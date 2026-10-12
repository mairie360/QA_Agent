# Stack locale — toute la plateforme sur ta machine

`docker compose` avec **tout**: Postgres + migrations, Redis, Mailpit (e-mails), 5 APIs, 7 BFF, 8 fronts, derrière Traefik en HTTPS.
Les images sont celles **déployées sur dev**; tu remplaces seulement le service que tu développes par ton code (voir plus bas).
C'est la même configuration que le chart de Deploiment (mêmes variables, mêmes ports), avec quelques écarts volontaires signalés « LOCAL » dans `docker-compose.yml`.

## Démarrer

Prérequis: Docker avec Compose v2, ~4 Go de mémoire libre, [mkcert](https://github.com/FiloSottile/mkcert) (recommandé, pour un HTTPS de confiance), accès aux images `ghcr.io/mairie360/*`.

```bash
npm install
npm run local:init     # local/.env (JWT_SECRET aléatoire), certificat HTTPS, vérifie l'accès aux images
npm run local:up       # démarre tout; la 1re fois: téléchargement des images
npm run local:ps       # état des services
```

Si les images ne se téléchargent pas: `echo $GHCR_TOKEN | docker login ghcr.io -u <utilisateur> --password-stdin` (jeton avec `read:packages`).

| Quoi | Où |
|---|---|
| Connexion | https://login.mairie360.localtest.me — administrateur du modèle: `admin@example.invalid` / `password_template` |
| Autres fronts | `dashboard.`, `project.`, `calendar.`, `message.`, `settings.`, `elearning.`, `admin.` + `.mairie360.localtest.me` |
| E-mails de l'app | https://mail.mairie360.localtest.me (Mailpit: rien ne sort de ta machine) |
| Base | `127.0.0.1:57432`, base `mairie_db_local`, utilisateur `postgres` / `password` |
| Redis | `127.0.0.1:57379` (sans mot de passe) |

`*.localtest.me` pointe vers 127.0.0.1 par le DNS public: rien à ajouter dans `/etc/hosts`. Les cookies de session sont posés sur `.mairie360.localtest.me`, partagés entre les fronts, et marqués `Secure`:
c'est pour cela qu'il faut du **HTTPS** même en local.

## Développer un service avec ton code

```bash
cp local/docker-compose.override.example.yml local/docker-compose.override.yml   # puis adapter les chemins
npm run local:up -- --build        # le service remplacé est construit depuis ton dépôt; les autres restent des images
```

L'exemple remplace `core-api` par le build de développement de `Core_API` (avec rechargement à chaud). Un front demande `NODE_AUTH_TOKEN` (paquets `@mairie360/*` sur GitHub Packages).
Le fichier `docker-compose.override.yml` est ignoré par git.

## Commandes

| Commande | Effet |
|---|---|
| `npm run local:up` / `local:down` | démarre / arrête (les données restent) |
| `npm run local:reset` | arrête **et supprime la base** : repart d'une instance vierge |
| `npm run local:logs` | journaux de tous les services |
| `npm run local:sync-tags` | met `images.env` à jour d'après Deploiment (`-- --env staging` pour les étiquettes de staging) |
| `bash local/scripts/compose.sh <args>` | n'importe quelle commande `docker compose` de la stack (ex. `--profile storage up -d`, `exec database psql …`) |

## Y brancher l'agent de test

Même agent, même missions, environnement `local`. Dans `.env` (racine du dépôt) ou dans la demande: `QA_ENV=local` / « teste en local ».

```bash
npm run local:seed         # comptes, rôles et groupes du seed dans la base locale
npm run local:qa-role      # (facultatif) rôle SQL en lecture seule pour que l'agent voie « derrière l'écran »
npm run doctor -- --env local
```

L'agent lit les e-mails dans Mailpit (pas de Resend), la base sur `127.0.0.1:57432`, Redis sur `57379`, sans `kubectl` ni `port-forward`.
Pour que le navigateur de l'agent et le seed fassent confiance au certificat, il faut **mkcert** (`mkcert -install`): sinon l'agent verra des erreurs de certificat.

## Limites connues (non vérifiées, à confirmer au premier lancement)

Cette stack a été écrite et validée **statiquement** (`npm test` → `tests/local-compose.test.sh`: syntaxe, interpolation, services, cohérence avec les images de dev). Aucune image n'a été démarrée.

- **Keycloak n'est pas inclus** : la connexion SSO répond 503 (« non configuré ») et seule la connexion par mot de passe fonctionne, comme le prévoit l'app.
- **Pièces jointes e-learning** : l'API démarre (variables S3 posées) mais le stockage n'existe pas. Le profil `--profile storage` ajoute MinIO, avec des images par défaut **non vérifiées** (`MINIO_IMAGE`, `MC_IMAGE` dans `local/.env`); les URL signées pointent vers le réseau Docker, donc le navigateur ne les atteint pas tel quel.
- **Appels serveur à serveur vers l'URL publique** (par exemple un front qui appellerait `https://login.mairie360.localtest.me` depuis son conteneur) : le nom résout vers 127.0.0.1 *dans* le conteneur. Si un service en a besoin, il faudra des alias réseau Traefik et la confiance du certificat.
- **Redis sans ACL** et **rôles d'API avec un mot de passe fixe** : volontaire en local; les clés ne sont pas préfixées par rôle comme dans le cluster.
- **Migrations** : lancées comme dans le chart (`LIQUIBASE_SEARCH_PATH=/migrations`). Si une version de l'image de migration exige un autre chemin, `npm run local:logs` le dit (service `liquibase`).
- **Ports 80/443 déjà pris** : changer `HTTP_PORT` / `HTTPS_PORT` dans `local/.env`; si 443 n'est pas utilisé, les URL des fronts doivent porter le port, ce qui casse les cookies partagés — préférer libérer 443.
- **Étiquettes** : celles de dev à la date de génération. `npm run local:sync-tags` pour les rafraîchir (dépôt Deploiment public).
