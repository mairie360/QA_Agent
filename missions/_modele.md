# Titre de la mission

**Persona**: `personas/<fichier>.md`
**Objectif métier** (une phrase, comme le dirait la personne): …

## Contexte
Ce que la persona sait, ce qui la motive. Aucune étape: l'agent choisit son chemin.

## Données à produire
| Op | Objet | Description | Critère de réussite |
|---|---|---|---|
| créer | … | … | visible à l'écran ET en base ; e-mail reçu si attendu |
| modifier | … | … | … |
| supprimer | … | … | … |

Règles de cette liste:
- Les objets créés portent le marqueur de session `[QA-xxxx]` dans leur nom ou titre.
- « Modifier » / « supprimer » visent un objet choisi par critères (celui que la persona vient de créer, ou « un … qui lui appartient »), jamais par position.
- Si la cible n'existe pas, l'agent la crée d'abord (mise en place), et le note.
- Les valeurs peuvent venir du seed (`seed/data/*.yaml`) plutôt qu'être figées ici.

## Ce qui fait réussir la mission
Les effets attendus, dans les mots du métier.

## Ce qu'on veut apprendre (facultatif)
Les points d'usage sur lesquels l'équipe veut un avis (clarté d'un écran, discoverabilité d'une action…).
