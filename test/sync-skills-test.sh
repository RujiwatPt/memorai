#!/usr/bin/env bash
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEST_HOME="$(mktemp -d)"
trap 'rm -rf "$TEST_HOME"' EXIT

targets=(
  "$TEST_HOME/.claude/skills"
  "$TEST_HOME/.codex/skills"
  "$TEST_HOME/.gemini/skills"
  "$TEST_HOME/.cursor/skills-cursor"
)
skills=(dev-workflow memorai standby)

for target in "${targets[@]}"; do
  mkdir -p "$target"
  for skill in "${skills[@]}"; do
    ln -s "$REPO/skills/$skill" "$target/$skill"
  done
done

HOME="$TEST_HOME" bash "$REPO/scripts/sync-skills.sh" --check >/dev/null

broken_link="$TEST_HOME/.codex/skills/standby"
rm "$broken_link"
ln -s "$TEST_HOME/missing-standby" "$broken_link"

if HOME="$TEST_HOME" bash "$REPO/scripts/sync-skills.sh" --check >"$TEST_HOME/check.out" 2>&1; then
  echo "expected --check to reject a broken stale symlink" >&2
  exit 1
fi
grep -Eq 'codex +standby +STALE' "$TEST_HOME/check.out"

before="$(readlink "$broken_link")"
if HOME="$TEST_HOME" bash "$REPO/scripts/sync-skills.sh" standby >"$TEST_HOME/sync.out" 2>&1; then
  echo "expected sync to refuse an unmanaged stale symlink" >&2
  exit 1
fi
after="$(readlink "$broken_link")"
[ "$before" = "$after" ]
grep -Eq 'codex +standby +SKIPPED.+symlink points to' "$TEST_HOME/sync.out"

rm "$broken_link"
mkdir "$broken_link"
if HOME="$TEST_HOME" bash "$REPO/scripts/sync-skills.sh" standby >"$TEST_HOME/real-dir.out" 2>&1; then
  echo "expected sync to refuse a real directory" >&2
  exit 1
fi
[ -d "$broken_link" ] && [ ! -L "$broken_link" ]
grep -Eq 'codex +standby +SKIPPED.+real directory' "$TEST_HOME/real-dir.out"

echo "Skill sync safety regressions PASSED."
