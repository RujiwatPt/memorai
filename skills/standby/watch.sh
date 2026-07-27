#!/usr/bin/env bash
# Notify when a Memorai handoff arrives, for agents with no idle scheduler.
# Read-only on the DB — it never claims or mutates a message; the agent does that.
#
#   watch.sh <agent_id> [interval_seconds] [--once]  default interval: 300 (5 min)
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
ONCE=0
DB="${MEMORAI_DB:-$HOME/memorai/memorai.db}"
STATE_DIR="$HOME/.agents/state"
STATE="$STATE_DIR/standby-last-seen-$AGENT"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RENDERER="$SCRIPT_DIR/render-watch-rows.mjs"

case "$AGENT" in
  claude|codex|cursor|antigravity) ;;
  *)
  echo "usage: watch.sh <agent_id> [interval_seconds] [--once]" >&2
  echo "       agent_id ∈ claude | codex | cursor | antigravity" >&2
  exit 2
  ;;
esac
[[ "$INTERVAL" =~ ^[1-9][0-9]*$ ]] || {
  echo "✗ interval_seconds must be a positive integer" >&2
  exit 2
}
if [ "${3:-}" = "--once" ]; then
  ONCE=1
elif [ -n "${3:-}" ]; then
  echo "✗ unknown option: $3" >&2
  exit 2
fi
[ -f "$DB" ] || { echo "✗ memorai db not found at $DB (set MEMORAI_DB)" >&2; exit 1; }
command -v sqlite3 >/dev/null || { echo "✗ sqlite3 not found" >&2; exit 1; }
command -v node >/dev/null || { echo "✗ node not found" >&2; exit 1; }
[ -f "$RENDERER" ] || { echo "✗ watcher renderer not found at $RENDERER" >&2; exit 1; }
mkdir -p "$STATE_DIR"

# Start from the current max id so we only report genuinely new arrivals.
if [ -f "$STATE" ]; then
  last=$(cat "$STATE")
else
  last=$(sqlite3 -readonly "$DB" "select coalesce(max(id),0) from messages;")
  echo "$last" > "$STATE"
fi
[[ "$last" =~ ^[0-9]+$ ]] || {
  echo "✗ invalid watcher state in $STATE" >&2
  exit 1
}

echo "standby watch · agent=$AGENT · every ${INTERVAL}s · from message id > $last"
echo "Ctrl-C to stop."

while true; do
  rows=$(sqlite3 -readonly -json "$DB" "
    select id, from_agent, to_agent, status, topic
    from messages
    where id > $last
      and (to_agent = '$AGENT' or to_agent = 'all')
      and status in ('UNREAD','ACTION_REQUIRED')
    order by id;")

  if [ -n "$rows" ] && [ "$rows" != "[]" ]; then
    n_direct=$(printf '%s' "$rows" | node "$RENDERER" "$AGENT" --direct-count)

    printf '\n[%s]\n' "$(date '+%H:%M')"
    printf '%s' "$rows" | node "$RENDERER" "$AGENT"

    last=$(printf '%s' "$rows" | node "$RENDERER" "$AGENT" --max-id)
    echo "$last" > "$STATE"

    # Only messages addressed to you are worth interrupting for.
    if [ "$n_direct" -gt 0 ] &&
       [ "${MEMORAI_DISABLE_NOTIFICATIONS:-0}" != 1 ] &&
       command -v osascript >/dev/null; then
      osascript -e "display notification \"$n_direct handoff(s) for $AGENT\" with title \"Memorai\"" 2>/dev/null || true
    fi
  fi

  [ "$ONCE" = 1 ] && break
  sleep "$INTERVAL"
done
