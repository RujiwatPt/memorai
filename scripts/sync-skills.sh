#!/usr/bin/env bash
# Sync every skill in this repo into each desktop agent's skill directory.
#
# The repo is the single source of truth: skills/<name>/ is the real content,
# and each agent gets a symlink pointing at it. Edit here, commit here, and the
# change is live in all four agents at once — no copying, no drift.
#
#   sync-skills.sh              link (or relink) every skill into every agent
#   sync-skills.sh --check      verify only, change nothing; non-zero if broken
#   sync-skills.sh <name>       sync just one skill (e.g. standby)
#
# Idempotent. Never overwrites a real directory — only symlinks it manages.
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SKILLS_DIR="$REPO/skills"

CHECK=0
ONLY=""
for arg in "$@"; do
  case "$arg" in
    --check) CHECK=1 ;;
    -*)      echo "unknown flag: $arg" >&2; exit 2 ;;
    *)       ONLY="$arg" ;;
  esac
done

[ -d "$SKILLS_DIR" ] || { echo "✗ no skills/ directory in $REPO" >&2; exit 1; }

# label:target-skills-dir  (antigravity reads ~/.gemini, not ~/.antigravity)
TARGETS=(
  "claude:$HOME/.claude/skills"
  "codex:$HOME/.codex/skills"
  "antigravity:$HOME/.gemini/skills"
  "cursor:$HOME/.cursor/skills-cursor"
)

# Collect skills: any skills/<name>/SKILL.md
skills=()
for d in "$SKILLS_DIR"/*/; do
  name="$(basename "$d")"
  [ -f "$d/SKILL.md" ] || continue
  [ -n "$ONLY" ] && [ "$name" != "$ONLY" ] && continue
  skills+=("$name")
done

if [ ${#skills[@]} -eq 0 ]; then
  echo "✗ no skills found${ONLY:+ matching '$ONLY'} in $SKILLS_DIR" >&2
  exit 1
fi

[ "$CHECK" = 1 ] && echo "Checking ${#skills[@]} skill(s) from $SKILLS_DIR" \
                 || echo "Syncing ${#skills[@]} skill(s) from $SKILLS_DIR"

fail=0
for entry in "${TARGETS[@]}"; do
  label="${entry%%:*}"
  dir="${entry#*:}"

  if [ ! -d "$dir" ]; then
    printf '  %-12s skipped — %s does not exist\n' "$label" "$dir"
    continue
  fi

  for name in "${skills[@]}"; do
    src="$SKILLS_DIR/$name"
    link="$dir/$name"

    if [ "$CHECK" = 1 ]; then
      if [ -L "$link" ] && [ "$(readlink "$link")" = "$src" ] && [ -f "$link/SKILL.md" ]; then
        printf '  %-12s %-16s ok\n' "$label" "$name"
      elif [ -e "$link" ]; then
        printf '  %-12s %-16s STALE — points elsewhere or is not a link\n' "$label" "$name"
        fail=1
      else
        printf '  %-12s %-16s MISSING\n' "$label" "$name"
        fail=1
      fi
      continue
    fi

    if [ -L "$link" ]; then
      rm "$link"
    elif [ -e "$link" ]; then
      printf '  %-12s %-16s SKIPPED — real directory, not a link\n' "$label" "$name"
      fail=1
      continue
    fi

    ln -s "$src" "$link"
    printf '  %-12s %-16s linked\n' "$label" "$name"
  done
done

echo
if [ "$fail" != 0 ]; then
  echo "Finished with problems (see above)."
  exit 1
fi
[ "$CHECK" = 1 ] && echo "All good." || echo "Done. Restart each agent to pick up changes."
