# Brancher l'agent à Claude ou à ChatGPT

L'agent se compose de trois morceaux, tous standard:
1. **Les consignes**: `AGENTS.md` (Claude Code les lit via `CLAUDE.md`, Codex via `AGENTS.md`).
2. **Un navigateur**: le serveur MCP Playwright (`@playwright/mcp`). C'est ce qui permet de passer par l'interface web.
3. **Les outils de session et d'observation**: le serveur MCP `qa-observer` de ce dépôt (`mcp/server.mjs`, transport stdio).

Le serveur `qa-observer` cible l'environnement choisi dans la conversation (`env` de `run_start`), sans redémarrage: `.env.staging` et `.env.dev` doivent donc tous deux être remplis si on veut les deux.

Tout outil qui sait lancer des serveurs MCP et suivre des consignes en Markdown peut jouer le rôle de l'agent.

## Claude Code (le plus simple)

`.mcp.json` à la racine déclare déjà les deux serveurs. Ouvrir Claude Code dans le dépôt, accepter les serveurs MCP du projet, puis donner la mission.

## Claude Desktop

Copier `docs/exemples/claude-desktop.json` dans la configuration de Claude Desktop en remplaçant le chemin absolu, redémarrer. Coller ensuite dans la conversation le contenu de `AGENTS.md`, puis donner la mission
(Claude Desktop ne lit pas `AGENTS.md` tout seul).

## Codex CLI (OpenAI)

Ajouter le contenu de `docs/exemples/codex-config.toml` à `~/.codex/config.toml` (chemins absolus), lancer `codex` dans le dépôt: il lit `AGENTS.md`. Même demande de mission que pour Claude.

## SDK Agents d'OpenAI

Les deux serveurs sont des MCP stdio: les brancher avec les classes MCP du SDK, `AGENTS.md` en instructions de l'agent.

## ChatGPT (application web ou bureau): limite à connaître

ChatGPT ne lance pas de serveur MCP local: il n'accepte que des serveurs MCP **distants** (HTTPS) via les connecteurs en mode développeur, et son navigateur intégré n'est pas Playwright.
Ce dépôt n'expose que du stdio, **il n'est donc pas utilisable tel quel dans ChatGPT**. Les solutions réalistes: Codex CLI ou le SDK Agents (ci-dessus, même modèle OpenAI),
ou, si c'est indispensable, ajouter un transport HTTP à `mcp/server.mjs` et l'héberger derrière une authentification — ce qui exposerait un accès (lecture seule) à la base de staging et n'est donc pas fait par défaut.
Ces informations sur ChatGPT peuvent avoir évolué: à revérifier avant de s'y fier.

## Navigateur

Le Chromium de Playwright doit être installé (`npx playwright install chromium`). Par défaut le navigateur est visible; ajouter `--headless` aux arguments de `@playwright/mcp` pour l'exécuter sans fenêtre.
`--isolated` garde le profil en mémoire: chaque session repart sans cookies, comme un nouvel utilisateur.
