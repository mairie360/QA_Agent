#!/usr/bin/env bash
# Prépare la stack locale (idempotent): local/.env avec un JWT_SECRET aléatoire, certificat HTTPS, images.
#   npm run local:init
set -euo pipefail
cd "$(dirname "$0")/.."

ok()   { printf '  \033[32mOK\033[0m   %s\n' "$1"; }
warn() { printf '  \033[33mA FAIRE\033[0m %s\n' "$1"; }

command -v docker >/dev/null || { echo "docker est requis" >&2; exit 1; }
docker compose version >/dev/null 2>&1 || { echo "Docker Compose v2 est requis" >&2; exit 1; }

# 1. .env
if [ ! -f .env ]; then
  cp .env.example .env
  secret="$(openssl rand -hex 32)"
  sed -i.bak "s|^JWT_SECRET=.*|JWT_SECRET=${secret}|" .env && rm -f .env.bak
  ok ".env créé avec un JWT_SECRET aléatoire"
else
  grep -q '^JWT_SECRET=.\{32,\}' .env || { warn "JWT_SECRET absent ou trop court dans local/.env (32 caractères minimum)"; }
  ok ".env déjà présent"
fi
set -a; . ./.env; set +a
DOMAIN="${LOCAL_DOMAIN:-mairie360.localtest.me}"

# 2. Images
if [ ! -f images.env ]; then node scripts/sync-tags.mjs; fi
ok "images.env présent ($(grep -c '_IMAGE=' images.env) images)"

# 3. Certificat HTTPS (les fronts posent des cookies Secure: il faut HTTPS même en local)
mkdir -p certs
if [ ! -f certs/local.pem ]; then
  if command -v mkcert >/dev/null; then
    mkcert -install >/dev/null 2>&1 || true
    mkcert -cert-file certs/local.pem -key-file certs/local-key.pem "$DOMAIN" "*.$DOMAIN" >/dev/null
    ok "certificat mkcert créé pour *.$DOMAIN (autorité installée dans le navigateur)"
  else
    openssl req -x509 -newkey rsa:2048 -nodes -days 365 -keyout certs/local-key.pem -out certs/local.pem \
      -subj "/CN=$DOMAIN" -addext "subjectAltName=DNS:$DOMAIN,DNS:*.$DOMAIN" >/dev/null 2>&1
    warn "mkcert absent: certificat AUTO-SIGNÉ créé. Le navigateur affichera un avertissement par hôte; installer mkcert (https://github.com/FiloSottile/mkcert), supprimer local/certs/ et relancer."
  fi
else
  ok "certificat présent (local/certs/)"
fi

# 4. Accès aux images
if docker manifest inspect "$(grep '^CORE_API_IMAGE=' images.env | cut -d= -f2)" >/dev/null 2>&1; then
  ok "images accessibles sur ghcr.io"
else
  warn "images ghcr.io non accessibles: se connecter (echo \$GHCR_TOKEN | docker login ghcr.io -u <utilisateur> --password-stdin, jeton avec read:packages)"
fi

cat <<MSG

Suite:
  npm run local:up        démarre toute la stack (première fois: quelques minutes de téléchargement)
  https://login.$DOMAIN   page de connexion — admin: admin@example.invalid / password_template
  https://mail.$DOMAIN    boîte Mailpit (tous les e-mails de l'app arrivent ici)
MSG
