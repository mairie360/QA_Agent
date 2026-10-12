#!/usr/bin/env bash
# Ouvre les accès locaux à la base et à Redis d'un environnement (ils ne sont pas exposés: NetworkPolicy).
# Optionnel: sans eux, l'agent travaille avec l'écran et les e-mails et écrit « non vérifié en base ».
#
#   ./scripts/port-forward.sh staging   Postgres -> 127.0.0.1:55432, Redis -> 127.0.0.1:55379
#   ./scripts/port-forward.sh dev       Postgres -> 127.0.0.1:56432, Redis -> 127.0.0.1:56379
#
# Les deux peuvent tourner en même temps (ports différents). Ctrl-C ferme les tunnels.
# Contexte kubectl: QA_KUBE_CONTEXT (dans .env.<env>), sinon le nom de l'environnement.
set -euo pipefail
cd "$(dirname "$0")/.."

ENV_NAME="${1:-${QA_ENV:-staging}}"
case "$ENV_NAME" in
  staging) NS=mairie360-staging; REL=staging; DB_PORT=55432; REDIS_PORT=55379 ;;
  dev)     NS=mairie360-dev;     REL=dev;     DB_PORT=56432; REDIS_PORT=56379 ;;
  *) echo "Environnement inconnu: $ENV_NAME (staging ou dev)" >&2; exit 1 ;;
esac

[ -f ".env" ] && set -a && . ./.env && set +a
[ -f ".env.${ENV_NAME}" ] && set -a && . "./.env.${ENV_NAME}" && set +a

CTX="${QA_KUBE_CONTEXT:-$ENV_NAME}"
K="kubectl --context ${CTX} -n ${NS}"

pids=()
trap 'kill "${pids[@]}" 2>/dev/null || true' EXIT INT TERM
$K port-forward "svc/${REL}-database" "${DB_PORT}:5432" & pids+=($!)
$K port-forward "svc/${REL}-redis" "${REDIS_PORT}:6379" & pids+=($!)
echo "[$ENV_NAME] Tunnels ouverts: Postgres :${DB_PORT}, Redis :${REDIS_PORT} (Ctrl-C pour fermer)"
wait
