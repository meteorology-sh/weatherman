#!/usr/bin/env bash
# Format one file with Prettier, given a Claude Code hook payload on stdin.
#
# Wired to PostToolUse in .claude/settings.json so an edit is formatted the
# moment it lands, the same as an editor formatting on save. Without it the
# formatting happens later, by hand, as a separate pass over files that were
# already reviewed.
#
# **It is a script rather than a one-liner in settings.json for two reasons**,
# and both were found by testing rather than assumed:
#
#   - `jq` is not installed on this machine, so the usual `jq -r .tool_input…`
#     recipe extracts nothing. Node is guaranteed present here — it is what the
#     project runs on — so the payload is read with that instead.
#   - A hook that extracts no path must do **nothing**. Piping an empty string
#     into `prettier --write` does not error: it formats the entire repository.
#     That is the failure this script's one guard exists to prevent, and it is
#     silent enough that it happened while this hook was being written.
#
# Never blocks the edit: any failure here exits 0, because a formatter that can
# refuse a tool call is a formatter that can wedge the session.
set -uo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# The path Claude just wrote. `tool_response.filePath` is what Edit reports;
# `tool_input.file_path` is the fallback for tools that do not echo it back.
file="$(
  node -e '
    let s = "";
    process.stdin.on("data", (d) => (s += d)).on("end", () => {
      try {
        const p = JSON.parse(s);
        const f = p?.tool_response?.filePath || p?.tool_input?.file_path;
        if (f) console.log(f);
      } catch {}
    })
  ' 2>/dev/null
)"

# The guard. No path means no work — see above for what the alternative does.
[ -n "$file" ] || exit 0
[ -f "$file" ] || exit 0

# Prettier is a devDependency of both packages; either copy will do, and the
# config it finds is the repo-root .prettierrc.yaml either way.
for candidate in \
  "$root/app/node_modules/.bin/prettier" \
  "$root/server/node_modules/.bin/prettier"; do
  if [ -x "$candidate" ]; then
    # --ignore-unknown so a file Prettier has no parser for is skipped rather
    # than reported as an error on every edit.
    "$candidate" --ignore-unknown --write "$file" >/dev/null 2>&1
    exit 0
  fi
done

exit 0
