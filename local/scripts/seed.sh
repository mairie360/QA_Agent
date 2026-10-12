#!/usr/bin/env bash
# Seed de l'agent de test sur la stack locale (comptes, rôles, groupes). Le seed appelle l'administration en HTTPS:
# Node doit faire confiance à l'autorité mkcert.
#   npm run local:seed            applique    |   bash local/scripts/seed.sh plan   voit sans écrire
set -euo pipefail
cd "$(dirname "$0")/../.."
if command -v mkcert >/dev/null; then export NODE_EXTRA_CA_CERTS="$(mkcert -CAROOT)/rootCA.pem"; fi
exec node seed/seed.mjs "${1:-apply}" --env local "${@:2}"
