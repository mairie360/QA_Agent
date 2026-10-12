# Mettre en place STAGING

**Usage recommandé:** les **missions** (persona + données à créer/modifier/supprimer + scénario), jouées par l'agent pour des retours d'usage reproductibles d'une version à l'autre.
Cible: `https://<front>.staging.mairie360-eip.fr` (8 fronts) — déployé par Argo CD depuis le dépôt Deploiment (`clusters/mairie360/instances/staging/values.yaml`).

## 1. Ce qu'il te faut

| Quoi | Où l'obtenir | Obligatoire |
|---|---|---|
| Node 20+, Claude Code (ou Codex) | ta machine | oui |
| Compte **administrateur** de staging (e-mail + mot de passe en clair) | l'e-mail: `kubectl --context <ctx> -n mairie360-staging get secret staging-database-secret -o jsonpath='{.data.ADMIN_EMAIL}' \| base64 -d`. Le **mot de passe n'est pas dans le cluster** (seul son hash argon2id y est): demande-le à celui qui a lancé `scripts/seal-secrets.sh` / le playbook Ansible | oui |
| **Boîte mail de test** réelle acceptant les alias `vous+qa-…@domaine` | Gmail et la plupart des hébergeurs | oui |
| Clé **Resend en accès complet** | tableau de bord Resend (une clé « envoi seul » ne relit pas les e-mails) | recommandée (sans elle l'agent ne voit pas les e-mails) |
| `kubectl` sur le cluster de staging, rôle SQL, mot de passe Redis | voir « Observer derrière l'écran » | facultatif |

Staging envoie ses e-mails par **Resend** (`smtp.resend.com`, expéditeur `noreply@mairie360-eip.fr`), y compris Keycloak: l'agent les relit via l'API Resend.

## 2. Installer

```bash
git clone git@github.com:mairie360/QA_Agent.git && cd QA_Agent
npm install
npx playwright install chromium        # ou PLAYWRIGHT_CHROMIUM_EXECUTABLE=<chemin>
npm test                               # sans réseau: « Tout est OK » partout (le dernier test demande le CLI Docker; sans Docker: npm run selftest) (le dernier test valide la stack locale et demande le CLI Docker; sans Docker: npm run selftest)
```

## 3. Configurer

```bash
cp .env.example .env                   # commun à tous les environnements
cp .env.staging.example .env.staging   # secrets de staging
```

`.env` (commun): `QA_ENV=staging`, `QA_MAILBOX=vous@domaine`, `RESEND_API_KEY=…`, éventuellement `QA_MAX_ACTIONS` (40 pour les premiers essais, 150 par défaut).

`.env.staging`:

| Variable | Valeur |
|---|---|
| `QA_ADMIN_EMAIL`, `QA_ADMIN_PASSWORD` | le compte administrateur ci-dessus. S'il n'a **jamais ouvert de session**, sa première connexion impose de changer le mot de passe: fais-le une fois à la main sur `https://login.staging.mairie360-eip.fr` et note le nouveau |
| `QA_SEED_PASSWORD` | mot de passe commun des comptes de seed, au choix (8 caractères minimum) |
| `QA_API_FRONT` | `admin` par défaut: le front dont l'hôte relaie `/bff/admin/*` (**sert au seed seulement**, l'agent n'appelle jamais d'API). À corriger si `seed:plan` échoue |
| `QA_DB_PASSWORD`, `QA_REDIS_PASSWORD`, `QA_KUBE_CONTEXT` | seulement pour l'observation (§ 6) |

Aucun fichier `.env*` n'est commité (`.gitignore`).

## 4. Vérifier la connexion

```bash
npm run doctor -- --env staging
```

Doit montrer les 8 fronts qui répondent (OK). Les lignes « ABSENT » concernent l'observation facultative: l'agent écrira « non vérifié en base » pour ce qu'elles couvrent.

## 5. Peupler (seed), puis première session

```bash
npm run seed:plan   -- --env staging   # lit seulement: ce qui serait créé
npm run seed:apply  -- --env staging   # 14 comptes, 5 groupes, 1 rôle; idempotent, additif, ne supprime rien
```

Ouvre ensuite l'écran d'administration et vérifie que comptes et groupes sont là, puis relance `seed:apply`: il ne doit rien créer de plus.
Le seed passe par les routes d'administration du BFF (vraies règles métier, miroir Keycloak). Ses comptes ont le mot de passe `QA_SEED_PASSWORD`, changement forcé à la première connexion;
`npm run seed:apply -- --env staging --reset-passwords` le remet.

Puis, avec Claude Code depuis la racine du dépôt:

> Joue la mission `missions/premiere-connexion.md` avec la persona `personas/nouvel-arrivant.md` sur staging.

Le résultat est dans `reports/<date>-staging-<id>/` (journal, captures, `rapport.md`). Relis-le (voir `docs/premier-lancement.md` § 6). Ne nettoie pas entre deux sessions: c'est voulu.

## 6. Observer derrière l'écran (facultatif)

La base et Redis de staging **ne sont pas exposés** (NetworkPolicy): on y accède par `kubectl port-forward`.

1. **Rôle Postgres en lecture seule** (une fois): la commande est en tête de `sql/readonly-role.sql`
   (`kubectl --context <ctx> -n mairie360-staging exec -i sts/staging-database -- psql -U postgres -d mairie_db_staging -v dbname=mairie_db_staging -v pw="'<mot de passe>'" -f - < sql/readonly-role.sql`).
   Ce rôle lit aussi les hash de mot de passe: staging doit rester peuplé de données fictives. Reporte le mot de passe dans `QA_DB_PASSWORD`.
2. **Mot de passe Redis** (compte `admin` du chart): `kubectl --context <ctx> -n mairie360-staging get secret staging-redis -o jsonpath='{.data.redis-password}' | base64 -d` → `QA_REDIS_PASSWORD`.
3. `QA_KUBE_CONTEXT=<ctx>` si le contexte kubectl ne s'appelle pas `staging`. Les kubeconfig des instances sont sur la machine Argo CD du groupe (voir le dépôt `ansible` / `Deploiment`).
4. Ouvre les tunnels: `./scripts/port-forward.sh staging` (Postgres 127.0.0.1:55432, Redis 127.0.0.1:55379), puis `npm run doctor -- --env staging`: « base en lecture seule » et « Redis » doivent passer.

## Particularités de staging

- **Limitation de débit** des routes de connexion (429): des échecs répétés bloquent l'adresse du testeur un moment. À savoir avant d'enchaîner beaucoup de sessions.
- **E-mails réels**: tout passe par Resend. Utilise toujours les alias de `QA_MAILBOX` (`run_alias`), jamais l'adresse d'un vrai agent.
- **Comptes supprimés = archivés**: l'adresse ne se réutilise pas, d'où un alias unique par session.
- **Données personnelles**: n'y mets que des données fictives (le rôle SQL lit les hash).
- **Contrôle d'accès**: l'agent a les droits de sa persona dans l'interface; c'est pour cela que staging doit rester un environnement de test.

## Dépannage

| Symptôme | Piste |
|---|---|
| `doctor`: un front en ECHEC | l'instance est peut-être en cours de déploiement; vérifier dans Argo CD |
| `seed:plan` → 401/403/404 sur `/bff/admin/...` | `QA_API_FRONT` faux, ou admin sans droit; essayer un autre front |
| `seed:plan` → « Connexion admin refusée » | `QA_ADMIN_*` faux, ou première connexion de l'admin pas encore faite (changement de mot de passe forcé) |
| L'agent ne se connecte pas avec un compte de seed | mot de passe changé par une session précédente: il doit le réinitialiser depuis l'administration (c'est dans ses consignes) |
| `mail_wait` ne trouve rien | clé Resend « envoi seul », alias non reçu, ou e-mail pas encore envoyé (délai de 90 s par défaut) |
| `doctor`: base « droits d'écriture » | le rôle utilisé n'est pas `qa_readonly`; refaire `sql/readonly-role.sql` |
| `port-forward` se coupe / ne se connecte pas | contexte kubectl faux, ou NetworkPolicy; vérifier `kubectl --context <ctx> -n mairie360-staging get svc` |
