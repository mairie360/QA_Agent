#!/usr/bin/env bash
# Docker Compose de la stack locale: ajoute les bons fichiers (et docker-compose.override.yml s'il existe).
#   bash local/scripts/compose.sh up -d
#   bash local/scripts/compose.sh --profile storage up -d
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f .env ] || { echo "local/.env absent: lancer npm run local:init" >&2; exit 1; }
[ -f images.env ] || { echo "local/images.env absent: lancer npm run local:sync-tags" >&2; exit 1; }
files=(-f docker-compose.yml)
[ -f docker-compose.override.yml ] && files+=(-f docker-compose.override.yml)
exec docker compose --project-directory . "${files[@]}" --env-file images.env --env-file .env "$@"
