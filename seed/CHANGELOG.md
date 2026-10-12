# Évolutions du seed

## 1 — version initiale
Mairie fictive: 14 comptes (maire, DGS, 4 services avec responsables et agents, un stagiaire, un nouvel arrivant), 5 groupes, un rôle « Référent numérique ».
Les comptes ont tous le mot de passe commun `QA_SEED_PASSWORD` et le changement forcé à la première connexion.

## Comment faire évoluer
1. Modifier `seed/data/*.yaml` (ajouts d'abord: ne jamais supprimer ni renommer une clé existante).
2. Incrémenter `version` dans `seed/data/manifest.yaml` et décrire le changement ici.
3. `npm run seed:plan`, relire, puis `npm run seed:apply`.
4. Nouveau type d'objet (agenda, projets, e-learning, messages): ajouter `seed/drivers/<type>.mjs` (mêmes fonctions `name` et `sync(ctx, items, {dryRun})`),
   `seed/data/<type>.yaml`, et le déclarer dans `DRIVERS` de `seed/seed.mjs`.
