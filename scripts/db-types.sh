#!/usr/bin/env bash
# Regenerates src/lib/supabase/database.types.ts from the linked project.
# Writes to a temp file first so a failed run never empties the real file.
set -euo pipefail
cd "$(dirname "$0")/.."
out=src/lib/supabase/database.types.ts
tmp=$(mktemp)
trap 'rm -f "$tmp"' EXIT
scripts/supabase.sh gen types typescript --linked --schema public > "$tmp"
if ! grep -q "export type Database" "$tmp"; then
  echo "Type generation produced no types; $out left unchanged." >&2
  exit 1
fi
mv "$tmp" "$out"
echo "Updated $out"
