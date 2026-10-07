# Plan — Défi Journalier "L'Épreuve de la Forêt"

## Résumé

Défi quotidien sur un nouveau plateau de 15 cases avec un nouvel élément (champignon). Même défi pour tous les joueurs, une seule validation, pas de bonus. Cases pré-remplies proportionnelles au niveau du joueur (handicap inversé). Classement mondial éphémère 24h.

---

## Étape 0 — Carte à 15 cases ✅ VALIDÉE

### Disposition : "Clairière Secrète"

```
     [0]──────────────[1]──────────────[2]          ← Couronne Nord
      |\               |                |
      | \              |                |
     [5] [3]          [7]             [4] [6]       ← Bords + Centre intérieur haut
      |   |          / | \             |   |
      |   |        /   |   \           |   |
     [8] [10]────/    [13]   \────[11] | [9]        ← Bords + Centre intérieur bas
      |   |          / | \         |   |
      |   |        /   |   \       |   |
    [12]──|──────/     |     \─────|──[14]          ← Couronne Sud
```

5 cases CENTRE (champignon autorisé) : **3, 4, 7, 10, 11**
10 cases COURONNE (bord de forêt) : **0, 1, 2, 5, 6, 8, 9, 12, 13, 14**

### Positions visuelles (% de la zone de jeu)

| Case | x   | y   | Rôle | Description |
|------|-----|-----|------|-------------|
| 0    | 12  | 5   | Couronne | Coin nord-ouest |
| 1    | 50  | 5   | Couronne | Nord-centre |
| 2    | 88  | 5   | Couronne | Coin nord-est |
| 3    | 30  | 28  | **Centre** | Intérieur haut-gauche |
| 4    | 70  | 28  | **Centre** | Intérieur haut-droite |
| 5    | 8   | 30  | Couronne | Bord gauche haut |
| 6    | 92  | 30  | Couronne | Bord droite haut |
| 7    | 50  | 38  | **Centre (hub)** | Centre absolu haut |
| 8    | 8   | 62  | Couronne | Bord gauche bas |
| 9    | 92  | 62  | Couronne | Bord droite bas |
| 10   | 30  | 62  | **Centre** | Intérieur bas-gauche |
| 11   | 70  | 62  | **Centre** | Intérieur bas-droite |
| 12   | 12  | 90  | Couronne | Coin sud-ouest |
| 13   | 50  | 78  | Couronne | Sud-centre |
| 14   | 88  | 90  | Couronne | Coin sud-est |

### Connexions (graphe de voisinage) — VALIDÉES

| Case | Voisins | Nb | Rôle |
|------|---------|-----|------|
| 0    | [1, 3, 5] | 3 | Couronne (coin) |
| 1    | [0, 2, 7] | 3 | Couronne |
| 2    | [1, 4, 6] | 3 | Couronne (coin) |
| 3    | [0, 5, 7, 10] | 4 | **Centre** |
| 4    | [2, 6, 7, 11] | 4 | **Centre** |
| 5    | [0, 3, 8] | 3 | Couronne (bord) |
| 6    | [2, 4, 9] | 3 | Couronne (bord) |
| 7    | [1, 3, 4, 10, 11, 13] | 6 | **Centre (hub)** |
| 8    | [5, 10, 12] | 3 | Couronne (bord) |
| 9    | [6, 11, 14] | 3 | Couronne (bord) |
| 10   | [3, 7, 8, 12] | 4 | **Centre** |
| 11   | [4, 7, 9, 14] | 4 | **Centre** |
| 12   | [8, 10, 13] | 3 | Couronne (coin) |
| 13   | [7, 12, 14] | 3 | Couronne |
| 14   | [9, 11, 13] | 3 | Couronne (coin) |

### Propriétés du graphe

- **Centre** (5 cases) : 3, 4, 7, 10, 11
  - Case 7 = hub central (6 voisins), connecté aux 4 autres cases centre + 2 couronne (1, 13)
  - Cases 3/4 = anneau intérieur haut (4 voisins chacune)
  - Cases 10/11 = anneau intérieur bas (4 voisins chacune)
- **Couronne** (10 cases) : 0, 1, 2, 5, 6, 8, 9, 12, 13, 14
  - Coins (3 voisins) : 0, 2, 12, 14
  - Bords (3 voisins) : 1, 5, 6, 8, 9, 13
  - Anneau complet : 0→1→2→6→9→14→13→12→8→5→0
- **Symétrie** gauche-droite (axe 1, 7, 13) :
  - 0 ↔ 2, 3 ↔ 4, 5 ↔ 6, 8 ↔ 9, 10 ↔ 11, 12 ↔ 14
  - Cases 1, 7, 13 sur l'axe

### `specialCells`

```ts
specialCells: {
  corners: [0, 2, 12, 14],
  center:  [3, 4, 7, 10, 11],
  edges:   [1, 5, 6, 8, 9, 13],
}
```

---

## Étape 1 — Nouvel élément : Champignon

### Définition (`src/elements/champignon.ts`)

| Champ | Valeur |
|---|---|
| id | `champignon` |
| label | `Champignon` |
| color | `#8B6914` (brun doré) |
| maxPerBoard | 3 |
| icon | Nouvel asset `assets/elements/champignon.png` (à fournir — placeholder emoji 🍄 en attendant) |
| constraints | `neighbor_same` / `forbid` (deux champignons ne sont pas voisins) |
| placementRules | `[{ type: 'center_only' }]` — uniquement sur `specialCells.center` (cases 3, 4, 7, 10, 11) |

Invariant I8 : `champignon ≤ 3`, placement uniquement sur les 5 cases centre.
Note : sur les 5 cases centre, la contrainte `neighbor_same/forbid` + la topologie (7 est voisin des 4 autres) limitent de fait le placement à max 2 champignons sur {3,11} ou {4,10} ou {3,4} ou {10,11} — 7 ne peut jamais cohabiter avec un autre champignon car il est voisin de tous.

### Fichiers impactés

- Créer `src/elements/champignon.ts`
- `src/elements/ElementRegistry.ts` : ajouter `champignon: champignonDef`
- `src/core/engine/validator.ts` : vérifier que `isPlacementValid()` respecte aussi `placementRules` (actuellement seul `validateBoard` le fait)
- `src/core/engine/hintEngine.ts` : `getValidCellsForElement` doit aussi filtrer par `placementRules`
- Asset placeholder : `assets/elements/champignon.png`

---

## Étape 2 — Plateau 15 cases (`board_15_daily`)

### Fichier `src/boards/board_15cells_daily.ts`

Créer le fichier avec la définition validée à l'étape 0, incluant :
- `id: 'board_15_daily'`
- `label: 'Clairière Secrète'`
- `cellCount: 15`
- `connections` : tableau validé (voir étape 0)
- `cellPositions` : positions validées (voir étape 0)
- `availableElements` : les 10 éléments existants + `champignon`
- `specialCells.center: [3, 4, 7, 10, 11]`
- `specialCells.corners: [0, 2, 12, 14]`
- `specialCells.edges: [1, 5, 6, 8, 9, 13]`

### Fichiers impactés

- Créer `src/boards/board_15cells_daily.ts`
- `src/boards/BoardRegistry.ts` : ajouter `board_15_daily`

---

## Étape 3 — Génération déterministe du défi journalier

### Service `src/services/dailyChallengeService.ts`

- `getDailyChallengeId(date: Date)` : retourne `daily_YYYY-MM-DD`
- `generateDailyChallenge(date: Date)` : utilise la date comme seed pour le PRNG → même challenge pour tous les joueurs
  - Plateau : toujours `board_15_daily`
  - Composition : rotation de compositions inhabituelles (incluant 1-2 champignons)
  - Cases vides : 7 (fixe — plateau 15 cases, 8 pré-remplis = défi conséquent)
  - Solution unique vérifiée par le solveur
  - Pas de `availableTokens` au sens classique car le nombre de cases pré-remplies varie par joueur
- `getDailyFixedPlacements(playerLevel: number, baseSolution: string[])` :
  - Niveau 10+ : 4 cases pré-remplies
  - Niveau 8-9 : 5 cases
  - Niveau 6-7 : 6 cases
  - Niveau 4-5 : 7 cases
  - Niveau 2-3 : 8 cases
  - Niveau 1 : 9 cases
  - Les cases pré-remplies sont choisies de façon déterministe (même seed) pour que le classement soit comparable

### Collection Firestore

- `/dailyChallenges/{YYYY-MM-DD}` : stocke le challenge JSON pré-généré (ou généré à la demande côté client avec le seed)
- `/dailyChallenges/{YYYY-MM-DD}/results/{userId}` : `{ timeMs, completedAt, playerLevel }`

### Approche de génération

**Option retenue : génération côté client avec seed déterministe.** La date sert de seed → même séquence pseudo-aléatoire pour tous. Pas de Cloud Function nécessaire. Le résultat est validé côté client puis soumis à Firestore.

---

## Étape 4 — Écran de jeu journalier (`app/game/daily.tsx`)

Variante de `[challengeId].tsx` avec les différences suivantes :

| Aspect | Mode normal | Mode journalier |
|---|---|---|
| Bonus | Disponibles | **Désactivés** (`bonusDisabled = true`) |
| Validations | Illimitées | **1 seule** (`singleValidation = true`) |
| HintOverlay | Affiché | **Masqué** |
| Timer | Standard | Standard (identique) |
| Victoire | markChallengeCompleted + badges | `submitDailyResult()` + badges journaliers |
| Échec | FailModal "Réessayer" | **FailModal "Rendez-vous demain"** (pas de retry) |
| FallingLeaves | Selon préférence | Selon préférence (inchangé) |

### Nouveau state dans `gameStore`

- `isDailyChallenge: boolean` — flag activé par `loadDailyChallenge()`
- `dailyValidationUsed: boolean` — bloque le bouton Valider après 1 usage

---

## Étape 5 — État joueur + persistance

### `playerStore.ts` — Nouveaux champs

```ts
dailyChallengeStreak: number;        // Jours consécutifs réussis (indépendant du streak normal)
lastDailyChallengeDate: string;      // "YYYY-MM-DD"
dailyChallengeStatus: 'pending' | 'success' | 'failed' | null;  // Statut du jour
```

### Actions

- `submitDailyResult(date: string, success: boolean)` : met à jour streak + status
- `resetDailyStatus()` : appelé quand la date change (nouveau jour)

### `useStorage.ts`

Ajouter `dailyChallengeStreak`, `lastDailyChallengeDate`, `dailyChallengeStatus` au schéma persisté.

---

## Étape 6 — Classement journalier

### Firestore `dailyChallenges/{date}/results/{userId}`

```ts
{
  userId: string;
  username: string;
  timeMs: number;
  playerLevel: number;
  completedAt: Timestamp;
}
```

### Service `src/services/dailyChallengeService.ts`

- `submitDailyResult(date, userId, username, timeMs, playerLevel)` — écrit dans Firestore
- `subscribeDailyLeaderboard(date, maxCount, onChange)` — écoute en temps réel, trié par `timeMs asc`
- `getDailyStatus(date, userId)` — vérifie si le joueur a déjà joué aujourd'hui

### LeaderboardScreen

Nouvel onglet "Jour" (5e onglet) :
- Affiche le classement du jour en cours
- Tri par `timeMs` ascendant (plus rapide = meilleur)
- Indication du niveau de chaque joueur + nombre de cases révélées (transparence)

---

## Étape 7 — UI d'accès au défi journalier

### `app/(tabs)/index.tsx` — Carte "Défi du Jour" 

Insérée **avant** la carte "Continuer" :

- **Non joué** : carte dorée pulsante `🌅 Défi du Jour` avec compteur de participants
- **Réussi** : carte verte `✓ {temps} — #{rang} mondial`
- **Échoué** : carte grise `Rendez-vous demain`
- **Non connecté** : masquée

### `app/(tabs)/levels.tsx` — Accès secondaire

Bouton "Défi du Jour" au-dessus de la carte "Continuer".

---

## Étape 8 — Badges journaliers

4 nouveaux badges dans `src/constants/badges.ts` :

| id | Label | Condition | Rareté |
|---|---|---|---|
| `daily_first` | Premier Pas Quotidien | Réussir 1 défi journalier | Bois (5🌱) |
| `daily_week` | Semaine Parfaite | 7 jours consécutifs réussis | Pierre (15🌱) |
| `daily_month` | Forestier Assidu | 30 jours consécutifs réussis | Or (30🌱) |
| `daily_champion` | Champion du Jour | Terminer #1 mondial un jour | Cristal (75🌱) |

### `badgeEngine.ts`

Ajouter l'évaluation des badges journaliers dans un nouveau contexte `DailyGameContext` (distinct de `GameContext` existant).

---

## Étape 9 — Récompenses

| Résultat | Graines |
|---|---|
| Réussi (base) | 5 |
| Top 10% | +5 |
| Top 3 | +15 |
| #1 mondial | +25 |
| Streak 7 jours | +20 (bonus unique) |

Le calcul des récompenses est fait côté client après soumission et lecture du classement.

---

## Étape 10 — i18n

~25 nouvelles clés dans `fr.json` et `en.json` :
- Titres et descriptions du défi journalier
- Statuts (réussi, échoué, en attente)
- Badges journaliers
- Onglet classement "Jour"
- Règle du champignon pour le briefing
- Messages d'erreur / validation unique

---

## Cases pré-remplies par niveau (handicap)

| Niveau joueur | Cases pré-remplies | Cases à remplir |
|---|---|---|
| 10-15 | 4 | 11 |
| 8-9 | 5 | 10 |
| 6-7 | 6 | 9 |
| 4-5 | 7 | 8 |
| 2-3 | 8 | 7 |
| 1 | 9 | 6 |

Les cases pré-remplies sont tirées de la solution avec le même seed que le challenge, garantissant que tous les joueurs d'un même niveau voient les mêmes indices.

---

## Risques et points d'attention

1. **Asset champignon** : un placeholder emoji (`🍄`) suffira pour le développement ; l'asset PNG définitif sera fourni séparément
2. **Seed PRNG** : utiliser un PRNG déterministe pur (pas `Math.random()`) — un simple LCG ou mulberry32 suffit
3. **Fuseau horaire** : le "jour" est déterminé en UTC pour que tous les joueurs du monde aient le même défi au même moment
4. **Composition** : les compositions journalières doivent inclure le champignon (1-2) et respecter tous les invariants I1-I8
5. **isPlacementValid + hintEngine** : doivent intégrer `placementRules` pour que le champignon ne puisse être placé que sur les cases centre, tant dans le solveur que dans le bonus "cases valides"
6. **Pas de conflit avec le mode normal** : le défi journalier est entièrement séparé des 15 niveaux existants (ID `daily_YYYY-MM-DD`, pas `niveau_X_XXX`)

---

## Ordre d'implémentation

1. ~~Valider la carte 15 cases (étape 0)~~ ✅ VALIDÉE
2. Élément champignon (étape 1)
3. Plateau 15 cases (étape 2)
4. `isPlacementValid` + `hintEngine` : support `placementRules` (étape 1 dépendance)
5. Service de génération + Firestore (étape 3)
6. Écran de jeu journalier (étape 4)
7. État joueur + persistance (étape 5)
8. Classement journalier (étape 6)
9. UI d'accès (étape 7)
10. Badges + récompenses (étapes 8-9)
11. i18n (étape 10)
12. Vérification TypeScript + tests
