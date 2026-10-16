# Plan — Mode ONF : Grille Forestière (Sudoku Forestier)

## Contexte & décisions validées

**Mécanique** : Grille régulière N×N (3×3 puis 4×4) avec connexions orthogonales (haut/bas/gauche/droite). Le joueur pose ses jetons comme dans le jeu principal (drag & drop). Toutes les règles de voisinage existantes s'appliquent **plus** une contrainte additionnelle : **un même élément ne peut pas apparaître deux fois dans la même ligne ni dans la même colonne** (max-1-par-ligne/colonne, sans exiger 1 de chaque partout — sudoku assoupli).

**Éléments compatibles** : bucheron, ours, mouton, loup, renard, ruche, cerf, biche, tas_buches, chalet. **`chien` exclu** (connected_group ≥ 2 + contrainte sudoku = structurellement impossible).

**Progression** :
- `currentLevel >= 5` → débloque 3×3
- 10 parties 3×3 résolues → débloque 4×4

**Génération** : temps réel à chaque nouvelle partie (comme le daily), pas de JSON pré-généré.

**Entrée** : carte dans `app/(tabs)/index.tsx` (comme la carte Daily).

**Écran de jeu** : nouvelle route `app/game/onf.tsx`.

**Bonus & graines** : disponibles comme dans le jeu principal.

**Persistence** : `playerStore` + Firestore (`/players/{uid}`).

**Background** : fond de forêt existant réutilisé (pas d'asset ONF externe).

---

## Seuils configurables (constantes faciles à modifier)

```ts
// src/constants/onf.ts  (nouveau fichier)
export const ONF_UNLOCK_LEVEL = 5;           // currentLevel >= 5 → 3×3 accessible
export const ONF_4X4_UNLOCK_COUNT = 10;      // nb de 3×3 résolus → 4×4 accessible
```

---

## Tâches d'implémentation

### 1. Nouveau type de contrainte `row_col_unique`

**Fichier** : `src/core/models/Element.ts`

Ajouter `'row_col_unique'` à `ConstraintType`. Cette contrainte ne s'appuie pas sur `connections` mais sur les métadonnées `rows`/`cols` du plateau.

> Note : la contrainte n'est pas déclarée dans `ElementDefinition` (elle est universelle au mode, pas spécifique à un élément). Elle sera vérifiée séparément dans le validateur ONF.

### 2. Nouveau modèle de plateau étendu

**Fichier** : `src/core/models/Board.ts`

Ajouter un champ optionnel à `BoardDefinition` :

```ts
gridMeta?: {
  rows: number[][];  // gridMeta.rows[i] = tableau des indices de cases de la ligne i
  cols: number[][];  // gridMeta.cols[j] = tableau des indices de cases de la colonne j
};
```

Ce champ est présent uniquement sur les plateaux ONF. Le validateur standard l'ignore.

### 3. Définitions des plateaux ONF

**Nouveaux fichiers** :
- `src/boards/board_3x3_onf.ts`
- `src/boards/board_4x4_onf.ts`

#### board_3x3_onf.ts — 9 cases

```
[0][1][2]   ← ligne 0
[3][4][5]   ← ligne 1
[6][7][8]   ← ligne 2
```

```ts
connections: [
  [1, 3],       // 0
  [0, 2, 4],    // 1
  [1, 5],       // 2
  [0, 4, 6],    // 3
  [1, 3, 5, 7], // 4 (centre)
  [2, 4, 8],    // 5
  [3, 7],       // 6
  [4, 6, 8],    // 7
  [5, 7],       // 8
]
gridMeta: {
  rows: [[0,1,2], [3,4,5], [6,7,8]],
  cols: [[0,3,6], [1,4,7], [2,5,8]],
}
```

Positions en % (grille carrée centrée) :
- (x, y) pour case (col, row) : x = 20 + col*30, y = 20 + row*30

Background : fond existant `board_9_v1` ou `board_8_v2` (à choisir à l'implémentation selon le rendu).

#### board_4x4_onf.ts — 16 cases

Même logique, cases 0–15, connexions orthogonales, `gridMeta.rows` = 4 lignes de 4, `gridMeta.cols` = 4 colonnes de 4.

Positions : x = 12.5 + col*25, y = 12.5 + row*25.

Background : fond existant `board_12` ou `board_10_v3`.

### 4. Enregistrement dans `BoardRegistry`

**Fichier** : `src/boards/BoardRegistry.ts`

Ajouter `board_3x3_onf` et `board_4x4_onf` à l'export du registre.

### 5. Validateur ONF — contrainte `row_col_unique`

**Fichier** : `src/core/engine/validator.ts` (ou nouveau `src/core/engine/onfValidator.ts`)

Ajouter une fonction exportée :

```ts
export function validateRowColUnique(
  board: (string | null)[],
  gridMeta: { rows: number[][]; cols: number[][] }
): Violation[]
```

Pour chaque ligne et chaque colonne, vérifier qu'aucun `elementId` n'y apparaît plus d'une fois. Retourne des `Violation[]` avec un nouveau `constraintType: 'row_col_unique'`.

Cette fonction est appelée **en plus** de `validateBoard()` standard depuis l'écran de jeu ONF.

### 6. Solveur ONF — élagage `row_col_unique`

**Fichier** : `src/core/engine/solver.ts` (ou nouveau `src/core/engine/onfSolver.ts`)

Créer `solveOnf(input: SolverInput & { gridMeta })` qui étend `backtrack` avec un prédicat d'élagage :
- Avant de placer un élément en case `i`, vérifier que la ligne et la colonne de `i` ne contiennent pas déjà cet élément.
- Ce check s'ajoute au `isPlacementValid` existant.

Option recommandée : créer une fonction wrapper `isPlacementValidOnf(cellIndex, elementId, board, boardDef, elementDefs)` qui appelle `isPlacementValid` puis vérifie la contrainte ligne/colonne via `gridMeta`.

### 7. Générateur de défis ONF

**Nouveau fichier** : `src/services/onfChallengeService.ts`

```ts
export function generateOnfChallenge(gridSize: 3 | 4, rng?: RngFunction): Challenge | null
```

Logique :
1. Choisir aléatoirement une composition depuis `ONF_COMPOSITIONS_3x3` ou `ONF_COMPOSITIONS_4x4` (tableaux définis dans le fichier, analogues aux compositions du daily).
2. Choisir aléatoirement des `fixedPlacements` (N cases pré-remplies, entre 2 et 4 selon la taille).
3. Appeler `solveOnf()` — si `isUnique`, c'est le défi. Sinon, réessayer (max 50 tentatives).
4. Retourne un `Challenge` standard (compatible avec `gameStore.loadChallenge`).

**Compositions ONF — contraintes de composition** :
- 3×3 : 9 cases. Exemples valides : `{bucheron:3, ours:3, mouton:3}`, `{bucheron:2, ours:3, mouton:2, loup:2}`, `{ours:3, mouton:3, loup:3}`, `{bucheron:3, mouton:3, renard:3}`. Max 3 éléments distincts (pour que la contrainte sudoku reste soluble avec 3 de chaque dans 9 cases). Ruche max 1 (possible si ours ≥ 1). Pas de chien. Cerf = biche si présents.
- 4×4 : 16 cases. 4 éléments distincts × 4 ou compositions asymétriques. Max 4 éléments distincts recommandé pour la jouabilité. Exemples : `{bucheron:4, ours:4, mouton:4, loup:4}`, `{bucheron:3, ours:4, mouton:4, loup:3, renard:2}`.

> La contrainte sudoku assouplie (max 1 par ligne/colonne) est plus permissive qu'un sudoku strict. Des compositions asymétriques sont donc jouables (ex: 3 bucheron + 3 ours + 3 mouton sur 9 cases).

**ID du défi** : `onf_3x3_<timestamp>` ou `onf_4x4_<timestamp>` (pas besoin d'unicité Firestore, c'est local).

### 8. État ONF dans `playerStore`

**Fichier** : `src/store/playerStore.ts`

Ajouter à `PlayerState` :

```ts
// ── Mode ONF ──────────────────────────────────────────────────
onf3x3SolvedCount: number;   // nb de 3×3 résolus (sert à débloquer 4×4)
onf4x4SolvedCount: number;   // statistique
```

Ajouter les actions :

```ts
incrementOnf3x3Solved: () => void;
incrementOnf4x4Solved: () => void;
```

Valeurs initiales : `0` pour les deux.

**Sélecteur dérivé** (non stocké, calculé) :
```ts
// Accessible dans les composants :
const isOnfUnlocked = currentLevel >= ONF_UNLOCK_LEVEL;
const isOnf4x4Unlocked = onf3x3SolvedCount >= ONF_4X4_UNLOCK_COUNT;
```

### 9. Sync Firestore

**Fichier** : `src/services/playerService.ts`

Ajouter `onf3x3SolvedCount` et `onf4x4SolvedCount` à `PlayerProfile` et à `migrateProfile` (défaut `0`).

Inclure ces champs dans `upsertPlayer` / `updatePlayerAfterGame` (ou équivalent existant).

### 10. Écran de jeu ONF

**Nouveau fichier** : `app/game/onf.tsx`

Paramètre de route : `?size=3` ou `?size=4`.

Flux :
1. `useLocalSearchParams` → `size: '3' | '4'`
2. `generateOnfChallenge(size)` → `challenge`
3. `gameStore.loadChallenge(challenge)`
4. Même rendu que `app/game/[challengeId].tsx` (BoardRenderer, ElementPalette, drag & drop)
5. **Validation** : bouton Valider → `validateBoard()` + `validateRowColUnique()` → union des violations. Si toutes nulles ET `checkVictory()` → victoire.
6. Victoire → `player.addSeeds(seedsEarned)` + `player.incrementOnf3x3Solved()` ou `incrementOnf4x4Solved()` + sync Firestore.
7. Bouton "Nouveau défi" (pas de briefing obligatoire après la première partie) → régénère un défi de même taille.

**Affichage de la contrainte sudoku** : bandeau ou icône distinctif rappelant la règle ligne/colonne (à concevoir visuellement — peut être une simple ligne dans le header ou une infobulle).

### 11. Carte ONF dans `app/(tabs)/index.tsx`

Ajouter une section "Mode ONF" après la carte Daily (ou avant, selon l'ordre éditorial). Affichage conditionnel :
- `currentLevel < ONF_UNLOCK_LEVEL` → carte grisée avec "Débloqué au niveau 5"
- `currentLevel >= ONF_UNLOCK_LEVEL` → carte active avec bouton "Jouer 3×3"
- `onf3x3SolvedCount >= ONF_4X4_UNLOCK_COUNT` → affiche aussi bouton "Jouer 4×4"

### 12. Visualisation de la contrainte dans `BoardRenderer`

La contrainte ligne/colonne doit être visible. Deux approches (choisir à l'implémentation) :

**Option A** (recommandée) : surligner les cases de la même ligne et colonne que la case sélectionnée (fond légèrement coloré), comme un vrai sudoku.

**Option B** : afficher des indicateurs d'erreur rouge sur les cases en conflit ligne/colonne lors de la validation (analogue aux violations existantes).

L'option A nécessite de passer `gridMeta` au `BoardRenderer` ou à `getCellColor`. Cette prop est déjà sous contrôle du parent (`onf.tsx`) qui peut calculer les ensembles de cases à surligner.

---

## Fichiers créés

| Fichier | Rôle |
|---|---|
| `src/constants/onf.ts` | Constantes de débloquage |
| `src/boards/board_3x3_onf.ts` | Plateau 3×3 avec gridMeta |
| `src/boards/board_4x4_onf.ts` | Plateau 4×4 avec gridMeta |
| `src/services/onfChallengeService.ts` | Générateur temps réel + compositions |
| `app/game/onf.tsx` | Écran de jeu ONF |

## Fichiers modifiés

| Fichier | Modification |
|---|---|
| `src/core/models/Board.ts` | Ajout `gridMeta?: { rows, cols }` à `BoardDefinition` |
| `src/core/engine/validator.ts` | Ajout `validateRowColUnique()` |
| `src/core/engine/solver.ts` | Ajout `solveOnf()` ou `isPlacementValidOnf()` |
| `src/boards/BoardRegistry.ts` | Enregistrement des 2 nouveaux plateaux |
| `src/store/playerStore.ts` | Ajout `onf3x3SolvedCount`, `onf4x4SolvedCount`, actions |
| `src/services/playerService.ts` | Ajout champs ONF dans `PlayerProfile` + migration |
| `app/(tabs)/index.tsx` | Carte ONF conditionnelle |

---

## Risques & points d'attention

1. **Unicité sur grille orthogonale** : le solver ONF doit être testé empiriquement. Sur 3×3 avec 3 éléments × 3 et des contraintes de voisinage fortes (ex: mouton ≠ renard), il peut n'y avoir aucune solution valide pour certaines compositions. La liste `ONF_COMPOSITIONS_3x3` doit être validée par des tests de génération (cf. `scripts/diagnose.ts`).

2. **Performance du solver** : sur 4×4 (16 cases), le backtracking avec élagage ligne/colonne + contraintes de voisinage devrait rester rapide (< 100ms). À vérifier. Si trop lent, générer en `useEffect` avec un état `loading`.

3. **Compatibilité `checkVictory`** : la victoire ONF ne peut pas utiliser `checkVictory()` seul (comparaison simple avec `solution`). Il faut appeler `validateRowColUnique()` sur la solution du joueur pour être sûr. Alternativement, la solution pré-calculée par le solver satisfait déjà la contrainte — donc `checkVictory()` seul suffit si la solution est correcte.

   > **Décision** : utiliser `checkVictory()` seul. La solution pré-calculée par `solveOnf` est garantie valide (contrainte sudoku incluse). La validation intermédiaire (bouton Valider) utilisera `validateBoard()` + `validateRowColUnique()` pour le retour visuel au joueur.

4. **`cerf/biche` sur grille 3×3** : deux cases voisines sont forcément dans la même ligne ou la même colonne → cerf et biche (éléments distincts) peuvent être voisins sans violer la contrainte sudoku (ils sont différents). Compatible. Mais leur `paired_specific` (exactement 1 voisin du type partenaire) est contraignant sur une petite grille — les inclure uniquement dans les compositions 4×4.

5. **`ruche` sur 3×3** : ruche = max 1, ours voisin obligatoire. Sur 3×3, l'ours et la ruche seraient dans des lignes/colonnes différentes — compatible. Inclure prudemment, valider en génération.

6. **`tas_buches` et `chalet`** : chaîne bucheron→bûches→chalet. Complexité élevée sur petites grilles. Réserver à la 4×4 uniquement.

---

## Validation

1. Créer un script `scripts/testOnfGenerator.ts` qui génère 100 défis 3×3 et 100 défis 4×4, vérifie l'unicité et la validité de chaque solution, et mesure le temps de génération.
2. Test manuel : vérifier que le drag & drop fonctionne, que les violations ligne/colonne sont bien affichées, que la victoire est détectée correctement.
3. Vérifier la persistance Firestore après une victoire ONF (champs `onf3x3SolvedCount`, seeds).
4. Vérifier le débloquage progressif (3×3 à niveau 5, 4×4 après 10 parties 3×3).
