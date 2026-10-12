# Mettre en place DEV

**Usage recommandé:** le **mode accompagné** — tu décris en discutant une fonctionnalité en cours de développement, l'agent la vérifie lui-même par l'interface et te rend compte
(`docs/verifier-une-fonctionnalite.md`). Les missions fonctionnent aussi.
Cible: `https://<front>.dev.mairie360-eip.fr` (8 fronts) — déployé par Argo CD depuis Deploiment (`clusters/mairie360/instances/dev/values.yaml`), étiquettes d'image `dev-<sha>` mises à jour automatiquement.

## 1. Ce qu'il te faut

| Quoi | Où l'obtenir | Obligatoire |
|---|---|---|
| Node 20+, Claude Code (ou Codex) | ta machine | oui |
| Compte **administrateur** de dev (e-mail + mot de passe en clair) | l'e-mail: `kubectl --context <ctx> -n mairie360-dev get secret dev-database-secret -o jsonpath='{.data.ADMIN_EMAIL}' \| base64 -d`. Le **mot de passe n'est pas dans le cluster** (seul son hash argon2id y est): demande-le à celui qui a provisionné l'instance | oui |
| **Boîte mail de test** réelle acceptant les alias `vous+qa-…@domaine` | Gmail et la plupart des hébergeurs | oui |
| Clé **Resend en accès complet** | tableau de bord Resend (dev envoie aussi par Resend, domaine `mairie360-eip.fr`) | recommandée |
| `kubectl` sur le cluster de dev, rôle SQL, mot de passe Redis | voir « Observer derrière l'écran » | facultatif |

## 2. Installer

```bash
git clone git@github.com:mairie360/QA_Agent.git && cd QA_Agent
npm install
npx playwright install chromium
npm test                               # sans réseau: « Tout est OK » partout (le dernier test demande le CLI Docker; sans Docker: npm run selftest)
```

## 3. Configurer

```bash
cp .env.example .env                   # commun: QA_ENV, QA_MAILBOX, RESEND_API_KEY
cp .env.dev.example .env.dev           # secrets de dev
```

Dans `.env`, mets `QA_ENV=dev` si dev est ton environnement habituel; sinon tu peux le choisir dans la demande (« teste sur dev »), sans redémarrer.
`.env.dev` a les mêmes variables que `.env.staging` (voir `docs/setup-staging.md` § 3): `QA_ADMIN_EMAIL`, `QA_ADMIN_PASSWORD` (si l'admin n'a jamais ouvert de session, fais d'abord le changement de mot de passe forcé à la main sur `https://login.dev.mairie360-eip.fr`),
`QA_SEED_PASSWORD`, `QA_API_FRONT` (`admin` par défaut, seed seulement), et pour l'observation `QA_DB_PASSWORD`, `QA_REDIS_PASSWORD`, `QA_KUBE_CONTEXT`.

## 4. Vérifier, peupler

```bash
npm run doctor      -- --env dev
npm run seed:plan   -- --env dev
npm run seed:apply  -- --env dev     # 14 comptes, 5 groupes, 1 rôle; idempotent, additif, ne supprime rien
```

Les comptes du seed de dev sont indépendants de ceux de staging (mêmes clés, instances séparées). Relis le résultat dans l'écran d'administration, puis relance `seed:apply`: rien de plus ne doit être créé.

## 5. Première conversation

Avec Claude Code depuis la racine du dépôt:

> Teste sur dev: les responsables peuvent maintenant ajouter un membre à un groupe depuis la fiche de l'agent. Un agent simple ne doit pas voir ce bouton.

L'agent annonce l'environnement, reformule la demande et ses critères d'acceptation, pose au plus trois questions **si elles bloquent**, joue les cas (nominal, saisies invalides, droits, état de l'instance, retour arrière, voisinage), puis répond avec un verdict.
Tu peux ensuite lui dire « creuse le cas 4 », « réessaie avec un compte Guest », « j'ai corrigé, retente ». Rapport: `reports/<date>-dev-<id>/rapport.md`.

Pour aider l'agent: donne-lui **où se trouve** la fonction, **qui y a droit**, **le comportement attendu** (texte du ticket ou de la PR) et ce qui t'inquiète. Détail: `docs/verifier-une-fonctionnalite.md`.

## 6. Observer derrière l'écran (facultatif)

Base et Redis de dev ne sont pas exposés: `kubectl port-forward`.

1. Rôle Postgres en lecture seule (une fois), commande en tête de `sql/readonly-role.sql` avec la variante dev
   (`-n mairie360-dev exec -i sts/dev-database -- psql -U postgres -d mairie_db_dev -v dbname=mairie_db_dev -v pw="'<mot de passe>'" -f - < sql/readonly-role.sql`) → `QA_DB_PASSWORD`.
2. Mot de passe Redis: `kubectl --context <ctx> -n mairie360-dev get secret dev-redis -o jsonpath='{.data.redis-password}' | base64 -d` → `QA_REDIS_PASSWORD`.
3. `./scripts/port-forward.sh dev` (Postgres 127.0.0.1:56432, Redis 127.0.0.1:56379 — ports différents de staging: les deux tunnels peuvent tourner ensemble), puis `npm run doctor -- --env dev`.

## Particularités de dev

- **Fonction « introuvable »**: très souvent l'image n'est pas encore déployée. Vérifie le tag `dev-<sha>` du service concerné dans Deploiment (`clusters/mairie360/instances/dev/values.yaml`) et l'état de l'application dans Argo CD avant de chercher un bug.
- **Machine de 4 Go sans marge** (voir les limites mémoire dans Deploiment): une seule session à la fois, pas d'agents en parallèle.
- **Instance instable par nature**: des restes de sessions et des données de développeurs y traînent. C'est prévu: l'agent observe l'état avant d'agir et ne supprime que ce qu'il a créé.
- Mêmes particularités qu'en staging pour la limitation de débit, Resend, les comptes archivés et les données fictives (`docs/setup-staging.md`).

## Dépannage

Voir le tableau de `docs/setup-staging.md` (mêmes symptômes, avec `--env dev` et le namespace `mairie360-dev`). En plus:

| Symptôme | Piste |
|---|---|
| Le front répond 502/503 juste après un déploiement | Argo CD synchronise encore; attendre ou consulter l'application `dev` |
| Contexte `kubectl` inconnu | les kubeconfig des instances sont sur la machine Argo CD du groupe; `QA_KUBE_CONTEXT` doit porter le nom de ton contexte local |
