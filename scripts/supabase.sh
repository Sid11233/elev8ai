#!/usr/bin/env bash
# Runs the Supabase CLI with SUPABASE_ACCESS_TOKEN (and other vars) from .env.local,
# so CLI auth survives Codespace restarts. Usage: scripts/supabase.sh <cli args>
set -euo pipefail
cd "$(dirname "$0")/.."
if [ -f .env.local ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env.local
  set +a
fi
exec npx supabase "$@"
