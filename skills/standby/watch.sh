#!/usr/bin/env bash
# Notify when a Memorai handoff arrives, for agents with no idle scheduler.
# Read-only on the DB — it never claims or mutates a message; the agent does that.
#
#   watch.sh <agent_id> [interval_seconds]     default interval: 300 (5 min)
#
# Polling is a local SQLite read with no API cost, so a short interval is free.
#
# Messages addressed to you raise a desktop notification and are worth acting on.
# Broadcasts (to_agent = 'all') are informational by policy — they are listed,
# tagged FYI, and deliberately do NOT notify or ask you to start work.
# Ctrl-C to stop.
set -euo pipefail

AGENT="${1:-}"
INTERVAL="${2:-300}"
DB="${MEMORAI_DB:-$HOME/memorai/memorai.db}"
STATE_DIR="$HOME/.agents/state"
STATE="$STATE_DIR/standby-last-seen-$AGENT"

if [ -z "$AGENT" ]; then
  echo "usage: watch.sh <agent_id> [interval_seconds]" >&2
  echo "       agent_id ∈ claude | codex | cursor | antigravity" >&2
  exit 2
fi
[ -f "$DB" ] || { echo "✗ memorai db not found at $DB (set MEMORAI_DB)" >&2; exit 1; }
command -v sqlite3 >/dev/null || { echo "✗ sqlite3 not found" >&2; exit 1; }
mkdir -p "$STATE_DIR"

# Start from the current max id so we only report genuinely new arrivals.
if [ -f "$STATE" ]; then
  last=$(cat "$STATE")
else
  last=$(sqlite3 -readonly "$DB" "select coalesce(max(id),0) from messages;")
  echo "$last" > "$STATE"
fi

echo "standby watch · agent=$AGENT · every ${INTERVAL}s · from message id > $last"
echo "Ctrl-C to stop."

while true; do
  rows=$(sqlite3 -readonly -separator '|' "$DB" "
    select id, from_agent, to_agent, status, topic
    from messages
    where id > $last
      and (to_agent = '$AGENT' or to_agent = 'all')
      and status in ('UNREAD','ACTION_REQUIRED')
    order by id;")

  if [ -n "$rows" ]; then
    direct=$(printf '%s\n' "$rows" | awk -F'|' -v a="$AGENT" '$3 == a')
    bcast=$(printf '%s\n' "$rows"  | awk -F'|' -v a="$AGENT" '$3 != a')
    n_direct=$(printf '%s' "$direct" | grep -c . || true)

    printf '\n[%s]\n' "$(date '+%H:%M')"

    if [ -n "$direct" ]; then
      printf '  %s message(s) for you:\n' "$n_direct"
      printf '%s\n' "$direct" | while IFS='|' read -r id from to status topic; do
        printf '    #%-4s %-14s %-16s %s\n' "$id" "$from" "$status" "$topic"
      done
      echo "    → tell your agent to run its standby cycle."
    fi

    if [ -n "$bcast" ]; then
      printf '  broadcasts (FYI — not work, no action needed):\n'
      printf '%s\n' "$bcast" | while IFS='|' read -r id from to status topic; do
        printf '    #%-4s %-14s %-16s %s\n' "$id" "$from" "$status" "$topic"
        # ACTION_REQUIRED to 'all' violates the one-owner rule: every idle agent
        # sees it and each can claim it. Flag it; it needs a named owner.
        if [ "$status" = "ACTION_REQUIRED" ]; then
          printf '      ⚠ ACTION_REQUIRED sent to "all" — needs one named owner, not a broadcast.\n'
        fi
      done
    fi

    last=$(printf '%s\n' "$rows" | tail -1 | cut -d'|' -f1)
    echo "$last" > "$STATE"

    # Only messages addressed to you are worth interrupting for.
    if [ -n "$direct" ] && command -v osascript >/dev/null; then
      osascript -e "display notification \"$n_direct handoff(s) for $AGENT\" with title \"Memorai\"" 2>/dev/null || true
    fi
  fi

  sleep "$INTERVAL"
done
