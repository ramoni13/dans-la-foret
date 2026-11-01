# Architecture — Dans la Forêt

Jeu de logique mobile/web (Expo ~57 / React Native 0.86 / React 19).
**Jamais modifier** `AGENTS.md`. Toujours consulter https://docs.expo.dev/versions/v57.0.0/ avant d'écrire du code Expo.

---

## Convention de maintenance de ce fichier

**Ce fichier est la source de vérité architecturale du projet. Il doit rester synchronisé avec le code.**

Toute modification structurelle doit entraîner une mise à jour de ce fichier dans la même session :

| Type de changement | Sections à mettre à jour |
|---|---|
| Nouveau mode de jeu ou nouvel écran | Routing, Flux de jeu, section dédiée |
| Nouvelle formule de récompense en graines | Section "Système de récompenses en graines" |
| Nouveau badge ou modification de condition | Section "Système de badges", "Notion de Perfect" si pertinent |
| Nouveau store / action Zustand | Section "Stores Zustand" |
| Nouveau service ou hook | Section "Structure source `src/`" |
| Nouveau plateau ou élément | Tableaux "Plateaux" et "Éléments disponibles" |
| Nouvelle constante ou invariant | Sections "Système de bonus", "Invariants composition" |
| Modification de la stack technique | Section "Stack technique" |

**Règle** : si une section de ce fichier décrit un comportement ou une valeur qui a changé dans le code, corriger ce fichier avant de clore la tâche.

---

## Stack technique

| Couche | Technologie |
|---|---|
| Framework | Expo ~57.0.21 + Expo Router ~57.0.20 |
| React | 19.2.3 |
| Navigation | expo-router (file-based) + @react-navigation/drawer |
| État global | Zustand ^5 |
| Backend | Firebase 12.19 (Auth + Firestore) |
| Audio | expo-av 16 |
| Gestures | react-native-gesture-handler ~2.32 |
| Animations | react-native-reanimated 4.5 |
| SVG | react-native-svg 15.15 |
| i18n | hook `useT()` maison (fr/en, clé JSON) |
| Typage | TypeScript ~6.0 |
| Tests | Jest 29 + ts-jest |

---

## Routing (Expo Router — file-based)

```
app/
  _layout.tsx              ← Root : GestureHandlerRootView + StorageBridge + AudioBridge
  (tabs)/
    _layout.tsx            ← Tabs layout + UNIQUE onAuthChange Firebase + garde auth
    index.tsx              ← Accueil (progression globale + prochain défi + cartes daily/ONF)
    levels.tsx             ← Sélection des niveaux + bouton daily
    rules.tsx              ← Onglet Règles (éléments + animations briefing)
    challenge.tsx          ← Défis entre amis
    profile.tsx            ← Profil, auth, badges, classement
  game/
    [challengeId].tsx      ← Écran de jeu principal (drag & drop complet)
    daily.tsx              ← Défi du Jour (15 cases, 1 validation, pas de bonus)
    onf.tsx                ← Mode Planète Urgence / Grille Forestière (?size=3 ou ?size=4)
    friend-challenge.tsx   ← Défi ami
```

**Règle critique** : un seul `onAuthChange` dans `(tabs)/_layout.tsx`. Ne jamais en ajouter ailleurs.

---

## Structure source `src/`

```
src/
  core/
    models/
      Element.ts      ← ElementDefinition + ConstraintDefinition (source de vérité des règles)
      Board.ts        ← BoardDefinition + CellPosition
      Challenge.ts    ← Challenge + FixedPlacement + TokenCount + DifficultyLevel (niveau_1…15)
      FriendChallenge.ts
    engine/
      validator.ts    ← validateBoard(), checkVictory(), isPlacementValid(), validateRowColUnique(), isPlacementValidOnf()
      solver.ts       ← Backtracking, s'arrête à 2 solutions (isUnique) + solveOnf() pour mode ONF
      hintEngine.ts   ← getValidCellsForElement(), calculateSeedReward()
      badgeEngine.ts  ← evaluateBadges(), getClosestBadges(), GameContext
    generators/
      challengeGenerator.ts ← generateChallenge() — solution unique garantie
  elements/
    ElementRegistry.ts  ← Record<string, ElementDefinition> (source unique)
    bucheron.ts / ours.ts / mouton.ts / ruche.ts / chien.ts
    renard.ts / cerf.ts / biche.ts / chalet.ts / tas_buches.ts
    champignon.ts       ← center_only, défi journalier uniquement
  boards/
    BoardRegistry.ts    ← Record<string, BoardDefinition>
    board_6cells_v1.ts … board_12cells.ts  (8 plateaux)
    board_15cells_daily.ts ← 15 cases, Clairière Secrète (défi du jour)
    board_3x3_onf.ts    ← 9 cases grille carrée + gridMeta (mode ONF)
    board_4x4_onf.ts    ← 16 cases grille carrée + gridMeta (mode ONF)
  store/
    gameStore.ts    ← état partie en cours (Zustand)
    playerStore.ts  ← profil + progression + badges + graines
    audioStore.ts   ← état audio (musique ambiante + ingame)
    challengeStore.ts
  hooks/
    useGame.ts      ← logique jeu (timer, place/remove/move, bonus, validate)
    useDragDrop.ts  ← drag & drop cross-platform
    useWebDrag.ts   ← drag natif web (HTML5)
    useStorage.ts   ← persistance AsyncStorage ↔ playerStore
  services/
    firebase.ts         ← init unique Firebase (auth + db)
    authService.ts      ← register/login email, Google (web), anonyme, logout
    playerService.ts    ← CRUD Firestore profil joueur
    badgeService.ts     ← awardBadgesFirestore(), updateDailyStreak()
    challengeService.ts ← défis amis Firestore
    dailyChallengeService.ts ← génération daily (PRNG, 16 compositions, solver), Firestore
    onfChallengeService.ts   ← génération ONF temps réel (solveOnf), calculateOnfReward()
    leaderboardService.ts
    worldRecordService.ts ← subscribeWorldRecord(), trySetWorldRecord()
    audioService.ts
    exponentAVPatch.ts / .web.ts  ← patch crash expo-av sur web
  constants/
    colors.ts       ← Colors (forest, cell, elements, ui, badges)
    bonus.ts        ← BonusId + BONUS_DEFINITIONS + BASE/ADVANCED_BONUS_IDS
    badges.ts       ← BADGE_DEFINITIONS (60), BADGE_MAP, BADGE_SEED_REWARDS, RARITY_POINTS, RANK_DEFINITIONS
    difficulty.ts   ← LEVEL_PARAMS (15 niveaux) + Composition + LevelParams
    onf.ts          ← ONF_UNLOCK_LEVEL (5) + ONF_4X4_UNLOCK_COUNT (10)
    music.ts
  data/
    levelMeta.ts        ← LEVEL_META[1..15] (RuleCard, LevelMeta)
    challenges/
      niveau_1.json … niveau_13.json  ← défis pré-générés (JSON embarqués)
      apprenti.json / debutant.json / expert.json / maitre.json
  i18n/
    index.ts    ← useT() hook (Zustand-reactive)
    locale.ts   ← Lang type + getSystemLocale()
    locales/fr.json / en.json
  components/
    Board/      ← BoardRenderer.tsx, Cell.tsx, Connection.tsx
    Elements/   ← ElementPalette.tsx, ElementToken.tsx, DragGhost.tsx, MobileDragGhost.tsx
    Bonus/      ← HintOverlay.tsx
    Game/       ← VictoryModal.tsx, FailModal.tsx, Confetti.tsx, FallingLeaves.tsx
    LevelBriefing/ ← LevelBriefingModal.tsx, RuleCard.tsx, BoardSummary.tsx,
                    ElementChips.tsx, RuleAnimations/(7 composants)
    Badges/     ← BadgeCard, BadgeCollection, BadgeDetailModal, BadgeProgressInline,
                  BadgeShowcase, BadgeToast, BadgeUnlockProgress
    Audio/      ← AudioController.tsx, MusicPanel.tsx, MusicUnlockModal.tsx
    Leaderboard/← LeaderboardScreen.tsx
  utils/
    boardUtils.ts  ← findNearestCell(), formatTime()
    haptics.ts
scripts/
  generateChallenges.ts    ← npm run generate
  regenerateChallenges.ts  ← npm run regenerate
  generateViewerData.ts
  diagnose.ts / diagnose2.ts / analyze*.ts / test*.ts
```

---

## Modèles de données clés

### Element (src/core/models/Element.ts)
Les règles de jeu sont **uniquement** dans `ElementDefinition.constraints`. Jamais codées en dur dans le moteur.

**Types de contraintes :**
- `neighbor_same` — forbid/require voisin identique
- `neighbor_specific` — forbid/require voisin d'un type donné
- `neighbor_specific_chain` — voisin requis + voisin conditionnel (tas_buches ← bucheron + chalet si présent)
- `connected_group` — tous les exemplaires forment 1 groupe connexe (chien = meute)
- `paired_specific` — couplage 1-pour-1 (cerf ↔ biche)
- `position_only` / `count_on_board`
- `row_col_unique` — mode ONF uniquement : max 1 élément identique par ligne ET par colonne (vérifiée via `gridMeta`, pas déclarée dans ElementDefinition)

### Éléments disponibles (10)
| id | Règle distinctive |
|---|---|
| bucheron | ≠ voisin bucheron |
| ours | ≠ voisin ours |
| mouton | ≠ voisin mouton, ≠ voisin renard |
| ruche | singleton (max 1), voisin ours obligatoire |
| chien | meute connexe (`connected_group`), toujours ≥ 2 |
| cerf | `paired_specific` avec biche, ≠ voisin cerf |
| biche | `paired_specific` avec cerf, ≠ voisin biche |
| renard | ≠ voisin mouton, ≠ voisin renard |
| tas_buches | `neighbor_specific_chain` : voisin bucheron + voisin chalet si chalet présent |
| chalet | voisin bucheron obligatoire, ≠ voisin chalet, bucheron ≥ chalet |

### Plateaux (10 dans BoardRegistry)
| id | Cases | Niveaux |
|---|---|---|
| board_6_v1 | 6 | 1 |
| board_7_v1 | 7 | 2 |
| board_8_v2 | 8 | 3–5 |
| board_9_v1 | 9 | 6–8 |
| board_10_v3 | 10 | 9–10 |
| board_11_v1 | 11 | (obsolète) |
| board_11_v2 | 11 | 11–12 |
| board_12 | 12 | 13–15 |
| board_15_daily | 15 | Défi du Jour |
| board_3x3_onf | 9 | Mode ONF 3×3 (grille carrée, `gridMeta`) |
| board_4x4_onf | 16 | Mode ONF 4×4 (grille carrée, `gridMeta`) |

`BoardDefinition` a un champ optionnel `gridMeta?: { rows: number[][], cols: number[][] }` — présent uniquement sur les plateaux ONF.

### Challenge (src/core/models/Challenge.ts)
- `solution: string[]` — solution unique pré-calculée par le solveur
- `fixedPlacements` — jetons non déplaçables par le joueur
- `availableTokens` — inventaire du joueur
- Victoire = `playerBoard[i] === solution[i]` pour tout i (simple comparaison O(n))
- `solutionCount` doit toujours valoir 1

### DifficultyLevel
`niveau_1` … `niveau_15` — 15 niveaux avec progression cases 6→12 et cases vides fixes par niveau.

---

## Stores Zustand

### gameStore
État de la partie en cours. Actions clés :
- `loadChallenge(challenge)` — initialise le plateau
- `placeElement(cellIndex, elementId)` — place un jeton (sans validation auto)
- `moveElement(from, to)` — permute deux cases
- `validateChallenge()` → compare avec `solution` → `ValidationResult`
- `startTimer()` — démarré après le briefing
- `resetGame()`

### playerStore
Profil + progression + badges + graines. Points critiques :
- `seeds` = monnaie (graines 🌱). Valeur test = 99, **TODO passer à 3** avant publication
- `isPremium` = true en test, **TODO passer à false** avant publication
- `restoreFromCloud(profile)` — union intelligente local+cloud (ne jamais écraser les badges locaux sur profil non vierge)
- `awardBadges(ids[])` — un seul `set()` pour N badges (zéro re-render intermédiaire)
- `markChallengeCompleted(id, timeMs, failCount)` — errorCount = nb échecs de validation pendant la partie (pas errorCount de la solution)
- `checkDailyLogin()` → retourne true si première connexion du jour → `addSeeds(3)` dans `(tabs)/_layout.tsx`
- `onfSolvedCount` — compteur unifié de grilles ONF résolues (ne fait PAS progresser `currentLevel`)
- `incrementOnfSolved()` — appelé après victoire ONF (jamais `markChallengeCompleted`)

**Système de tracks de badges (chantier 3 — system v2) :**
- `trackGoals: { performance, perseverance, exploration }` — un objectif actif par ligne (badge ID ou null si track épuisée)
- `activeBadgeGoals: string[]` — champ dérivé maintenu en sync avec `trackGoals` (= values filtrées). Passé à `evaluateBadges()`.
- `advanceTrackGoals(completedBadgeIds, updatedEarnedBadges) → string[]` — appelé après `awardBadges()` ; remplace l'objectif complété par le suivant dans chaque track concernée. Retourne les IDs des nouveaux goals injectés.
- `goalCounters` — compteurs par badge actif (vitesse, précision). Remis à 0 à chaque activation.
- Auto-migration au `checkDailyLogin()` : répare les `trackGoals` si les badges sont déjà obtenus ou si les prérequis ne sont pas satisfaits. Mappe aussi les anciens `activeBadgeGoals` (pré-tracks) vers les nouvelles tracks.

### audioStore
- `ingameEnabled` — son pendant le jeu
- `userHasInteracted` — requis sur web avant toute lecture audio
- `signalUserInteraction()` — déclenché par premier clic/toucher (géré dans `app/_layout.tsx`)

---

## Flux de jeu (GameScreen — `app/game/[challengeId].tsx`)

1. `useLocalSearchParams` → `challengeId`
2. `game.loadChallenge(found)` — charge le défi
3. Briefing modal (`LevelBriefingModal`) si `challengeNumber === 1`
4. `game.startTimer()` après fermeture du briefing
5. Drag & drop via `useDragDrop` + `MobileDragGhost` (natif) ou web HTML5
6. Bouton **Valider** → `game.validateChallenge()` → `VictoryModal` ou `FailModal`
7. Victoire → `useEffect(isVictory)` :
   - `player.markChallengeCompleted()` + `player.addSeeds(seedsEarned)`
   - `evaluateBadges(ctx)` + `player.awardBadges(newBadges)`
   - Sync Firestore en arrière-plan (markCompleted, updateSeeds, awardBadgesFirestore, upsertLeaderboardEntry)
   - `trySetWorldRecord()` → badges WR si record battu

---

## Authentification

- Firebase Auth : email/password + Google (web popup) + anonyme
- **Garde** : utilisateur non connecté → redirigé vers `/(tabs)/profile`
- Non connecté = accès limité à l'onglet Profil uniquement
- Profil Firestore sur `/players/{uid}`
- `onAuthChange` : un seul abonnement dans `(tabs)/_layout.tsx` → `player.setAuthState()`

---

## Système de badges (60 badges)

Catégories : vitesse, précision, régularité, social, amélioration, exploration, secrets (5), saisonniers (4)
Raretés : bois (5🌱) → pierre (15🌱) → or (30🌱) → cristal (75🌱)

**3 lignes de badges typées (Track system — `badgeEngine.ts`) :**

| Track | Clé | Description |
|---|---|---|
| ⚡ Performance | `TRACK_PERFORMANCE` | Vitesse et précision — 12 badges de précision_pousse à précision_couronne |
| 🌿 Persévérance | `TRACK_PERSEVERANCE` | Régularité et accumulation — 12 badges de regularite_aube à daily_champion |
| 🌍 Exploration | `TRACK_EXPLORATION` | Modes, social, amélioration — 13 badges de exploration_graine à exploration_crane |

Fonctions : `getTrackForBadge(id) → TrackName | null`, `pickNextTrackGoal(track, earnedBadges, currentGoal) → string | null`.
`ELIGIBLE_GOAL_BADGE_IDS` est dérivé de l'union des 3 tracks + `MASTER_SEQUENCE`. `exploration_graine` est désormais inclus (plus d'exclusion).
Badges hors track (déclenchement automatique sans objectif actif) : `social_*`, `ami_*`, `record_*`, `secret_*`, `saisonnier_*`, `regularite_lune`, `regularite_soleil`, `onf_premier`, `ami_de_la_foret`.

**Rang forestier** : le score est la somme de deux composantes.

**Badges** (Bois=5pts, Pierre=10pts, Or=20pts, Cristal=50pts) — score max badges : 880 pts

**Activité** (défis complétés) :
- Défi solo : +1 pt
- Défi entre amis : +2 pts
- Grille Planète Urgence : +3 pts
- Défi du jour : +5 pts

7 rangs de Promeneur à Esprit de la Forêt (paliers : 0 / 30 / 100 / 300 / 700 / 1500 / 3000 pts).
Score calculé par `getPlayerScore(earnedBadges, activityStats)` dans `src/constants/badges.ts`.
Chaque changement de rang déclenche une récompense en graines (`RANK_SEED_REWARDS` dans `src/components/Game/RankUpModal.tsx`) :

| Rang | Graines |
|---|---|
| Promeneur | 0 |
| Bucheron | 10 |
| Sylviculteur | 25 |
| Garde Forestier | 50 |
| Technicien Planète Urgence | 100 |
| Ingénieur des Forêts | 200 |
| Esprit de la Forêt | 500 |

La détection de rang est active dans **tous les modes** : solo, daily, Planète Urgence, ami.

`evaluateBadges(GameContext)` dans `badgeEngine.ts` — appelé après chaque victoire.

---

## Système de bonus (2 bonus)

| id | Limite | Comportement |
|---|---|---|
| reveal_cell | 3/jour (∞ premium) | Révèle la solution d'une case 5 s — le joueur tape une case, la solution s'affiche en surbrillance dorée puis la case se vide. Palette non-sélectionnable pendant l'attente de sélection. |
| instinct | 3/jour (∞ premium) | Révèle les cases mal placées en rouge pendant 5 s. Nécessite au moins un élément posé. |

**UX modale bonus :** au clic sur un bouton bonus, une modale d'explication s'affiche toujours :
- Bouton **"Compris !"** — ferme sans activer.
- Bouton **"Activer !"** — visible uniquement si les conditions sont remplies (pas de cooldown, pas épuisé, condition contextuelle OK). Active le bonus.

**Recharge via pub (mode free uniquement) :**
- Quand tous les bonus sont épuisés (`dailyBonusUses` = 0 pour tous), chaque bouton épuisé affiche l'icône 🎬 (fond grisé, bordure pointillée violette) à la place du compteur.
- Un clic ouvre `WatchAdModal` (`src/components/Bonus/WatchAdModal.tsx`) — popup avec compte à rebours simulé de 5 s.
- Après confirmation, `player.refillBonusWithAd()` est appelé : recharge `dailyBonusUses` à 3 pour tous les bonus ET pose `watchAdUsedToday = true`.
- **1 seule recharge par jour** (reset dans `checkDailyLogin` à minuit).
- Non accessible si `isPremium` (bonus déjà illimités) ou `bonusDisabled` (mode ONF, niveau 15).
- État dans `playerStore` : `watchAdUsedToday: boolean`, `lastWatchAdDate: string | null`.
- Props dans `HintOverlay` : `watchAdAvailable` (boolean) + `onWatchAd` (callback).

**Canal reveal dans gameStore :**
- `revealActive` — true = en attente de sélection d'une case par le joueur
- `revealCellIndex` — index de la case révélée
- `revealElementId` — élément de la solution affiché
- `displayBoard` — calculé dans `[challengeId].tsx` : playerBoard + revealElementId sur revealCellIndex

Niveau 15 : `bonusDisabled = true` → aucun bonus utilisable.

---

## i18n

```ts
const t = useT()
t('btn_play')                          // "Jouer" ou "Play"
t('a11y_no_same', { element: 'ours' }) // interpolation {{element}}
```
Langue stockée dans `playerStore.language` (détectée via `getSystemLocale()`).
Fichiers : `src/i18n/locales/fr.json` et `en.json`.

**Règle obligatoire — tout texte UI doit être traduit :**
- Tout nouveau texte affiché à l'écran doit avoir une entrée dans **les deux fichiers** : `fr.json` ET `en.json`.
- Ne jamais hardcoder un texte visible dans un composant React. Toujours passer par `t('clé')`.
- Lors de l'ajout ou de la modification d'une clé, mettre à jour `fr.json` ET `en.json` dans le même commit/modification.
- Les clés manquantes dans `en.json` sont considérées comme des bugs.

---

## Génération de défis

```bash
npm run generate        # génère tous les niveaux
npm run regenerate      # régénère avec nouveaux paramètres
npm run generate:viewer # données pour le viewer
```

Le générateur (`challengeGenerator.ts`) garantit :
- Solution unique vérifiée par le solveur backtracking
- Diversité structurelle (signature des cases fixes, signature de solution complète)
- Validité pédagogique (relations entre éléments liés visibles du joueur)
- Tension narrative (renard ↔ mouton, chalet ↔ bucheron)

---

## Invariants composition (difficulty.ts)

| Code | Règle |
|---|---|
| I1 | Σ éléments = cellCount |
| I2 | ruche ≤ 1 |
| I3 | ours ≥ 1 si ruche = 1 |
| I4 | chien ≥ 2 si chien > 0 |
| I5 | cerf = biche (quantité) |
| I6 | bucheron ≥ chalet si les deux présents |
| I7 | bucheron ≥ 1 si tas_buches > 0 |

---

## Conventions de code

- **Règles de jeu** : déclarées dans `ElementDefinition.constraints` — jamais en dur dans le moteur
- **Ajouter un élément** : créer `src/elements/monElement.ts` + une ligne dans `ElementRegistry.ts`
- **Ajouter un plateau** : créer `src/boards/board_Xcells_vY.ts` + une ligne dans `BoardRegistry.ts`
- **Stores** : `usePlayerStore.getState()` pour lire hors composant React (ex: dans `useEffect` après mise à jour)
- **Badges** : toujours `awardBadges(ids[])` (batch), jamais `awardBadge()` en boucle
- **Validation victoire** : comparaison directe `playerBoard[i] === solution[i]`, pas de `validateBoard()`
- **Timer** : ne démarre qu'après fermeture du briefing (`startTimer()` dans `handleBriefingClose`)
- **Audio web** : nécessite `userHasInteracted = true` avant lecture. Géré dans `app/_layout.tsx`.
- **Patch expo-av** : `exponentAVPatch.web.ts` neutralise le crash `emit` dans `ontimeupdate`. Metro choisit automatiquement `.web.ts` sur web.
- **SafeArea** : utiliser `useSafeAreaInsets()` — pas de `SafeAreaView` Expo (dépréciée v57)

---

## Fichiers à ne PAS modifier directement

- `src/data/challenges/niveau_*.json` → régénérer via `npm run generate`
- `.kilo/` → config Kilo
- `AGENTS.md`
- `assets/` → assets statiques (images, musiques)

---

## Mode Planète Urgence — Grille Forestière (Sudoku Forestier)

- **Écrans** : `app/game/onf.tsx` — route `/game/onf?size=3` ou `/game/onf?size=4` (affiché en UI sous le nom "Planète Urgence" / "Défi de la forêt")
- **Mécanique** : grille N×N orthogonale + règles de voisinage standard + contrainte `row_col_unique` (max 1 élément identique par ligne ET par colonne)
- **Progression** : `currentLevel >= ONF_UNLOCK_LEVEL (5)` → 3×3 débloqué ; `currentLevel >= ONF_4X4_LEVEL_UNLOCK (14)` → 4×4 débloqué
- **Solveur** : `solveOnf()` dans `solver.ts` — backtracking + élagage ligne/colonne via `isPlacementValidOnf()`
- **Validation** : bouton Valider → `validateBoard()` + `validateRowColUnique()` (union violations) ; victoire = `checkVictory()` seul (solution pré-calculée satisfait déjà la contrainte)
- **Générateur** : `src/services/onfChallengeService.ts` — compositions 3×3 et 4×4, retry max 50
- **Récompense** : `calculateOnfReward(elapsedMs)` → 5 graines de base + 2 si résolu en < 120 s (= 5 ou 7 graines, indépendant de la taille)
- **Affichage contrainte** : surlignage ligne/colonne (Option A) — `getCellColorOnf` dans `onf.tsx` calcule les cases à fond jaune depuis `gridMeta`
- **Éléments exclus** : `chien` (connected_group + sudoku impossible), `champignon` (center_only, pas de specialCells ONF)
- **Carte d'accueil** : `app/(tabs)/index.tsx` — bouton "Défi de la forêt" verrouillé si `currentLevel < ONF_4X4_LEVEL_UNLOCK` ; débloqué sinon
- **Constantes** : `src/constants/onf.ts` — `ONF_UNLOCK_LEVEL = 5`, `ONF_4X4_UNLOCK_COUNT = 10`, `ONF_4X4_LEVEL_UNLOCK = 14`
- **Pas de Firestore spécifique** : pas de collection dédiée ONF ; seeds synchées via le flux standard ; compteur unifié `onfSolvedCount` dans `PlayerProfile` (était `onf4x4SolvedCount` — migré via `migrateProfile`)

---

## Défi du Jour (daily challenge)

- **Écran** : `app/game/daily.tsx` — 15 cases, 1 seule validation, aucun bonus
- **Briefing** : `src/components/LevelBriefing/DailyBriefingModal.tsx` — 2 pages (champignon + récap)
- **Génération** : `src/services/dailyChallengeService.ts` — PRNG déterministe (mulberry32), 16 compositions en 7 familles, solver backtracking, baseFixedCount ≤ 6, validation pédagogique/narrative
- **Plateau** : `src/boards/board_15cells_daily.ts` — 15 cases, specialCells.center = [3,4,7,10,11]
- **Élément exclusif** : `champignon` (center_only, ≠ voisin champignon, max 2 sur board_15_daily)
- **Uniqueness** : `fixedOrder` du générateur ; `getDailyFixedPlacements` prend les N premiers (superset preserves uniqueness)
- **Player level** : 6 tiers (niv 10+ → 4 fixes, niv 1 → 9 fixes)
- **État** : `playerStore.dailyChallengeStatus` / `lastDailyChallengeDate` / `dailyChallengeStreak` + `gameStore.dailyValidationUsed`
- **Reset** : `playerStore.resetDailyStatus()` — utilisé par le bouton "Rejouer" (`__DEV__` only) dans `index.tsx` et `levels.tsx`
- **Viewer** : `VIEWER_DEFIS.html` + `VIEWER_DATA.js` — mode Classic/Daily, bouton "Régénérer" (solver embarqué en JS pur), `scripts/generateViewerData.ts`

---

## Onglet Règles

- **Écran** : `app/(tabs)/rules.tsx` — 📖 dans la tab bar
- **Contenu** : 10 éléments dans l'ordre d'apparition (bucheron→ours→mouton→ruche→chien→cerf→biche→renard→tas_buches→chalet)
- **Débloqué** (`currentLevel >= introLevel`) : icône + nom + animations `RuleCard` du briefing (fond forêt sombre)
- **Verrouillé** : icône grisée + nom grisé + "???" + "Débloqué au niveau X"
- **RuleCards** : mapping explicite par `ruleIds` → index dans `ALL_RULES_BY_ID` (collecté depuis `LEVEL_META`)
- **Pédagogie** : niveau 12 = `chain_tas_buches` (bûcheron→bûches seulement), niveau 13 = `chain_tas_buches_chalet` (bûches→chalet conditionnel) — chaîne séparée en 2 slides
- **ChainAnim** : supporte 2 ou 3 éléments dans `rule.elements` (skip phases chalet si pas de 3e)

---

## Entités HTML dans React Native

**Ne jamais utiliser** `&#xXXXX;` ou `&name;` dans `<Text>`. React Native ne les interprète pas.

**Ne jamais encoder les caractères accentués** comme `\u00e9` (é), `\u00e8` (è), `\u00e0` (à), `\u00b7` (·), `\u00d7` (×), `\u00a0` (espace insécable) dans les chaînes JSX. Écrire directement le caractère UTF-8 dans le fichier source.

```tsx
// MAUVAIS
'r\u00e9solue'    // illisible, source de bugs
'\u00b7 Sudoku'   // idem

// CORRECT
'résolue'         // UTF-8 direct dans le source
'· Sudoku'        // idem
```

**Exception autorisée** : les emoji multi-codepoint (paires de substitution) peuvent utiliser `{'\uD83D\uDD25'}` si le caractère est difficile à insérer directement — mais préférer l'emoji brut `{'🔥'}`.

Après chaque modification de fichier `.tsx`, vérifier avec :
```powershell
Select-String -Path "app\(tabs)\*.tsx","src\components\**\*.tsx" -Pattern '\\u[0-9a-fA-F]{4}'
```

---

## Système de récompenses en graines

Les graines sont la monnaie du jeu. Chaque mode de jeu a sa propre formule, calculée à la victoire.

### Mode solo (`app/game/[challengeId].tsx` + `src/core/engine/hintEngine.ts:207`)

```ts
// calculateSeedReward(elapsedMs, estimatedDurationMs, bonusUsed)
let seeds = 10;                               // base
if (elapsedMs < estimatedDurationMs * 0.5)    seeds += 5;  // bonus rapidité (< 50% du temps estimé)
seeds -= bonusUsed.length * 2;                // -2 par bonus utilisé
return Math.max(seeds, 1);                    // minimum 1 graine
```

| Situation | Graines |
|---|---|
| Base | 10 |
| + bonus rapidité (< 50% temps estimé) | +5 |
| − par bonus utilisé | −2 chacun |
| Minimum garanti | 1 |
| Maximum (sans bonus, rapide) | 15 |

### Mode solo — PERFECT x2 (`app/game/[challengeId].tsx:311,705`)

Si le run est parfait (voir section ci-dessous), les graines de base sont **doublées** : `player.addSeeds(seedsEarned)` est appelé une 2e fois via `onPerfectBonusCollected` dans `VictoryModal`. Le maximum effectif devient **30 graines**.

### Défi du Jour (`src/services/dailyChallengeService.ts:654`)

```ts
// calculateDailyReward(rank, totalParticipants, dailyStreak)
const baseSeeds      = 5;
const topPercentBonus = rank <= ceil(totalParticipants * 0.10) ? 5  : 0;  // top 10%
const top3Bonus       = rank <= 3                              ? 15 : 0;  // top 3
const firstPlaceBonus = rank === 1                             ? 25 : 0;  // #1 mondial
const streakBonus     = dailyStreak === 7                      ? 20 : 0;  // passage palier 7 jours
```

| Composante | Graines |
|---|---|
| Base | 5 |
| Top 10% | +5 |
| Top 3 | +15 |
| #1 mondial | +25 |
| Streak 7 jours (bonus unique au palier) | +20 |
| **Maximum cumulé** | **70** |

Bonus streak record : si le joueur bat son record de série ET `newStreak > 1`, `player.addSeeds(newStreak)` est appelé en plus.

### Mode ONF (`src/services/onfChallengeService.ts:59`)

```ts
// calculateOnfReward(elapsedMs) — indépendant de la taille (3×3 ou 4×4)
return 5 + (elapsedMs < 120_000 ? 2 : 0);  // 5 ou 7 graines
```

### Défi entre amis (`src/services/challengeService.ts:34`)

```ts
export const CHALLENGE_WINNER_SEEDS = 15;  // victoire uniquement, aucun bonus
```

### Connexion journalière (`(tabs)/_layout.tsx`)

`player.checkDailyLogin()` → retourne `true` si première connexion du jour → `player.addSeeds(3)`.

### Badges débloqués (`src/constants/badges.ts:35`)

```ts
export const BADGE_SEED_REWARDS: Record<BadgeRarity, number> = {
  bois:    5,
  pierre:  15,
  or:      30,
  cristal: 75,
};
```

### Changement de rang (`src/components/Game/RankUpModal.tsx:29`)

Voir tableau `RANK_SEED_REWARDS` dans la section Système de badges ci-dessus.

---

## Notion de Perfect

### Définition — Run Parfait (mode solo uniquement)

**Fichier :** `app/game/[challengeId].tsx:313–320`

Un run est parfait si **4 critères cumulatifs** sont vrais au moment de la victoire :

| Critère | Champ | Détail |
|---|---|---|
| Aucun jeton posé déplacé/retiré/remplacé | `game.elementChangeCount === 0` | Incrémenté dans `gameStore` à chaque `moveElement` / `removeElement` / `placeAndDeselect` sur case occupée. La pose initiale sur une case vide ne compte pas. |
| Aucune validation ratée pendant la partie | `failsDuringGame === 0` | `failsDuringGame` = nb de fois où Valider a renvoyé `status: 'failure'`. Différent de `errorCount` (nb de cases fausses dans la grille). |
| Jamais abandonné ce défi par le passé | `abandonCountForChallenge === 0` | Lu dans `stats.abandonCount[challengeId]` **avant** `markChallengeCompleted`. |
| Aucun bonus utilisé | `game.bonusUsed.length === 0` | Tous les 4 bonus (hint, count, instinct, flash) sont bloquants. |

Condition supplémentaire pour afficher l'overlay : `seedsEarned > 0`.

```ts
const isPerfect =
  game.elementChangeCount === 0 &&
  failsDuringGame === 0 &&
  abandonCountForChallenge === 0 &&
  game.bonusUsed.length === 0;
if (isPerfect && seedsEarned > 0) setIsPerfectRun(true);
```

**Récompense :** les graines sont doublées (`PERFECT x2`) — `player.addSeeds(seedsEarned)` est appelé une 2e fois via `VictoryModal.onPerfectBonusCollected`.

### dailyPerfect — Défi du Jour

Le daily n'autorise qu'**une seule pression sur Valider**. Toute victoire est parfaite par construction : `stats.dailyPerfectCount` est toujours incrémenté dans `recordDailyVictory`. (`playerStore.ts:1048`)

### onfPerfect — Mode ONF

Condition : grille **jamais complétée** auparavant ET `failCount === 0`. Incrémente `stats.onfPerfectCount`. (`playerStore.ts:1021–1025`)

### Badges liés au Perfect

| Badge ID | Label | Rareté | Graines | Condition |
|---|---|---|---|---|
| `precision_parfaite` | Pose Parfaite 🎯 | Or | 30 | 3 défis **consécutifs** avec les 4 critères (goalCounter remis à 0 si un défi n'est pas parfait) |
| `amelioration_etoile` | Perfection absolue 💫 | Or | 30 | `failCount === 0` ET `elapsedMs / estimatedDurationMs < 0.20` |
| `daily_perfect` | Quotidien sans faute 🏅 | Or | 30 | 10 victoires daily (= toujours parfait par construction) |
| `onf_precision` | Grille sans faute 🎯 | Pierre | 15 | 3 grilles Planète Urgence résolues sans erreur (`onfPerfectCount >= 3`) |

Sources : `src/constants/badges.ts:144,293,494,537` + `src/core/engine/badgeEngine.ts:205,358,406`.

---

## TODOs avant publication

```ts
// playerStore.ts
seeds: 99,        // → 3
isPremium: true,  // → false
```

```ts
// app/(tabs)/levels.tsx + app/(tabs)/index.tsx
// Retirer les boutons "Rejouer" (gardés par __DEV__, mais vérifier)
```
