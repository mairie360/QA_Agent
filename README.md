# QA_Agent — un utilisateur IA qui teste Mairie360

QA_Agent met un **agent IA** (Claude, ou un agent OpenAI) à la place d'un utilisateur de la plateforme Mairie360. Il reçoit un rôle (agent d'accueil, administrateur…) et un objectif métier,
se sert de l'application **uniquement par son interface web**, note ce qu'il fait et ce qu'il obtient, recoupe avec ce qui s'est réellement passé derrière l'écran (e-mails, base, Redis),
puis **évalue sa propre session** : ce qui a marché, ce qui l'a gêné, ce qui est cassé.

**À quoi ça sert :** donner aux développeurs un retour d'*usage* — pas seulement « ça répond 200 », mais « une personne peut-elle faire son travail avec ça ? ».
**Ce que ce n'est pas :** une CI automatique. Un développeur lance une session quand il en a besoin.

## Comment ça fonctionne

```
 Toi ──────────────►  Agent IA  (Claude Code, Codex…)      lit AGENTS.md : persona + mission, ou ta demande
 « teste sur dev : … »    │
                          ├──► Navigateur (Playwright MCP) ──►  Application, par l'interface web  ◄── la seule façon d'AGIR
                          │                                      (8 fronts → BFF → APIs)
                          └──► qa-observer (MCP, ce dépôt)
                                 • journal de la session, instantanés avant/après, rapport
                                 • observation EN LECTURE SEULE : e-mails (Resend ou Mailpit), base, Redis
                                                    │
                                              reports/<date>-<env>-<id>/   journal.md · captures · rapport.md
```

Deux façons de lui parler :

| Façon | Tu donnes | L'agent fait |
|---|---|---|
| **Mission** | une persona et un fichier de mission (`missions/`) : objectif métier + tableau des données à créer / modifier / supprimer | joue le rôle, accomplit la mission, journalise, écrit son auto-évaluation |
| **Fonctionnalité** (en discutant) | une phrase : « Teste sur dev : les responsables peuvent maintenant … » | reformule, déduit des critères d'acceptation, joue nominal / saisies invalides / droits / état de l'instance / retour arrière / voisinage, répond avec un verdict, reste disponible pour creuser ou retester |

### Les principes qui structurent tout

- **Interface web uniquement.** L'agent n'appelle jamais le BFF ni l'API (seul le *seed*, lancé par un développeur hors agent, utilise l'administration du BFF).
- **L'état de départ est inconnu, et c'est voulu.** Aucun nettoyage entre deux sessions : l'instance est propre un jour, pleine de traces un autre. L'agent observe avant d'agir, marque tout ce qu'il crée (`[QA-xxxx]`, adresses e-mail uniques), choisit ses cibles par critères et **ne supprime que ce que la mission demande**.
- **De la variabilité comme chez une vraie personne** (comportement « pressé », « hésitant »…) : deux sessions de la même mission ne suivent pas le même chemin.
- **Observer sans modifier.** Base, Redis et e-mails sont lus ; l'agent ne peut rien y écrire. Le jeu de données de base vient du *seed* (idempotent, additif, versionné).
- **Jamais la production.** Le code ne connaît que `staging`, `dev` et `local`.

## Choisir son environnement

| Environnement | Usage recommandé | E-mails | Observation base / Redis | Mise en place |
|---|---|---|---|---|
| **staging** | **missions** : retours d'usage reproductibles, comparables d'une version à l'autre | Resend (vraie boîte de test) | `kubectl port-forward`, facultatif | [`docs/setup-staging.md`](docs/setup-staging.md) |
| **dev** | **mode accompagné** : tu guides Claude Code en discutant pour vérifier une fonctionnalité en cours | Resend (vraie boîte de test) | `kubectl port-forward`, facultatif | [`docs/setup-dev.md`](docs/setup-dev.md) |
| **local** | développer avec **toute la plateforme sur ta machine** (docker compose, 24 conteneurs), y brancher l'agent quand tu veux | Mailpit (rien ne sort) | directe, sans `kubectl` | [`docs/setup-local.md`](docs/setup-local.md) + [`local/README.md`](local/README.md) |

Rien n'est verrouillé : chaque environnement accepte missions et mode fonctionnalité ; le tableau est l'usage recommandé.
On choisit l'environnement dans `.env` (`QA_ENV`) ou simplement dans la demande (« teste sur dev », « en local »). Les secrets de chaque environnement sont séparés (`.env.staging`, `.env.dev`, jamais commités).

## Démarrage rapide

```bash
git clone git@github.com:mairie360/QA_Agent.git && cd QA_Agent
npm install && npx playwright install chromium
npm test                                  # sans réseau : « Tout est OK »
```

Puis suivre le guide de l'environnement voulu (liens ci-dessus). Pour une première prise en main complète : [`docs/premier-lancement.md`](docs/premier-lancement.md) (check-list pas à pas).

Lancer une session — avec Claude Code, depuis la racine du dépôt :

> Joue la mission `missions/creer-un-compte-agent.md` avec la persona `personas/administrateur.md` sur staging. Comportement : pressé.

> Teste sur dev : les responsables peuvent maintenant ajouter un membre à un groupe depuis la fiche de l'agent. Un agent simple ne doit pas voir ce bouton.

Autres outils (Claude Desktop, Codex CLI, SDK Agents d'OpenAI ; limite de ChatGPT web) : [`docs/integration.md`](docs/integration.md).

## Contenu du dépôt

```
AGENTS.md          consignes de l'agent — source unique (CLAUDE.md l'importe)
personas/          qui joue : profil, aisance numérique, attentes ; _comportements.md (pressé, hésitant…)
missions/          objectifs métier + données à créer/modifier/supprimer ; _modele.md pour en écrire
rubric.md          grille d'évaluation de l'utilisabilité (notes de 1 à 5 avec preuves)
templates/         forme des rapports (mission, fonctionnalité)
seed/              jeu de données : 14 comptes, 5 groupes, 1 rôle — idempotent, additif, versionné (CHANGELOG.md)
mcp/server.mjs     outils de l'agent hors navigateur : journal, observation en lecture seule, instantanés, rapport
harness/           code partagé : profils d'environnement, base, Redis, e-mails, état de session
local/             la plateforme complète en docker compose (images de dev), HTTPS, Mailpit
scripts/, sql/     port-forward vers staging/dev ; rôle Postgres en lecture seule
docs/              guides de mise en place par environnement, check-list, mode fonctionnalité, intégration
tests/             tests sans réseau : seed, lecteur Mailpit, validation du compose
reports/           journal, captures et rapport de chaque session (ignoré par git)
```

## Le rapport d'une session

Chaque session écrit `reports/<date>-<env>-<id>/` : `journal.md` (chaque action, observation, friction, bug, objet touché, avec preuves), `captures/`, `snapshots/` (état avant/après) et `rapport.md`.
Le rapport est **refusé par l'outil s'il manque une section** (verdict, parcours ou cas testés, données touchées, état rencontré, frictions, bugs, utilisabilité, limites, suggestions) et tout y renvoie à une preuve ; ce qui n'a pas été vérifié s'appelle « non vérifié ».

## Faire évoluer

- **Une mission ou une persona :** copier `missions/_modele.md` ou un fichier de `personas/`. Une mission décrit un objectif métier et une **table de données**, pas des étapes.
- **Le seed :** ajouter dans `seed/data/*.yaml` (ne jamais renommer une clé), incrémenter `seed/data/manifest.yaml`, noter dans `seed/CHANGELOG.md`. Il couvre aujourd'hui comptes, rôles et groupes ; calendrier, projets, messages, e-learning demandent un pilote dans `seed/drivers/`.
- **Un environnement :** un profil dans `harness/config.mjs`.

## Garde-fous et limites

- Refus de tout domaine hors `staging.`, `dev.` et `*.localtest.me` ; base en lecture seule (rôle `SELECT`, transaction `READ ONLY`, une instruction) ; Redis limité à quatre lectures ; colonnes secrètes masquées ; budget d'actions par session (`QA_MAX_ACTIONS`, 150 par défaut).
- **« Interface web uniquement » repose sur les consignes, pas sur un verrou technique** : le navigateur expose `browser_evaluate` (JavaScript dans la page), qui permettrait d'appeler le BFF. `AGENTS.md` l'interdit ; le journal et les captures permettent de le vérifier après coup.
- Le navigateur a **les droits de la persona** dans l'interface : un environnement de test doit rester un environnement de test, avec des données fictives.
- Le rapport est **l'avis d'un modèle** jouant un rôle : utile pour repérer frictions et incohérences, pas une mesure. Une session de test n'est pas une preuve d'absence de défauts.
- Une session consomme beaucoup d'appels au modèle.

### Ce qui est vérifié, et ce qui ne l'est pas

Vérifié sans accès aux environnements (`npm test`) : le serveur MCP (outils, garde-fous de lecture seule, budget d'actions, refus d'un rapport incomplet, choix d'environnement, mode fonctionnalité), le seed contre un faux BFF (création, idempotence, évolution, aucune suppression),
le lecteur d'e-mails de la stack locale contre un faux Mailpit, et la configuration de la stack locale (`docker compose config`).

**Non vérifié : aucun run réel** sur staging, dev ni en local (ce dépôt a été construit dans un environnement qui n'atteint pas les domaines et sans démon Docker). À confirmer au premier lancement :
`QA_API_FRONT` (seed) ; noms de tables et colonnes (l'agent les découvre avec `db_tables` / `db_describe`) ; `port-forward` sous la NetworkPolicy ; migrations et HTTPS/cookies de la stack locale ;
forme réelle de l'API de Mailpit ; et surtout si les missions, écrites d'après les contrats du BFF, correspondent aux écrans réels.
