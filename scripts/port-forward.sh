#!/usr/bin/env bash
# Ouvre les accès locaux à la base et à Redis de staging (ils ne sont pas exposés: NetworkPolicy).
# Optionnel: sans eux, l'agent travaille avec l'écran et les e-mails seulement et écrit « non vérifié en base ».
#
#   ./scripts/port-forward.sh     Postgres -> 127.0.0.1:55432, Redis -> 127.0.0.1:55379 (Ctrl-C pour fermer)
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f .env ] && set -a && . ./.env && set +a

CTX="${QA_KUBE_CONTEXT:?QA_KUBE_CONTEXT manquant}"
NS="${QA_NAMESPACE:-mairie360-staging}"
REL="${QA_RELEASE:-staging}"
K="kubectl --context ${CTX} -n ${NS}"

pids=()
trap 'kill "${pids[@]}" 2>/dev/null || true' EXIT INT TERM
$K port-forward "svc/${REL}-database" 55432:5432 & pids+=($!)
$K port-forward "svc/${REL}-redis" 55379:6379 & pids+=($!)
echo "Tunnels ouverts: Postgres :55432, Redis :55379 (Ctrl-C pour fermer)"
wait
