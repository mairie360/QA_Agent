# Mettre en place LOCAL

**Usage recommandé:** développer avec **toute la plateforme** sur ta machine (24 conteneurs), et y brancher l'agent de test quand tu veux vérifier ce que tu viens de coder, sans dépendre de dev ni de staging, sans rien envoyer à l'extérieur.
Le détail de la stack (services, commandes, développer un seul service, limites connues) est dans **`local/README.md`**; ce document décrit la mise en place de bout en bout.

## 1. Ce qu'il te faut

| Quoi | Remarque | Obligatoire |
|---|---|---|
| Docker avec Compose v2, ~4 Go de mémoire libres | la stack complète tourne en ~3 Go sur la machine de dev | oui |
| Ports **80 et 443** libres | sinon changer `HTTP_PORT` / `HTTPS_PORT` dans `local/.env` (déconseillé: les cookies partagés supposent 443) | oui |
| **mkcert** | certificat HTTPS de confiance: les fronts posent des cookies `Secure`. Sans lui: certificat auto-signé et avertissements | fortement recommandé (obligatoire pour l'agent) |
| Accès aux images `ghcr.io/mairie360/*` | si elles sont privées: `echo $GHCR_TOKEN \| docker login ghcr.io -u <utilisateur> --password-stdin` (jeton `read:packages`) | oui |
| Node 20+, Claude Code (ou Codex) | pour l'agent de test | pour l'agent |

**Pas besoin** de compte administrateur à demander, de `kubectl`, de clé Resend ni de boîte mail réelle: l'administrateur est celui du modèle de la migration et les e-mails restent dans Mailpit.

## 2. Démarrer la stack

```bash
git clone git@github.com:mairie360/QA_Agent.git && cd QA_Agent
npm install
npm run local:init       # local/.env (JWT_SECRET aléatoire), certificat mkcert, vérifie l'accès aux images
npm run local:up         # démarre tout (1re fois: téléchargement des images)
npm run local:ps         # tout doit être « running » (liquibase: « exited (0) » = migrations faites)
```

| Quoi | Où |
|---|---|
| Connexion | `https://login.mairie360.localtest.me` — `admin@example.invalid` / `password_template` |
| Autres fronts | `dashboard.`, `project.`, `calendar.`, `message.`, `settings.`, `elearning.`, `admin.` + `.mairie360.localtest.me` |
| E-mails de l'app | `https://mail.mairie360.localtest.me` (Mailpit) |
| Base / Redis | `127.0.0.1:57432` (`postgres` / `password`, base `mairie_db_local`) / `127.0.0.1:57379` |

`*.localtest.me` pointe vers 127.0.0.1 par le DNS public: pas de `/etc/hosts` à modifier. Si quelque chose ne démarre pas: `npm run local:logs`.

## 3. Développer un service avec ton code

```bash
cp local/docker-compose.override.example.yml local/docker-compose.override.yml   # adapter les chemins vers tes dépôts
npm run local:up -- --build
```

Un seul service est remplacé par ton build (rechargement à chaud pour Core API); les 23 autres restent les images de dev. Rafraîchir les étiquettes d'image: `npm run local:sync-tags`. Repartir d'une base vierge: `npm run local:reset`.

## 4. Brancher l'agent de test

```bash
cp .env.example .env     # une fois; QA_ENV=local si c'est ton environnement habituel
npm run local:seed       # comptes, rôles, groupes du seed dans la base locale (mêmes que staging/dev)
npm run local:qa-role    # facultatif: rôle SQL en lecture seule, pour que l'agent voie « derrière l'écran »
npm run doctor -- --env local
```

L'environnement `local` n'a besoin d'**aucun** `.env.local` : ses valeurs par défaut sont dans le code (administrateur du modèle, mot de passe de seed, boîte `qa@mairie360.local`, base `127.0.0.1:57432`, Mailpit `127.0.0.1:58025`, Redis sans mot de passe).
`mkcert -install` doit avoir été fait pour que le navigateur de l'agent et le seed fassent confiance au certificat.

Puis, avec Claude Code depuis la racine du dépôt:

> Teste en local: …  *(décris la fonctionnalité que tu viens de coder)*

ou une mission: « Joue `missions/creer-un-compte-agent.md` avec `personas/administrateur.md` en local ». L'agent lit les e-mails dans Mailpit, la base et Redis directement, sans `kubectl`.

## Particularités du local

- **Redis sans ACL** et **rôles d'API à mot de passe fixe**: volontaire; les clés ne sont pas préfixées par rôle comme dans le cluster.
- **Limitation de débit coupée** (`RATE_LIMIT_ENABLED=false`) pour ne pas se bloquer en développant.
- **Keycloak non inclus**: la connexion SSO répond 503, le mot de passe fonctionne.
- **Pièces jointes e-learning**: l'API démarre, mais sans stockage (profil `--profile storage` optionnel, images non vérifiées).
- Cette stack a été écrite et validée **statiquement**; aucun conteneur n'a été démarré lors de sa conception. Le premier `npm run local:up` dira ce qui reste à ajuster.

## Dépannage

| Symptôme | Piste |
|---|---|
| `local:init`: images non accessibles | `docker login ghcr.io` (jeton `read:packages`) |
| `local:up` bloque sur `liquibase` | `npm run local:logs`: la migration échoue (chemin de recherche, base pas prête) |
| « Bind for 0.0.0.0:443 failed » | un autre programme occupe 80/443 (autre Traefik, nginx, Docker Desktop) |
| Avertissement de certificat dans le navigateur | mkcert absent ou `mkcert -install` non fait: supprimer `local/certs/`, installer mkcert, relancer `local:init` |
| Connexion qui boucle | cookies `Secure` refusés: HTTPS non de confiance, ou domaine différent de `LOCAL_DOMAIN` |
| `seed` : erreur de certificat Node | `mkcert` absent: `export NODE_EXTRA_CA_CERTS=<chemin du rootCA.pem de mkcert>` |
| L'agent ne voit pas la base | `npm run local:qa-role` pas lancé |
| Un service redémarre en boucle | `bash local/scripts/compose.sh logs <service>`; vérifier `local/.env` (JWT_SECRET de 32 caractères minimum) |
