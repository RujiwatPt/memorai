#!/usr/bin/env bash
# Inject the shared engineering standard into each agent's ALWAYS-ON instruction
# file, so the rules apply without the agent having to choose to load a skill.
#
# Installing a skill is not the same as applying it: a skill only activates when
# the model matches a request to its description. Rules like "verify before
# saying done" must be in context unconditionally — that is what this installs.
#
#   sync-agent-rules.sh          write / update the block in every target
#   sync-agent-rules.sh --check  verify only, change nothing; non-zero if stale
#   sync-agent-rules.sh --show   print the block and exit (e.g. to paste into Cursor)
#
# The block is delimited by markers, so re-running updates in place rather than
# appending duplicates. Content outside the markers is never touched.
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="$REPO/skills/dev-workflow/AGENT_RULES.md"
BEGIN="<!-- BEGIN dev-workflow standard — managed by scripts/sync-agent-rules.sh -->"
END="<!-- END dev-workflow standard -->"

MODE=sync
case "${1:-}" in
  --check) MODE=check ;;
  --show)  MODE=show ;;
  "")      ;;
  *)       echo "unknown flag: $1" >&2; exit 2 ;;
esac

[ -f "$SRC" ] || { echo "✗ missing $SRC" >&2; exit 1; }

block="$(printf '%s\n%s\n%s\n' "$BEGIN" "$(cat "$SRC")" "$END")"

if [ "$MODE" = show ]; then
  printf '%s\n' "$block"
  exit 0
fi

# label:always-on-instruction-file
TARGETS=(
  "claude:$HOME/.claude/CLAUDE.md"
  "codex:$HOME/.codex/AGENTS.md"
  "antigravity:$HOME/.gemini/GEMINI.md"
)

fail=0
for entry in "${TARGETS[@]}"; do
  label="${entry%%:*}"
  file="${entry#*:}"

  if [ "$MODE" = check ]; then
    if [ ! -f "$file" ]; then
      printf '  %-12s MISSING — %s does not exist\n' "$label" "${file/#$HOME/\~}"
      fail=1
    elif ! grep -qF "$BEGIN" "$file"; then
      printf '  %-12s NOT INSTALLED — no managed block in %s\n' "$label" "${file/#$HOME/\~}"
      fail=1
    elif [ "$(awk -v b="$BEGIN" -v e="$END" '$0==b{f=1} f{print} $0==e{f=0}' "$file")" = "$block" ]; then
      printf '  %-12s ok\n' "$label"
    else
      printf '  %-12s STALE — block differs from AGENT_RULES.md\n' "$label"
      fail=1
    fi
    continue
  fi

  mkdir -p "$(dirname "$file")"
  [ -f "$file" ] || : > "$file"

  if grep -qF "$BEGIN" "$file"; then
    # Replace between markers, preserving everything outside them.
    # The block is passed as a FILE, not via -v: awk cannot hold a multi-line
    # string in a -v assignment ("newline in string"), which silently breaks
    # every update after the first install.
    tmp="$(mktemp)"; blk="$(mktemp)"
    printf '%s\n' "$block" > "$blk"
    if awk -v b="$BEGIN" -v e="$END" -v f="$blk" '
         $0==b {while ((getline line < f) > 0) print line; close(f); skip=1; next}
         $0==e {skip=0; next}
         !skip {print}
       ' "$file" > "$tmp"; then
      mv "$tmp" "$file"
      printf '  %-12s updated  %s\n' "$label" "${file/#$HOME/\~}"
    else
      # Never mv a partial rewrite over the user's file.
      rm -f "$tmp" "$blk"
      printf '  %-12s FAILED — left %s untouched\n' "$label" "${file/#$HOME/\~}"
      fail=1
      continue
    fi
    rm -f "$blk"
  else
    # Append, keeping any pre-existing user content above.
    [ -s "$file" ] && printf '\n' >> "$file"
    printf '%s\n' "$block" >> "$file"
    printf '  %-12s installed %s\n' "$label" "${file/#$HOME/\~}"
  fi
done

echo
if [ "$fail" != 0 ]; then
  echo "Finished with problems (see above)."
  exit 1
fi

if [ "$MODE" = check ]; then
  echo "All good."
else
  cat <<'NOTE'
Done. Restart each agent to pick up the change.

Cursor has no file-based global rules — its user rules live in the app UI.
Paste the block into Cursor → Settings → Rules (User Rules):

    bash ~/memorai/scripts/sync-agent-rules.sh --show
NOTE
fi
