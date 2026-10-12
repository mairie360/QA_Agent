# Créer, adapter puis retirer le compte d'un agent

**Persona**: `personas/administrateur.md`
**Objectif métier**: « Un agent saisonnier arrive lundi: je lui crée son accès, je règle ce qu'il faut, et quand sa mission se termine je ferme son compte. »

## Contexte
L'administrateur reçoit une demande d'un chef de service. Il ne connaît que le prénom, le nom et le service de l'agent (service au choix parmi ceux du seed).

## Données à produire
| Op | Objet | Description | Critère de réussite |
|---|---|---|---|
| créer | Compte agent | Un agent saisonnier fictif, nom de famille portant `[QA-xxxx]`, adresse via `run_alias`, rôle `User`, rattaché à un service existant (groupe) | apparaît dans la liste et dans la recherche ; présent en base avec le bon rôle ; membre du groupe choisi |
| modifier | Ce compte | Corriger une faute dans le prénom et ajouter un numéro de téléphone français | affichés à l'écran ; `phone_country` = FR et numéro national en base |
| modifier | Ce compte | Lui donner aussi le rôle « Référent numérique », puis le lui retirer | rôle présent puis absent, à l'écran et en base |
| supprimer | Ce compte | Fermer l'accès de l'agent | n'apparaît plus parmi les comptes actifs ; il ne peut plus se connecter ; ligne conservée (archivée) en base |

## Ce qui fait réussir la mission
Le compte a existé avec les bonnes informations, a été corrigé, puis fermé, sans toucher à aucun autre compte (l'écart avant/après ne contient que celui-ci).

## Ce qu'on veut apprendre
Les écrans de création et de modification sont-ils évidents ? La différence entre « supprimer » et « archiver » est-elle claire ? Les messages d'erreur (e-mail déjà utilisé, téléphone invalide) aident-ils ?
