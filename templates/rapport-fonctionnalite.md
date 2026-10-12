# Vérification de fonctionnalité [QA-xxxx]

Environnement · fonctionnalité demandée · profils utilisés · date · durée · nombre d'actions · lu le diff ? (oui/non)

## Verdict
**fonctionne / fonctionne avec réserves / ne fonctionne pas / introuvable ou non déployée / non concluant**, en deux phrases: ce qui décide du verdict.

## Compréhension de la demande
Ce que l'agent a compris, ses hypothèses, et les critères d'acceptation qu'il en a déduits (numérotés, repris dans « Cas testés »).

## Cas testés
| # | Cas (profil, entrée) | Attendu | Observé | Preuve | Résultat |
|---|---|---|---|---|---|
| 1 | nominal | | | journal / capture / requête | ✅ ❌ ⚠️ non vérifié |
Couvrir au minimum: nominal · saisies invalides et limites · droits (y compris un profil sans droit) · état de l'instance (liste longue, doublons, restes) · annuler/recommencer/double envoi · voisinage.

## Données créées, modifiées, supprimées
Objets touchés (nom exact, marqueur de session), vérifiés à l'écran et en base; résultat de `snapshot_diff` si disponible.

## État rencontré
Ce que l'environnement contenait au départ et en quoi cela a (ou non) gêné la vérification.

## Frictions
Où, ce qui gêne, pourquoi, preuve, gravité (faible / moyenne / forte).

## Bugs et incohérences
Attendu / observé (écran, e-mail, base), preuve, gravité (mineur / majeur / bloquant). Séparer bug de la fonctionnalité et bug existant ailleurs.

## Régressions possibles
Ce qui existait à côté et a changé de comportement.

## Limites de l’évaluation
Ce qui n'a pas été couvert ou vérifié (pas d'accès base, e-mail non reçu, profil non testé). Une session n'est pas une preuve d'absence de défauts.

## Suggestions
Pour le développeur, classées par impact: correctif, cas à ajouter en test automatisé, mission à écrire.
