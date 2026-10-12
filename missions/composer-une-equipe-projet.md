# Monter une équipe projet entre services

**Persona**: `personas/administrateur.md`
**Objectif métier**: « La mairie lance un projet de réaménagement de la place: je crée une équipe avec une personne de chaque service concerné, puis je l'ajuste quand le projet change. »

## Contexte
Services concernés: Urbanisme, Finances, Accueil. L'administrateur choisit les personnes lui-même parmi les agents existants.

## Données à produire
| Op | Objet | Description | Critère de réussite |
|---|---|---|---|
| créer | Groupe | « Réaménagement de la place [QA-xxxx] », avec une description | listé ; présent en base |
| créer | Adhésions | Y ajouter 3 agents, un de chacun des 3 services | les 3 apparaissent dans les membres ; 3 lignes en base |
| modifier | Groupe | Renommer en « Place centrale [QA-xxxx] » et retirer 1 membre | nouveau nom affiché ; 2 membres restants, aussi en base |
| supprimer | Groupe | Dissoudre l'équipe en fin de projet | disparaît de la liste ; membres encore dans leurs services d'origine |

## Ce qui fait réussir la mission
L'équipe a existé, a été modifiée puis supprimée, et les groupes de services n'ont pas bougé.

## Ce qu'on veut apprendre
Trouver un agent précis parmi beaucoup est-il facile (recherche, filtres, pagination) ? Que se passe-t-il si un nom de groupe existe déjà ? La suppression d'un groupe est-elle assez protégée ?
