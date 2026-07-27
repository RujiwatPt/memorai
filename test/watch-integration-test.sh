#!/usr/bin/env bash
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEST_DIR="$(mktemp -d)"
trap 'rm -rf "$TEST_DIR"' EXIT

TEST_HOME="$TEST_DIR/home"
TEST_DB="$TEST_DIR/watch.db"
STATE_DIR="$TEST_HOME/.agents/state"
mkdir -p "$STATE_DIR"
echo 0 > "$STATE_DIR/standby-last-seen-codex"

sqlite3 "$TEST_DB" "
  CREATE TABLE messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_agent TEXT NOT NULL,
    to_agent TEXT NOT NULL,
    topic TEXT NOT NULL,
    content TEXT NOT NULL,
    status TEXT NOT NULL
  );
  INSERT INTO messages (from_agent, to_agent, topic, content, status)
  VALUES (
    'cursor',
    'codex',
    'tab' || char(9) || 'line' || char(10) || 'pipe|',
    'test',
    'ACTION_REQUIRED'
  );
  INSERT INTO messages (from_agent, to_agent, topic, content, status)
  VALUES ('claude', 'all', 'broadcast|topic', 'test', 'UNREAD');
"

HOME="$TEST_HOME" \
MEMORAI_DB="$TEST_DB" \
MEMORAI_DISABLE_NOTIFICATIONS=1 \
bash "$REPO/skills/standby/watch.sh" codex 1 --once > "$TEST_DIR/watch.out"

grep -Fq '1 message(s) for you' "$TEST_DIR/watch.out"
grep -Fq 'tab\tline\npipe|' "$TEST_DIR/watch.out"
grep -Fq 'broadcast|topic' "$TEST_DIR/watch.out"
[ "$(cat "$STATE_DIR/standby-last-seen-codex")" = 2 ]

if HOME="$TEST_HOME" MEMORAI_DB="$TEST_DB" \
  bash "$REPO/skills/standby/watch.sh" "codex' OR 1=1 --" 1 --once >/dev/null 2>&1; then
  echo "expected invalid agent_id to be rejected" >&2
  exit 1
fi

if HOME="$TEST_HOME" MEMORAI_DB="$TEST_DB" \
  bash "$REPO/skills/standby/watch.sh" codex 0 --once >/dev/null 2>&1; then
  echo "expected invalid interval to be rejected" >&2
  exit 1
fi

echo "Standby watcher integration PASSED."
