# Dire une fonctionnalité à l'agent et la lui faire vérifier

Sans écrire de scénario ni de mission: tu décris, il teste, il te rend compte, tu discutes.

## Exemple

> Teste sur **dev**: les responsables peuvent maintenant ajouter un membre à un groupe depuis la fiche de l'agent (pas seulement depuis le groupe). C'est dans « Groupes » de l'écran d'administration. Un agent simple ne doit pas voir ce bouton.

L'agent reformule sa compréhension et les critères d'acceptation, pose au plus trois questions **si elles bloquent**, puis joue les cas (nominal, saisies invalides, droits, état de l'instance, retour arrière, voisinage),
et répond dans la conversation avec un verdict. Le détail est dans `reports/<date>-dev-<id>/rapport.md`.

## Ce qui l'aide à bien tester

- **L'environnement**: « sur dev » ou « sur staging ». S'il est vague, il le demande.
- **Où ça se trouve** dans l'interface, si ce n'est pas évident.
- **Qui y a droit**, qui n'y a pas droit.
- **Le comportement attendu**: texte du ticket, de la PR, ou quelques lignes. Plus c'est précis, plus ses critères d'acceptation le sont.
- **Ce qui t'inquiète** (un cas limite, une régression possible): il le teste en priorité.
- Facultatif: « lis le diff de la PR pour cibler les cas limites ». Il le fera et l'écrira dans le rapport (il est sinon un utilisateur qui ne lit pas le code).

## Après le premier compte rendu

- « Creuse le cas 4 » · « Réessaie avec un compte Guest » · « J'ai corrigé, retente les cas en échec » (il rejoue ses cas sans repartir de zéro).
- Les verdicts possibles: **fonctionne** · **fonctionne avec réserves** · **ne fonctionne pas** · **introuvable ou non déployée** · **non concluant**.
  « Introuvable » veut souvent dire que l'image n'est pas encore déployée sur cet environnement: vérifie le tag dans le dépôt Deploiment avant de chercher un bug.

## Limites

- Une session de test n'est pas une preuve d'absence de défauts: l'agent dit ce qu'il n'a pas couvert.
- Il vérifie l'usage et les effets visibles (écran, e-mails, base si branchée), pas la qualité du code.
- Sur dev, la machine est petite: une session Playwright est légère, mais évite de lancer plusieurs agents en parallèle.
