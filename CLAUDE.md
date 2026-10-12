@AGENTS.md

# Spécifique à Claude Code

- Les serveurs MCP du projet (`.mcp.json`: navigateur Playwright + `qa-observer`) demandent une approbation à la première utilisation.
- Lance la session depuis la racine de ce dépôt. Exemple de demande: « Joue la mission `missions/creer-un-compte-agent.md` avec la persona `personas/administrateur.md`. »
- Pour vérifier une fonctionnalité, décris-la simplement: « Teste sur dev: les responsables peuvent maintenant … » (voir `docs/verifier-une-fonctionnalite.md`).
- Pour introduire de la variété: ajoute un comportement (« tu es pressé et tu lis peu »).
- Choix de l'environnement: dis « sur dev », « sur staging » ou « en local » dans la demande (paramètre `env` de `run_start`); sans précision l'agent le demande.
