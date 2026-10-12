# Rapport de session [QA-xxxx]

Persona · mission · comportement · date · durée · nombre d'actions · domaine

## Verdict
Mission **atteinte / partielle / abandonnée**, en deux phrases. Ce qui a décidé du résultat.

## Parcours
Les étapes réellement suivies, dans l'ordre, avec les détours et erreurs de la persona (lignes du journal, captures clés).

## Données créées, modifiées, supprimées
| Op | Objet (nom exact) | Voulu par la mission ? | Vérifié à l'écran | Vérifié en base |
|---|---|---|---|---|
Résultat de `snapshot_diff` (avant/après): l'écart correspond-il exactement à la liste de la mission ? Tout écart en trop ou manquant est détaillé.

## État rencontré
Ce que l'instance contenait au départ: volumes, restes de sessions précédentes, doublons, écarts avec ce que décrit le seed. Comment l'agent l'a constaté.

## Impact de l’état sur la mission
L'état a-t-il gêné (pagination, collision de noms, objet manquant, compte dont le mot de passe avait changé) ? Comment l'agent a-t-il contourné ? Cela aurait-il gêné un vrai utilisateur ?

## Frictions
Liste: où, ce qui gêne, pourquoi, preuve, gravité (faible / moyenne / forte).

## Bugs et incohérences
Liste: attendu / observé (écran, e-mail, base), preuve (capture, requête et résultat), gravité (mineur / majeur / bloquant).

## Évaluation de l’utilisabilité
Tableau de `rubric.md`: note de 1 à 5 par critère, une phrase et une preuve chacun.

## Limites de l’évaluation
Ce qui n'a pas été vérifié (pas d'accès base, e-mail non reçu à temps…), ce que la persona ne pouvait pas savoir, ce qu'un autre profil trouverait différemment.

## Suggestions
Pour l'équipe de développement, classées par impact: correctif, amélioration d'écran, mission supplémentaire à écrire.
