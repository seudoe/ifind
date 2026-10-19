#!/usr/bin/env bash
# Upsert env vars into the linked Vercel project (production).
# Input: ENV_LOCAL (contents of .env.local), PROJECT_IDENTITY. Needs VERCEL_TOKEN/ORG_ID/PROJECT_ID.
set -euo pipefail

push() {
  printf '%s' "$2" | vercel env add "$1" production --force --token "$VERCEL_TOKEN" >/dev/null
  echo "set $1"
}

while IFS= read -r line || [ -n "$line" ]; do
  line="${line%$'\r'}"
  [[ "$line" =~ ^[[:space:]]*# || -z "${line//[[:space:]]/}" || "$line" != *=* ]] && continue
  key="${line%%=*}"; val="${line#*=}"
  key="${key//[[:space:]]/}"
  val="${val%\"}"; val="${val#\"}"; val="${val%\'}"; val="${val#\'}"
  [ -z "$val" ] && continue
  push "$key" "$val"
done <<< "$ENV_LOCAL"

push PROJECT_IDENTITY "$PROJECT_IDENTITY"
