#!/usr/bin/env bash
# Materialize all 53 pinned Marketing Skills from the audited upstream submodule.
# Documentation only: this does not run the third-party skill scripts.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
git submodule update --init -- .agents/marketingskills
SOURCE=".agents/marketingskills/skills"
DEST=".agents/skills"
if [[ ! -d "$SOURCE" ]]; then
  echo "Missing Marketing Skills source. Ensure Git submodules are enabled." >&2
  exit 1
fi
count="$(find "$SOURCE" -mindepth 2 -maxdepth 2 -name SKILL.md -type f | wc -l | tr -d ' ')"
if [[ "$count" != "53" ]]; then
  echo "Expected 53 skills in pinned upstream, found $count. Check source revision before installing." >&2
  exit 1
fi
mkdir -p "$DEST"
installed=0
skipped=0
for dir in "$SOURCE"/*/; do
  name="$(basename "$dir")"
  if [[ -e "$DEST/$name" ]]; then
    echo "SKIP existing skill: $name"
    skipped=$((skipped + 1))
  else
    cp -R "$dir" "$DEST/$name"
    installed=$((installed + 1))
  fi
done
cp "$ROOT/.agents/marketingskills/LICENSE" "$DEST/LICENSE.marketingskills"
echo "Marketing Skills: source=$count installed=$installed skipped=$skipped."
echo "All original files are preserved in the pinned submodule; only missing skills were copied."
echo "Review third-party scripts before running them. No website deployment or ad campaign was triggered."
