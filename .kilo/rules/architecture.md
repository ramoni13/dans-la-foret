# Architecture — Dans la Forêt

Jeu de logique mobile/web (Expo ~57 / React Native 0.86 / React 19).
**Jamais modifier** `AGENTS.md`. Toujours consulter https://docs.expo.dev/versions/v57.0.0/ avant d'écrire du code Expo.

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
    index.tsx              ← Accueil (progression globale + prochain défi)
    levels.tsx             ← Sélection des niveaux
    challenge.tsx          ← Défis entre amis
    profile.tsx            ← Profil, auth, badges, classement
  game/
    [challengeId].tsx      ← Écran de jeu principal (drag & drop complet)
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
      validator.ts    ← validateBoard(), checkVictory(), isPlacementValid()
      solver.ts       ← Backtracking, s'arrête à 2 solutions (isUnique)
      hintEngine.ts   ← getValidCellsForElement(), calculateSeedReward()
      badgeEngine.ts  ← evaluateBadges(), getClosestBadges(), GameContext
    generators/
      challengeGenerator.ts ← generateChallenge() — solution unique garantie
  elements/
    ElementRegistry.ts  ← Record<string, ElementDefinition> (source unique)
    bucheron.ts / ours.ts / mouton.ts / ruche.ts / chien.ts
    renard.ts / cerf.ts / biche.ts / chalet.ts / tas_buches.ts
  boards/
    BoardRegistry.ts    ← Record<string, BoardDefinition>
    board_6cells_v1.ts … board_12cells.ts  (8 plateaux)
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
    leaderboardService.ts
    worldRecordService.ts ← subscribeWorldRecord(), trySetWorldRecord()
    audioService.ts
    exponentAVPatch.ts / .web.ts  ← patch crash expo-av sur web
  constants/
    colors.ts       ← Colors (forest, cell, elements, ui, badges)
    bonus.ts        ← BonusId + BONUS_DEFINITIONS + BASE/ADVANCED_BONUS_IDS
    badges.ts       ← BADGE_DEFINITIONS (41), BADGE_MAP, BADGE_SEED_REWARDS, RARITY_UNLOCKS
    difficulty.ts   ← LEVEL_PARAMS (15 niveaux) + Composition + LevelParams
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

### Plateaux (8 dans BoardRegistry)
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

## Système de badges (41 badges)

Catégories : vitesse, précision, régularité, social, amélioration, exploration, secrets (5), saisonniers (4)
Raretés : bois (5🌱) → pierre (15🌱) → or (30🌱) → cristal (75🌱)

**Déblocages par paliers** (`RARITY_UNLOCKS`) :
- 3 bois → +10 graines
- 5 pierre → bonus Flash
- 3 or → bonus Instinct
- 3 pierre → thème Automne
- etc.

`evaluateBadges(GameContext)` dans `badgeEngine.ts` — appelé après chaque victoire.

---

## Système de bonus (4 bonus)

| id | Coût | Requis |
|---|---|---|
| highlight_valid_cells | 3🌱 | non |
| count_errors | 2🌱 | non |
| instinct | 6🌱 | 3 badges or |
| flash | 8🌱 | 5 badges pierre |

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

## TODOs avant publication

```ts
// playerStore.ts
seeds: 99,        // → 3
isPremium: true,  // → false
```
