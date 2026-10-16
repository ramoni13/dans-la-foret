# Plan — Refonte complète du système de badges

## Contexte et état actuel

- **46 badges** effectifs (commentaire `AGENTS.md` dit 41 — à mettre à jour)
- `autoGoal: boolean` dans `playerStore` + toggle `<Switch>` dans `profile.tsx`
- `BadgeGoalPickerModal` permet au joueur de choisir manuellement ses 3 objectifs
- `goalCounters` : compteurs remis à 0 **à l'activation** du badge comme objectif actif — **hermétiques les uns des autres par badge** (la clé est le `badgeId`, pas une métrique globale partagée)
- `GOAL_SEQUENCES` par catégorie → `pickNextAutoGoal` pour l'avance automatique
- **Aucun badge dédié ONF**, **aucun compteur d'éléments modifiés** par partie
- `vitesse_Loup` : casse incohérente (L majuscule)
- Page admin "Ramoni" : section Réglages → bouton `🧹 Nettoyer la base` dans `profile.tsx`

---

## Analyse hermétisme des compteurs (question 2)

### Compteurs actuellement hermétiques ✅
- `goalCounters[badgeId]` (vitesse & précision) : clé par badge, remis à 0 à chaque **activation** comme objectif. Chaque badge a son propre compteur isolé, pas de partage entre badges de même catégorie. Un badge vitesse non actif n'est jamais incrémenté.
- `speedBadgeHits[badgeId]` : compteur global de secours (non utilisé pour l'attribution si le badge est éligible), incrémenté indépendamment par badge.

### Problème identifié ⚠️
- `goalCounters` sont remis à 0 à l'**activation** du badge comme objectif. Si demain le mode manuel disparaît et que l'auto-avance prend tout en charge, ce comportement reste correct : le compteur repart de 0 quand le nouveau badge entre dans la séquence → **volontaire et correct** pour un badge de type "streak depuis maintenant".
- **Mais** : pour les badges vitesse, la `speedBadgeHits` (compteur global, incrémenté en dehors des objectifs actifs) ne sert à rien si tous les badges sont éligibles et doivent être actifs pour être décernés. Ce compteur fantôme crée une confusion.

### Ce qui change avec la refonte
- Suppression du mode manuel → plus de `goalCounters` remis à 0 aléatoirement par le joueur. La remise à 0 n'a lieu qu'à l'auto-avance : logique et prévisible.
- Nouveaux badges (ONF, Perfect, etc.) utiliseront leurs propres compteurs dédiés dans `stats` → isolation garantie.

---

## Étape 1 — Suppression du choix manuel (toggle + modal)

### Fichiers à modifier
| Fichier | Action |
|---|---|
| `src/store/playerStore.ts` | Supprimer `autoGoal: boolean`, `setAutoGoal()`, le champ dans l'état initial, dans `resetGame()`, dans `restoreFromCloud()` |
| `src/core/engine/badgeEngine.ts` | Aucun changement structurel — `pickNextAutoGoal` et `advanceGoalAuto` restent, `award()` garde la garde `eligibleSet` |
| `src/components/Badges/BadgeGoalPickerModal.tsx` | **Supprimer le fichier** |
| `src/components/Badges/ActiveGoalCard.tsx` | Supprimer le bouton "Choisir un objectif →" et le handler `onChoose` |
| `app/(tabs)/profile.tsx` | Supprimer le `<Switch>` + label `goal_auto_label` + import `BadgeGoalPickerModal` + état `showGoalPicker` + handler `setActiveBadgeGoals` Firestore dans `onConfirm` |
| `src/i18n/locales/fr.json` | Supprimer clé `goal_auto_label` |
| `src/i18n/locales/en.json` | Supprimer clé `goal_auto_label` |

### Comportement après
- Les 3 slots sont toujours remplis automatiquement via `advanceGoalAuto()` après chaque badge obtenu.
- `DEFAULT_BADGE_GOALS` reste le point de départ pour les nouveaux joueurs.
- `activeBadgeGoals` reste dans le store (lecture seule pour le joueur, écrit uniquement par `advanceGoalAuto`).

---

## Étape 2 — Correction du bug vitesse_Loup

Renommer `vitesse_Loup` → `vitesse_loup` dans :
- `src/constants/badges.ts` (définition)
- `src/core/engine/badgeEngine.ts` (toutes les occurrences : `ELIGIBLE_GOAL_BADGE_IDS`, `GOAL_SEQUENCES`, `evaluateBadges`, `getClosestBadges`, `getBadgeProgress`, `getBadgeCurrentValue`)
- `src/store/playerStore.ts` (`speedThresholds` array, `speedBadgeHits`)
- `src/i18n/locales/fr.json` + `en.json` (si clé badge_vitesse_Loup existe)
- **Migration** : dans `migrateProfile()`, si `earnedBadges` contient `'vitesse_Loup'`, le remplacer par `'vitesse_loup'`. Idem pour `activeBadgeGoals` et `goalCounters`.

---

## Étape 3 — Nouveau badge : Pose Parfaite (compteur d'éléments modifiés)

### Définition du badge
| Champ | Valeur |
|---|---|
| ID | `precision_parfaite` |
| Emoji | 🎯 |
| Label FR | Pose Parfaite |
| Label EN | Perfect Placement |
| Rareté | **or** |
| Catégorie | `precision` |
| Description FR | Poser tous les éléments sans jamais déplacer un jeton déjà posé, et sans avoir abandonné ce défi au préalable |
| Steps | **3** (3 victoires "parfaites" consécutives) |

### Définition de "Perfect" (sans ambiguïté)
Une victoire est **parfaite** si toutes ces conditions sont réunies :
1. `elementChangeCount === 0` : aucun jeton **déjà posé** n'a été déplacé ou retiré (pose initiale directe comptée à 0)
2. `failCount === 0` : aucun échec de validation pendant la partie
3. Le joueur n'a pas abandonné ce `challengeId` auparavant (`abandonCount[challengeId] === 0` ou undefined)

### Compteur `elementChangeCount` dans `gameStore`
Nouveau champ dans `GameState` :
```ts
elementChangeCount: number; // nb de fois qu'un élément DÉJÀ POSÉ est déplacé, retiré, ou remplacé
```

Incrément dans :
- `placeElement(cellIndex, elementId)` : si `playerBoard[cellIndex] !== null` (remplacement) → `+1`
- `removeElement(cellIndex)` : si `playerBoard[cellIndex] !== null` → `+1`
- `moveElement(fromCell, toCell)` : toujours `+1` (déplacement d'un élément posé)

Reset à `0` dans `loadChallenge()` et `loadDailyChallenge()`.

### Transmission à `evaluateBadges` via `GameContext`
Ajouter dans `GameContext` :
```ts
elementChangeCount: number; // transmis depuis game.elementChangeCount au moment de la victoire
```

### Incrément du compteur dédié dans `playerStore`
Dans `markChallengeCompleted`, dans la boucle `for (const badgeId of activeBadgeGoals)` :
```ts
if (badgeId === 'precision_parfaite') {
  const isPerfect = elementChangeCount === 0
    && errorCount === 0
    && (state.stats.abandonCount[challengeId] ?? 0) === 0;
  if (isPerfect) {
    newGoalCounters['precision_parfaite'] = (newGoalCounters['precision_parfaite'] ?? 0) + 1;
  } else {
    newGoalCounters['precision_parfaite'] = 0; // streak reset
  }
}
```

### Évaluation dans `badgeEngine.ts`
```ts
if ((goalCounters['precision_parfaite'] ?? 0) >= 3) award('precision_parfaite');
```

### Appel depuis `app/game/[challengeId].tsx`
Passer `game.elementChangeCount` dans le `GameContext` transmis à `evaluateBadges`.

---

## Étape 4 — Nouveaux badges par type de défi

### Badges ONF (0 badge actuellement)

| ID | Emoji | Label FR | Rareté | Type | Steps | Trigger |
|---|---|---|---|---|---|---|
| `onf_premier` | 🌲 | Forestier en herbe | bois | court | 1 | Première grille ONF résolue (`onfSolvedCount >= 1`) |
| `onf_forestier` | 🌳 | Forestier confirmé | pierre | moyen | 10 | `onfSolvedCount >= 10` |
| `onf_maitre` | 🏆 | Maître de la forêt | or | long | 50 | `onfSolvedCount >= 50` |
| `onf_precision` | 🎯 | Grille sans faute | pierre | court | 3 | 3 grilles ONF résolues sans erreur de validation (`onfPerfectCount`) |
| `onf_speed` | ⚡ | Sudoku express | pierre | court | 3 | 3 grilles ONF 4×4 résolues en moins de 2 min (`onfSpeedCount`) |

**Nouveaux compteurs dans `playerStore.stats`** (jamais remis à 0, hermétiques) :
```ts
onfPerfectCount: number;  // grilles ONF validées sans erreur (failCount=0)
onfSpeedCount: number;    // grilles ONF 4×4 résolues en < 120s
```

**Évaluation** : dans `onf.tsx` après victoire, appeler une fonction `evaluateOnfBadges(ctx: OnfGameContext)` dans `badgeEngine.ts` :
```ts
export interface OnfGameContext {
  onfSolvedCount: number;  // APRÈS incrémentation
  onfPerfectCount: number; // APRÈS incrémentation
  onfSpeedCount: number;   // APRÈS incrémentation
  earnedBadges: string[];
  activeBadgeGoals: string[];
  goalCounters: Record<string, number>;
}
```

Les badges ONF sont **éligibles** (dans `ELIGIBLE_GOAL_BADGE_IDS`) sauf `onf_premier` qui est un badge unique immédiat (hors objectif actif requis, comme `ami_de_la_foret`).

**Incréments** dans `playerStore` : ajouter une action `markOnfChallengeCompleted` étendue ou une nouvelle action `recordOnfVictory(failCount, elapsedMs, gridSize)` qui incrémente `onfSolvedCount`, `onfPerfectCount` si `failCount === 0`, et `onfSpeedCount` si `gridSize === 4 && elapsedMs < 120_000`.

### Badges Daily complémentaires

| ID | Emoji | Label FR | Rareté | Type | Steps | Trigger |
|---|---|---|---|---|---|---|
| `daily_perfect` | 🎯 | Quotidien sans faute | or | long | 10 | 10 défis daily réussis sans erreur (`dailyPerfectCount`) |
| `daily_speed` | ⚡ | Forestier matinal | pierre | court | 3 | 3 défis daily réussis en moins de 3 minutes (`dailySpeedCount`) |

**Nouveaux compteurs dans `playerStore.stats`** :
```ts
dailyPerfectCount: number;  // daily gagnés sans erreur de validation
dailySpeedCount: number;    // daily gagnés en < 180s
```

**Évaluation** : étendre `evaluateDailyBadges(ctx: DailyGameContext)` avec :
```ts
failCount: number;     // failCount de la partie daily
elapsedMs: number;     // durée de la partie daily
dailyPerfectCount: number; // APRÈS incrémentation
dailySpeedCount: number;   // APRÈS incrémentation
goalCounters: Record<string, number>;
activeBadgeGoals: string[];
```

Incréments dans `daily.tsx` après victoire, avant `evaluateDailyBadges`.

### Badges Ami complémentaires

| ID | Emoji | Label FR | Rareté | Type | Steps | Trigger |
|---|---|---|---|---|---|---|
| `ami_challenger` | ⚔️ | Premier Défi | bois | court | 1 | Lancer son premier défi ami (`totalFriendsInvited >= 1` déjà = `social_poignee`) |

> Note : `ami_challenger` et `social_poignee` ont le même trigger. Fusionner ou différencier : `social_poignee` = inviter 1 ami, `ami_challenger` = lancer un défi (même si déjà invité). Utiliser `stats.friendPlayed >= 1` comme trigger pour `ami_challenger` à la place.

| ID | Emoji | Label FR | Rareté | Type | Steps | Trigger |
|---|---|---|---|---|---|---|
| `ami_challenger` | ⚔️ | Premier Duel | bois | court | 1 | Jouer son premier défi ami (`stats.friendPlayed >= 1`) |
| `ami_serial` | 🏅 | Duelliste | or | long | 100 | `stats.friendWins >= 100` |

> `social_roi` couvre déjà 50 victoires ami. `ami_serial` cible 100. `social_lion` (5) et `social_loup` (20) restent.

---

## Étape 5 — Révision et doublons

### Doublons à résoudre

| Problème | Décision |
|---|---|
| `precision_pousse` (3 victories) et `precision_oeil` (3 victories) ont la même cible | `precision_oeil` → cible passe à **5** victories consécutives sans erreur |
| `amelioration_graphe` (3 PB) et `amelioration_cycle` (rejouer 3×) sont dans la même catégorie à 3 steps | Garder les 2 : triggers distincts (amélioration temps vs rejouer même défi) |
| `exploration_graine` (🌱) même emoji que `daily_first` (🌅 → déjà différent) | Pas de doublon d'emoji sur ceux-là, OK |
| `social_trophee` (👑 top 3 daily × 5) et `daily_champion` (👑 #1 mondial daily) même emoji | `social_trophee` → emoji 🥉 |
| `regularite_lune` et `regularite_soleil` : conditions heure de jeu impossibles à valider de façon hermétique avec le streak daily → déplacer hors de `ELIGIBLE_GOAL_BADGE_IDS` (comme secrets) | Ces 2 badges deviennent **non-éligibles** (conditionnels heure, décernés automatiquement hors objectif actif) |

### Ajustements step counts pour couvrir les 3 types par catégorie

| Catégorie | Court (≤3) | Moyen (5) | Long (≥10) | Action |
|---|---|---|---|---|
| Vitesse | `vitesse_tortue` (5 défis) → reste 5 | Aucun à 5 actuellement | `vitesse_tornade` (5 mais très difficile) | Ajouter `vitesse_marathon` : or, 20 victoires sous seuil `tortue` = badge "endurance vitesse" long |
| Précision | `precision_pousse` (3 ✓) | `precision_oeil` → passer à 5 ✓ | `precision_couronne` (50 ✓) | Cible `oeil` à 5, OK |
| Régularité | `regularite_aube` (3 ✓) | `regularite_fougere` (7 ✓) | `regularite_foret` (100 ✓) | ✓ OK |
| Amélioration | `amelioration_cycle` (3 ✓) | Aucun à 5 | `amelioration_fusee` (10 ✓) | Ajouter `amelioration_discipline` : pierre, 5 défis améliorés distincts = badge moyen |
| Exploration | `exploration_graine` (3 niveaux ✓) | `exploration_herbe` (5 niveaux ✓) | `exploration_crane` (13 niveaux ✓) | ✓ OK |
| Social | `social_poignee` (1 ✓) | `social_lion` (5 ✓) | `social_roi` (50 ✓) | ✓ OK |
| Daily | `daily_first` (1 ✓) | `daily_week` (7) | `daily_month` (30 ✓) | Ajouter `daily_speed` (3 ✓) comme court vitesse daily |
| ONF | `onf_premier` (1 ✓) | `onf_forestier` (10 ✓) | `onf_maitre` (50 ✓) | ✓ OK |
| Précision ONF | `onf_precision` (3 ✓) | — | — | OK pour compléter la catégorie |

### Nouveaux badges récapitulatifs (ajouts nets)

| ID | Rareté | Catégorie | Steps |
|---|---|---|---|
| `precision_parfaite` | or | precision | 3 (court, streak) |
| `onf_premier` | bois | onf | 1 |
| `onf_forestier` | pierre | onf | 10 |
| `onf_maitre` | or | onf | 50 |
| `onf_precision` | pierre | onf | 3 |
| `onf_speed` | pierre | onf | 3 |
| `daily_perfect` | or | daily | 10 |
| `daily_speed` | pierre | daily | 3 |
| `ami_challenger` | bois | social | 1 |
| `ami_serial` | cristal | social | 100 |
| `vitesse_marathon` | or | vitesse | 20 |
| `amelioration_discipline` | pierre | amelioration | 5 |

---

## Étape 6 — MASTER_SEQUENCE et nouvelle logique d'enchaînement

### Principe
Remplacer `GOAL_SEQUENCES` (séquences par catégorie) par une `MASTER_SEQUENCE` **linéaire unique** de tous les badges éligibles, ordonnée pour alterner catégories et types de défis.

`pickNextAutoGoal` lit la `MASTER_SEQUENCE` dans l'ordre et retourne le premier badge non obtenu et non déjà en objectif actif, **quelle que soit la catégorie** du badge complété (fini la priorité "même catégorie d'abord").

### MASTER_SEQUENCE proposée

```ts
// Phase 1 — Découverte (Bois)
'exploration_graine',      // Finir niv 1-3
'regularite_aube',         // 3 jours de connexion
'precision_pousse',        // 3 victoires sans erreur
'vitesse_tortue',          // 5 victoires rapides
'daily_first',             // Premier daily
'onf_premier',             // Première grille ONF
'amelioration_cycle',      // Rejouer 3× un défi
'ami_challenger',          // Premier défi ami joué

// Phase 2 — Progression (Pierre)
'exploration_herbe',       // Niv 1-5
'regularite_fougere',      // 7 jours
'precision_oeil',          // 5 victoires consécutives sans erreur
'vitesse_loup',            // 5 victoires < seuil loup
'daily_week',              // 7 daily de suite
'onf_precision',           // 3 grilles ONF sans erreur
'social_poignee',          // Inviter 1 ami
'amelioration_graphe',     // 3 PB battus
'onf_speed',               // 3 grilles ONF < 2 min
'daily_speed',             // 3 daily < 3 min
'social_lion',             // 5 victoires ami
'exploration_collectionneur', // 50 défis
'amelioration_discipline', // 5 défis distincts améliorés
'social_cirque',           // Inviter 5 amis

// Phase 3 — Maîtrise (Or)
'exploration_chene',       // Niv 1-9
'precision_hibou',         // 10 victoires consécutives sans erreur
'vitesse_oiseau',          // 5 victoires < seuil oiseau
'precision_parfaite',      // 3 poses parfaites (0 déplacement, 0 erreur, 0 abandon)
'daily_perfect',           // 10 daily sans erreur
'onf_forestier',           // 10 grilles ONF
'regularite_arbre',        // 30 jours
'amelioration_etoile',     // Perfection absolue
'amelioration_fusee',      // 10 PB distincts
'social_loup',             // 20 victoires ami
'daily_month',             // 30 daily de suite
'exploration_cible',       // Dernier défi d'un niveau sans bonus
'vitesse_marathon',        // 20 victoires rapides
'precision_arc',           // 25 victoires consécutives sans erreur
'onf_maitre',              // 50 grilles ONF
'social_roi',              // 50 victoires ami

// Phase 4 — Légende (Cristal)
'exploration_crane',       // Tous les 13 niveaux
'precision_couronne',      // 50 victoires consécutives sans erreur
'vitesse_eclair',          // 5 victoires < 7s+1s/niv
'regularite_foret',        // 100 jours
'daily_champion',          // #1 mondial daily
'vitesse_tornade',         // 5 victoires < 4s+0.5s/niv
'social_trophee',          // Top 3 daily × 5
'ami_serial',              // 100 victoires ami
```

**Badges hors séquence** (déclenchés automatiquement, hors `ELIGIBLE_GOAL_BADGE_IDS`) :
- Tous les `secret_*`
- Tous les `saisonnier_*`
- `record_first`, `record_mondial`
- `ami_de_la_foret` (premium)
- `regularite_lune`, `regularite_soleil` (condition heure, déplacés hors éligibles)
- `onf_premier` (badge unique immédiat, 1 step)

### Mise à jour `DEFAULT_BADGE_GOALS`
```ts
export const DEFAULT_BADGE_GOALS: string[] = [
  'exploration_graine',  // accessible dès le début
  'precision_pousse',    // 3 victoires sans erreur
  'regularite_aube',     // 3 jours de connexion
];
```

---

## Étape 7 — Page d'administration de la séquence (Ramoni only)

### Route
`app/admin/badge-sequence.tsx`

### Accès
Visible uniquement si `player.username === 'Ramoni'`.
Bouton dans `profile.tsx` section Réglages, **en dessous** du bouton "🧹 Nettoyer la base" :
```
{player.username === 'Ramoni' && (
  <TouchableOpacity onPress={() => router.push('/admin/badge-sequence')}>
    <Text>🏅 Séquence des badges</Text>
  </TouchableOpacity>
)}
```

### Fonctionnalités de la page

1. **Affichage de la MASTER_SEQUENCE courante** en liste ordonnée numérotée avec pour chaque badge : numéro, emoji, label, rareté (couleur), catégorie.

2. **Réorganisation par glisser-déposer** via `react-native-gesture-handler` (déjà dans le projet). Utiliser `FlatList` avec un gestionnaire de drag.

3. **Filtres** : par catégorie (chips), par rareté (chips).

4. **Prévisualisation "Prochains objectifs"** : si le joueur X est au badge N dans la séquence, les 3 prochains slots seront badge N+1, N+2, N+3 (affichage statique pour illustration).

5. **Export JSON** : bouton "📋 Copier la séquence" → copie dans le clipboard la séquence actuelle en JSON string.

6. **Import JSON** : champ texte + bouton "📥 Importer" → parse le JSON et met à jour la `MASTER_SEQUENCE` locale pour la session (ne persiste pas en Firestore, rechargement remet la séquence par défaut).

7. **Reset** : bouton "🔄 Réinitialiser" → remet la `MASTER_SEQUENCE` par défaut.

### Stockage de la séquence personnalisée
La séquence est définie dans `badgeEngine.ts`. La page admin peut la modifier **en mémoire** pour tester. Pour une modification persistante, exporter le JSON, copier-coller dans `badgeEngine.ts` et redéployer.

> Pas de Firestore pour la séquence — c'est une configuration de code, pas de données joueur.

---

## Étape 8 — Migration et compatibilité

Dans `migrateProfile()` dans `playerStore.ts` :

```ts
// Correction vitesse_Loup → vitesse_loup
if (earnedBadges.includes('vitesse_Loup')) {
  earnedBadges = earnedBadges.map(id => id === 'vitesse_Loup' ? 'vitesse_loup' : id);
}
activeBadgeGoals = activeBadgeGoals.map(id => id === 'vitesse_Loup' ? 'vitesse_loup' : id);
if (goalCounters['vitesse_Loup'] !== undefined) {
  goalCounters['vitesse_loup'] = goalCounters['vitesse_Loup'];
  delete goalCounters['vitesse_Loup'];
}

// Suppression de autoGoal (champ obsolète)
delete (profile as any).autoGoal;

// Initialisation des nouveaux compteurs stats à 0 si absents
stats.onfPerfectCount = stats.onfPerfectCount ?? 0;
stats.onfSpeedCount   = stats.onfSpeedCount   ?? 0;
stats.dailyPerfectCount = stats.dailyPerfectCount ?? 0;
stats.dailySpeedCount   = stats.dailySpeedCount   ?? 0;
```

---

## Étape 9 — Mise à jour i18n

Ajouter dans `fr.json` et `en.json` les clés des nouveaux badges :
- Labels et descriptions pour : `precision_parfaite`, `onf_premier`, `onf_forestier`, `onf_maitre`, `onf_precision`, `onf_speed`, `daily_perfect`, `daily_speed`, `ami_challenger`, `ami_serial`, `vitesse_marathon`, `amelioration_discipline`
- Supprimer : `goal_auto_label`
- Ajouter catégorie `cat_onf` : `🌲 Grille ONF` / `🌲 ONF Grid`

---

## Étape 10 — Mise à jour des compteurs de progression (`getClosestBadges` / `getBadgeProgress`)

Étendre `progressMap` dans `badgeEngine.ts` avec les nouveaux badges :
```ts
onf_forestier:          [ctx.onfSolvedCount ?? 0, 10],
onf_maitre:             [ctx.onfSolvedCount ?? 0, 50],
onf_precision:          [ctx.onfPerfectCount ?? 0, 3],
onf_speed:              [ctx.onfSpeedCount ?? 0, 3],
daily_perfect:          [ctx.dailyPerfectCount ?? 0, 10],
daily_speed:            [ctx.dailySpeedCount ?? 0, 3],
precision_parfaite:     [goalCounters['precision_parfaite'] ?? 0, 3],
amelioration_discipline:[ctx.improvedChallengesCount ?? 0, 5],
vitesse_marathon:       [speedHits['vitesse_marathon'] ?? 0, 20],
ami_serial:             [ctx.friendWins, 100],
ami_challenger:         [ctx.stats?.friendPlayed >= 1 ? 1 : 0, 1],
```

Ces valeurs doivent être passées dans `GameContext` (pour les badges solo) ou dans `OnfGameContext` / `DailyGameContext` selon le type de défi.

---

## Ordre d'implémentation

```
1. Corriger vitesse_Loup → vitesse_loup + migration
2. Supprimer autoGoal / toggle / BadgeGoalPickerModal
3. Ajouter elementChangeCount dans gameStore
4. Ajouter precision_parfaite (badge + compteur + évaluation)
5. Ajouter badges ONF (5 badges + compteurs + evaluateOnfBadges)
6. Ajouter badges Daily complémentaires (2 badges + compteurs)
7. Ajouter badges Ami complémentaires (2 badges)
8. Ajustements step counts (precision_oeil→5, amelioration_discipline, vitesse_marathon)
9. Remplacer GOAL_SEQUENCES par MASTER_SEQUENCE + adapter pickNextAutoGoal
10. Mettre à jour ELIGIBLE_GOAL_BADGE_IDS + getClosestBadges + getBadgeProgress
11. Mettre à jour i18n (fr + en)
12. Mettre à jour AGENTS.md (nb badges)
13. Créer page admin badge-sequence.tsx (Ramoni only)
14. Brancher lien dans profile.tsx Réglages sous "Nettoyer la base"
```

---

## Fichiers touchés — Résumé

| Fichier | Type de changement |
|---|---|
| `src/constants/badges.ts` | Ajouter 12 badges, corriger emoji `social_trophee`, renommer `vitesse_Loup` |
| `src/core/engine/badgeEngine.ts` | Remplacer `GOAL_SEQUENCES` par `MASTER_SEQUENCE`, adapter `pickNextAutoGoal`, ajouter `evaluateOnfBadges`, étendre `GameContext`, `DailyGameContext`, `getClosestBadges`, `getBadgeProgress` |
| `src/store/gameStore.ts` | Ajouter `elementChangeCount` + incréments dans `placeElement`, `removeElement`, `moveElement`, reset dans `loadChallenge` |
| `src/store/playerStore.ts` | Supprimer `autoGoal`/`setAutoGoal`, ajouter compteurs `onfPerfectCount`, `onfSpeedCount`, `dailyPerfectCount`, `dailySpeedCount`, étendre `markChallengeCompleted` pour `precision_parfaite`, ajouter migration |
| `src/components/Badges/BadgeGoalPickerModal.tsx` | **Supprimer** |
| `src/components/Badges/ActiveGoalCard.tsx` | Supprimer bouton "Choisir" |
| `app/(tabs)/profile.tsx` | Supprimer Switch + import modal + lien admin badge-sequence |
| `app/game/onf.tsx` | Appeler `evaluateOnfBadges`, passer `elapsedMs` et `failCount` pour compteurs |
| `app/game/daily.tsx` | Passer `elapsedMs` et `failCount` à `evaluateDailyBadges` |
| `app/game/[challengeId].tsx` | Passer `game.elementChangeCount` dans `GameContext` |
| `app/admin/badge-sequence.tsx` | **Créer** |
| `src/i18n/locales/fr.json` | +12 badges, -`goal_auto_label`, +`cat_onf` |
| `src/i18n/locales/en.json` | Idem |
| `AGENTS.md` | Mettre à jour nb de badges (46 → ~58) |
