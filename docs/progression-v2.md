# Chantier « Progression v2 » — Dans la Forêt

Ce document est la **référence** du chantier pour toutes les sessions. Il reprend la
spécification complète (sections A à F). Le chantier refond la progression du jeu :
étoiles, chapitres, déblocages, cérémonies, Herbier, trophées. Il est découpé en lots ;
on exécute UN SEUL LOT par session, puis on s'arrête avec un résumé (fichiers modifiés,
tests, points ouverts).

Expert attendu : React Native / Expo 57 / TypeScript / Zustand / Firebase, et game design.

---

## A. Règles transverses (pour tous les lots)

- Lire `AGENTS.md` et la doc Expo https://docs.expo.dev/versions/v57.0.0/ avant d'écrire
  du code Expo. Ne jamais modifier `AGENTS.md`.
- `.kilo/rules/architecture.md` : l'utilisateur AUTORISE explicitement sa modification.
  Le mettre à jour à la fin de CHAQUE lot (convention de maintenance du fichier).
- i18n : tout texte visible passe par `t('clé')`, avec la clé dans `fr.json` ET `en.json`.
- Écrire les accents en UTF-8 direct. Jamais de `\u00e9`, jamais d'entité HTML dans `<Text>`.
- `useSafeAreaInsets()` (pas de `SafeAreaView`). `usePlayerStore.getState()` hors React.
  Badges et trophées toujours attribués en lot avec `awardBadges(ids[])`.
- Ne pas modifier `assets/` ni `src/data/challenges/niveau_*.json` à la main.
- Animations (D8) : tout NOUVEAU composant utilise `react-native-reanimated` 4.5. Un
  composant existant n'est migré que si le lot le réécrit (VictoryModal, SeedFlyAnimation,
  BadgeToast, BadgeCard). Ne pas toucher aux RuleAnimations, FallingLeaves, Confetti,
  Cell, ChallengeCountdown, SplashScreen. Avant le premier composant Reanimated, vérifier
  la config Babel / `react-native-worklets` selon la doc Expo v57.
- Accessibilité : respecter `AccessibilityInfo.isReduceMotionEnabled()` (fondus à la
  place des animations) et annoncer les récompenses via `accessibilityLabel` /
  `accessibilityLiveRegion`.
- Drapeau `PROGRESSION_V2` dans `src/constants/featureFlags.ts`, pour livrer lot par lot.
- Contournements dev (`'planete'`, `DEV_USERS`) : les centraliser dans un seul helper.
- Fin de lot : `npx tsc --noEmit` sans erreur, `npm test` vert, nouveaux tests Jest pour
  toute logique pure, vérification qu'aucun `\uXXXX` n'apparaît dans les `.tsx` modifiés.
- Opérations Firestore destructives (purge, script) : les PROPOSER et attendre la
  confirmation de l'utilisateur avant toute exécution.

## B. Contexte : état actuel (vérifié dans le code)

- 21 niveaux (`src/constants/difficulty.ts`, `DifficultyLevel` = `niveau_1`…`niveau_21`),
  10 défis par niveau (`src/data/challenges/niveau_N.json`).
- Règles introduites aux niveaux : 1 bûcheron/ours/mouton · 3 chien · 5 loup · 7 ruche ·
  9 cerf/biche · 11 tas_buches · 12 chalet · 17 champignon · 19 arbre.
  Bonus désactivés aux niveaux 15, 18 et 21.
- Calcul actuel du niveau : `computePlayerLevel` (`src/services/playerService.ts`) =
  `floor(completedChallenges/10)+1`, plafonné à 21. Appelé dans `markChallengeCompleted`
  (`src/store/playerStore.ts`).
- Écran de sélection des niveaux : dans `app/(tabs)/index.tsx` (`isLevelUnlocked`,
  `isChallengeUnlocked`). Il n'y a PAS de fichier `levels.tsx`.
- Déblocages actuels : `src/constants/unlocks.ts` (Duel niv. 3, Journalier niv. 9),
  `src/constants/onf.ts` (`ONF_4X4_LEVEL_UNLOCK = 14`, plus des restes 3×3 :
  `ONF_UNLOCK_LEVEL`, `ONF_4X4_UNLOCK_COUNT`), et `DAILY_UNLOCK_LEVEL` codé en dur dans
  `index.tsx` (~l.764).
- Forestier (ONF) : 4×4 UNIQUEMENT, 100 grilles pré-générées (`src/data/onf_challenges.json`,
  `scripts/generateOnfChallenges.ts`, `pickOnfChallenge` dans
  `src/services/onfChallengeService.ts`). Restes 3×3 à supprimer : `board_3x3_onf` et
  `gridSize` dans `app/game/onf-lobby.tsx`.
- Journalier : `src/services/dailyChallengeService.ts` (compositions ~l.94-136, toutes
  avec champignon ; certaines avec chalet ou tas_buches), `getDailyFixedPlacements`
  (nombre de cases fixes variable selon le niveau du joueur), `calculateDailyReward`.
- Graines : `addSeeds` / `spendSeeds` (spendSeeds JAMAIS appelé). Solo :
  `calculateSeedReward` (`hintEngine.ts`), PERFECT ×2 via
  `VictoryModal.onPerfectBonusCollected`. Animation : `seedAnimStore` +
  `SeedFlyAnimation.tsx`.
- Herbier : `src/data/treesData.ts` (100 cartes), `src/utils/onfCards.ts` (cartes
  déduites de `onfSolvedCount`, 1 carte toutes les 5 grilles), `collectedTreeCardIds` et
  `collectTreeCard` dans playerStore, `TreeCardGallery`.
- Badges : 66 dans `src/constants/badges.ts`, plus `RARITY_POINTS`, `ACTIVITY_POINTS`,
  `getPlayerScore`, `RANK_DEFINITIONS`, `BADGE_SEED_REWARDS`. Moteur dans
  `src/core/engine/badgeEngine.ts`, avec blocage par « objectif actif »
  (`ELIGIBLE_GOAL_BADGE_IDS`, `activeBadgeGoals`, tracks, `trackGoals`, `goalCounters`,
  `advanceTrackGoals`). `app/admin/badge-sequence.tsx`. `RankUpModal.tsx`
  (`RANK_SEED_REWARDS`).
- Musiques : `src/constants/music.ts`, 14 titres (2 gratuits, 12 liés à un `unlockBadgeId`),
  `BADGE_MUSIC_UNLOCK_MAP`, `MusicUnlockModal`.
- Perfect actuel (`app/game/[challengeId].tsx` ~l.313) : elementChangeCount 0, aucune
  validation ratée, jamais abandonné, aucun bonus.

## C. Spécification fonctionnelle (décisions validées)

### C1. Étoiles (Solo uniquement)
- Par défi, à la victoire :
  - ⭐ victoire ;
  - ⭐⭐ aucune validation ratée pendant la partie ;
  - ⭐⭐⭐ aucune validation ratée + aucun bonus + aucun jeton posé déplacé, retiré ou
    remplacé (`elementChangeCount === 0`).
  Le critère « jamais abandonné » est SUPPRIMÉ. Le maximum est toujours 3, sans exception.
- On stocke la MEILLEURE note par défi (`challengeStars: Record<challengeId, 1|2|3>`).
  Les étoiles ne baissent jamais et ne se dépensent jamais.
- Seuil pour débloquer le niveau suivant (D1), sur 30 possibles :
  - 6 ⭐ pour les niveaux qui introduisent une règle : 1, 3, 5, 7, 9, 11, 12, 17, 19 ;
  - 6 ⭐ pour les épreuves sans bonus : 15, 18, 21 ;
  - 4 ⭐ pour les autres niveaux : 2, 4, 6, 8, 10, 13, 14, 16, 20.
- Le niveau N+1 est ouvert si étoiles(N) ≥ seuil(N). `currentLevel` = 1 + nombre de
  niveaux consécutifs validés depuis le niveau 1 (maximum 21). `levelsCompleted`
  (0 à 21) sert à savoir si le niveau 21 lui-même est validé.
- Dans un niveau ouvert, les 10 défis sont accessibles (D13). Le « prochain conseillé »
  (premier défi sans ⭐⭐⭐, en priorité ceux jamais gagnés) est mis en avant.
- Le Journalier, le Forestier et le Duel ne donnent PAS d'étoiles.

### C2. Graines
- Solo, première victoire sur un défi : `calculateSeedReward` inchangé, plus PERFECT ×2
  (si ⭐⭐⭐).
- Solo, défi rejoué (D10) : 5 🌱 par NOUVELLE étoile gagnée, sinon 0. Pas de ×2.
- Journalier, Forestier, Duel, connexion quotidienne : formules inchangées.
- Trophées : `BADGE_SEED_REWARDS` par rareté (bois 5, pierre 15, or 30, cristal 75).
- Fin de chapitre : voir C3.
- Les graines se dépensent UNIQUEMENT dans l'Herbier (C6).

### C3. Chapitres, rang et déblocages
- Rang = chapitre en cours (D4). On supprime `getPlayerScore`, `RARITY_POINTS`,
  `ACTIVITY_POINTS` et `RankUpModal` : le changement de rang est intégré à la cérémonie
  de chapitre.

| Ch | Niveaux | Rang affiché pendant le chapitre | Récompenses à la fin du chapitre |
|---|---|---|---|
| 1 L'Éveil | 1-3 | Promeneur | +10 🌱 · Duel · 1 carte · musique 1 |
| 2 Le Loup | 4-6 | Bûcheron | +25 🌱 · Forestier Sentier · 1 carte · musique 2 |
| 3 La Ruche et les Cerfs | 7-9 | Sylviculteur | +50 🌱 · Journalier Pousse · Forestier Clairière · 1 carte · musique 3 |
| 4 Le Chalet | 10-12 | Garde Forestier | +100 🌱 · Journalier Grand Chêne · Forestier profond · 1 carte · musique 4 |
| 5 L'Épreuve | 13-15 | Technicien Planète Urgence | +200 🌱 · région Herbier « Europe » · 1 carte · musique 5 |
| 6 Cœur de forêt | 16-18 | Ingénieur des Forêts | +500 🌱 · région Herbier « Monde » · 1 carte · musique 6 |
| 7 L'Esprit | 19-21 | Esprit de la Forêt | région « Arbres remarquables » · 1 carte légendaire · musique 7 · trophée final |

- Chapitre N terminé = tous ses niveaux validés (seuil d'étoiles atteint). Exemple :
  Duel ouvert dès que `currentLevel ≥ 4`.
- Créer `src/constants/progression.ts` : `STAR_THRESHOLDS`, `CHAPTERS` (niveaux,
  emoji, clés i18n, rang, récompenses typées), et des helpers purs testés :
  `computeStars`, `computeLevelProgress(challengeStars)` → `{ currentLevel,
  levelsCompleted, starsByLevel }`, `getChapterForLevel`, `isChapterCompleted`, et
  `isFeatureUnlocked(feature, progress)` avec les features `duel | onf_sentier |
  onf_clairiere | onf_profonde | daily_pousse | daily_grand_chene | herbier_europe |
  herbier_monde | herbier_remarquables`.
- `unlocks.ts` et `onf.ts` : remplacés ou réécrits pour s'appuyer sur `isFeatureUnlocked`.
  Plus aucun seuil de niveau codé en dur dans les écrans.

### C4. Forestier 4×4 en 3 paliers
- Contrainte mathématique : `row_col_unique` ⇒ au moins 4 types d'éléments. Le chien est
  impossible. Bûcheron, ours et mouton respectent leur règle automatiquement. Le loup
  (≠ voisin mouton) est la première vraie règle « forestière ».
- **Sentier** (fin Ch.2) : composition `{bucheron:4, ours:4, mouton:4, loup:4}`.
  Environ 30 grilles, de 8 cases fixées (faciles) à 5 (la contrainte loup/mouton devient
  nécessaire). Solution unique vérifiée par `solveOnf`.
  Exemple de solution valide : `M O L B / O M B L / L B M O / B L O M`.
- **Clairière** (fin Ch.3) : compositions existantes avec ruche et/ou cerf/biche, SANS
  champignon.
- **Profonde** (fin Ch.4) : compositions avec champignon (et toutes les autres).
- Ajouter `tier: 'sentier' | 'clairiere' | 'profonde'` à chaque grille de
  `onf_challenges.json` (via le générateur). `pickOnfChallenge(completedIds, unlockedTiers)`
  filtre selon les paliers ouverts et privilégie le palier le plus élevé.
- Supprimer les restes 3×3 : `board_3x3_onf` (registre et fichier si plus aucun usage),
  `gridSize` dans `onf-lobby.tsx`, `ONF_UNLOCK_LEVEL`, `ONF_4X4_UNLOCK_COUNT`.
  Conserver `solveOnf` et `isPlacementValidOnf`.
- Première partie du Forestier : un écran d'introduction court expliquant la règle
  ligne/colonne (réutiliser le pattern des briefings existants s'il y en a un).

### C5. Journalier en 2 ligues
- **Pousse** (fin Ch.3) : compositions SANS chalet ni tas_buches.
  **Grand Chêne** (fin Ch.4) : toutes les compositions.
- Deux grilles par jour : même seed de date, avec un sel par ligue. Le joueur joue la
  grille de sa ligue la plus haute.
- Le nombre de cases fixes est IDENTIQUE pour tous les joueurs d'une même ligue (on ne
  dépend plus du niveau du joueur). Respecter l'unicité : N ≥ `baseFixedCount` du
  générateur.
- Un classement Firestore par ligue et par date. Adapter `submitDailyResult`, le
  classement, `calculateDailyReward` (rang dans la ligue), les séries et les règles
  Firestore. Inspecter le schéma existant avant de proposer le nouveau.
- Le briefing du Journalier présente déjà le champignon : la Pousse est donc le premier
  contact avec le champignon. Au niveau 17, le briefing du champignon doit dire « Tu l'as
  déjà croisé dans le Défi du Jour ! ».

### C6. Herbier
- Source de vérité : `collectedTreeCardIds` (et non plus `onfSolvedCount`).
  Réécrire `onfCards.ts` en conséquence.
- Ajouter `region: 'france' | 'europe' | 'monde' | 'remarquables'` à `TreeCard`. Le
  classer à partir de `geo_location`, et signaler les cas douteux dans le résumé.
  « France » est ouverte dès le départ, les autres régions selon C3.
- Planter une carte : coût = `30 + 5 × floor(nbCartesPossédées / 10)` 🌱 (D5). Le
  joueur choisit une carte parmi les régions ouvertes. Elle s'affiche en silhouette
  avant d'être plantée. Utiliser `spendSeeds`.
- Sources de cartes gratuites : 1 par fin de chapitre (la suivante de la région, ou une
  légendaire au Ch.7) et 1 toutes les 5 grilles Forestier (`ONF_CARD_UNLOCK_EVERY`).
- L'Herbier est accessible dès le Ch.1. Il a son entrée sur l'accueil, avec la
  progression « X / 100 » et la prochaine carte en silhouette.

### C7. Cérémonies et animation des étoiles
- **Animation des étoiles** (dans VictoryModal, environ 2,5 s, un tap passe la séquence) :
  - 3 emplacements vides, chacun avec son critère écrit en dessous (Gagné / Sans erreur /
    Parfait) ;
  - pop successif des étoiles obtenues, avec une note de plus en plus aiguë et une
    vibration légère (moyenne pour la 3ᵉ) ; les étoiles manquées restent grises avec leur
    critère visible ;
  - en rejouant : les étoiles déjà acquises sont pâles, seules les NOUVELLES brillent et
    s'envolent vers le compteur ⭐ du bandeau ;
  - jauge du niveau `x / seuil`, puis bandeau « Niveau N débloqué ! » si le seuil est
    franchi ;
  - ordre : étoiles, puis graines (PERFECT ×2 enchaîné après la 3ᵉ étoile).
  - Généraliser `seedAnimStore` et `SeedFlyAnimation` en `rewardFlyStore` / `RewardFly`
    avec une cible `'seeds' | 'stars'`.
- **Compteurs** : ⭐ (or, « ce que je sais ») et 🌱 (vert, « ce que je récolte ») dans le
  bandeau, plus une jauge `étoiles / 30` et le seuil sur chaque niveau de l'écran de
  sélection, regroupé par chapitre.
- **Trois intensités de célébration** :
  - niveau passé = bandeau dans VictoryModal ;
  - fin de chapitre = cérémonie plein écran ;
  - mode débloqué = cérémonie + pastille « Nouveau » sur la tuile, jusqu'à la première
    partie.
- **Déroulé de la cérémonie de chapitre** (le joueur avance en touchant l'écran, aucune
  étape imposée de plus de 2 s) :
  1. l'emblème du chapitre se remplit d'étoiles ;
  2. le nouveau rang s'affiche et les graines volent ;
  3. les cartes-récompenses sont face cachée, le joueur les retourne d'un tap (mode,
     carte arbre, musique, région) ;
  4. aperçu du chapitre suivant (silhouettes des nouveaux éléments) ;
  5. boutons « Essayer maintenant » (vers le mode débloqué) et « Plus tard ».
- Toujours APRÈS le VictoryModal, jamais pendant une partie. File persistée
  `pendingCeremonies` + `seenCeremonies` dans playerStore. Si l'app a été fermée, la
  cérémonie est rejouée au retour sur l'accueil.

### C8. Trophées (remplacent les badges, sans migration)
- Plus de blocage par objectif actif : tout trophée dont la condition est remplie est
  décerné. Supprimer `ELIGIBLE_GOAL_BADGE_IDS`, les tracks, `trackGoals`,
  `activeBadgeGoals`, `goalCounters`, `advanceTrackGoals`, `MASTER_SEQUENCE`, et
  `app/admin/badge-sequence.tsx` (ou l'adapter si un usage admin le justifie).
- Suggestions : afficher les 3 « prochains trophées » les plus proches, avec leur barre
  de progression (s'inspirer de `getClosestBadges`).
- Séries à 4 paliers (bois, pierre, or, cristal). La rareté est déterminée par le palier.

| Famille | Série | Paliers |
|---|---|---|
| Solo | Constellation : étoiles cumulées | 50 / 150 / 350 / 630 |
| Solo | Œil de lynx : victoires ⭐⭐+ d'affilée (1ʳᵉ victoire seulement) | 5 / 10 / 25 / 50 |
| Solo | Main sûre : défis à ⭐⭐⭐ | 3 / 10 / 25 / 50 |
| Solo | Vif comme le vent : < 50 % du temps estimé (1ʳᵉ victoire seulement) | 1 / 10 / 30 / 100 |
| Solo | Persévérant : défis distincts dont la note a été améliorée | 1 / 5 / 20 / 50 |
| Journalier | Rendez-vous : victoires | 1 / 10 / 50 / 100 |
| Journalier | Série : jours d'affilée | 3 / 7 / 30 / 100 |
| Journalier | Podium | top 10 % / top 3 / top 3 ×5 / n° 1 |
| Forestier | Grilles résolues | 1 / 10 / 50 / toutes |
| Forestier | Sans faute | 1 / 5 / 20 / 50 |
| Forestier | Express (< 2 min) | 1 / 5 / 20 / 50 |
| Duel | Victoires | 5 / 20 / 50 / 100 |
| Duel | Rassembleur : amis distincts défiés | 1 / 5 / 10 / 25 |
| Herbier | Botaniste : cartes | 10 / 25 / 50 / 100 |
| Fidélité | Habitué : jours joués d'affilée | 3 / 7 / 30 / 100 |

- Surprises (badges uniques, conservés tels quels) : `secret_*`, `saisonnier_*`,
  `record_first`, `record_mondial`, `regularite_lune`, `regularite_soleil`,
  `ami_de_la_foret`. Plus un trophée final « Esprit accompli » (fin du Ch.7).
- Musiques (D11) : 7 titres pour les 7 fins de chapitre, plus 5 titres pour le palier
  « pierre » de : Rendez-vous, Grilles, Duel-Victoires, Botaniste, Habitué. Les 2 titres
  gratuits restent gratuits. Modèle :
  `unlock?: { type: 'chapter', chapter: number } | { type: 'trophy', id: string }
  | { type: 'seeds', cost: number }` (le type `seeds` est prévu pour plus tard, non
  utilisé). Proposition d'attribution, à ajuster si un meilleur sens narratif existe :
  - Ch1 forest_breath · Ch2 jardin_japonais · Ch3 pulsation_douce · Ch4 woodland_pulse ·
    Ch5 deep_sub_pulse · Ch6 neo_classical_motivation · Ch7 elek ;
  - Rendez-vous swaying_groove · Grilles boucle_hypnotique · Duel lilting_swing ·
    Botaniste moonlit_beach_shuffle · Habitué sun_warmed_groove.

### C9. Remise à zéro (D14 : tout est remis à zéro)
- Ajouter `progressionVersion: 2` au profil. À la connexion, si la valeur est absente ou
  inférieure à 2 : remettre TOUT le profil joueur aux valeurs par défaut (niveau,
  défis, étoiles, graines = 3, cartes, musiques, badges et trophées, stats, séries,
  bonus, `isPremium`, amis, historique), local ET Firestore, une seule fois.
- `isPremium` est remis à zéro UNIQUEMENT parce que les testeurs n'ont pas payé.
  Commentaire obligatoire dans le code : en production, un achat ne doit jamais être
  remis à zéro.
- Classements, records du monde, résultats du Journalier : proposer un script ou une
  action admin de purge, et NE PAS l'exécuter sans confirmation.
- Forêt commune (`foretCommuneService`, compteur collectif de vrais arbres) : NE PAS y
  toucher sans confirmation explicite de l'utilisateur.
- Corriger les TODO de publication si pertinent : `seeds` initial = 3. `isPremium` par
  défaut = false (le passage en test se fait par un autre moyen).

## D. Modèle de données (playerStore + PlayerProfile Firestore)

À ajouter :
- `progressionVersion: number`
- `challengeStars: Record<string, 1|2|3>`
- `levelsCompleted: number` (dérivé, mais persisté pour l'affichage et Firestore)
- `pendingCeremonies: string[]`
- `seenCeremonies: string[]`
- `newFeatureBadges: string[]`
- `unlockedMusicIds` (si ce n'est plus dérivable)
- Compteurs des trophées (cumul d'étoiles, séries, nombre de ⭐⭐⭐, amis distincts…)

À supprimer : `trackGoals`, `activeBadgeGoals`, `goalCounters`, et le score de rang.
Mettre à jour `migrateProfile`, `restoreFromCloud` et la synchronisation Firestore.

## E. Lots

- **Lot 0 — Documentation.** Mettre `.kilo/rules/architecture.md` en
  conformité avec le code actuel :
  - 21 niveaux, 12 éléments (loup et non renard, champignon, arbre), plateaux
    13 et 14 cases et attribution réelle des niveaux d'après `LEVEL_PARAMS` ;
  - Forestier 4×4 pré-généré (100 grilles), `unlocks.ts`, Herbier (`treesData`,
    `onfCards`, `collectedTreeCardIds`), 66 badges, 2 bonus (et non 4) dans la section
    Perfect, `computePlayerLevel` ;
  - sélection des niveaux dans `index.tsx`, fichiers manquants (`onf-lobby.tsx`,
    `foretCommune*`, `seedAnimStore`, `onfCards`, `treesData`, `unlocks.ts`, `featureFlags`).
  Ajouter en tête une section « Chantier en cours : Progression v2 » qui renvoie vers
  `docs/progression-v2.md`. Corriger aussi l'en-tête de `difficulty.ts` (15 → 21 niveaux,
  niveaux 16-21 décrits) et les commentaires de niveaux de `BoardRegistry.ts`. Ne modifier
  AUCUNE logique dans ce lot.
- **Lot 1 — Fondations.** `featureFlags.ts`, `progression.ts` (C1, C3 : helpers purs +
  tests Jest exhaustifs : seuils, chaîne de déblocage, meilleure note, niveau 21),
  calcul des étoiles à la victoire Solo, `challengeStars` + calcul du niveau (remplace
  `computePlayerLevel`), graines rejouées (C2), modèle de données (D), remise à zéro (C9).
- **Lot 2 — Étoiles, interface.** Animation dans VictoryModal (migré vers Reanimated),
  `RewardFly`, compteur ⭐ dans le bandeau, écran de sélection des niveaux avec jauges,
  accès libre aux 10 défis et « prochain conseillé » (C7, C1).
- **Lot 3 — Chapitres et déblocages.** Regroupement par chapitre, rang = chapitre,
  `isFeatureUnlocked` partout (accueil, duel, daily, onf), suppression de
  `getPlayerScore` et `RankUpModal`, attribution des graines de fin de chapitre (C3).
- **Lot 4 — Cérémonies.** File persistée, CeremonyModal (Reanimated), bandeau de niveau,
  pastilles « Nouveau », « Essayer maintenant ». Les cartes-récompenses sont typées pour
  accueillir musique et carte arbre même si ces récompenses sont branchées plus tard (C7).
- **Lot 5 — Forestier à paliers (C4).** Générateur Sentier, champ `tier`, nouvelle
  génération de `onf_challenges.json` par le script, filtrage, suppression du 3×3, intro.
- **Lot 6 — Journalier en 2 ligues (C5).**
- **Lot 7 — Herbier (C6).**
- **Lot 8 — Trophées et musiques (C8).**
- **Lot ultérieur — Promenade (D12)** : défi généré à la volée pour un niveau débloqué,
  sans étoiles, 2 🌱 fixes. Pas dans ce chantier.
- **Lot optionnel** : migrer FallingLeaves et Confetti vers Reanimated, seulement si on
  mesure des saccades.

## F. Critères d'acceptation globaux

- Un nouveau joueur occasionnel (environ 1,7 ⭐ par défi) débloque le Duel en environ
  10 défis, le Forestier Sentier en environ 18, et le Journalier Pousse en environ 27.
- Aucun mode n'utilise un élément dont la règle n'a pas été enseignée en Solo (ou dans
  le briefing du mode, pour le champignon).
- Les étoiles et les cartes ne diminuent jamais. Rejouer ne permet pas de produire des
  graines à l'infini.
- Tous les textes sont présents en FR et en EN. TypeScript et Jest sont verts.
  `architecture.md` est à jour.
