# QA_Agent — un utilisateur IA qui teste Mairie360 sur staging

Une session de test = un agent IA (Claude ou un agent OpenAI) joue une **persona** (agent d'accueil, administrateur…) avec une **mission en langage métier**,
utilise l'application **par son interface web** comme une vraie personne, **tient un journal** de ce qu'il fait et de ce qu'il obtient, puis **évalue sa propre session**.
Le but est de donner un retour d'usage aux développeurs. Rien n'est automatique: **un dev lance une session quand il en a besoin**.

Principes:
- **Interface web uniquement.** Jamais le BFF ni l'API (sauf le seed, hors agent).
- **Tout le staging, pas un front.** L'agent circule d'un front à l'autre comme un utilisateur.
- **L'état de départ est inconnu, et c'est voulu.** Pas de nettoyage: l'instance est propre un jour, pleine de traces un autre. L'agent marque ce qu'il crée, choisit ses cibles par critères, ne supprime que ce que la mission demande.
- **De la variabilité** comme une vraie personne (comportement « pressé », « hésitant »…): deux sessions de la même mission ne suivent pas le même chemin.
- **Observation en lecture seule** de ce qui se passe derrière l'écran (e-mails réels via Resend, base, Redis), pour recouper avec ce que l'agent voit.

```
AGENTS.md        consignes de l'agent (source unique; CLAUDE.md l'importe)
personas/        qui joue (profil, aisance, attentes) + _comportements.md
missions/        objectifs métier + liste des données à créer/modifier/supprimer (_modele.md)
rubric.md        grille d'évaluation de l'utilisabilité
templates/       forme du rapport d'auto-évaluation
seed/            jeu de données de staging, évolutif, idempotent, additif (CHANGELOG.md)
mcp/server.mjs   outils de l'agent hors navigateur: session, journal, observation en lecture seule, rapport
harness/         code partagé (config, base, Redis, mails, état de session)
scripts/         port-forward.sh (base et Redis ne sont pas exposés)
sql/             rôle Postgres en lecture seule
reports/         journal, captures, instantanés et rapport de chaque session (ignoré par git)
docs/            intégration Claude / ChatGPT
```

## Mise en place (une fois)

```bash
npm install
cp .env.example .env     # puis remplir (domaine, boîte de test, admin de base, mots de passe)
npx playwright install chromium    # ou utiliser le Chromium déjà présent
npm run selftest         # serveur MCP: doit afficher « Tout est OK » (sans staging)
```

1. **Boîte de test réelle** (`QA_MAILBOX`): tous les comptes du seed et ceux créés par l'agent sont des alias `vous+qa-…@domaine`, donc les e-mails de staging (Resend) arrivent bien chez vous.
2. **Seed** (hors agent, par un dev): `npm run seed:plan` pour voir, `npm run seed:apply` pour appliquer. Voir ci-dessous.
3. **Observation facultative**: sans elle l'agent travaille avec l'écran et les e-mails et écrit « non vérifié en base ».
   - Clé Resend en accès complet (`RESEND_API_KEY`) pour lire les e-mails.
   - Base et Redis: `sql/readonly-role.sql` (une fois), mot de passe Redis du compte `admin` du chart, puis `./scripts/port-forward.sh`.
4. `npm run doctor` vérifie les 8 fronts et les observateurs.

## Lancer une session

Voir `docs/integration.md` pour chaque outil. Avec Claude Code, depuis la racine du dépôt:

> Joue la mission `missions/creer-un-compte-agent.md` avec la persona `personas/administrateur.md`. Comportement: pressé.

L'agent ouvre la session (`run_start`), se connecte par la page de connexion, accomplit la mission en journalisant chaque action, constate les effets (e-mail, base), et écrit `reports/<date>-<id>/rapport.md`.
Relancer la même mission donne un autre chemin; **ne pas nettoyer entre deux**: c'est le but.

## Le seed

Mairie fictive: 14 comptes (maire, DGS, 4 services avec responsables et agents, un stagiaire, un nouvel arrivant), 5 groupes, 1 rôle. Fichiers: `seed/data/*.yaml`.
Il est **idempotent et additif**: relancer ne crée rien de plus, corrige les noms, complète rôles et membres, et **ne supprime jamais rien** ni ne touche ce que l'agent a créé.
Chaque compte a le mot de passe `QA_SEED_PASSWORD` (changement forcé à la première connexion); `npm run seed:apply -- --reset-passwords` le remet.

Faire évoluer: ajouter dans les YAML (ne jamais renommer une clé), incrémenter `seed/data/manifest.yaml`, noter dans `seed/CHANGELOG.md`.
Le seed couvre aujourd'hui **comptes, rôles, groupes**. Calendrier, projets, messages, e-learning: ajouter un pilote dans `seed/drivers/` (voir `seed/CHANGELOG.md`).

## Ajouter une mission ou une persona

Copier `missions/_modele.md` ou un fichier de `personas/`. Une mission décrit un objectif métier et une **table de données** (créer / modifier / supprimer, avec critère de réussite), **pas des étapes**.

## Ce qui est vérifié, et ce qui ne l'est pas

Vérifié ici, sans staging: le serveur MCP (`npm run selftest`: outils, garde-fous de lecture seule, budget d'actions, refus d'un rapport incomplet) et le seed contre un faux BFF en mémoire (`node tests/seed.test.mjs`: création, idempotence, évolution, aucune suppression).

**Non vérifié: aucun run réel sur staging** (ce dépôt a été construit dans un environnement qui n'atteint pas le domaine). Au premier lancement, à confirmer:
- `QA_API_FRONT`: le front dont l'hôte relaie `/bff/admin/*` (pour le seed seulement);
- les noms de tables et colonnes (l'agent les découvre avec `db_tables` / `db_describe`);
- le `port-forward` vers la base sous la NetworkPolicy de staging;
- le comportement réel des écrans: les missions de ce dépôt ont été écrites d'après les contrats du BFF, pas en regardant les fronts.

## Limites

- Le rapport est **l'avis d'un modèle** jouant un rôle: utile pour repérer des frictions et des incohérences, pas une mesure.
- Une session consomme beaucoup d'appels au modèle: `QA_MAX_ACTIONS` borne les actions (150 par défaut).
- **« Interface web uniquement » repose sur les consignes, pas sur un verrou technique**: le navigateur Playwright expose aussi `browser_evaluate` (JavaScript dans la page), qui permettrait d'appeler le BFF. `AGENTS.md` l'interdit; le journal et les captures permettent de le vérifier après coup.
- Garde-fous: refus de tout domaine hors `staging.`/`dev.`; base en lecture seule (rôle, transaction `READ ONLY`, une instruction); Redis limité à 4 lectures; colonnes secrètes masquées.
  Le navigateur, lui, peut tout faire dans l'interface avec les droits de la persona: c'est pour cela que le staging doit rester un environnement de test.
