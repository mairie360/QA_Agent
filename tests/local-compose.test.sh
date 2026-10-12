#!/usr/bin/env bash
# Valide la stack locale sans démon Docker: syntaxe, interpolation, services attendus, et cohérence avec le chart de Deploiment
# (chaque image de local/images.env est utilisée, les 5 APIs / 7 BFF / 8 fronts sont présents, aucun port d'API exposé).
set -euo pipefail
cd "$(dirname "$0")/../local"
export JWT_SECRET=test-secret-test-secret-test-secret-test
cfg="$(docker compose --project-directory . -f docker-compose.yml --env-file images.env --env-file .env.example config)"
fail=0
check() { if eval "$2"; then printf '  OK     %s\n' "$1"; else printf '  ECHEC  %s\n' "$1"; fail=1; fi; }

for s in core-api project-api calendar-api message-api elearning-api \
         user-bff project-bff calendar-bff message-bff dashboard-bff settings-bff elearning-bff \
         login-front project-front calendar-front message-front dashboard-front settings-front elearning-front admin-front \
         database liquibase redis mailpit traefik; do
  check "service $s" "grep -q '^  $s:\$' <<<\"\$cfg\""
done
check "toutes les images de images.env sont utilisées" \
  'while IFS== read -r k v; do case "$k" in \#*|"") continue;; esac; grep -q "image: $v\$" <<<"$cfg" || { echo "   manquante: $k"; exit 1; }; done < images.env'
check "JWT_SECRET refusé s'il manque" '! (unset JWT_SECRET; docker compose --project-directory . -f docker-compose.yml --env-file images.env --env-file .env.example config -q) 2>/dev/null'
check "seul user-bff reçoit JWT_SECRET parmi les BFF" \
  '[ "$(echo "$cfg" | python3 -c "import sys,yaml; d=yaml.safe_load(sys.stdin); print(sum(1 for n,s in d[\"services\"].items() if n.endswith(\"-bff\") and \"JWT_SECRET\" in s.get(\"environment\",{})))")" = "1" ]'
check "aucune API n'est publiée sur l'hôte" \
  '[ "$(echo "$cfg" | python3 -c "import sys,yaml; d=yaml.safe_load(sys.stdin); print(sum(1 for n,s in d[\"services\"].items() if n.endswith(\"-api\") and s.get(\"ports\")))")" = "0" ]'
check "base, Redis et Mailpit publiés sur 127.0.0.1 seulement" \
  '[ "$(echo "$cfg" | python3 -c "import sys,yaml; d=yaml.safe_load(sys.stdin); print(sum(1 for n in (\"database\",\"redis\",\"mailpit\") for p in d[\"services\"][n][\"ports\"] if p.get(\"host_ip\")!=\"127.0.0.1\"))")" = "0" ]'
check "chaque front a une route HTTPS" \
  '[ "$(grep -c "loadbalancer.server.port" <<<"$cfg")" -ge 9 ]'
check "profil storage absent par défaut" '! grep -q "^  minio:" <<<"$cfg"'
[ "$fail" = 0 ] && echo "Tout est OK" || { echo "$fail échec(s)"; exit 1; }
