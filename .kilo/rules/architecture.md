# Architecture — Dans la Forêt

Jeu de logique mobile/web (Expo ~57 / React Native 0.86 / React 19).
**Jamais modifier** `AGENTS.md`. Toujours consulter https://docs.expo.dev/versions/v57.0.0/ avant d'écrire du code Expo.

---

## Chantier en cours : Progression v2

Refonte de la progression (étoiles, chapitres, déblocages, cérémonies, Herbier, trophées, Forestier à paliers, Journalier en 2 ligues, remise à zéro des profils).
**Référence unique : [`docs/progression-v2.md`](../../docs/progression-v2.md)** (spécification A à F, découpage en lots 0 à 8).

- Un seul lot par session. Livraison progressive via le drapeau `PROGRESSION_V2` (`src/constants/featureFlags.ts`, **valeur actuelle : `true`**).
- Ce fichier décrit l'état actuel du code ; chaque lot met à jour les sections concernées à sa fin.
- Statut : **Lots 0 à 8 terminés** : le chantier Progression v2 est complet. Le drapeau `PROGRESSION_V2` est passé à `true` : la Progression v2 est livrée (étoiles, chapitres, déblocages par chapitre, cérémonies, Herbier, trophées, Forestier à paliers, Journalier en 2 ligues, remise à zéro des profils).
- **Lot 1 (fondations)** : voir « Progression v2 — fondations (Lot 1) » ci-dessous. Étoiles, `challengeStars`, remise à zéro et graines rejouées existent.
- **Lot 2 (interface des étoiles)** : voir « Progression v2 — interface des étoiles (Lot 2) » ci-dessous. Animation des étoiles dans `VictoryModal`, `RewardFly` / `rewardFlyStore`, compteur ⭐ du bandeau, écran de sélection à jauges. **Tout est derrière `PROGRESSION_V2`.**
- **Lot 3 (chapitres et déblocages)** : voir « Progression v2 — chapitres et déblocages (Lot 3) » ci-dessous. Rang = chapitre, déblocage des modes par fin de chapitre, graines de fin de chapitre, écran des niveaux groupé par chapitre.
- **Lot 4 (cérémonies)** : voir « Progression v2 — cérémonies (Lot 4) » ci-dessous. File persistée, `CeremonyModal`, pastilles « Nouveau ».
- **Lot 5 (Forestier à paliers)** : voir « Progression v2 — Forestier à paliers (Lot 5) » ci-dessous. Trois paliers (Sentier, Clairière, forêt profonde), 130 grilles, champ `tier`, sélection par paliers ouverts, restes 3×3 supprimés, intro du Sentier.
- **Lot 6 (Journalier en 2 ligues)** : voir « Progression v2 — Journalier en 2 ligues (Lot 6) » ci-dessous. Pousse et Grand Chêne, une grille et un classement Firestore par ligue et par date, cases fixées identiques par ligue.
- **Lot 7 (Herbier)** : voir « Progression v2 — Herbier (Lot 7) » ci-dessous. `collectedTreeCardIds` devient la source de vérité, 143 cartes réparties par région, plantation payante, cartes de chapitre et du Forestier, entrée sur l'accueil.
- **Lot 8 (trophées et musiques)** : voir « Progression v2 — trophées et musiques (Lot 8) » ci-dessous. Les badges et leurs objectifs actifs sont remplacés par 15 séries à 4 paliers, 14 surprises et un trophée final ; les musiques se débloquent par chapitre ou par trophée.
- **Chantier « Monétisation et classements » (lots A à E, hors Progression v2)** : A = limites quotidiennes fiabilisées (**livré**, voir ci-dessous) ; B = pubs volontaires (**livré** : recharge des 2 bonus + Forêt commune, **jamais** de graines / grille / jeton, voir « Pubs volontaires » ci-dessous ; pub toujours SIMULÉE) ; C = refonte du Classement (**livré**, voir « Classements (Lot C) » ci-dessous) ; D = refonte des Statistiques (**livré**, voir « Statistiques (Lot D) » ci-dessous) ; E = AdMob réel + RevenueCat (à faire). Décision en attente : limiter ou non le Solo (recommandation : pas au lancement, mesurer d'abord).

### RGPD et publication sur les stores

**Référence : [`docs/rgpd-stores.md`](../../docs/rgpd-stores.md)** (pages légales, configuration Firebase, réponses Data safety / App Privacy, points à compléter).

- **Pas de Google Analytics (GA4)** : `measurementId` est retiré de `src/services/firebase.ts`. L'activer exigerait un consentement préalable et la mise à jour de la politique de confidentialité et des stores. Seule la mesure maison `metrics/{uid}` existe (intérêt légitime).
- **Informations légales** : `src/constants/legal.ts` (pur) = source UNIQUE de l'éditeur (KROMIA SAS), du contact (`contact@studio-kromia.com`), de `LEGAL_BASE_URL` (`https://www.studio-kromia.com/danslaforet`) et de `getLegalUrl(page)`. Pages statiques dans `Site/` : `confidentialite.html`, `cgu.html`, `mentions-legales.html`, `suppression-compte.html` (+ `legal.css`, liens en pied de `index.html`). Âge déclaré : 13 ans et plus (accord parental de 13 à 15 ans). Aucune donnée d'âge n'est collectée.
- **Interface** : `src/components/Account/LegalLinks.tsx` : `LegalConsentNotice` (phrase sous « Créer un compte », liens CGU + confidentialité) et `LegalLinksPanel` (Profil → Réglages : confidentialité, CGU, mentions légales, contact). Ouverture dans le navigateur via `Linking`.
- **Suppression de compte** (Apple 5.1.1(v), Google Play, RGPD art. 17) : Profil → Réglages → « Supprimer mon compte » → `DeleteAccountModal` (mot de confirmation `SUPPRIMER` / `DELETE` + mot de passe). Logique pure `src/constants/accountDeletion.ts` (`buildDeletionPlan`, `getReauthMethod`, `mapDeletionError`, testée par `__tests__/accountDeletion.test.ts`), exécution `src/services/accountDeletionService.ts` (`deleteMyAccount`) : (1) ré-authentification (mot de passe ; popup Google sur le web), (2) effacement Firestore : `results` (groupe, `userId`), `jackpotClaims` (`uid`), `friendChallenges` (les deux parties), `worldRecords` détenus, `leaderboard/{uid}`, `metrics/{uid}`, `players/{uid}` en dernier, (3) `playerStore.logout()` via `beforeAuthDelete` (sinon les synchronisations différées de `(tabs)/_layout.tsx` réécriraient le profil), (4) `deleteUser`, (5) AsyncStorage. `players`, `leaderboard` et `metrics` sont obligatoires (échec = compte Auth conservé) ; les autres cibles sont « au mieux » (renvoyées dans `residual`, le joueur est invité à écrire au contact). Exige des règles Firestore de suppression et un index de groupe `results.userId` (voir le doc). `adminService.deletePlayer` (admin) ne supprime toujours que `players/{uid}`.
- **Comptes inactifs (conservation 2 ans)** : un compte **gratuit** sans connexion depuis 2 ans est supprimé ; un compte **Premium n'est jamais supprimé pour inactivité** (engagement de `confidentialite.html` § 5 et `cgu.html` § 3). Logique pure `src/constants/inactiveAccounts.ts` (`getInactivityCutoff`, `toMillis`, `getLastActivityMs`, `decideInactiveAccount` → `delete | keep_premium | keep_active | keep_no_date | keep_protected`, `shouldRunInactivePurge`, `mergeCandidateUids`, `isAuthAccountOlderThan` ; testée par `__tests__/inactiveAccounts.test.ts`). Exécution `src/services/inactiveAccountService.ts` : `runInactivePurgeIfDue` est appelée par `(tabs)/_layout.tsx` après la restauration du profil, en arrière-plan ; elle ne tourne que si le drapeau **`INACTIVE_PURGE_ON_LAUNCH`** (`featureFlags.ts`, actuellement `true`) est actif, si le compte connecté est **administrateur** (`isAdminAccount` : seul compte autorisé par les règles Firestore à effacer les données d'autrui ; un joueur ordinaire ne lance jamais la purge) et **une fois par jour** (AsyncStorage `dlf_inactive_purge_last_run`, marqué avant le passage). Candidats : `metrics.lastSeenAt` et `players.updatedAt` antérieurs à la date limite ; décision sur la date la plus récente (`lastSeenAt`, `updatedAt`, `createdAt`) ; premium (profil OU métriques), comptes de dev / admin et compte connecté conservés ; sans date lisible : conservé ; 50 comptes au plus par passage. Effacement par `eraseAccountData(uid)` (`accountDeletionService.ts`, extrait de `deleteMyAccount` : même plan `buildDeletionPlan`). **Limite** : le SDK client ne supprime pas le compte Firebase Auth d'un autre utilisateur (uid listés dans le journal `[inactivePurge]`, à supprimer dans la console) ; passer `INACTIVE_PURGE_ON_LAUNCH` à `false` quand une Cloud Function planifiée (SDK Admin) prend le relais. Un joueur purgé qui se reconnecte reçoit un profil neuf (`(tabs)/_layout.tsx` : profil absent + compte Auth créé il y a plus de 10 min → `createPlayer`).
- **Vidéos publicitaires dans les textes légaux** : `confidentialite.html` (en bref, § 2, 3, 4, 8, résumé anglais) et `cgu.html` (§ 8) décrivent des vidéos **facultatives, non personnalisées**, fournies par **AppLovin** et ses partenaires (données techniques transmises uniquement quand le joueur lance une vidéo). Le Lot E devra respecter ces engagements : MAX non personnalisé, pas d'IDFA ni d'ATT, SDK initialisé au premier lancement d'une vidéo (voir `docs/rgpd-stores.md` § 7).
- **À compléter par l'éditeur** : capital social, Président, greffe RCS, médiateur de la consommation (`Site/mentions-legales.html`, `Site/cgu.html`).

### Statistiques (Lot D)

**Quatre blocs** (avant : 5 cartes, aucune donnée de la Progression v2). Écran : `src/components/Stats/StatsScreen.tsx`, monté par la section « Stats » du Profil (`profile.tsx` n'a plus de calcul de stats ni de `StatCard`).

| Bloc | Contenu |
|---|---|
| 🌲 Progression | étoiles x/630, défis ⭐⭐⭐, chapitre x/7, trophées, Herbier |
| 🧩 Solo | défis résolus, « bien joués » (⭐⭐+), plus rapide, abandons, **temps moyen par chapitre** |
| 🎮 Modes | Journalier (global + **par ligue** : parties, victoires, meilleur temps), Forestier (**par palier**, meilleur temps, sans erreur), Duel (V / D, taux, record de série) |
| 📆 Régularité | série du Journalier, jours de suite, jours joués, victoires, graines gagnées / dépensées, pubs regardées |

**Logique pure** (`src/constants/playerStats.ts`, testée par `__tests__/playerStats.test.ts`) : `buildStatsView` (les 4 blocs, valeurs neutres, jamais `NaN` ni `undefined`, pourcentages bornés à 100 %), `mergeStats` (fusion local/cloud), `tallyNewDuels`, `effectiveDailyStreak`, `averageBestTimeByChapter`, `countOnfByTier`, `percent`.

**Fusion** : `restoreFromCloud` utilise `mergeStats` : les compteurs cumulatifs ne baissent **jamais** (max local / cloud), `bestTimes` garde le plus petit temps par défi, les dictionnaires fusionnent clé par clé, les records de temps gardent le meilleur, la moyenne vient de la source qui compte le plus de parties. **Avant le Lot D**, `dailyPlayed`, `dailyWon`, `friendPlayed`, `failCount`, `sameChallengePlays`… étaient ÉCRASÉS par le cloud (0 si le Journalier ou le Duel n'y avaient jamais écrit leurs stats) : `dailyWon` alimente le trophée Rendez-vous, qui pouvait donc régresser à chaque reconnexion. Un profil cloud vierge (nouveau compte) n'hérite pas des stats locales d'une session précédente.

**Nouveaux compteurs** (`playerStore.stats`, tous cumulatifs, définis dans `createDefaultStats` et lus par `readLotDStats` pour les anciennes sauvegardes) : `friendLosses`, `friendBestWinStreak`, `dailyPlayed/WonPousse`, `dailyPlayed/WonGrandChene`, `bestDailyTimeMsPousse/GrandChene`, `bestOnfTimeMs`, `seedsEarned`, `seedsSpent`, `adsWatched`, `daysPlayed`. Tenus à la source : `addSeeds`, `grantChapterRewards` et `awardBadges` (graines gagnées), `spendSeeds` et `plantTreeCard` (dépensées ; **dépenser ne retire jamais de `seedsEarned`**), `claimAdReward` (pubs), `checkDailyLogin` (jours), `submitDailyResult(date, success, timeMs, league)` (Journalier par ligue), `recordOnfVictory` (meilleur temps). Les grilles du Forestier par palier ne sont **pas stockées** : dérivées de `completedOnfChallengeIds` et du champ `tier` (`countOnfByTier`).

**Duel : résultat réconcilié.** Avant, le challenger était compté « gagnant » dès l'envoi de son défi, avant tout résultat (pourcentage faux, trophée Duel gonflé). Maintenant `playerStore.recordDuelResults(uid, duels)` compte les défis **terminés** (`status: completed`, vainqueur connu) pas encore comptés : victoires, défaites, série. Idempotent par identifiant (`countedDuelIds`, persisté, fusionné par union). Joueur B : compté dès sa réponse (`friend-challenge.tsx`) ; joueur A : à chaque chargement de l'écran Défis (`challenge.tsx`). Un défi sans vainqueur ne compte NI en victoire NI en partie. `recordFriendWin` et `incrementStat` sont supprimés.

**Synchronisation Firestore** : point d'entrée unique dans `(tabs)/_layout.tsx` (`updateStats`, debounce 5 s, écriture immédiate au démontage ; même garde `store.userId` que les limites), plus une écriture après `restoreFromCloud`. Avant : seuls `totalSolved` et `bestTimes` (Solo) puis `stats` entier après une victoire Forestier étaient écrits ; le Journalier et le Duel n'écrivaient rien. La sauvegarde locale surveille maintenant `state.stats` par référence (avant : une liste de champs qui omettait `dailyPlayed`, `friendPlayed`, `onf*`, `daily*`, `abandonCount`).

**Corrections** : le **temps moyen** n'est plus la moyenne des meilleurs temps de tous les niveaux (qui croissait mécaniquement avec la progression) mais une moyenne **par chapitre** ; la **série du Journalier** s'affiche à 0 si le dernier jour joué n'est ni aujourd'hui ni hier (avant : périmée tant qu'une victoire ne la corrigeait pas) ; le sous-titre de la tuile « Stats » compte les défis étoilés (avant : `totalSolved`, seulement le Solo, alors que la carte additionnait tous les modes). `stats` initial et `logout()` utilisent `createDefaultStats()` (une seule source). `logout()` remet aussi `challengedFriendIds`, `countedDuelIds` et `duelWinStreak` à zéro. Supprimés : `recordTopDEJ` (jamais appelée), `incrementStat`, les 10 clés `profile_stat_*` de l'ancien écran (sauf `profile_stat_streak_value`).

**Limites connues, non traitées au Lot D** : `currentStreak` / `longestStreak` (jamais remis à zéro, donc égaux au nombre de victoires), `topDEJCount` (plus alimenté) et `seasonalChallengesPlayed` (jamais remis à zéro par saison, lu par un trophée surprise) restent dans `PlayerStats` : les retirer demande de toucher aux écrans admin et aux trophées ; ils ne sont plus affichés. Le Duel du joueur A n'est compté qu'à l'ouverture de l'écran Défis (pas en temps réel). Le temps de jeu cumulé n'est pas suivi. Les règles Firestore ne sont pas dans le dépôt : l'écriture `players/{uid}.stats` n'est pas protégée côté serveur.

### Classements (Lot C)

**Trois onglets** (avant : Daily, Badges, Graines, Records — Badges et Graines supprimés : les graines se dépensent dans l'Herbier, les trophées s'affichent sur la ligne des étoiles). Détail Firestore, règles et index à vérifier : `docs/leaderboard-firestore.md`.

| Onglet | Source | Départage |
|---|---|---|
| ⭐ Étoiles | `leaderboard/{uid}.starsRank` | étoiles → défis ⭐⭐⭐ → trophées → **le premier arrivé** |
| 🌅 Journalier (sélecteur de ligue) | `dailyRankPousse` / `dailyRankGrandChene` | victoires du jour dans la ligue → **le premier arrivé** |
| 🏆 Records | `worldRecords` agrégé côté client | records détenus → dernier record le plus ancien → identifiant |

**Logique pure** (`src/constants/leaderboardRank.ts`, testée par `__tests__/leaderboardRank.test.ts`) : chaque classement est lu par UNE requête serveur `orderBy(champ, 'desc').limit(100)` ; le départage est donc « empaqueté » dans un nombre (`computeStarsRank`, `computeDailyRank` : composantes de poids décroissant + minutes inversées depuis le 1er janvier 2026, exact sous 2^53). « Le premier arrivé » = l'instant où le joueur a atteint son résultat ACTUEL ; il ne change que si le résultat change (`resolveReachedAt`) : republier ne fait jamais perdre sa place. Aucun re-tri côté client, aucun index composite. `rankRecordHolders` classe les détenteurs de records. Les étoiles affichées sont relues du score empaqueté (jamais incohérentes avec le rang).

**Publication unique** : `publishLeaderboardEntry` (`leaderboardService.ts`) est appelé par `(tabs)/_layout.tsx` à chaque changement d'étoiles, de trophées, de niveaux validés ou de cartes de l'Herbier — donc depuis TOUS les modes (avant : seule une victoire Solo mettait le classement à jour, `upsertLeaderboardEntry` supprimé). Debounce 3 s, idempotent (aucune écriture si l'entrée est inchangée), garde `store.userId === compte connecté`. Un joueur sans étoile est retiré du classement ; une ancienne entrée (sans `starsRank`) n'apparaît dans aucun onglet.

**Journalier** : `sealDailyRecord` scelle chaque ligue dans une **transaction** (lecture du `sealed`, crédit du gagnant ET marquage atomiques : jamais compté deux fois, jamais perdu). Le crédit va dans la ligue du gagnant (plus de compteur unique `dailyWins` mélangeant les ligues). Le document `leaderboard/{uid}` est créé s'il n'existe pas : avant, `updateDoc` échouait et la victoire n'était jamais créditée tant que le gagnant n'avait pas joué en Solo. Instant de crédit déterministe = fin de la journée scellée.

**Supprimé** : `getTopLeaderboard`, `getPlayerRank`, `subscribeLeaderboard` (score composite niveau/badges/graines), `computeLeaderboardScore`, `getTopWorldRecords` (jamais appelée, ignorait son paramètre), `subscribeDailyRecordHolders` (jamais appelée, lisait tous les résultats de toutes les dates), et 8 clés i18n mortes (`leaderboard_tab_level/badges/seeds`, `leaderboard_my_rank`, `leaderboard_me_suffix`, `leaderboard_subinfo`, `leaderboard_subinfo_row`, `leaderboard_records_count`).

**Limites connues, non traitées au Lot C** : aucune protection serveur du score (un joueur peut écrire son propre `starsRank` si les règles le permettent ; une Cloud Function le recalculerait) ; « le premier arrivé » utilise l'horloge de l'appareil ; hors du top 100 le rang réel n'est affiché que pour les étoiles ; les règles Firestore ne sont pas dans le dépôt (le scellement écrit le document d'un AUTRE joueur : à vérifier en priorité).

### Pubs volontaires (Lot B, recentré)

**Principe produit (décision de l'utilisateur) : une pub est TOUJOURS volontaire, et ne donne JAMAIS de graines.** Trois usages seulement : (1) **recharger UN bonus épuisé** (joueur gratuit : le premium a des bonus illimités, donc aucune pub pour cela) ; (2) **contribuer à la Forêt commune** (page d'accueil, vrais arbres, ouvert à tous) ; (3) **recharger le quota global des défis** (`onf_recharge`, joueur gratuit, **UNE seule fois par jour**, +3 parties utilisables dans n'importe quel mode débloqué). Le compteur partagé est affiché sur l'accueil. Une vidéo augmente le quota global, pas le compteur consommé.

**La pub est toujours SIMULÉE** (compte à rebours de 5 s) : aucun SDK publicitaire n'est installé, **aucun revenu** tant que le Lot E n'a pas branché AdMob. Le Lot E ne remplace que le corps de `showRewardedAd`.

**Emplacements** (`src/constants/adRewards.ts`, pur, testé par `__tests__/adRewards.test.ts`), chacun avec un plafond de visionnages PAR JOUR (`AD_DAILY_CAPS`) :

| Emplacement | Récompense | Plafond/jour | Condition |
|---|---|---|---|
| `bonus_reveal_cell` / `bonus_instinct` | CE bonus repasse à 3 utilisations | 3 chacun (6 pubs) | le bonus est à 0, joueur gratuit |
| `foret_commune` | `FORET_COMMUNE_POINTS_PER_VIDEO` points pour la forêt | 5 | tous (free et premium) |
| `onf_recharge` | +`CHALLENGE_AD_RECHARGE_COUNT` (3) défis tous modes confondus | **1** | quota global du jour épuisé, joueur gratuit (le premium n'a pas de quota) |

**Recharge du quota global** : `adViews.onf_recharge` garde son nom historique pour préserver les sauvegardes. Une vidéo n'affecte pas `challengeCountToday` ; elle ajoute 3 au quota autorisé et peut donc bénéficier à tous les modes. Le CTA est sur l'accueil, à côté du compteur global, et disparaît quand le plafond journalier de vidéo est atteint.

**Supprimés** (décision utilisateur : déséquilibre free / premium) : « Doubler mes graines » (`double_seeds`, `doubleSeedsService.ts`, prop `doubleSeeds` de `VictoryModal`), l'ancienne grille de Forestier en plus **donnée sans condition** (`onf_grid`, `getOnfAdExtra`, remplacée par la recharge encadrée `onf_recharge`), le jeton de Duel en plus (`duel_token`, `getFriendTokenCap`, `getFriendTokenMax`) et leurs clés i18n.

**Compteur** : `playerStore.adViews: Partial<Record<AdPlacement, number>>` (visionnages du jour), partie des limites quotidiennes (`DailyLimits.adViews`) : persisté AsyncStorage + Firestore `dailyLimits`, remis à neuf à minuit par `rolloverDailyLimits`. `sanitizeAdViews` écarte les anciens emplacements (`onf_grid`, `duel_token`, `double_seeds`) : **un ancien profil ou une ancienne sauvegarde qui en contenait ne redonne AUCUNE grille ni AUCUN jeton** (jetons plafonnés à 3). L'emplacement actuel s'appelle `onf_recharge` (nom différent exprès : l'ancien `onf_grid` ne se confond pas avec lui). `watchAdUsedToday` (recharge unique d'avant) est converti : les deux bonus comptés au plafond de recharges.

**Fusion local/cloud** (`mergeDailyLimits`) : défis joués : max ; `adViews` : max par emplacement ; **bonus : fusion en « consommé »** (total offert = 3 × (1 + recharges) moins restant ; max des deux appareils), puis restant recomposé avec le plus grand nombre de recharges : une recharge faite sur un appareil est conservée, une consommation faite sur l'autre aussi, et une pub regardée n'annule jamais une consommation.

**Action unique** : `playerStore.claimAdReward(placement)` compte une pub REGARDÉE (plafond du jour, `stats.adsWatched`), un seul `set()`. Bonus : refus si le bonus n'est pas épuisé (plafond non consommé) ou si le joueur est premium. `onf_recharge` : refus si le quota global n'est pas épuisé ou si le joueur est premium. Elle ne verse jamais de graines : pour `foret_commune`, l'appelant (`ForetCommuneWidget`) verse les points si elle renvoie `true`.

**Service** (`src/services/rewardedAdService.ts`) : `showRewardedAd(placement)` → `{ outcome: 'earned' | 'dismissed' | 'unavailable' | 'error', earned }`. `earned` seulement si la pub est regardée jusqu'au bout. **C'est le SEUL point à remplacer au Lot E.** `RewardedAdHost` (`src/components/Ads/`, monté UNE fois dans `app/_layout.tsx`, dans une `Modal` native) s'enregistre auprès du service. **Contrainte : ne lancer une pub que depuis un écran SANS `Modal` native ouverte** (la modale de pub passerait dessous : c'était le bug du « Doubler mes graines » dans `VictoryModal`). Aujourd'hui la recharge d'un bonus part de la barre de bonus de l'écran de jeu (aucune modale ouverte), la Forêt commune de l'accueil et la recharge du Défi de la forêt de l'écran de quota atteint (`onf.tsx`, aucune modale ouverte).

**Hook** (`src/hooks/useRewardedAd.ts`) : `useRewardedAd(placement)` → `{ available, remaining, busy, watch }`. `available` = plafond non atteint, pub prête, et (premium → Forêt commune seulement). `watch()` : pub → `claimAdReward`. Anti double-tap (`busyRef`).

**Écrans** : `HintOverlay` (`adRemaining` par bonus, `onWatchAd(bonusId)` : icône 🎬 à la place du compteur quand CE bonus est à 0) ; `[challengeId].tsx` (deux `useRewardedAd`) ; `ForetCommuneWidget` (accueil) ; `onf.tsx` (`useRewardedAd('onf_recharge')`, écran de quota atteint). Plus aucune pub dans `VictoryModal`, `challenge.tsx`.

**Règles expliquées au joueur** : onglet Règles → « Les défis » → carte « Gratuit, Premium et vidéos » (`challenges_plans_*`, fr + en, valeurs lues dans `dailyLimits.ts` et `adRewards.ts` : jamais en dur) et carte « Défi de la forêt » (règle Sudoku, les 3 paliers avec leur chapitre de déblocage et leur nombre de grilles lus dans `FEATURE_UNLOCK_CHAPTER` / `onf_challenges.json`, fonctionnement, récompenses : `challenges_onf_*`).

**Record du monde** : n'est tenté que si le défi n'avait jamais été gagné (premier essai) ET qu'aucun bonus n'a été utilisé (`[challengeId].tsx`, `canSetRecord`). Un joueur gratuit qui recharge ses bonus par vidéo, ou un premium aux bonus illimités, ne peut donc pas battre un record avec un bonus.

**Limites connues** : aucune pub réelle (Lot E) ; le plafond n'est pas protégé par des règles Firestore ; aucune mesure de conversion.

### Félicitations premium

`playerStore.unlockPremium()` (appelée par toutes les `PremiumCard`) affiche, une seule fois au passage à premium, `PremiumCelebrationModal` (`src/components/Premium/`, montée UNE fois dans `app/_layout.tsx`, pilotée par `src/store/premiumCelebrationStore.ts`, non persisté). Elle annonce : 1 arbre planté (Forêt commune + 1 € reversé à Planète Urgence), tout illimité, badge « Ami de la Forêt » (`ami_de_la_foret`). Décor Reanimated : feux d'artifice (`PineconeBurst`), pluie de confettis, paillettes ; rien n'est animé en « réduire les animations ». Textes `premium_celebrate_*` (fr + en).

### Limites quotidiennes du joueur gratuit (Lot A)

**Une seule source** : `src/constants/dailyLimits.ts` (pur, testé par `__tests__/dailyLimits.test.ts`) : `FREE_DAILY_CHALLENGE_LIMIT = 10`, `BONUS_USES_PER_DAY = 3`, `todayLocalISO`, `createFreshDailyLimits`, `isLimitsOfDay`, `sanitizeDailyLimits`, `mergeDailyLimits`, `getDailyChallengesRemaining`. L'ancien compteur Duel sert uniquement à migrer les anciennes sauvegardes.

**Persistance** (avant le Lot A, `onfDailyCount`, `friendChallengeTokens` et `watchAdUsedToday` revenaient à neuf à chaque redémarrage : limites contournables) :
- AsyncStorage (`useStorage.ts`) : `challengeCountToday`, `adViews` et les anciens compteurs s'ajoutent à `dailyBonusUses` / `lastBonusResetDate` (`watchAdUsedToday` / `lastWatchAdDate` : anciens champs, convertis puis ignorés).
- Firestore : `players/{uid}.dailyLimits` (`DailyLimits`), écrit par `updateDailyLimits` (`playerService.ts`). `(tabs)/_layout.tsx` l'écrit après `restoreFromCloud`, puis à chaque changement des compteurs (debounce 1 s, seulement si `store.userId` est le compte connecté).
- **Fusion à la connexion** (`restoreFromCloud` → `mergeDailyLimits`) : **le plus restrictif des deux pour aujourd'hui** (défis commencés : max ; bonus : consommé max, recharges par pub conservées ; pubs : max par emplacement). Un compteur d'un autre jour est périmé et ignoré. Se déconnecter, réinstaller ou changer d'appareil ne rend donc aucune partie du jour. `logout()` remet les compteurs LOCAUX à neuf (le compte suivant n'hérite pas de ceux du précédent) ; ils reviennent du cloud à la connexion.
- **Changement de jour sans redémarrage** : `playerStore.rolloverDailyLimits()` (remise à neuf si `lastBonusResetDate` n'est plus aujourd'hui), appelée par `checkDailyLogin`, avant chaque consommation du quota, `spendBonus`, `claimAdReward`, au chargement AsyncStorage et au focus de l'accueil.

**Quota global** : `challengeCountToday` est consommé au démarrage effectif d'une partie Solo, Forestier, Journalier ou Duel. Reprendre le Journalier déjà en cours ne consomme pas une nouvelle partie. Un mode verrouillé ne déclenche jamais le compteur. Le compteur et les choix Premium / vidéo sont affichés une seule fois sur l'accueil. Les sauvegardes historiques initialisent le compteur à partir des anciennes parties Forestier, jetons Duel consommés et d'un Journalier déjà commencé. Si le quota est épuisé en Solo, `game/[challengeId].tsx` retourne à l'accueil et affiche une modale détaillant les 10 défis gratuits et la recharge vidéo de 3 défis.

**Duel** : aucun compteur de jetons séparé. Chaque joueur consomme une partie de son quota global en commençant sa manche. La création d'un défi ne consomme rien tant que la génération n'a pas réussi.

**Journalier** : `submitDailyResult(date, false)` écrit maintenant `lastDailyChallengeDate` (avant : seulement sur un succès). Sans cela, `isDailyToday` restait faux et le Journalier se rejouait après un échec ou un abandon. Une seule partie par jour.

**Premium** : `restoreFromCloud` garde `isPremium` si l'achat est local (`profile.isPremium || local`) ; `(tabs)/_layout.tsx` l'écrit dans Firestore (`updatePremium`) dès le passage à `true` et après la restauration. **Provisoire : aucune vérification d'achat côté serveur** (`PremiumCard` simule l'achat) ; le Lot E devra faire confirmer l'achat par RevenueCat.

**Limites connues, non traitées au Lot A** : l'écriture `dailyLimits` n'est pas protégée par des règles Firestore (à vérifier dans la console : un joueur peut écrire son propre document) ; la date du jour est celle de l'appareil (changer l'heure du téléphone contourne la limite, comme pour `checkDailyLogin`) ; la pub reste une simulation (Lots B puis E).

### Progression v2 — trophées et musiques (Lot 8)

**Les trophées remplacent les badges, sans migration** (le profil a été remis à zéro au Lot 1). **Plus aucun « objectif actif »** : tout trophée dont la condition est remplie est décerné. **Supprimés** : `badgeEngine.ts` (978 lignes : `evaluateBadges`, pistes `TRACK_*`, `MASTER_SEQUENCE`, `ELIGIBLE_GOAL_BADGE_IDS`, `getClosestBadges`…), `playerStore.trackGoals` / `activeBadgeGoals` / `goalCounters` / `retryStreak*` / `speedBadgeHits` et leurs actions (`setActiveBadgeGoals`, `advanceGoalAuto`, `advanceTrackGoals`), `ActiveGoalCard`, `BadgeGoalPickerModal`, `app/admin/badge-sequence.tsx`, `navStore.goalSlotsToFill` (point rouge du Profil), et 48 clés i18n. Les champs Firestore correspondants sont supprimés du profil à la remise à zéro (`deleteField`).

**Catalogue** (`src/constants/trophies.ts`, pur, testé) : 15 séries à 4 paliers (**bois, pierre, or, cristal** : la rareté est le palier ; identifiants `{serie}_{1..4}`), soit 60 trophées. Constellation (étoiles 50/150/350/630), Œil de lynx (série ⭐⭐+ 5/10/25/50), Main sûre (⭐⭐⭐ 3/10/25/50), Vif comme le vent (1/10/30/100), Persévérant (1/5/20/50), Rendez-vous (victoires du Journalier 1/10/50/100), Série (1/… 3/7/30/100), Podium (top 10 % / top 3 / top 3 ×5 / n° 1), Grilles résolues (1/10/50/toutes), Sans faute, Express, Duel (5/20/50/100), Rassembleur (1/5/10/25), Botaniste (10/25/50/100), Habitué (3/7/30/100). `src/constants/badges.ts` devient le catalogue de **75 trophées** (60 séries + 14 surprises + 1 final) ; le stockage reste `playerStore.earnedBadges`. **Surprises** (inchangées, mêmes identifiants et textes) : `secret_*` (5), `saisonnier_*` (4), `record_first`, `record_mondial`, `regularite_lune`, `regularite_soleil`, `ami_de_la_foret`. **Trophée final** `esprit_accompli` : décerné à la fin du chapitre 7 (21 niveaux validés).

**Moteur** : `trophies.ts` (`evaluateSeriesTrophies` — idempotent, rattrape les paliers sautés —, `evaluateFinalTrophy`, `getClosestTrophies` : les 3 « prochains trophées » avec barre de progression), `trophyEngine.ts` (`evaluateSurprises`, `buildTrophyCounters`), `src/services/trophyService.ts` (**point d'entrée unique** : `awardEarnedTrophies(surprise?)` évalue et inscrit en UN SEUL `awardBadges`, puis mémorise les musiques ; `computeNextTrophies` pour la VictoryModal). Appelé après chaque victoire (Solo, Journalier, Forestier, Duel), à la plantation d'une carte, et à la connexion (rattrapage).

**Compteurs** : tous sont des cumuls ou des **records qui ne baissent jamais** (un trophée obtenu ne se perd pas quand une série en cours retombe à 0) : `bestStarStreak` (record Œil de lynx), `loyaltyBest` (record Habitué, avancé par `checkDailyLogin`), `dailyPodium` (inclusif — un n° 1 compte aussi comme top 3 et top 10 % ; enregistré À LA PARTIE car le « top 10 % » dépend du nombre de participants ; **paliers indépendants** : un premier n° 1 donne Podium 4 sans donner le 3). Tous persistés (AsyncStorage, Firestore, `buildSoloProgressionPayload`), fusionnés par maximum au `restoreFromCloud`.

**Musiques** (`src/constants/musicUnlocks.ts`, pur, testé) : modèle `unlock?: { type: 'chapter', chapter } | { type: 'trophy', id } | { type: 'seeds', cost }` (`seeds` prévu, non utilisé). Attribution D11 : 7 titres de fin de chapitre (forest_breath, jardin_japonais, pulsation_douce, woodland_pulse, deep_sub_pulse, neo_classical_motivation, elek) + 5 titres du palier « pierre » (swaying_groove ← `rendez_vous_2`, boucle_hypnotique ← `grilles_2`, lilting_swing ← `duel_2`, moonlit_beach_shuffle ← `botaniste_2`, sun_warmed_groove ← `habitue_2`) ; les 2 titres gratuits le restent. `audioStore.syncOwnedMusic(progress)` remplace `syncOwnedFromBadges` ; `playerStore.unlockedMusicIds` mémorise les titres débloqués (ils ne se perdent jamais ; les gratuits n'y figurent pas). `MusicPanel` affiche « Fin du chapitre N » ou « Trophée : … » au lieu de « Badge requis ». La carte « musique » de la cérémonie nomme le titre réellement offert. **Les cartes de la cérémonie sont désormais toutes attribuées** (mode, carte d'arbre, musique, région, trophée final).

**Interface** : `BadgeProgressInline` affiche les 3 prochains trophées (Profil ; la VictoryModal n'affiche qu'une ligne, voir Lot 2) ; `BadgeCollection` : filtres par rareté + « Surprises », groupement par famille (Solo, Journalier, Forestier, Duel, Herbier, Fidélité, Surprises, Final) ; `getTrophyTexts` traduit les séries via l'i18n (`trophy_{serie}_name` / `_desc` avec le seuil du palier). La section du profil s'appelle « Trophées ».

### Progression v2 — Herbier (Lot 7)

**Source de vérité** : `playerStore.collectedTreeCardIds` (et non plus `onfSolvedCount`). `src/utils/onfCards.ts` réécrit : `ALL_TREE_CARDS` (143 cartes), `getOwnedCards`, `getOwnedCardCount`, `getCollectionProgress`, `getNextCard(collectedIds, openRegions)`, `getCardProgress(onfSolvedCount)` (grilles avant la prochaine carte gratuite). **Supprimés** : `getUnlockedCardCount`, `getUnlockedCards`, `getJustUnlockedCard` (l'ancien `floor(n / 5)` débloquait les cartes dans l'ordre du fichier).

**Données** : `TREES_DATA` contient les 143 cartes et leurs images (`TREE_IMAGES`, IDs 1-143). Chaque carte a une région (`france`, `europe`, `monde`, `remarquables`), un type d'image facultatif et les crédits photo (photographe et licence). `TREE_REGION_IDS` est la liste de référence des IDs par région ; `WORLD_TREES` est un ancien catalogue et n'est pas ajouté une deuxième fois. Répartition actuelle : France 62 · Europe 11 · Monde 59 · Remarquables 11.

**Classement des essences** (origine de l'essence lue dans `geo_location`) : indigènes → France ; introduites d'Europe, Proche-Orient, Caucase, Afrique du Nord → Europe ; originaires d'Amérique ou d'Asie → Monde ; records et arbres mythiques (séquoias, ginkgo, cèdre du Liban, if, pin cembre, pin laricio, baobab africain, pin de Bristlecone, banyan et kauri) → Remarquables. Les 43 essences internationales complètent les 100 premières : 39 sont classées « Monde » et 4 « Remarquables ».

**Logique pure** (`src/constants/herbier.ts`, testée) : `getPlantCost(n) = 30 + 5 × floor(n / 10)`, `getOpenRegions` (France d''emblée ; Europe fin ch.5, Monde fin ch.6, Remarquables fin ch.7, via `isFeatureUnlocked`), `getPlantableCards`, `checkPlant` (refus : carte inconnue, déjà possédée, région fermée, graines insuffisantes), `pickChapterCard`, `getChapterCardRegion`, `crossedOnfCardThreshold`, `getNextSilhouette`, `mergeCollectedIds`, `getHerbierProgress` / `getRegionProgress`.

**Store** : `plantTreeCard(id)` (un seul `set()` : graines ET carte ; aucun paiement si refus), `grantChapterCards()` (une carte par chapitre récompensé, **idempotente**, mémorisée dans `chapterCardsGranted` ; ch.7 : carte « remarquables »), `grantOnfCard(before, after)` (1 carte gratuite toutes les 5 grilles `ONF_CARD_UNLOCK_EVERY`). `chapterCardsGranted` : persisté (AsyncStorage, Firestore), fusionné au `restoreFromCloud`, remis à zéro. `buildSoloProgressionPayload` synchronise aussi `collectedTreeCardIds`. **Les graines se dépensent désormais UNIQUEMENT dans l''Herbier** (`spendSeeds` n''est plus mort).

**Interface** : `TreeCardGallery` réécrit (onglets « Ma collection » / « Planter », régions avec progression, silhouettes à `🌱 coût`, régions fermées verrouillées) ; **un tap sur une silhouette ouvre `PlantCardModal`** (`src/components/ONF/`, modale native imbriquée dans celle de la galerie) : confirmation (coût, graines du joueur, « Annuler » / « Planter », rien n'est dépensé avant), puis, si `plantTreeCard` réussit, révélation : feu d'artifice `PineconeBurst` (aucun en « réduire les animations »), carte en grand (`TreeCardView`, retournable d'un tap), bouton « OK ». La modale ne touche pas au store : la galerie lui passe `onConfirm` (plantation + synchronisation + trophées), qui renvoie `{ ok }` ou le message d'erreur. Textes `herbier_confirm_*`, `herbier_reveal_*` ; `HerbierEntry` sur l''accueil (derrière `PROGRESSION_V2`) : « X / 129 » + prochaine carte en silhouette ; `onf-lobby` et `onf.tsx` lisent la collection et les régions ouvertes. La cérémonie de chapitre attribue maintenant sa carte d'arbre (cartes `music` et `trophy` : Lot 8). **Badge rouge** : `playerStore.seenTreeCardIds` (persisté, fusionné par union au `restoreFromCloud`, remis à zéro) ; `countUnseenCards(collectedTreeCardIds, seenTreeCardIds)` (`herbier.ts`) compte les cartes obtenues (plantation, chapitre, Forestier) qui n'ont pas encore été vues. Le compteur s'affiche sur l'onglet « Ma collection » de l'Herbier et sur l'entrée de l'accueil ; il disparaît dès que la collection est affichée (`markTreeCardsSeen`). L'onglet affiche toujours le nombre de cartes : « Ma collection (N) ».

### Progression v2 — Journalier en 2 ligues (Lot 6)

**Ligues** (`src/constants/dailyLeagues.ts`, pur, testé) : `pousse` (fin du chapitre 3, compositions SANS chalet ni tas de bûches) et `grand_chene` (fin du ch. 4, toutes les compositions). `getPlayerLeague(getOpenDailyLeagues(...))` donne la ligue la plus haute ouverte ; `useFeatureAccess('dev').dailyLeagues` la fournit aux écrans (compte de développement : Grand Chêne).

**Deux grilles par jour** : seed de la date UTC + sel par ligue (`DAILY_LEAGUE_SALT` : Pousse 0, Grand Chêne 1 000 003 — **ne jamais modifier**, cela changerait toutes les grilles). `generateDailyChallenge(date, league)` ; identifiant du défi `daily_{date}_{ligue}` ; clé de chrono local `buildDailyChallengeKey`.

**Cases fixées identiques par ligue** : `getDailyFixedPlacements(league, dailyChallenge)` ne dépend plus du niveau du joueur. `DAILY_LEAGUE_FIXED_COUNT` = Pousse 6, Grand Chêne 5, toujours relevé à `baseFixedCount` (`resolveLeagueFixedCount`) pour garder l'unicité. Mesure sur 30 jours du générateur réel : `baseFixedCount` vaut 4 à 6, donc la Pousse a toujours 6 cases fixées, le Grand Chêne 5 ou 6.

**Firestore** (voir `docs/daily-leagues-firestore.md`) : `dailyChallenges/{date}_{ligue}/results/{uid}` (4 segments, comme avant). `submitDailyResult(date, league, …)`, `getDailyStatus(date, league, uid)`, `subscribeDailyLeaderboard(date, league, max, cb)`. `sealDailyRecord(date)` scelle un record par ligue, dans une transaction, et crédite la ligue du gagnant (Lot C : `dailyRankPousse` / `dailyRankGrandChene`, voir « Classements (Lot C) »). **Les règles et index Firestore ne sont pas dans le dépôt** : à vérifier dans la console.

**Récompense** : `calculateDailyReward` est inchangée ; elle reçoit le rang DANS LA LIGUE (`computeLeagueRank`). La série (`dailyChallengeStreak`) et le jackpot sont inchangés (une ligue jouée par jour).

**Interface** : `daily.tsx` joue la grille de sa ligue et lit le classement de sa ligue ; `DailyBriefingModal` (prop `league`) affiche la ligue ; accueil et classement lisent le record du jour de LA LIGUE du joueur ; bandeau « Record du jour · {ligue} ». **Niveau 17** : la règle du champignon (`LEVEL_META`, champ `seenElsewhereKey`) affiche « Tu l'as déjà croisé dans le Défi du Jour ! ».

### Progression v2 — Forestier à paliers (Lot 5)

**Trois paliers** (`src/constants/onfTiers.ts`, pur, testé) : `sentier` (fin du chapitre 2), `clairiere` (fin du ch. 3), `profonde` (fin du ch. 4). `getOpenOnfTiers` (`unlocks.ts`) donne les paliers ouverts ; `selectOnfChallenge(pool, completedIds, openTiers, rng)` choisit la grille : palier ouvert LE PLUS ÉLEVÉ qui en a encore, **Sentier dans l'ordre de difficulté**, autres paliers au hasard ; `tierExhausted` / `allCompleted` en fin de palier / de partie. `getTierForComposition` : champignon → profonde, ruche / cerf / biche → clairière, sinon sentier.

**Données** : `src/data/onf_challenges.json` = 130 grilles, champ `tier` partout, régénérées par `npm run generate:onf` (script **déterministe** : PRNG à graine `mulberry32`, date figée ; deux exécutions donnent le même fichier). Le Sentier a 30 grilles de 8 à 5 cases fixées (7 / 8 / 8 / 7), une solution différente par grille ; les grilles à 8 fixées se résolvent par le carré latin seul, celles à 6 fixées ou moins EXIGENT la règle loup/mouton. Les identifiants sont renumérotés (`onf_4x4_001…130`) : un joueur dont `completedOnfChallengeIds` contient d'anciens identifiants voit ces grilles comme déjà faites alors qu'elles ont changé (remise à zéro du profil, Lot 1).

**Interface** : `onf-lobby.tsx` affiche le parcours des 3 paliers, la progression et l'Herbier ; le bouton « Jouer » reste dans son pied de page fixe. Le quota commun et ses options Premium / vidéo apparaissent uniquement sur l'accueil. `onf.tsx` charge les paliers ouverts depuis le store et affiche « palier terminé » quand `tierExhausted`. `OnfBriefingModal` : briefing court au Sentier, complet aux autres paliers.

**Supprimé** : `board_3x3_onf` (fichier et registre), `ONF_UNLOCK_LEVEL`, `ONF_4X4_UNLOCK_COUNT`, `gridSize`. `solveOnf` et `isPlacementValidOnf` sont conservés.

### Progression v2 — cérémonies (Lot 4)

**Tout est derrière `PROGRESSION_V2`** : avec `false`, aucune cérémonie n'est mise en file ni jouée, aucune pastille n'apparaît.

**Logique pure** (`src/constants/ceremonies.ts`, testée) : `buildChapterCeremonyId` / `parseChapterCeremonyId` (`chapter_1` … `chapter_7`), `getCeremoniesToEnqueue(levelsCompleted, pending, seen)` (idempotent), `getNextCeremony`, `mergeCeremonyIds`, `getCeremonyCards` (cartes-récompenses **typées** : `mode | tree_card | music | region | trophy` ; les graines ont leur propre étape), `getChapterModes`, `getTryNowDestination` (Duel → `/(tabs)/challenge`, Forestier → `/game/onf-lobby`, Journalier → `/game/daily`, sinon accueil), `getNextChapterPreview` (silhouettes : éléments nouveaux du chapitre suivant, lus dans `LEVEL_META`), `getCeremonyRank` (rang du chapitre SUIVANT), `getCeremonySteps` (5 étapes, aucune n'impose plus de `CEREMONY_MAX_FORCED_MS = 2000`), `buildCeremonySummary`, et les pastilles (`getNewBadgesForCeremonies`, `hasNewBadge`, `clearNewBadges`).

**Store** (`playerStore`) : `enqueueCeremonies()` (met en file cérémonies ET pastilles, un seul `set()`, idempotente, sans effet si le drapeau est `false`), `markCeremonySeen(id)` (sort de la file, ne revient jamais), `clearNewFeatureBadge('duel' | 'onf' | 'daily')`. `restoreFromCloud` : une cérémonie vue (ici OU ailleurs) ne revient jamais en attente. Persistance : AsyncStorage, Firestore via `buildSoloProgressionPayload` (**point d'entrée unique** de la synchronisation de la progression : étoiles, chapitres, cérémonies, pastilles).

**Composants et hook** :
- `src/components/Game/CeremonyModal.tsx` (Reanimated, plein écran) — 1. emblème qui se remplit d'étoiles, 2. nouveau rang + graines qui volent (`RewardFly`), 3. cartes face cachée retournées d'un tap, 4. aperçu du chapitre suivant (silhouettes), 5. « Essayer maintenant » / « Plus tard » (« Continuer » si le chapitre ne débloque aucun mode). Le joueur avance en touchant l'écran. `useReducedMotion()` : fondus, mêmes étapes.
- `src/hooks/useCeremonyPlayer.ts` — monté **uniquement sur l'accueil** : une cérémonie n'apparaît donc qu'au retour sur l'accueil, jamais pendant une partie ni par-dessus la `VictoryModal`. Rejouée à l'ouverture suivante si l'app a été fermée. Une cérémonie n'est marquée vue qu'une fois terminée ou quittée. Pas pendant l'écran des niveaux, la modale solo ou la carte premium.
- `WoodButton` : prop `newBadge` (pastille « Nouveau »). Journalier et Forestier sur l'accueil ; Duel sur l'onglet Défis du bandeau (`ForestFrame`, petite pastille dorée). La pastille disparaît à la **première partie** dans le mode (Duel : dès l'ouverture de la recherche d'ami ou l'acceptation d'un défi). **L'effacement est aussi écrit dans Firestore** (`updateNewFeatureBadges`, abonnement dans `(tabs)/_layout.tsx`) : `restoreFromCloud` fait l'union local + cloud, donc une pastille restée dans le cloud revenait à la reconnexion / au rechargement.

**Mise en file** : après la victoire solo (`[challengeId].tsx`, juste après `grantChapterRewards`) et à la connexion (`(tabs)/_layout.tsx`, rattrapage d'un chapitre terminé ailleurs). Les pastilles sont liées à la MISE EN FILE (déjà dédoublonnée), pas recalculées depuis la progression : sinon une pastille effacée reviendrait.

**Les cartes de la cérémonie sont toutes attribuées** (Lot 8) : la carte `tree_card` depuis le Lot 7, la carte `music` (titre du chapitre, `musicUnlocks.ts`) et le trophée final `esprit_accompli` (décerné par `trophyService` à la fin du chapitre 7) depuis le Lot 8.

### Progression v2 — chapitres et déblocages (Lot 3)

**Rang = chapitre en cours (D4).** `getRankForLevel(level)` (`progression.ts`) renvoie le chapitre du niveau (`rankId`, `rankKey`, `emoji`, `labelFr` / `labelEn`) ; `getRankLabel(rank, lang)`. Le rang n'est plus un score. **Supprimés** : `getPlayerScore`, `getBadgeScore`, `getPlayerActivityScore`, `RARITY_POINTS`, `ACTIVITY_POINTS`, `MAX_BADGE_SCORE`, `RANK_DEFINITIONS`, `getRank`, `getNextRank`, `PlayerActivityStats` (`badges.ts`), `RankUpModal` + `RANK_SEED_REWARDS`, les 5 blocs « détection de changement de rang » (Solo, Journalier, Forestier, Duel) et 23 clés i18n `rank_*` devenues mortes. Le changement de rang n'a **plus de modale** : sa mise en scène sera la cérémonie de chapitre (Lot 4). Les graines de rang n'existent plus : elles sont remplacées par les graines de fin de chapitre. **Ceci s'applique que `PROGRESSION_V2` soit actif ou non** : sans le drapeau, le rang affiché suit `currentLevel` (ancien calcul), sans modale ni graines de rang.

**Graines de fin de chapitre (C3).** `getChapterSeeds`, `getChaptersToReward(levelsCompleted, rewardedChapters)`, `sumChapterSeeds`, `mergeRewardedChapters`. `playerStore.rewardedChapters` (anti-doublon, persisté : AsyncStorage, Firestore `rewardedChapters`, fusion par union au `restoreFromCloud`, remis à zéro par `resetProgression`) et `playerStore.grantChapterRewards()` : **idempotente**, un seul `set()` (graines + marquage), rattrape plusieurs chapitres d'un coup ; ne fait rien si `PROGRESSION_V2 = false`. Appelée après `markChallengeCompleted` dans `[challengeId].tsx` (les graines de chapitre sont exclues du gain animé par la `VictoryModal`) et au chargement du profil dans `(tabs)/_layout.tsx` (rattrapage d'un chapitre terminé ailleurs). Montants : 10 / 25 / 50 / 100 / 200 / 500, aucune au chapitre 7.

**Déblocage des modes (C3).** `src/constants/unlocks.ts` est le point d'entrée UNIQUE (pur, testé) : `isFeatureAvailable(feature, { levelsCompleted, currentLevel, useChapters, bypass })`, `getFeatureLockHint`, `getLockMessageKey`, `getOpenOnfTiers`, `getOpenDailyLeagues`. Avec `useChapters` (`PROGRESSION_V2`) : `isFeatureUnlocked` (fin d'un chapitre). Sans : anciens seuils (`LEGACY_UNLOCK_LEVELS` : Duel 3, Journalier 9, Forestier 14). Hook `src/hooks/useFeatureAccess.ts` (`useFeatureAccess('demo' | 'dev')`) lu par `index.tsx` (Journalier = `daily_pousse`, Forestier = `onf_sentier`) et `challenge.tsx` (Duel). `onf.ts` ne contient plus de seuil de déblocage. **Plus aucun seuil de niveau dans les écrans**, hormis `rules.tsx` (voir points ouverts).

**Classement.** Refondu au Lot C (étoiles, départage par ancienneté, trois onglets) : voir « Classements (Lot C) » en tête de ce fichier. Les anciens `upsertLeaderboardEntry`, `badgeScore` et le tri niveau → badges → graines n'existent plus.

**Interface.** `RankPanel` (`BadgeCollection.tsx`) : rang courant, avancement du chapitre, liste des 7 chapitres (état, graines). Profil : rang + chapitre. `LevelsScreen` : bande de 7 chapitres, en-tête du chapitre du niveau affiché (avancement, graines à venir) ; le carrousel par niveau est conservé.

### Pommes de pin (remplacent les étoiles à l'affichage)

**Les étoiles sont des pommes de pin** (thème forestier). **Seul l'affichage change** : le modèle garde ses noms (`challengeStars`, `StarSequence`, `buildStarSequence`, `starsRank`, champs Firestore…). Trois images (`assets/elements/design_app`) : `PP_vide2.png` (vide : non obtenue), `PP_bois.png` (1 ou 2 obtenues), `PP_or.png` (les 3 obtenues). Compteurs : la **dorée** dans la `VictoryModal` ; le bandeau `ForestFrame` utilise le bloc `bloc_pp.png` qui contient déjà la pomme de pin dorée. Cérémonie (emblème) : dorée allumée / vide.

**Logique pure** (`src/constants/pinecone.ts`, testée par `__tests__/pinecone.test.ts`) : `getRatingVariants(n)` (listes de défis : 3 → trois dorées, 1-2 → bois puis vides), `getInitialVariants` / `getFinalVariants`, `shouldTransform(seq)` (la fête ne se joue que si la 3e est OBTENUE CE TOUR-CI), `isStaticGold(seq)` (défi déjà à 3 : trois dorées d'emblée, sans fête ; les notes ne baissent jamais), `splitPineconeText` / `stripPineconeToken`, `buildBurstParticles` (gerbe déterministe), constantes de temps de la transformation.

**Composants** : `PineconeIcon` (image, `size` = hauteur, ratio 284/353) ; `PineconeText` (remplace l'ancien ⭐ DANS les textes : le jeton **`[pp]`** des textes traduits devient une petite pomme de pin dorée inline ; le libellé d'accessibilité lit « pommes de pin », clé `pinecone_unit`) ; `PineconeBurst` (confettis / feu d'artifice Reanimated, rien en « réduire les animations »). **Aucun emoji ⭐ ni mot « étoile » ne doit réapparaître dans `fr.json` / `en.json`** : écrire « pomme(s) de pin » / « pinecone(s) » ou `[pp]`.

**Séquence de la `StarRow` (VictoryModal)** : chaque pomme de pin NOUVELLE passe de vide à bois l'une après l'autre (pop, note de plus en plus aiguë, vibration) ; si la 3e est nouvelle, pause de 380 ms puis les trois bois se transforment ENSEMBLE en dorées (fondu + rebond, `notificationSuccess`) avec trois gerbes de confettis ; `onFinished` n'est appelé qu'APRÈS la fête (~700 ms), donc la jauge et les graines suivent. Un tap passe tout à l'état final. Supprimés : `StarIcon.tsx`, `starShape.ts` (étoile SVG à facettes) et son test.

### Progression v2 — interface des étoiles (Lot 2)

**Tout ce qui suit n'est visible que si `PROGRESSION_V2 = true`.** Avec `false`, le bandeau, la victoire et l'écran des niveaux restent ceux d'avant (seules les modales de graines passent à Reanimated, sans changement visuel).

**Logique pure** (`src/constants/progression.ts`, testée) : `buildChallengeId`, `getLevelChallengeIds`, `isLevelOpen`, `getLevelStatus` (jauge `x / seuil`), `getRecommendedChallengeId` (1er défi jamais gagné, sinon 1er sans ⭐⭐⭐), `getNextRecommended` (accueil), `getNextAfterWin` (bouton « Défi suivant »), `buildStarSequence` (états `new | owned | missed` par emplacement), `getStarPopDelays`, `getStarSequenceDuration` (≈ 1 s : 1re étoile à 120 ms, 260 ms entre deux étoiles), `STAR_NOTE_RATES`, `getStarHaptic`, `getLevelGaugeResult` (jauge + bandeau « Niveau N débloqué »). `src/constants/counterLayout.ts` : géométrie des compteurs ⭐ / 🌱. `src/utils/starTones.ts` : 3 notes WAV synthétisées en mémoire (le dépôt n'a aucun son d'effet et `assets/` ne se modifie pas).

**Composants (Reanimated)** :
- `src/components/Game/RewardFly.tsx` — remplace `SeedFlyAnimation` : `RewardFly` (cible `'seeds' | 'stars'`) et `useCounterPulse()` (retourne `{ counterStyle, haloStyle, pulse }`, styles Reanimated). Respecte `useReducedMotion()` (fondu sur place, pas de trajet ; les arrivées sont quand même signalées).
- `src/store/rewardFlyStore.ts` — remplace `seedAnimStore` : positions des compteurs du bandeau (`counters`), `triggerFly`, `clearFly`, `pulses` / `requestPulse(target)`. `ForestFrame` publie les centres des compteurs ; le compteur du bandeau rebondit à chaque `requestPulse`. **Aucun composant n'appelle encore `triggerFly`** : les modales (Victory, RankUp, Roulette, friend-challenge) volent vers leur PROPRE compteur local.
- `src/components/Game/StarRow.tsx` — 3 emplacements avec critère (Gagné / Sans erreur / Parfait) en **pommes de pin** (voir « Pommes de pin » ci-dessus) : pop successif des NOUVELLES, note de plus en plus aiguë (`playStarTone`), vibration légère (moyenne pour la 3e), transformation bois → or avec confettis si la 3e est obtenue. L'envol vers le compteur part dès l'APPARITION de la pomme de pin (pas à la fin du ressort).
- `src/components/Game/VictoryModal.tsx` — réécrit en Reanimated. Prop optionnelle `starResult?: VictoryStarResult` (`{ sequence, gauge, isReplay }`) : sans elle (Journalier, Forestier, Duel) la séquence d'étoiles est absente et les graines démarrent comme avant. Phases : `stars` → `gauge` (jauge `x / seuil`, bandeau « Niveau N débloqué ! ») → `seeds` (puis PERFECT ×2). Un tap passe la séquence. **`starResult` doit être fourni dès le premier rendu visible** (la séquence est décidée à l'ouverture). **Le pavé des 3 prochains trophées n'est plus dans la modale** (trop chargée) : elle n'affiche qu'UNE ligne (`pickTrophyHint`, `trophyHint.ts`) — un trophée obtenu ce tour, sinon un trophée à ≥ 75 % de sa cible, sinon rien. Les 3 prochains trophées et leur barre restent dans le Profil. Le bandeau PERFECT a la largeur de la carte (plus de marge négative).
- `src/services/starSoundService.ts` — joue la note via `expo-audio`, silencieux si le son en jeu est coupé ou avant la 1re interaction (web).
- `ForestFrame` — `CountersOverlay` : deux blocs côte à côte, pommes de pin à gauche (`bloc_pp.png`) et graines à droite (`bloc_graines.png`). Chaque bloc porte DÉJÀ son icône : le texte n'affiche que le nombre, sans voile coloré ni icône ajoutée ; avec le drapeau à `false`, 🌱 seul, libellé « N graines » comme avant.

**Écran de jeu Solo** (`[challengeId].tsx`) : `soloOutcome` (useMemo au passage en victoire) fige les notes AVANT la partie ; `starResult` en dérive. Avec le drapeau, les boutons de la `VictoryModal` viennent de `getVictoryNavigation` (`progression.ts`, pur, testé) : par défaut « Défi suivant » = `getNextAfterWin` (le prochain jamais gagné du niveau via `getNextInLevel`, puis le niveau suivant s'il est ouvert, sinon l'accueil). **Niveau tout juste validé** (`gauge.unlockedLevel`) : le bouton principal devient « Passer au niveau N » (cohérent avec le bandeau « Niveau N débloqué ») et un bouton secondaire « Continuer le niveau M (pommes de pin manquantes) » (props `onSecondaryAction` / `secondaryActionLabel` de `VictoryModal`) mène au prochain défi du niveau validé, absent si ce niveau n'a plus rien à améliorer. **Cérémonie en file** (`pendingCeremonies` non vide, cas des fins de chapitre) : le bouton principal devient « Découvrir ta récompense » et ramène à l'accueil, où `useCeremonyPlayer` la joue (jamais sur l'écran de jeu, règle C7) ; le « prochain conseillé » de l'accueil pointe alors vers le niveau suivant. Le bouton secondaire reste un choix explicite du joueur (il saute la cérémonie, qui reste en file). Clés i18n : `victory_go_next_level`, `victory_continue_level`, `victory_go_home_ceremony`.

**Écran des niveaux** (`LevelsScreen`, `index.tsx`) avec le drapeau : niveau ouvert si `isLevelOpen` (étoiles du précédent ≥ seuil), **les 10 défis accessibles** (D13), jauge `x / seuil` sur la carte du niveau + « Encore N ⭐ », ★☆☆ par défi, badge « Conseillé », total `x / 630 ⭐` dans l'en-tête. L'accueil (`SoloModal`) pointe vers `getNextRecommended`. **Non fait au Lot 2** : regroupement visuel par chapitre (Lot 3).

### Progression v2 — fondations (Lot 1)

**Drapeau `PROGRESSION_V2`** (`src/constants/featureFlags.ts`, **`true`** depuis la livraison ; `false` pendant le développement). Quand il est à `true` :
- `currentLevel` est dérivé des étoiles (`computeLevelProgress`) au lieu de `computePlayerLevel` (défis / 10) ;
- un défi **rejoué** rapporte 5 🌱 par NOUVELLE étoile, sinon 0 (C2) ; PERFECT ×2 seulement à la 1re victoire en ⭐⭐⭐ ;
- la remise à zéro unique des profils (`progressionVersion < 2`) s'exécute (local : `useStorage`, cloud : `app/(tabs)/_layout.tsx`).

Toujours actifs (additifs, sans effet visible) : calcul et persistance des étoiles, `levelsCompleted`, compteurs de trophées, modèle de données. **Aucun écran n'affiche les étoiles quand `PROGRESSION_V2 = false`** (Lot 2) et aucun ne lit encore `isFeatureUnlocked` (Lot 3) : les déblocages visibles restent ceux de la section « Progression et déblocages ».

**Fichiers purs** (testés, aucune dépendance React / Zustand / Firebase) :
- `src/constants/progression.ts` — `STAR_THRESHOLDS`, `computeStars`, `computeLevelProgress` → `{ currentLevel, levelsCompleted, starsByLevel }`, `applyStarResult` (meilleure note, compteurs de trophées, niveaux franchis), `computeSoloSeeds`, `mergeChallengeStars` (max local / cloud), `CHAPTERS` (7 chapitres, récompenses typées `ChapterReward`), `getChapterForLevel`, `getCurrentChapter`, `isChapterCompleted`, `isFeatureUnlocked(feature, progress)` (9 fonctionnalités : `duel | onf_sentier | onf_clairiere | onf_profonde | daily_pousse | daily_grand_chene | herbier_europe | herbier_monde | herbier_remarquables`), `computeLegacyLevel`, `resolvePlayerLevel`, `needsProgressionReset`. Constantes : `CURRENT_PROGRESSION_VERSION = 2`, `INITIAL_SEEDS = 3`, `SEEDS_PER_NEW_STAR = 5`.
- `src/constants/profileDefaults.ts` — `createDefaultProgressionFields()`, `createDefaultStats()`, `buildFirestoreResetPayload()`, `RESET_FIRESTORE_FIELDS` : source unique de l'état « profil neuf », partagée par `createPlayer`, `playerStore.resetProgression` et la remise à zéro Firestore.
- `src/constants/devAccess.ts` — `isDemoAccount` (`planete`), `isDevAccount` (`Ramoni`, `Cedric`, `planete`), `isAdminAccount` (`Ramoni`) : **seul** endroit où figurent des noms de comptes. Plus aucun `'planete'` / `'Ramoni'` / `DEV_USERS` dans `app/` ni `src/components/`.

**Étoiles (C1)** : ⭐ victoire · ⭐⭐ aucune validation ratée · ⭐⭐⭐ + aucun bonus + `elementChangeCount === 0`. Le critère « jamais abandonné » n'existe plus. `playerStore.recordSoloStars(...)` est appelé dans `[challengeId].tsx` **avant** `markChallengeCompleted` (qui ajoute le défi à `completedChallenges` : l'état d'avant sert à détecter la 1re victoire).

**Remise à zéro (C9)** : à la connexion, si `progressionVersion` est absent ou `< 2` : (1) `resetPlayerProgression(uid)` écrit les défauts dans Firestore (`merge: true`, identité et préférences conservées), (2) `playerStore.resetProgression()`, (3) relecture du profil, (4) `restoreFromCloud`. Si l'écriture cloud échoue, l'ancien profil n'est **pas** restauré et l'opération est retentée à la connexion suivante. Les profils créés par `createPlayer` naissent à `progressionVersion: 2`. `isPremium` est remis à `false` **uniquement** parce que les testeurs n'ont pas payé (commentaire obligatoire dans `profileDefaults.ts` : en production, un achat ne doit jamais être remis à zéro). La purge des classements, records et résultats du Défi du Jour est **proposée, non exécutée** : `docs/purge-progression-v2.md` + `scripts/purgeProgressionV2.ts` (dry-run par défaut). `foret_commune` n'est pas touchée.

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
| Changement de progression / déblocage | Section "Progression et déblocages", section "Chantier en cours" |

**Règle** : si une section de ce fichier décrit un comportement ou une valeur qui a changé dans le code, corriger ce fichier avant de clore la tâche.

L'utilisateur autorise explicitement la modification de ce fichier (`.kilo/rules/architecture.md`) à chaque lot de la Progression v2.

---

## Stack technique

| Couche | Technologie |
|---|---|
| Framework | Expo ~57.0.21 + Expo Router ~57.0.20 |
| React | 19.2.3 |
| Navigation | expo-router (file-based, Tabs + Stack). `@react-navigation/drawer` est dans `package.json` mais **non utilisé** |
| État global | Zustand ^5 |
| Backend | Firebase 12.19 (Auth + Firestore) |
| Audio | **expo-audio ~57** (`audioService.ts`, `MusicPanel.tsx`). `expo-av` n'est plus une dépendance ; `exponentAVPatch.ts/.web.ts` sont des vestiges non importés |
| Haptique | expo-haptics (`src/utils/haptics.ts`) |
| Gestures | react-native-gesture-handler ~2.32 (taps uniquement : `Cell`, `ElementToken`) |
| Animations | react-native-reanimated 4.5.1 + react-native-worklets 0.10.1 (config Babel : `babel-preset-expo` seul, pas de plugin Reanimated). Utilisé aujourd'hui par `Cell`, `ElementToken`, `onf-lobby`, `ONFCardUnlockBanner`, `TreeCardView` ; le reste du jeu utilise l'API `Animated` de RN |
| SVG | react-native-svg 15.15 |
| Lottie | lottie-react-native ~7.3 |
| i18n | hook `useT()` maison (fr/en, clé JSON) |
| Typage | TypeScript ~6.0 |
| Tests | Jest 29 + ts-jest (`__tests__/**/*.test.ts`, environnement `node`). Images et sons remplacés par `__mocks__/fileMock.js` (`moduleNameMapper` dans `package.json`) |

**Interaction de jeu** : tap pour sélectionner un jeton dans la palette puis tap sur une case (`placeAndDeselect`). Il n'y a **pas** de drag & drop (aucun `useDragDrop`, `useWebDrag`, `DragGhost`).

---

## Routing (Expo Router — file-based)

```
app/
  _layout.tsx              ← Root : GestureHandlerRootView + StorageBridge + AudioBridge + MusicUnlockModal + splash
  (tabs)/
    _layout.tsx            ← Tabs layout + UNIQUE onAuthChange Firebase + garde auth + connexion quotidienne
    index.tsx              ← Accueil : progression + prochain défi + Défi de la forêt (ONF, ch. 2) + Défi du Jour (ch. 3)
                             + ForetCommuneWidget. Contient aussi `LevelsScreen` (sélection des niveaux)
                             et `SoloModal` (sous-composants du même fichier)
    rules.tsx              ← Onglet Règles (12 éléments + animations briefing)
    challenge.tsx          ← Défis entre amis (Duel)
    profile.tsx            ← Profil, auth, badges, rang, classement, musiques, réglages
  game/
    _layout.tsx            ← Stack sans swipe-back (empêche le contournement de l'abandon)
    [challengeId].tsx      ← Écran de jeu Solo (tap-to-place)
    daily.tsx              ← Défi du Jour (15 cases, 1 validation, pas de bonus)
    onf-lobby.tsx          ← Lobby du Défi de la forêt : parcours des paliers, Herbier compact, pied de page fixe (Jouer / premium + vidéo)
    onf.tsx                ← Mode Planète Urgence / Défi de la forêt (grille 4×4 pré-générée, palier choisi selon les paliers ouverts)
    friend-challenge.tsx   ← Défi ami
  admin/

    metrics.tsx            ← Page admin (Ramoni) : métriques
```

Il n'existe **pas** de `levels.tsx` : la sélection des niveaux est `LevelsScreen` dans `app/(tabs)/index.tsx`.

**Règle critique** : un seul `onAuthChange` dans `(tabs)/_layout.tsx`. Ne jamais en ajouter ailleurs.

---

## Structure source `src/`

```
src/
  core/
    models/
      Element.ts      ← ElementDefinition + ConstraintDefinition (source de vérité des règles)
      Board.ts        ← BoardDefinition + CellPosition (specialCells, gridMeta optionnels)
      Challenge.ts    ← Challenge + FixedPlacement + TokenCount + DifficultyLevel (niveau_1…niveau_21)
      FriendChallenge.ts
    engine/
      validator.ts    ← validateBoard(), checkVictory(), isPlacementValid(), validateRowColUnique(), isPlacementValidOnf(), getConnectedGroup(Multi)
      solver.ts       ← solve() backtracking (s'arrête à 2 solutions) + solveOnf() pour le mode ONF
      hintEngine.ts   ← getValidCellsForElement(), getErrorCells(), calculateSeedReward()
    generators/
      challengeGenerator.ts ← generateChallenge() — solution unique garantie
  elements/
    ElementRegistry.ts  ← Record<string, ElementDefinition> (source unique, 12 éléments)
    bucheron.ts / ours.ts / mouton.ts / chien.ts / loup.ts / ruche.ts
    cerf.ts / biche.ts / tas_buches.ts / chalet.ts
    champignon.ts       ← center_only, niveaux 17+ et Défi du Jour
    arbre.ts            ← connected_group_with tas_buches, niveaux 19-21
  boards/
    BoardRegistry.ts    ← Record<string, BoardDefinition> (12 plateaux enregistrés)
    board_6cells_v1.ts, board_7cells_v1.ts, board_8cells_v2.ts, board_9cells_v1.ts, board_10cells_v3.ts,
    board_11cells_v1.ts (obsolète), board_11cells_v2.ts, board_12cells.ts, board_13cells_v1.ts, board_14cells_v1.ts
    board_15cells_daily.ts ← 15 cases, Clairière Secrète (Défi du Jour)
    board_4x4_onf.ts    ← 16 cases grille carrée + gridMeta (mode ONF)
    board_6cells_v3.ts  ← fichier orphelin, non enregistré dans BoardRegistry
  store/
    gameStore.ts    ← état partie en cours (Zustand)
    playerStore.ts  ← profil + progression + badges + graines (~1500 lignes)
    audioStore.ts   ← état audio (musique ambiante + ingame, titres possédés)
    challengeStore.ts ← défis amis en cours
    navStore.ts     ← bouton retour du cadre, compteur défis amis en attente, slots d'objectifs
    rewardFlyStore.ts ← positions des compteurs ⭐ / 🌱 du bandeau, pulses, déclencheur de vol (Lot 2)
    dialogStore.ts  ← file de dialogues `showAlert` / `showConfirm` (affichés par `DialogHost`) : remplace Alert.alert, window.alert et window.confirm
  hooks/
    useGame.ts      ← logique jeu (timer, place/remove/move, bonus, validate)
    useFeatureAccess.ts ← « ce mode est-il ouvert ? » (drapeau + étoiles + comptes dev), Lot 3
    useCeremonyPlayer.ts ← joue la file des cérémonies de chapitre sur l'accueil (Lot 4)
    useStorage.ts   ← persistance AsyncStorage (`dlf_player_v1`, `dlf_audio_v1`) ↔ playerStore/audioStore
  services/
    firebase.ts         ← init unique Firebase (auth + db)
    authService.ts      ← register/login email, Google (web), anonyme, logout, onAuthChange
    playerService.ts    ← CRUD Firestore profil joueur (`/players/{uid}`), PlayerProfile, migrateProfile(),
                          computePlayerLevel(), searchPlayers(), updateSeeds(), markCompleted()…
    badgeService.ts     ← awardBadgesFirestore(), updateDailyStreak(), vitrine
    challengeService.ts ← défis amis Firestore (`friendChallenges`), CHALLENGE_WINNER_SEEDS
    dailyChallengeService.ts ← génération daily par ligue (PRNG mulberry32, 16 compositions, solver), Firestore `dailyChallenges/{date}_{ligue}/results/{uid}`
    onfChallengeService.ts   ← pickOnfChallenge(completedIds, unlockedTiers) sur les 130 grilles pré-générées (champ `tier`), getOnfChallengeCount(), calculateOnfReward()
    leaderboardService.ts    ← collection `leaderboard` : publishLeaderboardEntry() (point d'entrée unique), subscribeStarsLeaderboard(), subscribeDailyWinsLeaderboard(ligue), getStarsPosition() (Lot C)
    worldRecordService.ts    ← collection `worldRecords` : subscribeWorldRecord(), trySetWorldRecord(), subscribeRecordHolders()
    foretCommuneService.ts   ← document `foret_commune/global` (compteur collectif de vrais arbres) — NE PAS MODIFIER sans accord explicite
    jackpotService.ts        ← bandit manchot du Défi du Jour (`jackpot/daily`, `jackpotClaims`)
    metricsService.ts        ← métriques de rétention (`metrics/{uid}`)
    adminService.ts          ← outils admin (Ramoni) : liste/suppression de joueurs
    inactiveAccountService.ts ← purge quotidienne des comptes gratuits inactifs depuis 2 ans (admin, drapeau INACTIVE_PURGE_ON_LAUNCH ; premium exclus)
    purgeProgressionService.ts ← purge de la progression v2 depuis le Profil (Ramoni) : comptage (dry-run) puis suppression par lots
    audioService.ts          ← expo-audio
    exponentAVPatch.ts / .web.ts ← vestiges du patch expo-av (non importés)
  constants/
    colors.ts       ← Colors (forest, cell, elements, ui, badges)
    bonus.ts        ← BonusId + BONUS_DEFINITIONS + BASE/ADVANCED_BONUS_IDS
    badges.ts       ← catalogue des 75 trophées (60 séries + 14 surprises + 1 final), BADGE_MAP, BADGE_SEED_REWARDS, getTrophyTexts (Lot 8)
    trophies.ts     ← 15 séries × 4 paliers, évaluation, podium, prochains trophées : logique pure (Lot 8)
    trophyEngine.ts ← surprises + compteurs des séries : logique pure (Lot 8)
    musicUnlocks.ts ← déblocage des musiques par chapitre / trophée : logique pure (Lot 8)
    difficulty.ts   ← LEVEL_PARAMS (21 niveaux) + Composition + LevelParams
    unlocks.ts      ← déblocage des modes : isFeatureAvailable, LEGACY_UNLOCK_LEVELS, DAILY_UNLOCK_LEVEL, FRIENDS_UNLOCK_LEVEL (Lot 3)
    onf.ts          ← ONF_CARD_UNLOCK_EVERY (5) uniquement (les restes 3×3 ont été supprimés au Lot 5)
    onfTiers.ts     ← paliers du Forestier, sélection des grilles, composition du Sentier : logique pure (Lot 5)
    herbier.ts      ← Herbier : coût de plantation, régions ouvertes, cartes gratuites, collection : logique pure (Lot 7)
    dailyLeagues.ts ← ligues du Journalier : compositions par ligue, sel, cases fixées, identifiants Firestore, rang dans la ligue (Lot 6)
    music.ts        ← MUSIC_CATALOG (14 titres, déblocage via MUSIC_UNLOCKS), TROPHY_MUSIC_UNLOCK_MAP
    foretCommune.ts ← constantes de la Forêt Commune
    frameLayout.ts  ← dimensions du cadre ForestFrame (useFrameLayout)
    featureFlags.ts ← PROGRESSION_V2 (Lot 1)
    progression.ts  ← étoiles, seuils, chapitres, déblocages : helpers purs (Lots 1-2)
    counterLayout.ts ← géométrie des compteurs ⭐ / 🌱 du bandeau (Lot 2)
    profileDefaults.ts ← valeurs par défaut du profil, charge utile de remise à zéro (Lot 1)
    ceremonies.ts   ← cérémonies de chapitre : file, cartes-récompenses typées, étapes, pastilles (Lot 4)
    devAccess.ts    ← contournements développeur centralisés (Lot 1)
    dailyLimits.ts  ← limites quotidiennes : quota global, migration des anciens compteurs, fusion local/cloud : logique pure
    adRewards.ts    ← pubs volontaires : recharge des 2 bonus + Forêt commune, plafonds quotidiens, compteurs : logique pure
    leaderboardRank.ts ← score empaqueté des classements, départage « premier arrivé », entrée publiée, détenteurs de records : logique pure (Lot C)
    playerStats.ts  ← statistiques : vue d'affichage (4 blocs), fusion local/cloud, tally des duels, série du Journalier : logique pure (Lot D)
    purgeProgression.ts ← collections purgées / préservées, mot de confirmation, lots d'écriture : logique pure, partagée par le script et le bouton admin
  data/
    levelMeta.ts        ← LEVEL_META[1..21] (RuleCard, LevelMeta, newElements, allRules)
    treesData.ts        ← TREES_DATA : les 143 cartes, leurs régions, crédits et TREE_IMAGES
    treesWorld.ts       ← ancien catalogue mondial (non ajouté à l'Herbier actuel)
    50treesdata_world.source.txt ← liste source des cartes monde (texte brut fourni, non importé)
    onf_challenges.json ← 130 grilles ONF 4×4 pré-générées (id `onf_4x4_NNN`, champ `tier` : 30 sentier, 65 clairiere, 35 profonde)
    challenges/
      niveau_1.json … niveau_21.json  ← défis pré-générés (format `{ challenges: Challenge[] }`, 10 par niveau)
      apprenti.json / debutant.json / expert.json / maitre.json  ← anciens fichiers, non utilisés par l'écran de sélection
  i18n/
    index.ts    ← useT() hook (Zustand-reactive)
    locale.ts   ← Lang type + getSystemLocale()
    locales/fr.json / en.json
  components/
    SplashScreen.tsx
    Board/      ← BoardRenderer.tsx, Cell.tsx, Connection.tsx
    Elements/   ← ElementPalette.tsx, ElementToken.tsx
    Bonus/      ← HintOverlay.tsx, BonusTutorialModal.tsx
    Account/    ← DeleteAccountModal.tsx (suppression du compte), LegalLinks.tsx (mention d'inscription + liens légaux du Profil)
    Ads/        ← RewardedAdHost.tsx (pub volontaire simulée : recharge d'un bonus, Forêt commune ou quota du Défi de la forêt, montée UNE fois à la racine)
    Game/       ← DialogHost.tsx (affiche `dialogStore` avec ConfirmModal : remplace Alert.alert / window.alert / confirm, monté UNE fois à la racine), ConfirmModal.tsx (prop `hideCancel` pour une alerte), VictoryModal.tsx (Reanimated, Lot 2), StarRow.tsx, PineconeIcon.tsx (+ PineconeText), PineconeBurst.tsx, RewardFly.tsx, CeremonyModal.tsx (Lot 4), FailModal.tsx, Confetti.tsx, FallingLeaves.tsx,
                  ChallengeCountdown.tsx, ConfirmModal.tsx,
                  AbandonConfirmModal.tsx, DailyAbandonConfirmModal.tsx, DailyRouletteModal.tsx,
                  DailyStreakRecordModal.tsx
    LevelBriefing/ ← **coque commune BriefingLayout.tsx** (en-tête, pagination, pied de page, bouton « Jouer » ; thème par mode) utilisée par LevelBriefingModal (Solo), DailyBriefingModal (accent doré) et OnfBriefingModal (accent vert) ; **résumé commun BoardSummary.tsx** (deux tuiles « déjà posées / à remplir », frise de la grille, inventaire des jetons avec badge ×N, props title / subtitle / accent + enfant BriefingNotes pour les rappels du mode ; chiffres lus dans `fixedPlacements` / `availableTokens`). Tailles de texte ≥ 16 px, cibles tactiles ≥ 44 px. ElementChips supprimé. IntroSlide.tsx,
                    RuleCard.tsx, BoardSummary.tsx, ElementChips.tsx, RuleAnimations/(10 composants + sprites.ts)
    Badges/     ← BadgeCard, BadgeCollection (+ RankPanel), BadgeDetailModal, BadgeProgressInline (3 prochains trophées),
                  BadgeShowcase, BadgeToast
                  BadgeShowcase, BadgeToast
    Audio/      ← AudioController.tsx, MusicPanel.tsx, MusicUnlockModal.tsx
    Leaderboard/← LeaderboardScreen.tsx (3 onglets : étoiles, Journalier par ligue, records ; Lot C)
    Stats/      ← StatsScreen.tsx (4 blocs : progression, solo, modes, régularité ; Lot D)
    ONF/        ← TreeCardGallery.tsx (Herbier : collection + plantation), PlantCardModal.tsx (confirmation puis révélation d'une carte plantée), TreeCardView.tsx, ONFCardUnlockBanner.tsx, HerbierEntry.tsx (Lot 7)
    ForetCommune/ ← ForetCommuneWidget.tsx
    Navigation/ ← ForestFrame.tsx (cadre, compteur 🌱, barre du bas)
    Premium/    ← PremiumCard.tsx
    UI/         ← BgImage.tsx, WoodButton.tsx, WoodSign.tsx
    Admin/      ← AdminCleanModal.tsx, AdminPurgeModal.tsx (purge de la progression v2)
  utils/
    boardUtils.ts  ← findNearestCell(), formatTime()
    haptics.ts
    onfCards.ts    ← catalogue des 143 cartes et accès à la collection (`collectedTreeCardIds`), Lot 7
docs/
  progression-v2.md ← spécification du chantier Progression v2
  purge-progression-v2.md ← proposition de purge des données partagées (non exécutée)
  daily-leagues-firestore.md ← schéma Firestore par ligue, règles et index à vérifier (Lot 6)
scripts/
  generateChallenges.ts    ← npm run generate (niveaux 1-21)
  regenerateChallenges.ts  ← npm run regenerate
  generateOnfChallenges.ts ← npm run generate:onf (130 grilles ONF 4×4 par paliers → src/data/onf_challenges.json ; déterministe)
  generateViewerData.ts    ← npm run generate:viewer
  purgeProgressionV2.ts    ← purge de la progression v2 en ligne de commande, non exécutée (dry-run par défaut, voir docs/purge-progression-v2.md) ; mêmes collections que le bouton admin du Profil
  diagnose*.ts / analyze*.ts / test*.ts / fetchONFData.js / genereJsonTrees.js (utilitaires ponctuels)
__tests__/
  hintEngine.test.ts / solver.test.ts / validator.test.ts
  progression.test.ts / profileDefaults.test.ts / playerStoreProgression.test.ts  ← Progression v2 (Lot 1); dailyLeagues.test.ts / dailyChallengeLeagues.test.ts (Lot 6); onfTiers.test.ts / onfChallenges.test.ts (Lot 5) ; herbier.test.ts (Lot 7)
__mocks__/
  fileMock.js ← stub des images / sons pour Jest
```

---

## Modèles de données clés

### Element (src/core/models/Element.ts)
Les règles de jeu sont **uniquement** dans `ElementDefinition.constraints` (et `placementRules`). Jamais codées en dur dans le moteur.

**Types de contraintes :**
- `neighbor_same` — forbid/require voisin identique
- `neighbor_specific` — forbid/require voisin d'un type donné (`onlyIfTargetOnBoard` pour les règles conditionnelles)
- `neighbor_specific_chain` — voisin requis + voisin conditionnel (tas_buches ← bucheron + chalet si présent)
- `connected_group` — tous les exemplaires forment 1 groupe connexe (chien = meute)
- `connected_group_with` — l'élément + `groupElementId` (si présent) forment 1 groupe connexe (arbre + tas_buches)
- `paired_specific` — couplage 1-pour-1 (cerf ↔ biche)
- `position_only` / `count_on_board`
- `row_col_unique` — mode ONF uniquement : max 1 élément identique par ligne ET par colonne (vérifiée via `gridMeta`, pas déclarée dans ElementDefinition)

**Règles de placement** (`placementRules`) : `center_only` | `edge_only` | `corner_only` | `cell_whitelist` (champignon = `center_only`, via `specialCells.center` du plateau).

### Éléments disponibles (12)
| id | `maxPerBoard` | Règle distinctive | Introduit au niveau |
|---|---|---|---|
| bucheron | 4 | ≠ voisin bucheron | 1 |
| ours | 4 | ≠ voisin ours ; voisin ruche obligatoire **si une ruche est présente** | 1 |
| mouton | 4 | ≠ voisin mouton, ≠ voisin loup | 1 |
| chien | 4 | meute connexe (`connected_group`), voisin chien obligatoire, toujours ≥ 2 | 3 |
| loup | 4 | ≠ voisin loup, ≠ voisin mouton | 5 |
| ruche | 1 | singleton ; la contrainte « voisin ruche » est portée par l'ours | 7 |
| cerf | 4 | `paired_specific` avec biche, ≠ voisin cerf | 9 |
| biche | 4 | `paired_specific` avec cerf, ≠ voisin biche | 9 |
| tas_buches | 4 | `neighbor_specific_chain` : voisin bucheron + voisin chalet si chalet présent | 11 |
| chalet | 4 | voisin bucheron obligatoire, ≠ voisin chalet, bucheron ≥ chalet | 12 |
| champignon | 3 | `center_only`, ≠ voisin champignon | 17 (aussi Défi du Jour et ONF « profond » à venir) |
| arbre | 6 | forêt connexe : arbres (+ tas_buches si présents) en un seul groupe | 19 |

> Le renard n'existe plus : il a été remplacé par le **loup**. Ne jamais référencer `renard`.

### Plateaux (12 dans BoardRegistry)
| id | Cases | Niveaux (d'après `LEVEL_PARAMS`) |
|---|---|---|
| board_6_v1 | 6 | 1 |
| board_7_v1 | 7 | 2 |
| board_8_v2 | 8 | 3–4 |
| board_9_v1 | 9 | 5–6 |
| board_10_v3 | 10 | 7–8 |
| board_11_v1 | 11 | (obsolète, aucun niveau) |
| board_11_v2 | 11 | 9–11 |
| board_12 | 12 | 12–15 |
| board_13_v1 | 13 | 16–18 (« Cœur de la Forêt », centre = [2,5,8,11,12]) |
| board_14_v1 | 14 | 19–21 (« Cœur Profond », centre = [4..9]) |
| board_15_daily | 15 | Défi du Jour (« Clairière Secrète », centre = [3,4,7,10,11]) |
| board_4x4_onf | 16 | Mode ONF 4×4 (grille carrée, `gridMeta`, centre = [5,6,9,10]) |

`BoardDefinition` a un champ optionnel `gridMeta?: { rows: number[][], cols: number[][] }` — présent uniquement sur les plateaux ONF.

### Challenge (src/core/models/Challenge.ts)
- `solution: string[]` — solution unique pré-calculée par le solveur
- `fixedPlacements` — jetons non déplaçables par le joueur
- `availableTokens` — inventaire du joueur
- `estimatedDuration` — en secondes (base du calcul de rapidité)
- Victoire = `playerBoard[i] === solution[i]` pour tout i (simple comparaison O(n))
- `solutionCount` doit toujours valoir 1
- Identifiants : solo `niveau_N_NNN` (ex. `niveau_3_001`), ONF `onf_4x4_NNN`

### DifficultyLevel et paramètres par niveau
`niveau_1` … `niveau_21`, 10 défis par niveau (`src/data/challenges/niveau_N.json`, 210 défis au total).
Paramètres dans `LEVEL_PARAMS` (`src/constants/difficulty.ts`) :

| Niv | Plateau (cases) | Vides | Fixées | Nouveauté | Bonus |
|---|---|---|---|---|---|
| 1 | 6 | 3 | 3 | bucheron, ours, mouton | oui |
| 2 | 7 | 4 | 3 | — | oui |
| 3 | 8 | 4 | 4 | chien | oui |
| 4 | 8 | 5 | 3 | — | oui |
| 5 | 9 | 5 | 4 | loup | oui |
| 6 | 9 | 6 | 3 | — | oui |
| 7 | 10 | 6 | 4 | ruche | oui |
| 8 | 10 | 7 | 3 | — | oui |
| 9 | 11 | 7 | 4 | cerf, biche | oui |
| 10 | 11 | 7 | 4 | — | oui |
| 11 | 11 | 7 | 4 | tas_buches | oui |
| 12 | 12 | 7 | 5 | chalet | oui |
| 13 | 12 | 7 | 5 | — | oui |
| 14 | 12 | 8 | 4 | — | oui |
| 15 | 12 | 8 | 4 | — | **non** |
| 16 | 13 | 8 | 5 | — | oui |
| 17 | 13 | 8 | 5 | champignon | oui |
| 18 | 13 | 9→8* | 5 | — | **non** |
| 19 | 14 | 9 | 5 | arbre | oui |
| 20 | 14 | 8 | 6 | — | oui |
| 21 | 14 | 8 | 6 | — | **non** |

\* `emptyCellsRange` du niveau 18 vaut `[8, 8]` et les JSON générés ont 5 cases fixées sur 13 cases ; le commentaire « 9 vides, 4 fixés » de l'ancien code était erroné. La source de vérité du nombre de cases fixées est le JSON généré.

Bonus désactivés (`bonusDisabled = true`) : niveaux **15, 18 et 21**.
`LEVEL_META[1..21]` (`src/data/levelMeta.ts`) décrit les cartes de règles (briefing) de chaque niveau ; 17 introduit le champignon, 19 l'arbre.

---

## Progression et déblocages (état actuel)

### Niveau du joueur
- `PROGRESSION_V2 = false` (ancien système, conservé pour un retour arrière) : `computePlayerLevel(completedCount)` (`playerService.ts`, délègue à `computeLegacyLevel`) = `min(21, floor(completedCount / 10) + 1)`, par nombre de défis uniques complétés. Appelé dans `markChallengeCompleted`, `restoreFromCloud` et à l'état initial → `playerStore.currentLevel`.
- `PROGRESSION_V2 = true` : `currentLevel` = `computeLevelProgress(challengeStars).currentLevel` (1 + niveaux consécutifs validés, voir « fondations (Lot 1) »). Mis à jour par `recordSoloStars` et `restoreFromCloud`.
- Les étoiles sont calculées et stockées dans les deux cas ; elles ne sont **affichées** que si PROGRESSION_V2 = true (Lot 2). Il n'y a pas de chapitres affichés. Le rang (Promeneur… Esprit de la Forêt) reste calculé depuis le score badges + activité (voir Système de badges) jusqu'au Lot 3.

### Écran de sélection des niveaux (`LevelsScreen`, `app/(tabs)/index.tsx`)
- Carrousel `‹ ›` sur `LEVELS` (21 entrées : id, label, emoji, description, couleur).
- `isLevelUnlocked(idx)` : niveau 1 toujours ouvert ; niveau N ouvert si **les 10 défis du niveau N-1** sont dans `completedChallenges` (`PROGRESSION_V2` : `isLevelOpen`, voir « interface des étoiles (Lot 2) »).
- `isChallengeUnlocked(i)` : séquentiel — le défi 1 est libre, le défi i+1 s'ouvre quand le défi i est complété (`PROGRESSION_V2` : les 10 défis d'un niveau ouvert sont accessibles).
- Le compte `planete` (`isDemoUser`) contourne tout.
- `nextChallenge` (accueil) = premier défi non complété dans l'ordre des niveaux (`PROGRESSION_V2` : `getNextRecommended`). `initialLevelIndex` = `currentLevel - 1`.

### Déblocages des modes
Tout passe par `isFeatureAvailable` (`src/constants/unlocks.ts`, voir « chapitres et déblocages (Lot 3) »).

| Mode | `PROGRESSION_V2 = true` (actuel) | `PROGRESSION_V2 = false` (ancien système) | Contournement |
|---|---|---|---|
| Duel (`duel`) | fin du chapitre 1 | `currentLevel >= 3` | compte démo |
| Journalier (`daily_pousse`) | fin du chapitre 3 | `currentLevel >= 9` | compte de développement |
| Forestier (`onf_sentier`) | fin du chapitre 2 | `currentLevel >= 14` | compte démo |
| Onglet Règles | `currentLevel >= introLevel` (12 entrées) | idem | compte démo |

Les paliers `onf_clairiere` / `onf_profonde` et la ligue `daily_grand_chene` sont définis mais ne sont lus par aucun écran avant les Lots 5 et 6. L'onglet Règles reste sur le niveau (`rules.tsx` : l'élément se débloque au niveau de son introduction) : il n'est pas un « mode ».

Les restes du 3×3 (`ONF_UNLOCK_LEVEL`, `ONF_4X4_UNLOCK_COUNT`, `board_3x3_onf`, `gridSize` du lobby) ont été supprimés au Lot 5.

### Contournements « développeur » (centralisés au Lot 1)
Tous passent par `src/constants/devAccess.ts` : `isDemoAccount` (`planete` : déblocages, jetons amis, exemption du quota global), `isDevAccount` (`Ramoni`, `Cedric`, `planete` : Défi du Jour), `isAdminAccount` (`Ramoni` : outils admin, « Rejouer » du daily, roulette rejouable, pages `admin/`). Utilisés par `index.tsx`, `challenge.tsx`, `rules.tsx`, `profile.tsx`, `onf.tsx`, `admin/*.tsx`, `DailyRouletteModal.tsx`. `DAILY_UNLOCK_LEVEL` est maintenant lu depuis `unlocks.ts` par `index.tsx` (plus de doublon).

---

## Stores Zustand

### gameStore
État de la partie en cours. Actions clés :
- `loadChallenge(challenge)` / `loadDailyChallenge(challenge)` — initialise le plateau
- `placeElement(cellIndex, elementId)` / `placeAndDeselect` — place un jeton (sans validation auto)
- `moveElement(from, to)` — permute deux cases ; `removeElement`, `clearPlayerBoard`
- `elementChangeCount` — nb de jetons posés puis déplacés/retirés/remplacés
- `useBonus(bonusId)`, `setBonusDisabled`, canal reveal (`revealActive`, `revealCellIndex`, `revealElementId`)
- `validateChallenge()` → compare avec `solution` → `ValidationResult`
- `startTimer(offset?)` — démarré après le briefing ; `stopTimer`, `resetGame()`

### playerStore
Profil + progression + badges + graines. Points critiques :
- `seeds` = monnaie (graines 🌱). **État initial : 0**, `isPremium: false`. `spendSeeds(amount)` : utilisé par la plantation de l'Herbier (`plantTreeCard`) depuis le Lot 7.
- `currentLevel` — selon `PROGRESSION_V2` : étoiles (`computeLevelProgress`) ou `computePlayerLevel(completedChallenges.length)`
- `completedChallenges: string[]` — IDs des défis solo gagnés
- **Progression v2 (Lot 1)** : `progressionVersion`, `challengeStars: Record<id, 1|2|3>` (meilleure note), `levelsCompleted`, `pendingCeremonies`, `seenCeremonies`, `newFeatureBadges`, `unlockedMusicIds`, compteurs de trophées `starStreak` / `quickFirstWins` / `improvedStarChallengeIds` / `loyaltyStreak`. Actions : `recordSoloStars(...)` (avant `markChallengeCompleted`), `resetProgression()` (remise à zéro locale, C9), `grantChapterRewards()` (Lot 3), `enqueueCeremonies()` / `markCeremonySeen(id)` / `clearNewFeatureBadge(tile)` (Lot 4). `restoreFromCloud` fusionne `challengeStars` par max.
- `restoreFromCloud(profile)` — union intelligente local+cloud (ne jamais écraser les badges locaux sur profil non vierge)
- `awardBadges(ids[])` — un seul `set()` pour N badges (zéro re-render intermédiaire) ; `awardBadge()` existe mais ne pas l'utiliser en boucle
- `markChallengeCompleted(id, timeMs, failCount, elementChangeCount = 0, bonusUsedCount = 0)` — `failCount` = nb d'échecs de validation pendant la partie (pas le nombre de cases fausses) ; met à jour stats et `currentLevel`
- `checkDailyLogin()` → retourne true si première connexion du jour → `addSeeds(3)` dans `(tabs)/_layout.tsx`
- `onfSolvedCount` — compteur unifié de grilles ONF résolues (ne fait PAS progresser `currentLevel`) ; `incrementOnfSolved()` / `recordOnfVictory(challengeId, failCount, elapsedMs)` après victoire ONF (jamais `markChallengeCompleted`)
- `completedOnfChallengeIds`, `hasSeenOnfBriefing`, `onfDailyCount` / `lastOnfDailyDate` (limite quotidienne ONF)
- `collectedTreeCardIds: number[]` — cartes de l'Herbier, **source de vérité** (Lot 7). Actions : `collectTreeCard`, `plantTreeCard`, `grantChapterCards`, `grantOnfCard`
- `dailyChallengeStatus` / `lastDailyChallengeDate` / `dailyChallengeStreak` / `submitDailyResult` / `resetDailyStatus` / `recordDailyVictory`
- `dailyBonusUses`, `adViews` — bonus quotidiens et pubs regardées aujourd'hui par emplacement (recharges de bonus, Forêt commune ; persistés et synchronisés ; `rolloverDailyLimits()` change de jour ; `claimAdReward(placement)` compte une pub regardée, sans jamais verser de graines)
- `friendChallengeTokens`, `challengedFriendIds`, `recordDuelResults` (Lot D : compte les défis terminés, idempotent), `recordFriendChallenged`
- `unlockPremium()` — appelé par `PremiumCard` à l'achat ; `logout()` remet seeds/badges/… à zéro côté local

**Trophées (Lot 8)** : plus d'objectifs actifs. Compteurs : `bestStarStreak`, `loyaltyBest`, `dailyPodium` (+ `starStreak`, `quickFirstWins`, `improvedStarChallengeIds` du Lot 1). Actions : `awardBadges(ids[])` (un seul `set()`, verse les graines par rareté), `recordDailyPodium(rank, total)`, `syncUnlockedMusic()`. L'évaluation passe par `src/services/trophyService.ts`.

**Persistance** : `useStorage.ts` sérialise le store dans AsyncStorage (`dlf_player_v1`) ; `playerService.ts` synchronise Firestore (`/players/{uid}`) ; `migrateProfile(raw)` normalise un profil Firestore (valeurs par défaut, anciens champs).

### audioStore
- `ingameEnabled` / `menuEnabled` — son pendant le jeu / dans les menus
- `selectedIngameTrackId` / `selectedMenuTrackId`, `ownedTrackIds`, `previewTrackId`
- `userHasInteracted` — requis sur web avant toute lecture audio
- `signalUserInteraction()` — déclenché par premier clic/toucher (géré dans `app/_layout.tsx`)
- `pendingMusicUnlockTrackId` / `dismissMusicUnlock` — alimente `MusicUnlockModal`

### rewardFlyStore (Lot 2 — remplace `seedAnimStore`)
Positions des compteurs ⭐ / 🌱 du bandeau (`counters`, alimentées par `ForestFrame`), `triggerFly(target, fromX, fromY, count)` / `clearFly`, et `pulses` / `requestPulse(target)` (le compteur du bandeau rebondit à chaque impulsion). Cible `'seeds' | 'stars'`. Les modales (`VictoryModal`, `RankUpModal`, `DailyRouletteModal`, `friend-challenge`) utilisent `RewardFly` avec des coordonnées locales vers LEUR compteur ; `badges/*` n'en dépendent pas.
### navStore / challengeStore
`navStore` : bouton retour contextuel du cadre, `pendingFriendChallenges`. `challengeStore` : défis amis actifs/terminés/en cours.

---

## Flux de jeu (GameScreen — `app/game/[challengeId].tsx`)

1. `useLocalSearchParams` → `challengeId`
2. `game.loadChallenge(found)` — charge le défi
3. Briefing modal (`LevelBriefingModal`) si `challengeNumber === 1` (réouvrable via le bouton « ? »)
4. `game.startTimer()` après fermeture du briefing (immédiat pour les défis 2+)
5. Pose des jetons : tap sur un jeton de la palette (`ElementPalette`) puis tap sur une case (`BoardRenderer`)
6. Bouton **Valider** → `game.validateChallenge()` → `VictoryModal` ou `FailModal` (échec = `failCountForGameRef` incrémenté)
7. Victoire → `useEffect(isVictory)` (garde `badgesEvaluatedRef`) :
   - capture de `bestTimes`, `sameChallengePlays`, `completedChallenges` AVANT mise à jour
   - `player.recordSoloStars(...)` (étoiles, meilleure note, niveau) **puis** `player.markChallengeCompleted()` + `player.addSeeds(seedsEarned)` — `seedsEarned` vient de `soloOutcome` : `computeSoloSeeds` si `PROGRESSION_V2`, sinon `calculateSeedReward` à chaque victoire
   - détection du run parfait (`isPerfectRun`) → PERFECT ×2 (`PROGRESSION_V2` : ⭐⭐⭐ à la 1re victoire seulement)
   - sync Firestore des étoiles : `updateSoloProgression` (`challengeStars`, `levelsCompleted`, compteurs)
   - `awardEarnedTrophies(...)` (`trophyService`) : séries, surprises et trophée final en UN SEUL `awardBadges` → file `BadgeToast` ; `computeNextTrophies` alimente les « prochains trophées » de la `VictoryModal`
   - `player.grantChapterRewards()` : graines de fin de chapitre (`PROGRESSION_V2`), exclues du gain animé de la `VictoryModal`
   - Sync Firestore en arrière-plan (markCompleted, updateSeeds, awardBadgesFirestore, upsertLeaderboardEntry)
   - `trySetWorldRecord()` → badges WR si record battu
8. « Défi suivant » → `niveau_N_(challengeNumber+1)` ou premier défi du niveau suivant (`PROGRESSION_V2` : `getNextAfterWin`, voir Lot 2)

---

## Authentification

- Firebase Auth : email/password + Google (web popup) + anonyme
- **Garde** : utilisateur non connecté → redirigé vers `/(tabs)/profile`
- Non connecté = accès limité à l'onglet Profil uniquement
- Profil Firestore sur `/players/{uid}`
- `onAuthChange` : un seul abonnement dans `(tabs)/_layout.tsx` → `player.setAuthState()`
- Collections Firestore utilisées : `players`, `leaderboard`, `worldRecords`, `dailyChallenges/{date}_{ligue}/results/{uid}`, `friendChallenges`, `jackpot/daily`, `jackpotClaims`, `metrics`, `foret_commune/global`

---

## Système de trophées (75 trophées)

Voir « Progression v2 — trophées et musiques (Lot 8) » en tête de ce fichier : catalogue, moteur, compteurs, musiques.

Raretés (nombre) : bois 15 (5🌱), pierre 15 (15🌱), or 15 (30🌱), cristal 15 + surprises (75🌱). Les graines sont versées par `awardBadges` d'après la rareté (`BADGE_SEED_REWARDS`) ; la rareté d'un trophée de série est son palier.

**Rang forestier** : ce n'est plus un score. Depuis la Progression v2 (Lot 3), le rang est le **chapitre en cours** (`getRankForLevel`, `progression.ts`) : Promeneur (ch. 1) → Bûcheron → Sylviculteur → Garde Forestier → Technicien Planète Urgence → Ingénieur des Forêts → Esprit de la Forêt (ch. 7). Les trophées ne comptent plus dans le rang ; les graines de rang sont remplacées par les graines de fin de chapitre (voir « Système de récompenses en graines »).

### Musiques (`src/constants/music.ts`, `musicUnlocks.ts`)
`MUSIC_CATALOG` : **14 titres** (types `menu` / `ingame`). **2 gratuits** (`manor_cocktail`, `foret_mystique`), **7 débloqués par la fin d'un chapitre**, **5 débloqués par le palier « pierre » d'une série** :

| Titre | Déblocage |
|---|---|
| forest_breath | fin du chapitre 1 |
| jardin_japonais | fin du chapitre 2 |
| pulsation_douce | fin du chapitre 3 |
| woodland_pulse | fin du chapitre 4 |
| deep_sub_pulse | fin du chapitre 5 |
| neo_classical_motivation | fin du chapitre 6 |
| elek | fin du chapitre 7 |
| swaying_groove | trophée `rendez_vous_2` (Rendez-vous) |
| boucle_hypnotique | trophée `grilles_2` (Grilles résolues) |
| lilting_swing | trophée `duel_2` (Duel) |
| moonlit_beach_shuffle | trophée `botaniste_2` (Botaniste) |
| sun_warmed_groove | trophée `habitue_2` (Habitué) |

`MusicUnlockModal` annonce le déblocage (`audioStore.pendingMusicUnlockTrackId`).

---

## Système de bonus (2 bonus)

| id | Limite | Comportement |
|---|---|---|
| reveal_cell | 3/jour (∞ premium) | Révèle la solution d'une case 5 s — le joueur tape une case, la solution s'affiche en surbrillance dorée puis la case se vide. Palette non-sélectionnable pendant l'attente de sélection. |
| instinct | 3/jour (∞ premium) | Révèle les cases mal placées en rouge pendant 5 s. Nécessite au moins un élément posé. |

**UX modale bonus :** au clic sur un bouton bonus, une modale d'explication s'affiche toujours :
- Bouton **"Compris !"** — ferme sans activer.
- Bouton **"Activer !"** — visible uniquement si les conditions sont remplies (pas de cooldown, pas épuisé, condition contextuelle OK). Active le bonus.

**Recharge via pub (joueur gratuit uniquement)** : voir « Pubs volontaires » en tête de ce fichier.
- **Chaque bonus** à 0 affiche SA propre icône 🎬 (fond violet pointillé) à la place du compteur, sans attendre l'autre bonus. La pub ne recharge que CE bonus (retour à 3 utilisations).
- **Plafond : 3 recharges par bonus et par jour** (6 pubs au plus), compté dans `playerStore.adViews` (`bonus_reveal_cell`, `bonus_instinct`).
- Non accessible si `isPremium` (bonus déjà illimités) ou `bonusDisabled` (niveaux 15, 18, 21 ; aucun bonus dans le Journalier ni le Forestier).
- Props dans `HintOverlay` : `adRemaining` (`Partial<Record<BonusId, number>>`) + `onWatchAd(bonusId)`. L'écran `[challengeId].tsx` appelle `useRewardedAd('bonus_reveal_cell' | 'bonus_instinct')`.
- Un bonus utilisé empêche ⭐⭐⭐ (⭐⭐ au mieux), retire 2 graines et interdit le record du monde.

**Canal reveal dans gameStore :**
- `revealActive` — true = en attente de sélection d'une case par le joueur
- `revealCellIndex` — index de la case révélée
- `revealElementId` — élément de la solution affiché
- `displayBoard` — calculé dans `[challengeId].tsx` : playerBoard + revealElementId sur revealCellIndex

Niveaux 15, 18 et 21 : `bonusDisabled = LEVEL_PARAMS[level].bonusDisabled = true` → aucun bonus utilisable.

---

## i18n

```ts
const t = useT()
t('btn_play')                          // "Jouer" ou "Play"
t('a11y_no_same', { element: 'ours' }) // interpolation {{element}}
```
Langue stockée dans `playerStore.language` (détectée via `getSystemLocale()`).
Fichiers : `src/i18n/locales/fr.json` et `en.json`.
Signature : `useT(): (key: string, vars?: Record<string, string>) => string` — les valeurs d'interpolation doivent être des **strings** (`String(n)`).

**Règle obligatoire — tout texte UI doit être traduit :**
- Tout nouveau texte affiché à l'écran doit avoir une entrée dans **les deux fichiers** : `fr.json` ET `en.json`.
- Ne jamais hardcoder un texte visible dans un composant React. Toujours passer par `t('clé')`.
- Lors de l'ajout ou de la modification d'une clé, mettre à jour `fr.json` ET `en.json` dans le même commit/modification.
- Les clés manquantes dans `en.json` sont considérées comme des bugs.

---

## Génération de défis

```bash
npm run generate        # génère tous les niveaux (21)
npm run regenerate      # régénère avec nouveaux paramètres
npm run generate:onf    # régénère les 130 grilles ONF 4×4 par paliers (src/data/onf_challenges.json ; déterministe)
npm run generate:viewer # données pour le viewer
```

Le générateur (`challengeGenerator.ts`) garantit :
- Solution unique vérifiée par le solveur backtracking
- Diversité structurelle (signature des cases fixes, signature de solution complète)
- Validité pédagogique (relations entre éléments liés visibles du joueur)
- Tension narrative (loup ↔ mouton, chalet ↔ bucheron)

---

## Invariants composition (difficulty.ts)

| Code | Règle |
|---|---|
| I1 | Σ éléments = cellCount |
| I2 | ruche ≤ 1 |
| I3 | ours ≥ 1 si ruche = 1 |
| I3b | si ruche = 1, ours ≤ 3 (limité par topologie) |
| I4 | chien ≥ 2 si chien > 0 |
| I5 | cerf = biche (quantité) |
| I6 | bucheron ≥ chalet si les deux présents |
| I7 | bucheron ≥ 1 si tas_buches > 0 |
| I8 | champignon ≤ 3 et `center_only` |
| I9 | arbre ≥ 2 si arbre > 0 |

---

## Conventions de code

- **Règles de jeu** : déclarées dans `ElementDefinition.constraints` — jamais en dur dans le moteur
- **Ajouter un élément** : créer `src/elements/monElement.ts` + une ligne dans `ElementRegistry.ts`
- **Ajouter un plateau** : créer `src/boards/board_Xcells_vY.ts` + une ligne dans `BoardRegistry.ts`
- **Stores** : `usePlayerStore.getState()` pour lire hors composant React (ex: dans `useEffect` après mise à jour)
- **Badges / trophées** : toujours `awardBadges(ids[])` (batch), jamais `awardBadge()` en boucle ; passer par `awardEarnedTrophies()` (`trophyService`)
- **Validation victoire** : comparaison directe `playerBoard[i] === solution[i]`, pas de `validateBoard()`
- **Timer** : ne démarre qu'après fermeture du briefing (`startTimer()` dans `handleBriefingClose`)
- **Audio web** : nécessite `userHasInteracted = true` avant lecture. Géré dans `app/_layout.tsx`.
- **SafeArea** : utiliser `useSafeAreaInsets()` — pas de `SafeAreaView` Expo (dépréciée v57)
- **Animations** (Progression v2) : tout NOUVEAU composant utilise `react-native-reanimated` ; ne pas migrer les composants existants hors des lots prévus ; respecter `AccessibilityInfo.isReduceMotionEnabled()`
- **Contournements dev** : à centraliser dans un seul helper (Lot 1+), ne plus en ajouter en dur

---

## Fichiers à ne PAS modifier directement

- `src/data/challenges/niveau_*.json` → régénérer via `npm run generate`
- `src/data/onf_challenges.json` → régénérer via `npm run generate:onf`
- `.kilo/` → config Kilo (exception : ce fichier `rules/architecture.md`, modification autorisée par l'utilisateur)
- `AGENTS.md`
- `assets/` → assets statiques (images, musiques)

---

## Mode Planète Urgence — Forestier (« Défi de la forêt », « Sudoku Forestier »)

**Nom affiché au joueur : « Défi de la forêt »** (fr) / « Forest Challenge » (en) partout (lobby, briefing, Règles). Les anciens libellés « Grille Forestière » / « Forest Grid » n'existent plus dans les textes visibles.

- **Écrans** : `app/game/onf-lobby.tsx` (lobby) puis `app/game/onf.tsx` (partie) — UI : « Défi de la forêt » (bouton d'accueil `index_onf_btn`) / « Planète Urgence ». Le lobby affiche le palier en cours et sa progression, puis pousse `/game/onf` : le défi vient de `pickOnfChallenge` selon les paliers ouverts (plateau `challenge.boardId`).
- **Mécanique** : grille 4×4 orthogonale + règles de voisinage standard + contrainte `row_col_unique` (max 1 élément identique par ligne ET par colonne). Elle impose au moins 4 types d'éléments : le chien est impossible.
- **Grilles** : **4×4 uniquement**, **130 grilles pré-générées** (`src/data/onf_challenges.json`, ids `onf_4x4_001…130`, `boardId: 'board_4x4_onf'`, champ `tier`) produites par `scripts/generateOnfChallenges.ts` (`npm run generate:onf`, déterministe : PRNG à graine, date figée). **Sentier** : 30 grilles, `{bucheron:4, ours:4, mouton:4, loup:4}`, de 8 à 5 cases fixées (la règle loup/mouton est nécessaire dès 6). **Clairière** : 65 grilles, ruche et/ou cerf/biche, sans champignon, 5 cases fixées. **Profonde** : 35 grilles avec champignon, 5 cases fixées. Chaque grille a une solution UNIQUE vérifiée par `solveOnf` (et re-vérifiée par `__tests__/onfChallenges.test.ts`).
- **Sélection** : `pickOnfChallenge(completedIds, unlockedTiers)` (`onfChallengeService.ts`, logique pure dans `onfTiers.ts` : `selectOnfChallenge`) — filtre sur les paliers ouverts et joue dans le palier ouvert LE PLUS ÉLEVÉ qui reste (Sentier : dans l'ordre de difficulté ; autres : au hasard). `tierExhausted = true` quand les paliers ouverts sont épuisés alors que d'autres restent verrouillés (écran « palier terminé : avance en solo ») ; `allCompleted = true` quand tout est terminé.
- **Progression** : `isFeatureAvailable('onf_sentier')` → débloqué (fin du chapitre 2 avec `PROGRESSION_V2`, sinon `currentLevel >= 14` ; compte `planete` exempté). Aucun lien avec le 3×3, qui n'existe plus côté jeu.
- **Limite quotidienne** : utilise le quota global de `FREE_DAILY_CHALLENGE_LIMIT` ; voir « Limites quotidiennes du joueur gratuit (Lot A) ». Chaque nouvelle grille Forestier consomme une partie au chargement.
- **Solveur** : `solveOnf()` dans `solver.ts` — backtracking + élagage ligne/colonne via `isPlacementValidOnf()` (utilisé par le script de génération, plus à l'exécution)
- **Validation** : bouton Valider → `validateBoard()` + `validateRowColUnique()` (union violations) ; victoire = `checkVictory()` seul (solution pré-calculée satisfait déjà la contrainte)
- **Récompense** : `calculateOnfReward(elapsedMs, onfSolvedCount)` → 10 graines de base, +5 toutes les 10 grilles résolues (tous paliers cumulés), +2 si résolu en < 120 s. L'écran affiche le montant courant et le prochain palier.
- **Affichage contrainte** : surlignage ligne/colonne — `getCellColorOnf` dans `onf.tsx` calcule les cases à fond jaune depuis `gridMeta`
- **Éléments exclus** : `chien` (connected_group + sudoku impossible). Le champignon apparaît dans certaines compositions de la famille C (le plateau 4×4 a `specialCells.center = [5,6,9,10]`).
- **Briefing** : `OnfBriefingModal` affiché à la première partie (`hasSeenOnfBriefing`, `markOnfBriefingSeen`).
- **Constantes** : `src/constants/onf.ts` — `ONF_CARD_UNLOCK_EVERY = 5` ; paliers et sélection : `src/constants/onfTiers.ts` (voir « Forestier à paliers (Lot 5) »).
- **Herbier** : voir section dédiée ; une carte gratuite toutes les 5 grilles (`grantOnfCard`, `ONFCardUnlockBanner` dans `onf.tsx`).
- **Pas de Firestore spécifique** : pas de collection dédiée ONF ; seeds synchées via le flux standard ; compteur unifié `onfSolvedCount` dans `PlayerProfile` (était `onf4x4SolvedCount` — migré via `migrateProfile`)

---

## Défi du Jour (daily challenge)

- **Écran** : `app/game/daily.tsx` — 15 cases, 1 seule validation, aucun bonus
- **Déblocage** : ligue Pousse à la fin du chapitre 3, Grand Chêne à la fin du chapitre 4 (`isFeatureAvailable`, voir « Progression v2 — Journalier en 2 ligues (Lot 6) ») ; sans `PROGRESSION_V2`, `currentLevel >= 9`
- **Briefing** : `src/components/LevelBriefing/DailyBriefingModal.tsx` — 3 pages (champignon, voisinage, récap avec la ligue)
- **Génération** : `src/services/dailyChallengeService.ts` — PRNG déterministe (mulberry32, seed = date UTC + sel de ligue), **16 compositions en 7 familles** (A…G, toutes avec champignon ; C/D/E contiennent chalet et/ou tas_buches, donc réservées au Grand Chêne), solver backtracking, `baseFixedCount` minimal pour l'unicité, validation pédagogique/narrative
- **Plateau** : `src/boards/board_15cells_daily.ts` — 15 cases, specialCells.center = [3,4,7,10,11]
- **Élément exclusif** : `champignon` (center_only, ≠ voisin champignon, max 2 sur board_15_daily)
- **Uniqueness** : `fixedOrder` du générateur ; `getDailyFixedPlacements(league, dailyChallenge)` prend les N premiers (superset preserves uniqueness)
- **Cases fixes par ligue** : Pousse 6, Grand Chêne 5, toujours ≥ `baseFixedCount` ; identiques pour tous les joueurs d'une ligue, indépendantes du niveau du joueur
- **Firestore** : `dailyChallenges/{date}_{ligue}/results/{uid}` (write-once : `userId`, `username`, `timeMs`, `playerLevel`, `league`, `completedAt`) via `submitDailyResult()` ; `getDailyStatus`, `subscribeDailyLeaderboard`, `sealDailyRecord` ; un classement par ligue et par date
- **Récompense** : `calculateDailyReward(rank, totalParticipants, dailyStreak)` (voir Système de récompenses)
- **Roulette / jackpot** : `DailyRouletteModal` + `jackpotService`
- **État** : `playerStore.dailyChallengeStatus` / `lastDailyChallengeDate` / `dailyChallengeStreak` / `longestDailyChallengeStreak` + `gameStore.dailyValidationUsed`
- **Reset** : `playerStore.resetDailyStatus()` — utilisé par le bouton « Rejouer » (↺, visible uniquement pour `username === 'Ramoni'`) dans `index.tsx`
- **Viewer** : `VIEWER_DEFIS.html` + `VIEWER_DATA.js` — mode Classic/Daily, bouton "Régénérer" (solver embarqué en JS pur), `scripts/generateViewerData.ts`

---

## Herbier (cartes d'arbres)

Voir « Progression v2 — Herbier (Lot 7) » en tête de ce fichier pour le détail (données, régions, store, interface).

- **Données** : `TREES_DATA` (143 cartes, IDs 1-143, images dans `assets/trees/` via `TREE_IMAGES`). Chaque `TreeCard` : `name_fr/en`, `name_latin`, `geo_location(_en)`, `anecdote(_en)`, `region`, `image_type?`, `photographer?`, `license?`.
- **Source de vérité des cartes possédées** : `collectedTreeCardIds` (playerStore), synchronisé au profil Firestore (`updateCollectedCards`, `buildSoloProgressionPayload`).
- **Obtenir une carte** : planter (`plantTreeCard`, `30 + 5 × floor(n / 10)` graines, région ouverte), carte de fin de chapitre (`grantChapterCards`), carte gratuite toutes les 5 grilles du Forestier (`grantOnfCard`).
- **UI** : `TreeCardGallery` (onglets collection / planter), `TreeCardView` (carte, variante `mini`/`locked`, repli emoji sans image), `ONFCardUnlockBanner` (bandeau par-dessus la VictoryModal ONF), `HerbierEntry` (accueil).

## Onglet Règles

- **Écran** : `app/(tabs)/rules.tsx` — 📖 dans la tab bar
- **Contenu** : **12 éléments** dans l'ordre d'apparition (bucheron → ours → mouton → chien → loup → ruche → cerf → biche → tas_buches → chalet → champignon → arbre), avec `introLevel` 1, 1, 1, 3, 5, 7, 9, 9, 11, 12, 17, 19
- **Débloqué** (`currentLevel >= introLevel`) : icône + nom + animations `RuleCard` du briefing (fond forêt sombre)
- **Verrouillé** : icône grisée + nom grisé + "???" + "Débloqué au niveau X"
- **RuleCards** : mapping explicite par `ruleIds` → index dans `ALL_RULES_BY_ID` (collecté depuis `LEVEL_META`)
- **Pédagogie** : niveau 11 = `chain_tas_buches` (bûcheron→bûches seulement), niveau 12 = `chain_tas_buches_chalet` (bûches→chalet conditionnel) — chaîne séparée en 2 slides
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
Select-String -Path "app\(tabs)\*.tsx","app\game\*.tsx","src\components\**\*.tsx" -Pattern '\\u[0-9a-fA-F]{4}'
```

---

## Système de récompenses en graines

Les graines sont la monnaie du jeu (🌱, `playerStore.seeds`). Chaque mode de jeu a sa propre formule, calculée à la victoire. Elles se dépensent uniquement dans l'Herbier (plantation d'une carte, Lot 7).

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

**`PROGRESSION_V2 = false` (ancien système)** : la récompense est versée à **chaque victoire**, y compris sur un défi déjà gagné (rejouer rapporte des graines indéfiniment).
**`PROGRESSION_V2 = true`** (`computeSoloSeeds`) : `calculateSeedReward` à la **première** victoire seulement ; un défi rejoué rapporte **5 🌱 par NOUVELLE étoile** (`SEEDS_PER_NEW_STAR`), sinon 0 ; pas de PERFECT ×2 en rejeu.

### Mode solo — PERFECT x2 (`app/game/[challengeId].tsx`, `VictoryModal.onPerfectBonusCollected`)

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
// calculateOnfReward(elapsedMs, onfSolvedCount) — grille 4×4
const base = 10 + 5 * Math.floor(onfSolvedCount / 10);
return base + (elapsedMs < 120_000 ? 2 : 0);
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

### Fin de chapitre (`playerStore.grantChapterRewards`, Lot 3)

`PROGRESSION_V2 = true` : à la fin de chaque chapitre, une seule fois (`rewardedChapters`) : **10 / 25 / 50 / 100 / 200 / 500** graines (aucune au chapitre 7). Remplace les anciennes graines de rang (`RANK_SEED_REWARDS`, supprimées). Voir « Progression v2 — chapitres et déblocages (Lot 3) ».

---

## Notion de Perfect

### Définition — Run Parfait (mode solo uniquement)

**Fichier :** `app/game/[challengeId].tsx` (`isPerfect`, ~l.381-388) ; le même calcul est refait dans `playerStore.markChallengeCompleted` pour le compteur `precision_parfaite`.

Un run est parfait si **4 critères cumulatifs** sont vrais au moment de la victoire :

| Critère | Champ | Détail |
|---|---|---|
| Aucun jeton posé déplacé/retiré/remplacé | `game.elementChangeCount === 0` | Incrémenté dans `gameStore` à chaque `moveElement` / `removeElement` / `placeAndDeselect` sur case occupée. La pose initiale sur une case vide ne compte pas. |
| Aucune validation ratée pendant la partie | `failsDuringGame === 0` | `failsDuringGame` = nb de fois où Valider a renvoyé `status: 'failure'`. Différent de `errorCount` (nb de cases fausses dans la grille). |
| Jamais abandonné ce défi par le passé | `abandonCountForChallenge === 0` | Lu dans `stats.abandonCount[challengeId]` **avant** `markChallengeCompleted`. (Critère supprimé par la Progression v2.) |
| Aucun bonus utilisé | `game.bonusUsed.length === 0` | Les **2** bonus (`reveal_cell`, `instinct`) sont bloquants. |

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

Le daily n'autorise qu'**une seule pression sur Valider**. Toute victoire est parfaite par construction : `stats.dailyPerfectCount` est toujours incrémenté dans `recordDailyVictory` (`playerStore.ts`).

### onfPerfect — Mode ONF

Condition : grille **jamais complétée** auparavant ET `failCount === 0`. Incrémente `stats.onfPerfectCount` (`recordOnfVictory`, `playerStore.ts`).

### Trophées liés au Perfect

Le Perfect nourrit désormais les séries **Main sûre** (défis à ⭐⭐⭐ : `countThreeStarChallenges`) et **Sans faute** du Forestier (`stats.onfPerfectCount`). Le critère « jamais abandonné » n'existe plus ; le détail des étoiles est dans « Progression v2 — fondations (Lot 1) ».

Sources : `src/constants/trophies.ts` (séries) + `src/constants/trophyEngine.ts` (compteurs).

---

## État de la qualité

**Après la purge des comptes inactifs (2 ans, premium exclus) et la mise à jour des textes légaux (vidéos AppLovin)** : `npx tsc --noEmit` sans erreur ; `npm test` vert (27 suites, 982 tests).

**Après le lot RGPD / stores (suppression de compte, pages légales)** : `npx tsc --noEmit` sans erreur ; `npm test` vert (26 suites, 962 tests).

**Après le renommage « Défi de la forêt », les dialogues de l'app et la recharge du quota par vidéo** : `npx tsc --noEmit` sans erreur ; `npm test` vert (25 suites, 943 tests).

**Après le passage aux pommes de pin** : `npx tsc --noEmit` sans erreur ; `npm test` vert (24 suites, 922 tests).

**Après le recentrage des pubs (bonus + Forêt commune)** : `npx tsc --noEmit` sans erreur ; `npm test` vert (24 suites, 930 tests).

**Fin du Lot D (statistiques)** : `npx tsc --noEmit` sans erreur ; `npm test` vert (24 suites, 940 tests), avec `PROGRESSION_V2` à `false` ET à `true`.

**Fin du Lot C (classements)** : `npx tsc --noEmit` sans erreur ; `npm test` vert (23 suites, 877 tests), avec `PROGRESSION_V2` à `false` ET à `true`.

**Fin du Lot B (pubs récompensées)** : `npx tsc --noEmit` sans erreur ; `npm test` vert (22 suites, 832 tests), avec `PROGRESSION_V2` à `false` ET à `true`.

**Fin du Lot A (limites quotidiennes)** : `npx tsc --noEmit` sans erreur ; `npm test` vert (21 suites, 786 tests), avec `PROGRESSION_V2` à `false` ET à `true`.

**Fin du Lot 8** : `npx tsc --noEmit` sans erreur ; `npm test` vert (18 suites, 682 tests), avec `PROGRESSION_V2` à `false` ET à `true`.

**Fin du Lot 7** : `npx tsc --noEmit` sans erreur ; `npm test` vert (15 suites, 563 tests), avec `PROGRESSION_V2` à `false` ET à `true`.

**Fin du Lot 6** : `npx tsc --noEmit` sans erreur ; `npm test` vert (14 suites, 485 tests), avec `PROGRESSION_V2` à `false` ET à `true`.

**Fin du Lot 5** : `npx tsc --noEmit` sans erreur ; `npm test` vert (12 suites, 429 tests), avec `PROGRESSION_V2` à `false` ET à `true`.

**Fin du Lot 4** : `npx tsc --noEmit` sans erreur ; `npm test` vert (10 suites, 357 tests), avec `PROGRESSION_V2` à `false` ET à `true`.

**Fin du Lot 3** : `npx tsc --noEmit` sans erreur ; `npm test` vert (9 suites, 289 tests), avec `PROGRESSION_V2` à `false` ET à `true`.

**Fin du Lot 2** : `npx tsc --noEmit` sans erreur ; `npm test` vert (8 suites, 235 tests), avec `PROGRESSION_V2` à `false` ET à `true`.

**Fin du Lot 1** : `npx tsc --noEmit` sans erreur ; `npm test` vert (6 suites, 154 tests).

Corrections apportées au Lot 1 (baseline du Lot 0 : 6 erreurs `tsc`, 3 suites Jest en échec) :
- `friend-challenge.tsx` : type de `t` aligné sur `useT()` (`vars?: Record<string, string>`) ; `AdminCleanModal.tsx` : styles `headerRight` / `refreshBtn` / `refreshBtnText` ajoutés ; `ElementChips.tsx` : `icon` de type `string` converti en `{ uri }`.
- Jest : `moduleNameMapper` des images / sons vers `__mocks__/fileMock.js` (`solver` et `validator` tournent à nouveau) ; test Loup de `hintEngine` corrigé (clé `Loup` → `loup`) ; test « solution unique » de `solver` remplacé par un défi réel (`niveau_12_001`) — l'ancien utilisait des éléments du temps du renard et n'avait plus de solution unique.

---
## TODOs avant publication

```ts
// L'état initial est déjà conforme : seeds: 0 (le TODO historique « 99 → 3 » est obsolète),
// isPremium: false. Remise à zéro v2 (C9) : seeds = 3 à la création/réinitialisation du profil.
```

- **Fait** : relecture des textes EN (cartes « monde » : anecdote du cerisier du Japon réécrite ; trophées : « Appointment » devenu « Rendezvous »). Le catalogue Herbier comporte 143 cartes illustrées et classées par région.
- **Reste à faire, décision de l'utilisateur** : la purge Firestore n'est exécutée qu'en dry-run (`PURGE_EMAIL` / `PURGE_PASSWORD` non fournis dans l'environnement) ; les contournements dev sont conservés tant que les tests sur appareil ne sont pas finis ; les règles Firestore du Journalier (`docs/daily-leagues-firestore.md`) sont à vérifier dans la console.
- Retirer ou vider les contournements développeur de `src/constants/devAccess.ts` (comptes `planete`, `Cedric`, `Ramoni` : déblocages, « Rejouer » du daily, outils admin) avant publication.
- Progression v2 : voir `docs/progression-v2.md` (remise à zéro `progressionVersion: 2`, `isPremium` remis à zéro uniquement parce que les testeurs n'ont pas payé — en production un achat ne doit jamais être remis à zéro).
