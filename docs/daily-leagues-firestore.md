# Défi du Jour en 2 ligues — schéma Firestore (Lot 6)

**Statut : implémenté côté application. Les règles et l'index Firestore ci-dessous ne sont PAS
dans le dépôt : ils sont à vérifier ou à créer dans la console Firebase. Rien n'a été écrit dans
Firestore pendant ce lot.**

## Schéma retenu

```
dailyChallenges/{YYYY-MM-DD}_{ligue}/results/{userId}
```

- `ligue` ∈ `pousse` | `grand_chene`. Exemple : `dailyChallenges/2026-11-06_pousse/results/abc123`.
- Un classement par ligue **et** par date. Un joueur ne joue qu'une ligue par jour (la plus haute
  ouverte), donc un seul résultat par joueur et par date.
- Le chemin garde **4 segments**, comme avant les ligues. Les règles écrites pour
  `dailyChallenges/{date}/results/{userId}` s'appliquent donc très probablement telles quelles
  (`{date}` est un joker : il accepte aussi `2026-11-06_pousse`).
- Document de résultat : `userId`, `username`, `timeMs`, `playerLevel`, **`league`** (nouveau),
  `completedAt`. Write-once.
- Document-date de ligue : après scellement, `sealed`, `sealedAt`, `league` et `recordHolder`.

## Ce qui a été inspecté avant de proposer ce schéma

| Élément | Avant | Après |
|---|---|---|
| Résultats | `dailyChallenges/{date}/results/{uid}` | `dailyChallenges/{date}_{ligue}/results/{uid}` |
| `submitDailyResult` | `(date, uid, …)` | `(date, ligue, uid, …)` |
| `getDailyStatus` | `(date, uid)` | `(date, ligue, uid)` |
| `subscribeDailyLeaderboard` | `(date, max, cb)` | `(date, ligue, max, cb)` |
| `sealDailyRecord(date)` | un record par date | un record par date **et par ligue** (2 scellements) |
| `subscribeDailyRecordHolders` | meilleur temps par date | meilleur temps par (date, ligue) ; anciens documents ignorés |
| `calculateDailyReward` | rang dans le classement unique | inchangée ; reçoit le rang **dans la ligue** (`computeLeagueRank`) |
| Série (`dailyChallengeStreak`) | par date | inchangée : se joue une ligue par jour, la série reste « un jour joué de plus » |
| Jackpot (`jackpotClaims/{uid}_{date}`) | par date | inchangé : un joueur ne réclame qu'une fois par jour, quelle que soit sa ligue |
| Classement général `leaderboard.dailyWins` | +1 pour le record du jour | +1 par record de ligue : jusqu'à 2 gagnants par jour |

## À faire dans la console Firebase (non exécuté)

1. **Règles.** Vérifier que la règle sur `dailyChallenges/{dateId}/results/{userId}` accepte un
   identifiant de la forme `AAAA-MM-JJ_pousse` et `AAAA-MM-JJ_grand_chene`. Si la règle valide le
   format de `{dateId}` (par exemple avec une expression régulière sur `AAAA-MM-JJ`), il faut
   l'élargir à `^\d{4}-\d{2}-\d{2}_(pousse|grand_chene)$`.
2. **Écriture du document-date.** `sealDailyRecord` écrit `sealed`, `sealedAt`, `league` et
   `recordHolder` dans `dailyChallenges/{date}_{ligue}` (comme avant, mais par ligue). La règle
   qui l'autorisait pour `dailyChallenges/{date}` doit couvrir ces nouveaux identifiants.
3. **Index.** `collectionGroup('results')` ordonné par `timeMs` croissant : déjà requis avant ce lot
   par `subscribeDailyRecordHolders`. Aucun index supplémentaire n'est nécessaire (le classement
   d'une ligue est une simple collection `results`, triée par `timeMs`).

## Anciens documents (avant les ligues)

Les documents `dailyChallenges/{date}/…` (sans ligue) **ne sont plus lus ni écrits**. Ils restent en
place et sont sans effet : `subscribeDailyRecordHolders` les ignore (leur identifiant n'a pas de
ligue). Ils font partie des données que la purge proposée dans `docs/purge-progression-v2.md` peut
supprimer (collection group `results`) ; la purge n'a **pas** été exécutée.

## Points d'attention

- **Déterminisme.** La grille d'une ligue ne dépend que de la date UTC et de la ligue (seed = date +
  sel). Deux joueurs de la même ligue obtiennent donc la même grille et le même nombre de cases
  fixées, sans aucune lecture Firestore. Les sels figurent dans `src/constants/dailyLeagues.ts` et
  **ne doivent pas être modifiés** : cela changerait les grilles de tous les jours.
- **Un joueur qui change de ligue** (il termine le chapitre 4 en cours de journée) : s'il avait déjà
  joué la Pousse aujourd'hui, `dailyChallengeStatus` l'empêche de rejouer ; la ligue Grand Chêne
  s'ouvre le lendemain. Il n'y a pas de rattrapage.
- **Écart de nombre de joueurs.** Un classement par ligue réduit le nombre de participants de chacun :
  les bonus « top 10 % » et « top 3 » de `calculateDailyReward` sont plus faciles à atteindre dans
  une petite ligue. À surveiller avec de vraies données.
