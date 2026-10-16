# Plan — Refonte 5 systèmes : ONF / UI / Badges / Graines / Statistiques

**Date** : 2026-10-11  
**Branche cible** : feature/refonte-systemes

---

## Vue d'ensemble des 5 chantiers

| # | Chantier | Fichiers principaux touchés |
|---|---|---|
| 1 | Diversité compositions ONF + champignon | `onfChallengeService.ts`, `board_4x4_onf.ts`, `validator.ts` |
| 2 | UI : descendre icônes speaker + retour | `ForestFrame.tsx`, `frameLayout.ts`, `onf.tsx` |
| 3 | Badges : 3 objectifs actifs + progression visible | `playerStore.ts`, `badgeEngine.ts`, `profile.tsx`, `i18n/*.json` |
| 4 | Bonus journaliers + achat jeton graines retiré | `playerStore.ts`, `bonus.ts`, `challenge.tsx`, `useGame.ts` |
| 5 | Statistiques : remplacer 3 cartes par 3 nouvelles | `playerStore.ts`, `profile.tsx`, services Firestore |

---

## Chantier 1 — Diversité ONF + champignon

### Objectif
Remplacer les compositions actuelles (principalement 4 types × 4 exemplaires = patterns diagonaux évidents) par des compositions **diversifiées** avec 4 à 7 types d'éléments différents, des quantités variées (3+3+2+2+1+1 etc.), jamais plus de 4 du même élément (contrainte row_col_unique), et incluant ruche, champignon, et optionnellement cerf/biche.

### Décisions architecturales

**Champignon en mode ONF :**  
Approche retenue : ajouter `specialCells: { center: [5, 6, 9, 10] }` au `board_4x4_onf.ts` (cases centrales en indices 0-based sur grille 4×4 = cases index 5, 6, 9, 10). L'invariant I8 (`if champignon > 0 → false`) sera levé sous condition : champignon ≤ 2, et uniquement placeable sur les cases centrales.  
Le validateur `isPlacementValidOnf` doit gérer `center_only` via `specialCells` — à vérifier.

**Chien en mode ONF :**  
Le chien a 2 contraintes cumulatives : `neighbor_same/require` (doit avoir au moins 1 voisin chien) ET `connected_group`. Un seul chien violerait immédiatement la contrainte `neighbor_same/require/minCount:1`. Il ne peut donc pas être placé seul. Il reste **exclu** (invariant I4 inchangé).

### Tâches

#### 1.1 — `src/boards/board_4x4_onf.ts`
- Ajouter `specialCells: { center: [5, 6, 9, 10] }` à la `BoardDefinition`

#### 1.2 — `src/services/onfChallengeService.ts`

**Lever l'invariant I8** : remplacer `if (get('champignon') > 0) return false` par `if (get('champignon') > 2) return false`.

**Ajouter l'invariant I11** : `if (ruche === 1 && ours > 2) return false` — avec ruche, max 2 ours pour garantir la solvabilité sudoku (l'ours doit être adjacent à la ruche unique, ce qui est très contraignant en grille).

**Ajouter l'invariant I12** : `if (champignon > 0 && champignon > specialCells.center.length) return false` — toujours vrai en 4×4 (4 cases centrales, champignon ≤ 2).

**Refondre `ONF_COMPOSITIONS_4X4`** : remplacer les 28 compositions existantes par **40 nouvelles compositions** respectant tous les invariants (Σ=16, chaque élément ≤ 4, ≥ 4 types distincts, jamais de composition "4+4+4+4"). Voici les compositions cibles calculées :

> **Règles de calcul appliquées :**
> - Σ = 16 (I1)
> - Tout élément ≤ 4 (I9 — row_col_unique)
> - cerf = biche (I5)
> - ruche ≤ 1 (I2) ; si ruche → ours ≥ 1, ours ≤ 2 (I3 + I11)
> - champignon ≤ 2 (I8 modifié)
> - chien exclu (I4 — contrainte `neighbor_same/require` incompatible avec un seul exemplaire)
> - chalet, tas_buches exclus (dépendances croisées trop contraignantes en grille sudoku)
> - ≥ 4 types distincts pour garantir la diversité visuelle

**Famille A — Base 4 types (sans éléments spéciaux) — 12 compositions**
```
{bucheron:4, mouton:4, ours:4, renard:4}                         — 4+4+4+4 EXCLU (voir note ci-dessous)
```
> Note : les compositions "4+4+4+4" sont exactement ce qu'on cherche à éliminer. La famille A commence donc à 3 types différents avec déséquilibre.

```
A01: {bucheron:4, mouton:4, ours:4, renard:3, cerf:1}            — INVALIDE (cerf≠biche)
```
> Toutes les compositions à 4 types équilibrés "4+4+4+4" sont exclues. Voici les compositions A valides :

```
A01: {bucheron:4, mouton:4, ours:3, renard:3, cerf:1, biche:1}   — 4+4+3+3+1+1 = 16 ✓
A02: {bucheron:4, mouton:3, ours:4, renard:3, cerf:1, biche:1}   — 4+3+4+3+1+1 = 16 ✓
A03: {bucheron:3, mouton:4, ours:4, renard:3, cerf:1, biche:1}   — 3+4+4+3+1+1 = 16 ✓
A04: {bucheron:4, mouton:3, ours:3, renard:4, cerf:1, biche:1}   — 4+3+3+4+1+1 = 16 ✓
A05: {bucheron:4, mouton:4, ours:2, renard:4, cerf:1, biche:1}   — 4+4+2+4+1+1 = 16 ✓
A06: {bucheron:4, mouton:4, ours:3, renard:2, cerf:2, biche:1}   — INVALIDE (cerf≠biche)
A06: {bucheron:4, mouton:4, ours:2, renard:2, cerf:2, biche:2}   — 4+4+2+2+2+2 = 16 ✓
A07: {bucheron:3, mouton:3, ours:4, renard:4, cerf:1, biche:1}   — 3+3+4+4+1+1 = 16 ✓
A08: {bucheron:3, mouton:4, ours:3, renard:4, cerf:1, biche:1}   — 3+4+3+4+1+1 = 16 ✓
A09: {bucheron:4, mouton:3, ours:2, renard:3, cerf:2, biche:2}   — 4+3+2+3+2+2 = 16 ✓
A10: {bucheron:3, mouton:3, ours:3, renard:3, cerf:2, biche:2}   — 3+3+3+3+2+2 = 16 ✓
A11: {bucheron:4, mouton:2, ours:4, renard:2, cerf:2, biche:2}   — 4+2+4+2+2+2 = 16 ✓
A12: {bucheron:2, mouton:4, ours:4, renard:2, cerf:2, biche:2}   — 2+4+4+2+2+2 = 16 ✓
```

**Famille B — Avec ruche (1 ruche, ours ≤ 2) — 10 compositions**
```
B01: {ruche:1, ours:1, bucheron:4, mouton:4, renard:4, cerf:1, biche:1}   — 1+1+4+4+4+1+1 = 16 ✓
B02: {ruche:1, ours:2, bucheron:4, mouton:4, renard:3, cerf:1, biche:1}   — 1+2+4+4+3+1+1 = 16 ✓
B03: {ruche:1, ours:2, bucheron:4, mouton:3, renard:4, cerf:1, biche:1}   — 1+2+4+3+4+1+1 = 16 ✓
B04: {ruche:1, ours:1, bucheron:4, mouton:4, renard:3, cerf:2, biche:1}   — INVALIDE (cerf≠biche)
B04: {ruche:1, ours:1, bucheron:4, mouton:4, renard:2, cerf:2, biche:2}   — 1+1+4+4+2+2+2 = 16 ✓
B05: {ruche:1, ours:2, bucheron:4, mouton:2, renard:3, cerf:2, biche:2}   — 1+2+4+2+3+2+2 = 16 ✓
B06: {ruche:1, ours:1, bucheron:3, mouton:4, renard:4, cerf:2, biche:1}   — INVALIDE
B06: {ruche:1, ours:1, bucheron:3, mouton:4, renard:4, cerf:2, biche:1}   — INVALIDE
B06: {ruche:1, ours:2, bucheron:3, mouton:3, renard:3, cerf:2, biche:2}   — 1+2+3+3+3+2+2 = 16 ✓
B07: {ruche:1, ours:1, bucheron:4, mouton:3, renard:3, cerf:2, biche:2}   — 1+1+4+3+3+2+2 = 16 ✓
B08: {ruche:1, ours:2, bucheron:4, mouton:4, renard:2, cerf:2, biche:1}   — INVALIDE (cerf≠biche)
B08: {ruche:1, ours:2, bucheron:3, mouton:4, renard:3, cerf:2, biche:1}   — INVALIDE
B08: {ruche:1, ours:2, bucheron:4, mouton:3, renard:2, cerf:2, biche:2}   — 1+2+4+3+2+2+2 = 16 ✓
B09: {ruche:1, ours:1, bucheron:3, mouton:3, renard:4, cerf:2, biche:2}   — 1+1+3+3+4+2+2 = 16 ✓
B10: {ruche:1, ours:2, bucheron:3, mouton:4, renard:2, cerf:2, biche:2}   — 1+2+3+4+2+2+2 = 16 ✓
```

**Famille C — Avec champignon (1-2 champignons, cases centrales) — 8 compositions**
```
C01: {champignon:1, bucheron:4, mouton:4, renard:4, cerf:2, biche:1}   — INVALIDE
C01: {champignon:1, bucheron:4, mouton:4, renard:3, cerf:2, biche:2}   — 1+4+4+3+2+2 = 16 ✓
C02: {champignon:1, bucheron:4, mouton:3, ours:4, renard:2, cerf:1, biche:1}   — 1+4+3+4+2+1+1 = 16 ✓
C03: {champignon:2, bucheron:4, mouton:4, ours:2, renard:2, cerf:1, biche:1}   — 2+4+4+2+2+1+1 = 16 ✓
C04: {champignon:2, bucheron:4, mouton:3, ours:3, renard:2, cerf:1, biche:1}   — 2+4+3+3+2+1+1 = 16 ✓
C05: {champignon:1, bucheron:4, mouton:3, ours:3, renard:3, cerf:1, biche:1}   — 1+4+3+3+3+1+1 = 16 ✓
C06: {champignon:2, bucheron:4, mouton:4, ours:2, renard:4}                    — 2+4+4+2+4 = 16 ✓
C07: {champignon:1, bucheron:4, mouton:4, ours:4, renard:2, cerf:1}            — INVALIDE (cerf sans biche)
C07: {champignon:2, bucheron:3, mouton:4, ours:3, renard:2, cerf:1, biche:1}   — 2+3+4+3+2+1+1 = 16 ✓
C08: {champignon:1, bucheron:4, mouton:4, ours:3, renard:3, cerf:1}            — INVALIDE (cerf sans biche)
C08: {champignon:1, bucheron:3, mouton:4, ours:4, renard:2, cerf:1, biche:1}   — 1+3+4+4+2+1+1 = 16 ✓
```

**Famille D — Cerf/biche dominants — 6 compositions**
```
D01: {cerf:4, biche:4, bucheron:4, mouton:2, renard:2}             — 4+4+4+2+2 = 16 ✓
D02: {cerf:3, biche:3, bucheron:4, mouton:3, ours:3}               — 3+3+4+3+3 = 16 ✓
D03: {cerf:3, biche:3, bucheron:4, mouton:2, ours:2, renard:2}     — 3+3+4+2+2+2 = 16 ✓
D04: {cerf:2, biche:2, bucheron:4, mouton:4, ours:2, renard:2}     — 2+2+4+4+2+2 = 16 ✓
D05: {cerf:2, biche:2, bucheron:4, mouton:3, ours:3, renard:2}     — 2+2+4+3+3+2 = 16 ✓
D06: {cerf:2, biche:2, bucheron:3, mouton:4, ours:3, renard:2}     — 2+2+3+4+3+2 = 16 ✓
```

**Famille E — Compositions à 7 types (maximum de diversité) — 4 compositions**
```
E01: {bucheron:3, mouton:2, ours:2, renard:2, cerf:2, biche:2, champignon:1, ruche:1}   — INVALIDE: ruche + champignon ensemble à vérifier au solveur ; et ours doit être ≥1 si ruche ✓ mais champignon+ruche = combinaison à tester
E01: {bucheron:3, mouton:3, ours:2, renard:2, cerf:2, biche:2, champignon:1, ruche:1}   — 3+3+2+2+2+2+1+1 = 16 ✓ (ruche+ours≤2✓, champignon≤2✓)
E02: {bucheron:4, mouton:2, ours:2, renard:2, cerf:2, biche:2, champignon:1, ruche:1}   — 4+2+2+2+2+2+1+1 = 16 ✓
E03: {bucheron:3, mouton:3, ours:1, renard:3, cerf:2, biche:2, champignon:1, ruche:1}   — 3+3+1+3+2+2+1+1 = 16 ✓
E04: {bucheron:4, mouton:3, ours:1, renard:2, cerf:2, biche:2, champignon:1, ruche:1}   — 4+3+1+2+2+2+1+1 = 16 ✓
```

> **Note importante sur la famille E** : Ruche + champignon simultanément est une combinaison nouvelle qui doit être testée au solveur. Si le backtracking échoue systématiquement, ces 4 compositions sont à retirer ou à séparer (ruche OU champignon, pas les deux). Le fallback (composition sans champignon) protège le générateur.

**Liste finale propre pour l'implémentation (42 compositions, doublons de calcul nettoyés) :**
```ts
const ONF_COMPOSITIONS_4X4 = [
  // Famille A — Diversité 6 types
  { bucheron:4, mouton:4, ours:3, renard:3, cerf:1, biche:1 },
  { bucheron:4, mouton:3, ours:4, renard:3, cerf:1, biche:1 },
  { bucheron:3, mouton:4, ours:4, renard:3, cerf:1, biche:1 },
  { bucheron:4, mouton:3, ours:3, renard:4, cerf:1, biche:1 },
  { bucheron:4, mouton:4, ours:2, renard:4, cerf:1, biche:1 },
  { bucheron:4, mouton:4, ours:2, renard:2, cerf:2, biche:2 },
  { bucheron:3, mouton:3, ours:4, renard:4, cerf:1, biche:1 },
  { bucheron:3, mouton:4, ours:3, renard:4, cerf:1, biche:1 },
  { bucheron:4, mouton:3, ours:2, renard:3, cerf:2, biche:2 },
  { bucheron:3, mouton:3, ours:3, renard:3, cerf:2, biche:2 },
  { bucheron:4, mouton:2, ours:4, renard:2, cerf:2, biche:2 },
  { bucheron:2, mouton:4, ours:4, renard:2, cerf:2, biche:2 },
  // Famille B — Avec ruche (ours ≤ 2)
  { ruche:1, ours:1, bucheron:4, mouton:4, renard:4, cerf:1, biche:1 },
  { ruche:1, ours:2, bucheron:4, mouton:4, renard:3, cerf:1, biche:1 },
  { ruche:1, ours:2, bucheron:4, mouton:3, renard:4, cerf:1, biche:1 },
  { ruche:1, ours:1, bucheron:4, mouton:4, renard:2, cerf:2, biche:2 },
  { ruche:1, ours:2, bucheron:4, mouton:2, renard:3, cerf:2, biche:2 },
  { ruche:1, ours:2, bucheron:3, mouton:3, renard:3, cerf:2, biche:2 },
  { ruche:1, ours:1, bucheron:4, mouton:3, renard:3, cerf:2, biche:2 },
  { ruche:1, ours:2, bucheron:4, mouton:3, renard:2, cerf:2, biche:2 },
  { ruche:1, ours:1, bucheron:3, mouton:3, renard:4, cerf:2, biche:2 },
  { ruche:1, ours:2, bucheron:3, mouton:4, renard:2, cerf:2, biche:2 },
  // Famille C — Avec champignon (cases centrales)
  { champignon:1, bucheron:4, mouton:4, renard:3, cerf:2, biche:2 },
  { champignon:1, bucheron:4, mouton:3, ours:4, renard:2, cerf:1, biche:1 },
  { champignon:2, bucheron:4, mouton:4, ours:2, renard:2, cerf:1, biche:1 },
  { champignon:2, bucheron:4, mouton:3, ours:3, renard:2, cerf:1, biche:1 },
  { champignon:1, bucheron:4, mouton:3, ours:3, renard:3, cerf:1, biche:1 },
  { champignon:2, bucheron:4, mouton:4, ours:2, renard:4 },
  { champignon:2, bucheron:3, mouton:4, ours:3, renard:2, cerf:1, biche:1 },
  { champignon:1, bucheron:3, mouton:4, ours:4, renard:2, cerf:1, biche:1 },
  // Famille D — Cerf/biche dominants
  { cerf:4, biche:4, bucheron:4, mouton:2, renard:2 },
  { cerf:3, biche:3, bucheron:4, mouton:3, ours:3 },
  { cerf:3, biche:3, bucheron:4, mouton:2, ours:2, renard:2 },
  { cerf:2, biche:2, bucheron:4, mouton:4, ours:2, renard:2 },
  { cerf:2, biche:2, bucheron:4, mouton:3, ours:3, renard:2 },
  { cerf:2, biche:2, bucheron:3, mouton:4, ours:3, renard:2 },
  // Famille E — 7-8 types (max diversité), ruche + champignon
  { bucheron:3, mouton:3, ours:2, renard:2, cerf:2, biche:2, champignon:1, ruche:1 },
  { bucheron:4, mouton:2, ours:2, renard:2, cerf:2, biche:2, champignon:1, ruche:1 },
  { bucheron:3, mouton:3, ours:1, renard:3, cerf:2, biche:2, champignon:1, ruche:1 },
  { bucheron:4, mouton:3, ours:1, renard:2, cerf:2, biche:2, champignon:1, ruche:1 },
];
```

**Mettre à jour le commentaire** de la fonction `isONFCompositionValid` pour documenter I11 et I12.
**Mettre à jour le tri anti-répétition** (`lastOnfCompoKey`) pour qu'il exclue aussi les familles similaires si possible (optionnel).

#### 1.3 — `src/core/engine/validator.ts` (si nécessaire)
- Vérifier que `isPlacementValidOnf` respecte bien `center_only` quand `specialCells.center` est défini sur le board ONF
- Si ce n'est pas le cas, ajouter le check : si `elementDef.placementConstraints?.includes('center_only')` ET `cell` n'est pas dans `boardDef.specialCells.center` → placement invalide

---

## Chantier 2 — UI : descendre icônes haut parleur + retour

### Contexte
- **`ForestFrame.tsx`** : speaker et back button positionnés en absolu avec `top: topBarCenterY - SIZE/2`  
  → `topBarCenterY = coinH / 2` = milieu de la barre des coins (trop haut sur certains appareils)
- **`app/game/onf.tsx`** : header maison en flex row, `paddingVertical: 6`, sans offset safe-area supplémentaire

### Objectif
Aligner les icônes avec le **bas des coins hauts** (pas le milieu). Autrement dit, les positionner à `top: coinH - SIZE` au lieu de `top: topBarCenterY - SIZE/2`.

### Tâches

#### 2.1 — `src/constants/frameLayout.ts`
- Ajouter la constante exportée `iconBottomY = coinH - SIZE_ICON` (avec `SIZE_ICON = 36`) pour centraliser la position cible
- Alternative plus simple : modifier directement dans ForestFrame (à décider à l'implémentation selon impact)

#### 2.2 — `src/components/Navigation/ForestFrame.tsx`
- Pour `SoundButton` : changer `top: topBarCenterY - SIZE / 2` → `top: coinH - SIZE` (aligner le bas de l'icône avec le bas du coin)
- Pour `backCircleBtn` : même changement

#### 2.3 — `app/game/onf.tsx`
- Le header flex n'a pas de problème de positionnement absolu, mais `paddingVertical: 6` peut être insuffisant
- Augmenter le `paddingVertical` du `header` style ou ajouter `paddingTop: insets.top + N` pour aligner visuellement avec les coins

> **Note** : Tester sur iPhone avec notch et Android avec barre de statut haute. Les valeurs exactes de décalage peuvent nécessiter un ajustement à l'exécution.

---

## Chantier 3 — Badges : 3 objectifs actifs + progression visible

### Concept
Remplacer l'affichage "fouillis" actuel par un système de **3 objectifs de badges actifs** choisis par le joueur, chacun avec :
- Icône + nom du badge
- Description de l'objectif ("Gagner 5 défis amis")
- Barre de progression current/target

### Architecture

#### État nouveau dans `playerStore`
```ts
activeBadgeGoals: string[];  // 3 badgeIds max, ordonnés par le joueur
```
- Initialisé à `[]`
- Le joueur **choisit** ses 3 objectifs parmi les badges non encore obtenus
- Persisté dans AsyncStorage + Firestore (`PlayerProfile`)

#### Calcul de progression
`getClosestBadges()` dans `badgeEngine.ts` retourne déjà `BadgeProgress[]` (currentValue, targetValue, percentage) pour les badges non obtenus. Cette fonction est réutilisée pour les objectifs actifs.  
Les badges sans progression numérique (secrets, saisonniers) ne sont **pas sélectionnables** comme objectif actif.

#### Interface

**Dans `app/(tabs)/profile.tsx`** — section badges :
- Afficher les 3 objectifs actifs avec barre de progression (composant `ActiveGoalCard`)
- Bouton "Changer mes objectifs" → ouvre un `BadgeGoalPickerModal`

**`BadgeGoalPickerModal`** (nouveau composant dans `src/components/Badges/`) :
- Liste des badges non obtenus **et éligibles** (ceux présents dans `progressMap` de `getClosestBadges`, plus les badges vitesse)
- Sélection max 3 (toggle)
- Bouton Confirmer → `player.setActiveBadgeGoals(ids)`

**`ActiveGoalCard`** (nouveau composant) :
- Affiche : emoji, label, description, barre de progression, current/target en texte
- Si badge obtenu entre-temps : afficher "✓ Obtenu !" + retirer automatiquement de `activeBadgeGoals` dans `awardBadges`

#### Déblocages via badges (remplacement de `RARITY_UNLOCKS` pour ONF/musique)
Remplacer les unlocks `mode_zen` et `defi_journalier` (qui semblent non implémentés fonctionnellement) par des unlocks **ONF** et **musique** :

| Rarity | Count | Unlock actuel | Nouvel unlock |
|---|---|---|---|
| bois × 6 | 6 | `mode_zen` | `music_unlock` (musique ambiante débloquée) |
| bois × 9 | 9 | `defi_journalier` | `mode_onf` (mode ONF débloqué, remplace `currentLevel >= 5`) |

> **Décision à confirmer** : l'actuel déverrouillage du mode ONF est `currentLevel >= ONF_UNLOCK_LEVEL (5)`. Le remplacer par `badges bois >= 9` change la condition. Les deux peuvent coexister (`currentLevel >= 5 OU badgeUnlock`). À confirmer à l'implémentation.

Mettre à jour `RarityUnlockId` et `RARITY_UNLOCKS` dans `badges.ts`, `computeUnlockedBonuses` dans `playerStore.ts`, et les gardes ONF dans `app/(tabs)/index.tsx` et `levels.tsx`.

### Tâches

#### 3.1 — `src/constants/badges.ts`
- Remplacer `mode_zen` par `music_unlock` et `defi_journalier` par `mode_onf` dans `RarityUnlockId` et `RARITY_UNLOCKS`

#### 3.2 — `src/store/playerStore.ts`
- Ajouter `activeBadgeGoals: string[]` à `PlayerState` (init `[]`)
- Ajouter action `setActiveBadgeGoals: (ids: string[]) => void` (max 3, filtre les doublons)
- Dans `awardBadges` : après attribution, retirer des `activeBadgeGoals` les badges nouvellement obtenus
- Dans `computeUnlockedThemes` : ajouter le cas `music_unlock` → `unlockedThemes.push('music')`
- Ajouter `unlockedOnf: boolean` calculé depuis les badges (`computeUnlockedOnf`)
- Dans `migrateProfile` : initialiser `activeBadgeGoals: []` si absent

#### 3.3 — `src/core/engine/badgeEngine.ts`
- Exporter `ELIGIBLE_GOAL_BADGE_IDS: string[]` = liste des badgeIds présents dans `progressMap` + speedBadges (ceux qui ont une progression numérique mesurable)

#### 3.4 — Nouveau composant `src/components/Badges/ActiveGoalCard.tsx`
- Props : `badgeId: string`, `progress: BadgeProgress`
- Affiche barre de progression + current/target

#### 3.5 — Nouveau composant `src/components/Badges/BadgeGoalPickerModal.tsx`
- Modal plein écran
- Liste filtrée : badges non obtenus ET dans `ELIGIBLE_GOAL_BADGE_IDS`
- Sélection toggle (max 3 cochés simultanément)
- Bouton Confirmer → `setActiveBadgeGoals`

#### 3.6 — `app/(tabs)/profile.tsx`
- Remplacer l'affichage actuel de `BadgeProgressInline` / `getClosestBadges` par les 3 `ActiveGoalCard`
- Ajouter le bouton "Changer mes objectifs"
- Intégrer `BadgeGoalPickerModal`

#### 3.7 — Gardes ONF + musique
- `app/(tabs)/index.tsx` : condition déverrouillage ONF = `player.currentLevel >= ONF_UNLOCK_LEVEL || player.unlockedOnf`
- `app/(tabs)/levels.tsx` : même condition
- Audio/musique : vérifier où la musique est actuellement verrouillée et ajouter la condition `player.unlockedThemes.includes('music')` (ou `isPremium`)

#### 3.8 — i18n `src/i18n/locales/fr.json` + `en.json`
- Clés : `badge_goals_title`, `badge_goals_empty`, `badge_goals_pick`, `badge_goals_confirm`, `badge_goal_obtained`

---

## Chantier 4 — Bonus journaliers (sans graines) + retrait achat jeton

### Concept
- Les bonus (`highlight_valid_cells`, `instinct`) ne sont **plus payés en graines**
- Le joueur reçoit **5 utilisations de chaque bonus par jour** (reset à minuit, non cumulable)
- Si `isPremium` : utilisations **illimitées**
- **Retirer** la possibilité d'acheter un jeton défi ami avec des graines (15🌱)

### Architecture

#### État nouveau dans `playerStore`
```ts
dailyBonusUses: Record<BonusId, number>;  // utilisations restantes aujourd'hui
lastBonusResetDate: string | null;         // ISO date du dernier reset (YYYY-MM-DD)
```
- Init : `{ highlight_valid_cells: 5, instinct: 5 }` — les 2 bonus existants
- Reset : si `lastBonusResetDate !== today` → remettre chaque bonus à 5

#### `spendBonus(bonusId)` (nouveau) dans `playerStore`
```ts
spendBonus: (bonusId: BonusId) => boolean
// Si isPremium → true toujours
// Sinon : vérifie dailyBonusUses[bonusId] > 0, décrémente, retourne true/false
```

#### Gestion du reset
Dans `checkDailyLogin()` (déjà appelé au montage dans `(tabs)/_layout.tsx`) : si `lastBonusResetDate !== today` → reset `dailyBonusUses` + mettre à jour `lastBonusResetDate`.

#### Suppression du paiement en graines pour les bonus
Dans `useGame.ts` → `activateBonus` : remplacer `player.spendSeeds(cost)` par `player.spendBonus(bonusId)`.  
Supprimer toute référence à `bonusDef.cost` dans la logique de vérification d'activation des bonus.

#### Retrait achat jeton défi ami avec graines
Dans `app/(tabs)/challenge.tsx` :
- Supprimer `TOKEN_SEED_COST = 15`
- Supprimer la vérification `hasSeeds` dans `handleChallenge`
- Supprimer `showBuyTokenModal` state + `handleConfirmBuyToken`
- Supprimer la modal de confirmation d'achat
- Nouveau comportement si pas de jeton : Alert "Plus de jeton · Tu en gagnes 1 tous les 5 défis solo" (sans option d'achat)
- Mettre à jour le texte d'explication en bas de l'onglet (supprimer la mention des 15 graines)

### Tâches

#### 4.1 — `src/store/playerStore.ts`
- Ajouter `dailyBonusUses: Record<BonusId, number>` + `lastBonusResetDate: string | null`
- Init : `{ highlight_valid_cells: 5, instinct: 5 }` et `null`
- Ajouter `spendBonus: (bonusId: BonusId) => boolean`
- Dans `checkDailyLogin` : reset `dailyBonusUses` si nouvelle journée
- Dans `migrateProfile` : initialiser les nouveaux champs si absents

#### 4.2 — `src/hooks/useGame.ts`
- Remplacer `player.spendSeeds(bonusDef.cost)` par `player.spendBonus(bonusId)`
- Supprimer la vérification `seeds >= cost`

#### 4.3 — `src/constants/bonus.ts`
- Supprimer le champ `cost` de `BonusDefinition` (ou le garder pour info seulement — à décider)
- Ajouter champ `dailyLimit: number` = 5 à chaque bonus

#### 4.4 — `app/(tabs)/challenge.tsx`
- Supprimer `TOKEN_SEED_COST`, `showBuyTokenModal`, `handleConfirmBuyToken`, la modal d'achat
- Modifier `handleChallenge` pour ne plus proposer l'achat avec graines
- Mettre à jour les textes informatifs

#### 4.5 — UI bonus dans `app/game/[challengeId].tsx` (et `daily.tsx`)
- Afficher les utilisations restantes à côté de chaque bouton bonus : `"✦ 3/5"` ou `"∞"` si premium
- Griser le bouton si `dailyBonusUses[bonusId] === 0` (et non premium)

---

## Chantier 5 — Statistiques

### Objectif
Remplacer :
- ❌ Graines disponibles  
- ❌ Meilleure série  
- ❌ Meilleur temps  

Par :
- ✅ **Défi du jour** : `dailyWon / dailyPlayed = X%`
- ✅ **Défis amis** : `friendWins / friendPlayed = X%`
- ✅ **Temps moyen** : `avgResolutionMs` formaté

### Nouveaux champs nécessaires dans `stats`
```ts
// Dans PlayerStats (playerStore.ts)
dailyPlayed: number;   // nb de défis du jour joués (tentés)
dailyWon: number;      // nb de défis du jour réussis
friendPlayed: number;  // nb de défis amis joués (en tant que participant)
avgResolutionMs: number; // moyenne cumulative (updated à chaque victoire solo)
totalResolutionCount: number; // nb de parties comptées pour la moyenne
```

**Note** : `friendWins` existe déjà dans `stats` (utilisé pour les badges sociaux). `friendPlayed` est nouveau.

### Calcul `avgResolutionMs`
À chaque victoire dans `markChallengeCompleted(id, timeMs, failCount)` :
```ts
newAvg = (state.stats.avgResolutionMs * state.stats.totalResolutionCount + timeMs) / (state.stats.totalResolutionCount + 1)
```

### Incrément `dailyPlayed` / `dailyWon`
Dans `submitDailyResult(date, success, timeMs)` : incrémenter `dailyPlayed` toujours, `dailyWon` si `success`.

### Incrément `friendPlayed`
Dans `app/game/friend-challenge.tsx` au moment de la validation finale (après `isVictory` ou defeat handling) : `player.incrementStat('friendPlayed')`.  
Ajouter `incrementStat: (key: keyof PlayerStats, amount?: number) => void` générique dans `playerStore`.

### Affichage
Dans `app/(tabs)/profile.tsx` :
- Calculer `dailyPct = dailyPlayed > 0 ? Math.round(dailyWon / dailyPlayed * 100) : null`
- Calculer `friendPct = friendPlayed > 0 ? Math.round(friendWins / friendPlayed * 100) : null`
- Afficher `null` comme `"—"`
- Remplacer les 3 `StatCard` retirées par :
  - 📅 **Défi du jour** : `"X réussis / Y joués (Z%)"` ou `"—"`
  - 🤝 **Défis amis** : `"X victoires / Y joués (Z%)"` ou `"—"`
  - ⏱ **Temps moyen** : `avgResolutionMs > 0 ? formatTime(avgResolutionMs) : "—"`
- Garder : 🏆 **Défis résolus** + 🔥 **Streak journalier** (déjà présents)

### Tâches

#### 5.1 — `src/store/playerStore.ts`
- Ajouter `dailyPlayed`, `dailyWon`, `friendPlayed`, `avgResolutionMs`, `totalResolutionCount` dans `PlayerStats`
- Init à `0`
- Mettre à jour `markChallengeCompleted` : calcul rolling average
- Mettre à jour `submitDailyResult` : incrémenter `dailyPlayed` + `dailyWon`
- Ajouter `incrementStat(key, amount?)` générique
- `migrateProfile` : initialiser les nouveaux champs à `0` si absents

#### 5.2 — `app/game/friend-challenge.tsx`
- Appeler `player.incrementStat('friendPlayed')` après conclusion du défi (victoire ou défaite)

#### 5.3 — `app/(tabs)/profile.tsx`
- Retirer les `StatCard` : Graines disponibles, Meilleure série, Meilleur temps
- Ajouter les 3 nouvelles `StatCard` : défi du jour %, défis amis %, temps moyen

#### 5.4 — Firestore sync
- `playerService.ts` : s'assurer que `dailyPlayed`, `dailyWon`, `friendPlayed`, `avgResolutionMs`, `totalResolutionCount` sont bien dans `toFirestore()` et `fromFirestore()` (migration douce avec `?? 0`)

---

## Ordre d'implémentation recommandé

1. **Chantier 5** (stats) — le plus indépendant, aucun impact sur d'autres systèmes
2. **Chantier 2** (UI icônes) — correctif visuel pur, aucune logique
3. **Chantier 1** (ONF diversité + champignon) — impact isolé dans `onfChallengeService.ts` + `board_4x4_onf.ts`
4. **Chantier 4** (bonus journaliers + retrait achat jeton) — impact store + hooks + challenge tab
5. **Chantier 3** (badges objectifs) — le plus complexe, dépend du store mis à jour par chantier 4

---

## Risques et points d'attention

| Risque | Mitigation |
|---|---|
| Champignon en ONF : `center_only` non respecté par `isPlacementValidOnf` | Vérifier `validator.ts` AVANT d'ajouter les compositions champignon |
| Compositions champignon insolvables (backtracking infini) | `try/catch` + timeout dans `generateOnfChallenge`, fallback sur composition sans champignon |
| Famille E (ruche + champignon) insolvable en combinaison | Tester au runtime ; si le solveur échoue > 10 fois, retirer les 4 compositions E du tableau |
| Chien : 1 seul exemplaire impossible (`neighbor_same/require/minCount:1` exige un voisin chien) | Invariant I4 maintenu — chien exclu définitivement du mode ONF |
| `dailyBonusUses` non initialisé sur profils existants | `migrateProfile` + valeur par défaut dans le store initial |
| `activeBadgeGoals` contient un badgeId obtenu entre-temps | `awardBadges` nettoie la liste automatiquement |
| `friendPlayed` non incrémenté si crash réseau mid-game | Incrémenter avant l'appel Firestore, dans le flux local |
| Unlock ONF via badges vs `currentLevel >= 5` : conflit possible | Condition OR : l'ancienne garde reste valide, le badge est un chemin alternatif |

---

## Hors périmètre (non planifié)

- Monétisation réelle `isPremium` (achat in-app)
- Refonte visuelle complète des badges  
- Nouveau système de niveaux lié aux badges
- Mode Zen (l'unlock `mode_zen` était non implémenté, remplacé par `music_unlock`)
