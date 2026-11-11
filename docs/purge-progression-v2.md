# Purge Progression v2 — proposition (NON EXÉCUTÉE)

**Statut : proposé, en attente de confirmation explicite de l'utilisateur.**
Rien de ce document n'a été exécuté. Aucune opération Firestore destructive n'a été lancée.

## Pourquoi

La remise à zéro des profils (spec C9) repart de zéro côté `players/{uid}`, mais plusieurs
collections partagées gardent des données issues de l'ancienne progression. Elles deviennent
incohérentes : un classement avec des niveaux et des scores d'avant, des records du monde
battus avec d'anciens critères, des résultats du Défi du Jour, etc.

## Ce qui est fait automatiquement (sans purge)

À la connexion d'un joueur dont `progressionVersion` est absent ou < 2 (et si `PROGRESSION_V2` est activé) :

- **Cloud** : `resetPlayerProgression(uid)` (`src/services/playerService.ts`) écrit les valeurs par
  défaut avec `merge: true` (seeds = 3, `isPremium = false`, étoiles, cartes, badges, stats, séries,
  amis, bonus…) et `progressionVersion: 2`. Identité (`userId`, `username`, `usernameLower`,
  `createdAt`) et préférences (langue, audio) sont conservées.
- **Local** : `playerStore.resetProgression()` ; la sauvegarde AsyncStorage `dlf_player_v1` est
  elle aussi remise à zéro si elle est antérieure à la version 2.
- L'ordre est : remise à zéro cloud, puis remise à zéro locale, puis `restoreFromCloud`. Si l'écriture
  cloud échoue (hors-ligne), l'ancien profil n'est PAS restauré et l'opération est retentée à la
  connexion suivante.
- Les nouveaux profils naissent directement à `progressionVersion: 2` : pas de remise à zéro en boucle.

## Ce que la purge proposerait de supprimer

| Collection | Contenu | Raison |
|---|---|---|
| `leaderboard` | classement général (`level`, `score`, `badgeScore`) | scores calculés avec l'ancien modèle ; reconstruit à la prochaine victoire de chaque joueur |
| `worldRecords` | meilleur temps par défi | records obtenus avec l'ancien système ; les « premiers records » (`record_first`) seraient de nouveau possibles |
| `dailyChallenges/*/results/*` | résultats du Défi du Jour par date | classements et séries d'avant ; la structure change au Lot 6 (deux ligues) |
| `jackpot`, `jackpotClaims` | bandit manchot du Défi du Jour | cagnotte et réclamations liées aux anciens comptes |
| `friendChallenges` | défis entre amis en cours | construits sur d'anciens niveaux et d'anciens profils |

## Ce qui n'est PAS purgé (par conception)

- **`foret_commune`** (compteur collectif de vrais arbres) : jamais touché, absent du script. Toute
  modification demande une confirmation explicite et séparée.
- **`players`** : pas supprimés. Remis à zéro par l'app à la connexion.
- **`metrics`** : données de rétention, utiles pour mesurer l'effet de la refonte. À purger seulement
  si vous le décidez.

## Points à trancher avant d'exécuter

1. **Faut-il purger `worldRecords` ?** Si oui, les records réapparaîtront au fil des parties. Si non, de
   nouveaux joueurs devront battre des temps obtenus avec l'ancien système (par exemple avec bonus).
2. **Faut-il purger `friendChallenges` ?** Des défis en cours disparaîtraient pour leurs joueurs.
3. **`metrics`** : conserver (recommandé, pour comparer avant / après) ou purger ?
4. **Droits Firestore** : le script se connecte avec un compte e-mail. Ce compte doit avoir le droit
   d'écrire dans ces collections ; les règles actuelles ne sont pas dans le dépôt, je ne peux pas le
   vérifier. À défaut, la purge se fait depuis la console Firebase.
5. **Moment** : l'idéal est de purger juste avant d'activer `PROGRESSION_V2`, pas avant.

## Bouton admin dans l'application

Le compte administrateur (`Ramoni`, `src/constants/devAccess.ts`) voit dans le Profil un bouton « Purger la progression v2 » (`AdminPurgeModal`, `purgeProgressionService.ts`). Même liste de collections que le script (`src/constants/purgeProgression.ts`), même principe en deux temps :

1. **Compter (simulation)** : lit les collections et affiche le nombre de documents par collection, sans rien écrire.
2. **Supprimer pour de bon** : bouton grisé tant que le comptage n'a pas été fait ET que le mot `PURGER` n'est pas saisi. Suppression par lots de 400, avec progression.

Garde-fous : réservé à l'administrateur (refusé dans le service, pas seulement masqué) ; chaque ouverture de la modale repart de zéro ; `foret_commune`, `players` et `metrics` ne sont jamais touchées. Le compte connecté doit avoir le droit d'écriture sur ces collections (règles Firestore, absentes du dépôt) : sinon l'opération échoue avec un message, sans suppression partielle silencieuse (les lots déjà validés restent supprimés).

## Comment l'exécuter en ligne de commande (après validation)

Le script est `scripts/purgeProgressionV2.ts`. Il est en **dry-run par défaut** : il compte les
documents sans rien supprimer.

```powershell
$env:PURGE_EMAIL = "compte-admin@exemple.com"
$env:PURGE_PASSWORD = "..."
npx ts-node --project tsconfig.scripts.json scripts/purgeProgressionV2.ts
```

La suppression réelle exige **les deux** garde-fous :

```powershell
$env:PURGE_CONFIRM = "OUI_JE_CONFIRME"
npx ts-node --project tsconfig.scripts.json scripts/purgeProgressionV2.ts --execute
```

`--execute` seul, sans `PURGE_CONFIRM`, est refusé.
