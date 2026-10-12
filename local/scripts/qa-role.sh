#!/usr/bin/env bash
# Crée le rôle Postgres en lecture seule de l'agent de test dans la base locale (une fois).
# L'agent peut s'en passer: sans lui il écrit « non vérifié en base ».
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; . ./.env; set +a
DB="${DB_NAME:-mairie_db_local}"
C="bash scripts/compose.sh exec -T database psql -U postgres -d $DB"
if [ "$($C -tAc "SELECT 1 FROM pg_roles WHERE rolname='qa_readonly'")" = "1" ]; then
  echo "qa_readonly existe déjà."; exit 0
fi
$C -v dbname="$DB" -v pw="'qa_readonly_local'" -f - < ../sql/readonly-role.sql
echo "Rôle qa_readonly créé (mot de passe local: qa_readonly_local, déjà le défaut du profil « local »)."
