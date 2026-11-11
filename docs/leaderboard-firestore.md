# Classements — schéma Firestore (Lot C)

**Statut : implémenté côté application. Les règles et index Firestore ci-dessous ne sont PAS dans le dépôt :
ils sont à vérifier dans la console Firebase. Rien n'a été écrit ni supprimé dans Firestore pendant ce lot.**

## Trois classements

| Onglet | Source | Requête serveur | Départage |
|---|---|---|---|
| ⭐ Étoiles | `leaderboard/{uid}.starsRank` | `orderBy('starsRank', 'desc').limit(100)` | étoiles → défis à ⭐⭐⭐ → trophées → **le premier arrivé** |
| 🌅 Journalier (par ligue) | `leaderboard/{uid}.dailyRankPousse` ou `dailyRankGrandChene` | `orderBy(champ, 'desc').limit(100)` | victoires du jour dans la ligue → **le premier arrivé** |
| 🏆 Records | `worldRecords/{défi}` (agrégé côté client) | lecture de la collection (≤ 210 documents) | records détenus → dernier record le plus ancien → identifiant |

Avant ce lot : 4 onglets (Daily, Badges, Graines, Records). **Badges** et **Graines** sont supprimés (les graines se
dépensent dans l'Herbier ; les trophées sont affichés sur la ligne du classement des étoiles).

## Le départage « empaqueté »

Chaque classement se lit avec **une seule requête déjà triée** : pas d'index composite, pas de re-tri côté client. Le
départage est donc encodé dans un seul nombre par classement (`src/constants/leaderboardRank.ts`) :

```
starsRank = étoiles × 10¹² + ⭐⭐⭐ × 10⁹ + trophées × 10⁷ + (10⁷ − 1 − minutesDepuisLe1erJanvier2026)
dailyRank = victoires × 10⁷ + (10⁷ − 1 − minutesDepuisLe1erJanvier2026)
```

- « Le premier arrivé » = l'instant (en minutes) où le joueur a atteint son résultat **actuel**. Il ne change que si le
  résultat change : republier la même position ne fait jamais perdre sa place (`resolveReachedAt`).
- Un nombre JavaScript est exact jusqu'à 2⁵³ ≈ 9,0 × 10¹⁵ ; le plus grand `starsRank` possible vaut ≈ 6,3 × 10¹⁴. Les
  composantes sont bornées (étoiles ≤ 999, ⭐⭐⭐ ≤ 999, trophées ≤ 99), l'horloge est bornée à ≈ 19 ans (à partir de 2045,
  tous les instants valent le dernier : le départage devient l'ordre Firestore, sans erreur).
- Les étoiles affichées sont **relues du score empaqueté** : l'affichage ne peut jamais contredire le rang.

## Document `leaderboard/{uid}`

Écrit par un seul point d'entrée, `publishLeaderboardEntry` (`src/services/leaderboardService.ts`), appelé depuis
`app/(tabs)/_layout.tsx` à chaque changement d'étoiles, de trophées, de niveaux validés ou de cartes de l'Herbier — donc
depuis **tous les modes** (avant : une victoire Solo seulement). Idempotent : aucune écriture si l'entrée n'a pas changé.

| Champ | Contenu |
|---|---|
| `userId`, `username` | identité |
| `starsRank` | score empaqueté du classement des étoiles |
| `stars`, `threeStars`, `trophies` | composantes (affichage ; relues de `starsRank`) |
| `levelsCompleted`, `level` | niveau (→ rang forestier = chapitre) |
| `herbier` | cartes possédées (affichage) |
| `dailyRankPousse`, `dailyRankGrandChene` | score empaqueté du Journalier de chaque ligue (écrit par `sealDailyRecord`) |

Un joueur **sans étoile** (profil remis à zéro) est retiré du classement : `starsRank` est supprimé du document.
Les anciens champs (`score`, `badgeCount`, `seeds`, `completedCount`, `badgeScore`, `dailyWins`) ne sont plus lus ni
écrits ; ils restent dans les documents existants et sont sans effet.

## Journalier : une victoire par ligue

`sealDailyRecord(date)` (appelé au 1er démarrage du jour) scelle, pour chaque ligue, le record de la veille.

- **Transaction** : lecture du document `dailyChallenges/{date}_{ligue}` ; s'il est déjà scellé → rien ; sinon crédit du
  gagnant **et** `sealed = true` dans la même transaction. Une victoire n'est donc jamais comptée deux fois (deux
  appareils qui scellent en même temps) ni perdue (échec entre les deux écritures).
- **Crédit dans la ligue du gagnant** : `dailyRankPousse` ou `dailyRankGrandChene`. Les deux ligues ne sont plus mélangées
  dans un compteur unique.
- **Instant de crédit déterministe** : la fin de la journée scellée. Tous les appareils calculent la même valeur.
- **Document `leaderboard/{uid}` absent** : créé (`set` avec `merge`). Avant ce lot, `updateDoc` échouait et la victoire
  n'était **jamais** créditée tant que le gagnant n'avait pas joué une partie Solo ; le scellement était retenté en vain à
  chaque connexion.

## À faire dans la console Firebase (non exécuté)

1. **Règles — `leaderboard/{uid}`.** Le joueur doit pouvoir écrire son propre document (`starsRank`, `stars`, …, y compris
   la suppression de `starsRank`). `sealDailyRecord` écrit le document **du gagnant** (`dailyRank*`) depuis l'appareil d'un
   autre joueur : la règle actuelle (non visible) doit l'autoriser, sinon le scellement échoue silencieusement
   (`console.warn`). À vérifier en priorité. Idéalement, limiter les champs `dailyRank*` à une écriture « +1 victoire ».
2. **Règles — `dailyChallenges/{date}_{ligue}`.** La transaction lit et écrit ce document (`sealed`, `sealedAt`, `league`,
   `recordHolder`) : déjà requis par le Lot 6, voir `docs/daily-leagues-firestore.md`.
3. **Index.** Aucun index composite. Les index mono-champ (`starsRank`, `dailyRankPousse`, `dailyRankGrandChene`) sont
   créés automatiquement par Firestore. Le comptage de position (`getCountFromServer`) utilise `where('starsRank', '>', n)`
   sur le même index.
4. **Anti-triche.** Un joueur peut modifier son propre `starsRank` si les règles le permettent. Une validation côté serveur
   (Cloud Function qui recalcule depuis `players/{uid}.challengeStars`) serait nécessaire pour l'empêcher : hors périmètre.

## Les anciennes données

Sans purge, les classements sont déjà corrects : une entrée sans `starsRank` n'apparaît dans aucun classement
(Firestore l'exclut d'un `orderBy`), et le Journalier repart de zéro (nouveaux champs par ligue). Le joueur réapparaît dès
qu'il a au moins une étoile : la publication a lieu à sa connexion, pas à sa prochaine victoire.

La purge de `leaderboard` proposée dans `docs/purge-progression-v2.md` reste **facultative** (ménage des anciens champs) ;
elle **supprimerait aussi les victoires du Journalier déjà créditées dans les nouveaux champs** : à ne pas lancer une fois
le Lot C en production sans avoir pesé ce point. Elle n'a pas été exécutée.

## Points d'attention

- **Rang hors du top 100.** Le classement des étoiles affiche la position réelle d'un joueur hors du top (comptage serveur
  des joueurs strictement devant). Le score local utilisé pour ce comptage ignore « le premier arrivé » (le plus favorable
  des cas) : à égalité parfaite sur les trois critères, la position peut être sous-estimée de quelques rangs. Pour le
  Journalier, aucun rang n'est affiché hors du top.
- **Records mondiaux.** Les records ne sont attribués qu'à la première victoire d'un défi Solo ; la collection est bornée
  (210 documents), sa lecture complète reste légère. Si le Forestier ou d'autres modes ont un jour leurs records, il
  faudra passer à un champ empaqueté comme ci-dessus.
- **Horloge de l'appareil.** « Le premier arrivé » utilise l'heure de l'appareil du joueur (changer l'heure du téléphone
  modifie son instant d'arrivée). Le scellement du Journalier, lui, est déterministe (fin du jour scellé).
