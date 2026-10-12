# Premier lancement — check-list

À suivre dans l'ordre: chaque étape suppose les précédentes. Cocher au fur et à mesure.
Tout se fait d'abord sur **un** environnement (`staging`, `dev` ou `local`, voir `.env.example`); les autres se branchent ensuite de la même façon.
**En local**, commence par `local/README.md` (`npm run local:init`, `npm run local:up`, `npm run local:seed`): pas de compte à demander ni de `kubectl`, mais il faut Docker, mkcert et l'accès aux images.

## 1. Préparer les accès (une fois)

- [ ] Un **compte admin de base** sur l'environnement, avec son mot de passe.
- [ ] Une **boîte mail de test réelle** qui accepte les alias `vous+qa-…@domaine` (Gmail et la plupart des hébergeurs le font).
- [ ] Une **clé Resend en accès complet** (une clé « envoi seul » ne peut pas relire les e-mails). Staging et dev envoient tous deux par Resend.
- [ ] *(Optionnel, à ajouter plus tard)* l'observation « derrière l'écran »: un `kubectl` qui atteint le cluster, le rôle SQL en lecture seule (`sql/readonly-role.sql`),
      le mot de passe Redis du compte `admin` du chart. Sans cela l'agent écrit « non vérifié en base » et reste utile.

## 2. Installer et vérifier hors réseau

```bash
npm install
npx playwright install chromium
cp .env.example .env                       # commun: QA_ENV, QA_MAILBOX, RESEND_API_KEY
cp .env.staging.example .env.staging       # (et/ou .env.dev.example → .env.dev) admin, mot de passe du seed
npm run selftest                           # doit finir par « Tout est OK »
node tests/seed.test.mjs                   # idem
```

- [ ] `npm run selftest` OK
- [ ] `node tests/seed.test.mjs` OK

## 3. Vérifier la connexion à l'environnement

- [ ] `npm run doctor` (ou `npm run doctor -- --env dev`): les 8 fronts répondent. C'est la première fois que le code touche le vrai environnement; les écarts apparaissent ici.

## 4. Le seed

- [ ] `npm run seed:plan` (ajouter `-- --env dev` pour dev). S'il échoue sur `/bff/admin/...`, `QA_API_FRONT` est probablement faux: essayer les autres fronts.
- [ ] Relire: 14 comptes, 5 groupes, 1 rôle seraient créés.
- [ ] `npm run seed:apply`, puis **ouvrir l'écran d'administration** et vérifier que comptes et groupes existent.
- [ ] Relancer `npm run seed:apply`: il ne doit **rien** créer de plus.
- [ ] Vérifier que l'alias avec `+` est accepté par Core **et** par Keycloak (le miroir d'administration crée aussi les comptes côté Keycloak), et que le téléphone du compte `urbanisme-1` est bien enregistré.

## 5. Premières sessions, petit budget

Dans `.env`, `QA_MAX_ACTIONS=40` pour limiter la dépense. Avec Claude Code, depuis la racine du dépôt (accepter les serveurs MCP du projet):

- [ ] `missions/premiere-connexion.md` avec `personas/nouvel-arrivant.md` (simple, sans droit d'administration)
- [ ] `missions/creer-un-compte-agent.md` avec `personas/administrateur.md`
- [ ] `missions/composer-une-equipe-projet.md` (même persona)
- [ ] `missions/explorer-un-module.md` sur un module au choix: produit les missions manquantes
- [ ] **Mode fonctionnalité**: « Teste sur dev: … » (voir `docs/verifier-une-fonctionnalite.md`)

## 6. Relire ce qui sort (le plus important)

Dans `reports/<date>-<env>-<id>/`: `journal.md`, `captures/`, `rapport.md`.

- [ ] **L'agent est-il resté dans l'interface ?** (journal, captures). Rien ne l'empêche techniquement d'appeler le BFF, seules ses consignes l'interdisent.
- [ ] **Dit-il vrai ?** Recontrôler 2 ou 3 affirmations du rapport à la main dans l'app.
- [ ] **Les effets sont-ils exactement ceux de la mission ?** Objets créés présents, supprimés absents, rien d'autre touché.
- [ ] **Les notes d'utilisabilité sont-elles crédibles**, ou toutes à 4-5 ? Sinon ajuster `rubric.md`.
- [ ] **Aucun secret** (mot de passe, jeton, lien de réinitialisation complet) dans le journal ou le rapport.

## 7. L'objectif central: un état qui n'est pas propre

- [ ] **Rejouer la même mission deux fois**, sans nettoyer: la seconde doit réussir malgré les restes de la première.
- [ ] **Créer volontairement du désordre** (un doublon, un compte dont le mot de passe a changé, une longue liste) puis relancer: l'agent doit s'en sortir et le noter dans « État rencontré ».
- [ ] **Varier le comportement** (« pressé », « hésitant ») sur la même mission: les parcours doivent différer.

## 8. Ajouter l'observation « derrière l'écran » (facultatif)

- [ ] Créer le rôle SQL (commande en tête de `sql/readonly-role.sql`, une fois par environnement), noter `QA_DB_PASSWORD` et `QA_REDIS_PASSWORD` dans `.env.<env>`.
- [ ] `./scripts/port-forward.sh staging` (ou `dev`; les deux peuvent tourner ensemble), puis `npm run doctor`: base « SELECT seul », Redis, Resend.
- [ ] Rejouer une mission: ses requêtes tombent-elles juste ? Les noms de tables que le code suppose ne sont pas vérifiés, l'agent les découvre avec `db_tables`.

## 9. Ce qui peut casser, par ordre de probabilité

1. `QA_API_FRONT` faux, ou des libellés de la page de connexion différents de ce que l'agent attend.
2. Des missions écrites d'après les contrats du BFF et non d'après les écrans: corriger la mission, pas l'application.
3. La limitation de débit des routes de connexion, qui peut bloquer l'agent après plusieurs essais.
4. Un compte du seed dont le mot de passe a changé: l'agent doit passer par l'administrateur pour le réinitialiser, et le noter.
5. En **local**: la stack complète a besoin d'environ 4 Go; ports 80/443 libres; mkcert pour que le navigateur de l'agent fasse confiance au certificat; images ghcr.io accessibles (voir les limites connues de `local/README.md`).
6. Sur **dev**: machine de 4 Go sans marge (voir Deploiment). Une seule session à la fois.
7. Une fonctionnalité « introuvable » en dev: souvent une image pas encore déployée. Vérifier le tag dans le dépôt Deploiment.

## 10. Renvoyer ce qui a posé problème

Un journal ou un rapport réel suffit pour corriger le harnais, les missions ou la grille d'après ce qui a vraiment gêné.
