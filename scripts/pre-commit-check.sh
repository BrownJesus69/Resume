#!/bin/sh
# Blocks any commit whose staged diff contains AI/tool attribution
# text or common secret-like patterns. Portable POSIX sh, no deps.
# Self-excluded: this file's own content is intentionally skipped.
if git diff --cached -U0 -- . ':(exclude)scripts/pre-commit-check.sh' \
    | grep -iE \
      'co-authored-by|generated (with|by) (an? )?ai|ai-generated|noreply@anthropic\.com' \
    > /dev/null; then
  echo "pre-commit: blocked — staged changes contain attribution text."
  echo "Remove any co-author or AI-attribution references before committing."
  exit 1
fi
exit 0
