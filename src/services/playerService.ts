// ============================================================
// PLAYER SERVICE — CRUD profils joueurs dans Firestore
// Collection : /players/{userId}
// ============================================================

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  collection,
  query,
  where,
  getDocs,
  limit,
  increment,
} from 'firebase/firestore';
import { db } from './firebase';
import {
  computeLegacyLevel,
  computeLevelProgress,
  mergeChallengeStars,
  mergeRewardedChapters,
} from '../constants/progression';
import {
  buildFirestoreResetPayload,
  createDefaultProgressionFields,
  readLotDStats,
} from '../constants/profileDefaults';
import { mergeCeremonyIds } from '../constants/ceremonies';
import { DailyLimits, extractDailyLimits, sanitizeDailyLimits } from '../constants/dailyLimits';

export interface PlayerProfile {
  userId: string;
  username: string;
  seeds: number;
  completedChallenges: string[];
  stats: {
    totalSolved: number;
    currentStreak: number;
    longestStreak: number;
    bestTimes: Record<string, number>;
    // ── Champs badges ───────────────────────────────────
    noErrorStreak: number;
    friendWins: number;
    totalFriendsInvited: number;
    topDEJCount: number;
    sameChallengePlays: Record<string, number>;
    failCount: Record<string, number>;
    improvedChallengesCount: number;
    seasonalChallengesPlayed: number;
    // ── Nouveaux champs statistiques (chantier 5) ──────
    dailyPlayed: number;
    dailyWon: number;
    friendPlayed: number;
    avgResolutionMs: number;
    totalResolutionCount: number;
    // ── Compteurs ONF et daily (refonte badges) ─────────
    abandonCount?: Record<string, number>;
    onfPerfectCount?: number;
    onfSpeedCount?: number;
    dailyPerfectCount?: number;
    dailySpeedCount?: number;
    // ── Statistiques du Lot D (cumulatifs ; fusionnés par maximum à la connexion) ──
    friendLosses?: number;
    friendBestWinStreak?: number;
    dailyPlayedPousse?: number;
    dailyWonPousse?: number;
    dailyPlayedGrandChene?: number;
    dailyWonGrandChene?: number;
    bestDailyTimeMsPousse?: number;
    bestDailyTimeMsGrandChene?: number;
    bestOnfTimeMs?: number;
    seedsEarned?: number;
    seedsSpent?: number;
    adsWatched?: number;
    daysPlayed?: number;
  };
  /** Défis entre amis déjà comptés dans les statistiques (un défi ne se compte qu'une fois, Lot D). */
  countedDuelIds?: string[];
  /** Série de victoires de Duel en cours (Lot D). */
  duelWinStreak?: number;
  isPremium: boolean;
  /**
   * Limites quotidiennes du joueur gratuit (Lot A) : grilles du Forestier jouées, jetons de Duel, bonus, recharge pub.
   * Stockées dans le profil pour qu'elles survivent à une déconnexion, une réinstallation ou un autre appareil.
   * `null` = jamais écrites (ancien profil) : le jour est alors considéré comme neuf.
   */
  dailyLimits?: DailyLimits | null;
  createdAt?: any;
  // ── Progression v2 (docs/progression-v2.md, section D) ──
  /** Version du modèle de progression. Absente ou < 2 → remise à zéro au prochain chargement (C9). */
  progressionVersion?: number;
  /** Meilleure note (1 à 3) par défi solo. Les étoiles ne baissent jamais. */
  challengeStars?: Record<string, 1 | 2 | 3>;
  /** Niveaux consécutifs validés depuis le niveau 1 (0 à 21). Dérivé de challengeStars, persisté pour l'affichage. */
  levelsCompleted?: number;
  /** File des cérémonies à rejouer (Lot 4). Ex. : chapter_1. */
  pendingCeremonies?: string[];
  /** Cérémonies déjà vues (Lot 4). */
  seenCeremonies?: string[];
  /** Chapitres dont la récompense de fin de chapitre a été versée (anti-doublon, Lot 3). */
  rewardedChapters?: number[];
  /** Chapitres dont la carte d'Herbier de fin de chapitre a été offerte (anti-doublon, Lot 7). */
  chapterCardsGranted?: number[];
  /** Fonctionnalités débloquées jamais ouvertes : pastille « Nouveau » (Lot 4). */
  newFeatureBadges?: string[];
  /** Titres musicaux débloqués. Source de vérité des musiques à partir du Lot 8. */
  unlockedMusicIds?: string[];
  // ── Compteurs de trophées (Lot 8) ──
  /** Victoires consécutives à ⭐⭐ ou plus (1re victoire seulement) — Œil de lynx. */
  starStreak?: number;
  /** Défis gagnés pour la 1re fois en moins de 50 % du temps estimé — Vif comme le vent. */
  quickFirstWins?: number;
  /** Défis distincts dont la note a été améliorée — Persévérant. */
  improvedStarChallengeIds?: string[];
  /** Jours joués d'affilée (hors défi du jour) — Habitué. Réservé au Lot 8. */
  loyaltyStreak?: number;
  /** Meilleure série de jours joués d'affilée (record, Habitué — Lot 8). */
  loyaltyBest?: number;
  /** Meilleure série de victoires ⭐⭐+ d'affilée (record, Œil de lynx — Lot 8). */
  bestStarStreak?: number;
  /** Podium du Journalier (inclusif), enregistré au moment de la partie (Lot 8). */
  dailyPodium?: { top10Percent: number; top3: number; first: number };

  updatedAt?: any;
  // ── Champs badges ────────────────────────────────────
  earnedBadges: string[];
  badgeShowcase: string[];   // max 3 IDs
  // ── Streak quotidien ─────────────────────────────────
  dailyStreak: number;
  lastPlayedDate: string;    // "YYYY-MM-DD"
  // ── Mode ONF — Grille Forestière 4×4 ────────────────
  onfSolvedCount: number;              // nb de grilles 4×4 résolues
  completedOnfChallengeIds: string[]; // IDs des défis ONF terminés (pour ne pas reproposer)
  // ── Herbier de la Forêt ──────────────────────────────
  collectedTreeCardIds?: number[];
  /** Cartes de l'Herbier déjà vues dans la collection (badge rouge « nouvelles cartes »). */
  seenTreeCardIds?: number[];
  // ── Sélection musicale personnalisée ────────────────
  selectedIngameTrackId?: string;
  selectedMenuTrackId?: string;
  // ── Métriques audio ─────────────────────────────────
  /** Nombre de fois que chaque piste a été lancée (trackId → count) */
  trackPlayCounts?: Record<string, number>;
  /** true si l'Ambiance Défi est activée (false = son coupé) */
  ingameAudioEnabled?: boolean;
  /** true si l'Ambiance Forêt est activée (false = son coupé) */
  menuAudioEnabled?: boolean;
}

// ── Calcul du niveau courant d'un joueur ──────────────────────────────────────
// Basé sur le nombre de défis solo complétés : 1 niveau par tranche de 10 défis.
// Chaque niveau du jeu contient 10 défis, donc :
//   Niveau 1 : 0–9 défis complétés
//   Niveau 2 : 10–19 défis complétés
//   Niveau N : (N-1)*10 … N*10-1
//   → formule : Math.floor(count / 10) + 1, plafonné à 21.
// Exemples : 0 défis → Niv. 1, 10 défis → Niv. 2, 42 défis → Niv. 5, 150 défis → Niv. 16, 210 défis → Niv. 21.
export function computePlayerLevel(completedCount: number): number {
  return computeLegacyLevel(completedCount);
}

// ── Résultat de recherche d'ami ───────────────────────────────────────────────
export interface PlayerSearchResult {
  userId: string;
  username: string;
  level: number;
}

// ── Migration silencieuse : garantit que tous les champs existent ─────────────
function migrateProfile(raw: any): PlayerProfile {
  // Les trophées remplacent les badges (Progression v2, C8). Le champ de stockage `earnedBadges` est conservé.
  const earnedBadges: string[] = raw.earnedBadges ?? [];

  return {
    userId:             raw.userId ?? '',
    username:           raw.username ?? 'Joueur',
    seeds:              raw.seeds ?? 0,
    completedChallenges: raw.completedChallenges ?? [],
    isPremium:          raw.isPremium ?? false,
    dailyLimits:        sanitizeDailyLimits(raw.dailyLimits),
    // ── Progression v2 : 0 = absent = profil pré-v2 (remis à zéro au chargement, C9).
    // Jamais undefined : Firestore refuse les valeurs undefined dans setDoc.
    progressionVersion:       typeof raw.progressionVersion === 'number' ? raw.progressionVersion : 0,
    challengeStars:           mergeChallengeStars(raw.challengeStars, undefined),
    levelsCompleted:          computeLevelProgress(raw.challengeStars).levelsCompleted,
    pendingCeremonies:        mergeCeremonyIds(raw.pendingCeremonies, undefined),
    seenCeremonies:           mergeCeremonyIds(raw.seenCeremonies, undefined),
    rewardedChapters:         mergeRewardedChapters(raw.rewardedChapters, undefined),
    chapterCardsGranted:      mergeRewardedChapters(raw.chapterCardsGranted, undefined),
    newFeatureBadges:         raw.newFeatureBadges ?? [],
    unlockedMusicIds:         raw.unlockedMusicIds ?? [],
    starStreak:               raw.starStreak ?? 0,
    quickFirstWins:           raw.quickFirstWins ?? 0,
    improvedStarChallengeIds: raw.improvedStarChallengeIds ?? [],
    loyaltyStreak:            raw.loyaltyStreak ?? 0,
    loyaltyBest:              Math.max(raw.loyaltyBest ?? 0, raw.loyaltyStreak ?? 0),
    bestStarStreak:           Math.max(raw.bestStarStreak ?? 0, raw.starStreak ?? 0),
    dailyPodium:              { top10Percent: raw.dailyPodium?.top10Percent ?? 0, top3: raw.dailyPodium?.top3 ?? 0, first: raw.dailyPodium?.first ?? 0 },
    createdAt:          raw.createdAt,
    updatedAt:          raw.updatedAt,
    stats: {
      totalSolved:            raw.stats?.totalSolved ?? 0,
      currentStreak:          raw.stats?.currentStreak ?? 0,
      longestStreak:          raw.stats?.longestStreak ?? 0,
      bestTimes:              raw.stats?.bestTimes ?? {},
      noErrorStreak:          raw.stats?.noErrorStreak ?? 0,
      friendWins:             raw.stats?.friendWins ?? 0,
      totalFriendsInvited:    raw.stats?.totalFriendsInvited ?? 0,
      topDEJCount:            raw.stats?.topDEJCount ?? 0,
      sameChallengePlays:       raw.stats?.sameChallengePlays ?? {},
      failCount:                raw.stats?.failCount ?? {},
      improvedChallengesCount:  raw.stats?.improvedChallengesCount ?? 0,
      seasonalChallengesPlayed: raw.stats?.seasonalChallengesPlayed ?? 0,
      abandonCount:             raw.stats?.abandonCount ?? {},
      dailyPlayed:              raw.stats?.dailyPlayed ?? 0,
      dailyWon:                 raw.stats?.dailyWon ?? 0,
      friendPlayed:             raw.stats?.friendPlayed ?? 0,
      avgResolutionMs:          raw.stats?.avgResolutionMs ?? 0,
      totalResolutionCount:     raw.stats?.totalResolutionCount ?? 0,
      // Nouveaux compteurs ONF et daily (refonte badges)
      onfPerfectCount:          raw.stats?.onfPerfectCount   ?? 0,
      onfSpeedCount:            raw.stats?.onfSpeedCount     ?? 0,
      dailyPerfectCount:        raw.stats?.dailyPerfectCount ?? 0,
      dailySpeedCount:          raw.stats?.dailySpeedCount   ?? 0,
      // Lot D : compteurs ajoutés ; un profil antérieur n'a pas ces champs : 0 (jamais undefined, Firestore le refuse)
      ...readLotDStats(raw.stats),
    },
    countedDuelIds: Array.isArray(raw.countedDuelIds) ? raw.countedDuelIds : [],
    duelWinStreak:  typeof raw.duelWinStreak === 'number' && raw.duelWinStreak > 0 ? Math.floor(raw.duelWinStreak) : 0,
    earnedBadges,
    badgeShowcase:   raw.badgeShowcase ?? [],
    dailyStreak:       raw.dailyStreak ?? 0,
    lastPlayedDate:    raw.lastPlayedDate ?? '',
    onfSolvedCount: raw.onfSolvedCount ?? raw.onf4x4SolvedCount ?? 0,
    completedOnfChallengeIds: raw.completedOnfChallengeIds ?? [],
    collectedTreeCardIds: raw.collectedTreeCardIds ?? [],
    // Profil sans ce champ (avant le badge) : les cartes déjà possédées sont considérées comme vues
    seenTreeCardIds: raw.seenTreeCardIds ?? raw.collectedTreeCardIds ?? [],
    selectedIngameTrackId: raw.selectedIngameTrackId,
    selectedMenuTrackId:   raw.selectedMenuTrackId,
    trackPlayCounts:       raw.trackPlayCounts ?? {},
    ingameAudioEnabled:    raw.ingameAudioEnabled ?? true,
    menuAudioEnabled:      raw.menuAudioEnabled   ?? true,
  };
}

// ── Créer ou mettre à jour le profil ─────────────────────────────────────────
export async function upsertPlayer(profile: PlayerProfile): Promise<void> {
  const ref = doc(db, 'players', profile.userId);
  await setDoc(ref, {
    ...profile,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

// ── Récupérer un profil (avec migration) ──────────────────────────────────────
export async function getPlayer(userId: string): Promise<PlayerProfile | null> {
  const ref  = doc(db, 'players', userId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return migrateProfile(snap.data());
}

// ── Vérifier si un pseudo est déjà pris (insensible à la casse) ──────────────
// Utilise le champ `usernameLower` stocké en minuscules à la création.
export async function isUsernameTaken(username: string): Promise<boolean> {
  const lower = username.trim().toLowerCase();
  if (!lower) return false;
  const q = query(
    collection(db, 'players'),
    where('usernameLower', '==', lower),
    limit(1),
  );
  const snap = await getDocs(q);
  return !snap.empty;
}

// ── Créer un nouveau profil (premier lancement) ───────────────────────────────
export async function createPlayer(userId: string, username: string): Promise<PlayerProfile> {
  const defaults = createDefaultProgressionFields();
  const profile: PlayerProfile = {
    userId,
    username,
    // Progression v2 : un profil neuf naît directement à la version courante (pas de remise à zéro)
    progressionVersion: defaults.progressionVersion,
    challengeStars: {},
    levelsCompleted: 0,
    pendingCeremonies: [],
    seenCeremonies: [],
    rewardedChapters: [],
    chapterCardsGranted: [],
    newFeatureBadges: [],
    unlockedMusicIds: [],
    starStreak: 0,
    quickFirstWins: 0,
    improvedStarChallengeIds: [],
    loyaltyStreak: 0,
    loyaltyBest: 0,
    bestStarStreak: 0,
    dailyPodium: { top10Percent: 0, top3: 0, first: 0 },
    seeds: defaults.seeds,
    completedChallenges: [],
    stats: {
      totalSolved: 0,
      currentStreak: 0,
      longestStreak: 0,
      bestTimes: {},
      noErrorStreak: 0,
      friendWins: 0,
      totalFriendsInvited: 0,
      topDEJCount: 0,
      sameChallengePlays: {},
      failCount: {},
      improvedChallengesCount: 0,
      seasonalChallengesPlayed: 0,
      // Nouveaux champs (chantier 5)
      dailyPlayed: 0,
      dailyWon: 0,
      friendPlayed: 0,
      avgResolutionMs: 0,
      totalResolutionCount: 0,
      ...readLotDStats(undefined),
    },
    isPremium: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    earnedBadges: [],
    badgeShowcase: [],
    dailyStreak: 0,
    lastPlayedDate: '',
    onfSolvedCount: 0,
    completedOnfChallengeIds: [],
    collectedTreeCardIds: [],
    seenTreeCardIds: [],
  };
  // usernameLower permet la recherche d'unicité insensible à la casse
  await setDoc(doc(db, 'players', userId), {
    ...profile,
    usernameLower: username.trim().toLowerCase(),
  });
  return profile;
}

// ── Marquer un défi ONF comme complété ────────────────────────────────────────
// Ajoute l'ID du défi dans completedOnfChallengeIds (tableUnion via arrayUnion).
export async function markOnfChallengeCompleted(
  userId: string,
  challengeId: string,
  onfSolvedCount: number,
): Promise<void> {
  const { arrayUnion } = await import('firebase/firestore');
  await updateDoc(doc(db, 'players', userId), {
    completedOnfChallengeIds: arrayUnion(challengeId),
    onfSolvedCount,
    updatedAt: serverTimestamp(),
  });
}

// ── Limites quotidiennes (Lot A) ──────────────────────────────────────────────
// Écrit les compteurs du jour dans le profil. `merge: true` : un document absent est créé, rien d'autre n'est touché.
export async function updateDailyLimits(userId: string, limits: DailyLimits): Promise<void> {
  await setDoc(doc(db, 'players', userId), {
    dailyLimits: extractDailyLimits(limits),
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

// ── Statistiques (Lot D) ──────────────────────────────────────────────────────
// Écrit TOUTES les statistiques du joueur (Journalier et Duel y compris : avant le Lot D, seuls `totalSolved` et
// `bestTimes` étaient écrits après une victoire Solo, et une victoire Forestier réécrivait l'objet entier). `merge: true` :
// rien d'autre n'est touché. Les compteurs sont cumulatifs et fusionnés par maximum à la connexion (`mergeStats`), donc
// une écriture en retard d'un autre appareil ne peut pas les faire baisser.
export async function updateStats(
  userId: string,
  stats: PlayerProfile['stats'],
  extra: { countedDuelIds: string[]; duelWinStreak: number },
): Promise<void> {
  await setDoc(doc(db, 'players', userId), {
    stats,
    countedDuelIds: extra.countedDuelIds,
    duelWinStreak: extra.duelWinStreak,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

// ── Premium (Lot A) ───────────────────────────────────────────────────────────
// À appeler après un achat : sans cette écriture, `restoreFromCloud` aurait renvoyé le joueur en gratuit.
// (Le branchement RevenueCat — Lot E — devra faire confirmer l'achat côté serveur.)
export async function updatePremium(userId: string, isPremium: boolean): Promise<void> {
  await setDoc(doc(db, 'players', userId), {
    isPremium,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

// ── Mettre à jour les graines ─────────────────────────────────────────────────
export async function updateSeeds(userId: string, seeds: number): Promise<void> {
  await updateDoc(doc(db, 'players', userId), {
    seeds,
    updatedAt: serverTimestamp(),
  });
}

// ── Chercher des joueurs par pseudo (insensible à la casse) ──────────────────
// Double requête pour couvrir :
//   - les nouveaux comptes qui ont le champ `usernameLower`
//   - les anciens comptes créés avant l'ajout de ce champ (recherche sur `username`)
export async function searchPlayers(
  searchTerm: string,
  excludeUid: string,
  maxResults = 8,
): Promise<PlayerSearchResult[]> {
  if (!searchTerm.trim() || searchTerm.length < 2) return [];

  const termLower = searchTerm.trim().toLowerCase();
  const termUpper = searchTerm.trim();

  // Borne haute pour la requête préfixe Firestore (>= term, < termEnd)
  const makeTermEnd = (t: string) =>
    t.slice(0, -1) + String.fromCharCode(t.charCodeAt(t.length - 1) + 1);

  const termLowerEnd = makeTermEnd(termLower);
  const termUpperEnd = makeTermEnd(termUpper);

  // Requête 1 : champ usernameLower (nouveaux comptes, insensible à la casse)
  const qLower = query(
    collection(db, 'players'),
    where('usernameLower', '>=', termLower),
    where('usernameLower', '<', termLowerEnd),
    limit(maxResults),
  );

  // Requête 2 : champ username original (anciens comptes sans usernameLower)
  // On cherche avec la casse exacte du terme saisi — Firestore ne supporte pas
  // l'insensible à la casse natif, mais au moins on rattrape les anciens profils.
  const qOriginal = query(
    collection(db, 'players'),
    where('username', '>=', termUpper),
    where('username', '<', termUpperEnd),
    limit(maxResults),
  );

  const [snapLower, snapOriginal] = await Promise.all([
    getDocs(qLower),
    getDocs(qOriginal),
  ]);

  // Fusionner en dédupliquant par userId
  const seen = new Set<string>();
  const results: PlayerSearchResult[] = [];

  for (const snap of [snapLower, snapOriginal]) {
    for (const d of snap.docs) {
      const profile = migrateProfile(d.data());
      if (profile.userId === excludeUid) continue;
      if (seen.has(profile.userId)) continue;
      seen.add(profile.userId);

      // Rétro-alimenter usernameLower si absent (migration silencieuse)
      if (!d.data().usernameLower) {
        updateDoc(d.ref, { usernameLower: profile.username.toLowerCase() }).catch(() => {});
      }

      results.push({
        userId: profile.userId,
        username: profile.username,
        level: computePlayerLevel(profile.completedChallenges?.length ?? 0),
      });

      if (results.length >= maxResults) break;
    }
    if (results.length >= maxResults) break;
  }

  return results;
}

// ── Mettre à jour les cartes collectées (Herbier) ────────────────────────────
export async function updateCollectedCards(userId: string, cardIds: number[]): Promise<void> {
  await updateDoc(doc(db, 'players', userId), {
    collectedTreeCardIds: cardIds,
    updatedAt: serverTimestamp(),
  });
}

// ── Sauvegarder la sélection musicale ────────────────────────────────────────
export async function updateMusicSelection(
  userId: string,
  selectedIngameTrackId: string,
  selectedMenuTrackId: string,
): Promise<void> {
  await updateDoc(doc(db, 'players', userId), {
    selectedIngameTrackId,
    selectedMenuTrackId,
    updatedAt: serverTimestamp(),
  });
}

// ── Incrémenter le compteur d'écoute d'une piste ─────────────────────────────
export async function incrementTrackPlayCount(
  userId: string,
  trackId: string,
): Promise<void> {
  await updateDoc(doc(db, 'players', userId), {
    [`trackPlayCounts.${trackId}`]: increment(1),
    updatedAt: serverTimestamp(),
  });
}

// ── Persister l'état audio (son activé/coupé) ────────────────────────────────
export async function updateAudioEnabled(
  userId: string,
  ingameAudioEnabled: boolean,
  menuAudioEnabled: boolean,
): Promise<void> {
  await updateDoc(doc(db, 'players', userId), {
    ingameAudioEnabled,
    menuAudioEnabled,
    updatedAt: serverTimestamp(),
  });
}

// ── Marquer un défi comme complété ────────────────────────────────────────────
export async function markCompleted(
  userId: string,
  challengeId: string,
  timeMs: number,
  currentProfile: PlayerProfile
): Promise<void> {
  const alreadyDone = currentProfile.completedChallenges.includes(challengeId);
  const prevBest    = currentProfile.stats.bestTimes[challengeId];
  const newBest     = prevBest !== undefined ? Math.min(prevBest, timeMs) : timeMs;

  await updateDoc(doc(db, 'players', userId), {
    completedChallenges: alreadyDone
      ? currentProfile.completedChallenges
      : [...currentProfile.completedChallenges, challengeId],
    'stats.totalSolved': alreadyDone
      ? currentProfile.stats.totalSolved
      : currentProfile.stats.totalSolved + 1,
    [`stats.bestTimes.${challengeId}`]: newBest,
    updatedAt: serverTimestamp(),
  });
}

// ── Remise à zéro Progression v2 (C9) ────────────────────────────────────────
// Remet TOUT le profil de progression aux valeurs par défaut (voir
// uildFirestoreResetPayload) et pose progressionVersion: 2.
// Conserve l'identité du compte (userId, username, usernameLower, email, createdAt)
// et les préférences (langue, audio) : merge: true ne touche pas aux champs absents.
// Appelée UNE SEULE FOIS par profil, à la connexion, si progressionVersion < 2.
// Ne touche PAS aux classements, records du monde, résultats du Défi du Jour ni à la
// Forêt commune : voir docs/purge-progression-v2.md (purge proposée, non exécutée).
export async function resetPlayerProgression(userId: string): Promise<void> {
  const { deleteField } = await import('firebase/firestore');
  const payload: Record<string, unknown> = {
    ...buildFirestoreResetPayload(),
    // Anciens objectifs de badges : supprimés du profil (les trophées n'ont plus d'objectif actif, Lot 8)
    trackGoals: deleteField(),
    activeBadgeGoals: deleteField(),
    goalCounters: deleteField(),
    retryStreak: deleteField(),
    retryStreakFusee: deleteField(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(doc(db, 'players', userId), payload, { merge: true });
}

// ── Synchroniser la progression Solo (étoiles) ───────────────────────────────
export async function updateSoloProgression(
  userId: string,
  data: {
    challengeStars: Record<string, number>;
    levelsCompleted: number;
    starStreak: number;
    quickFirstWins: number;
    improvedStarChallengeIds: string[];
    bestStarStreak?: number;
    loyaltyBest?: number;
    dailyPodium?: { top10Percent: number; top3: number; first: number };
    rewardedChapters?: number[];
    chapterCardsGranted?: number[];
    collectedTreeCardIds?: number[];
    seenTreeCardIds?: number[];
    pendingCeremonies?: string[];
    seenCeremonies?: string[];
    newFeatureBadges?: string[];
  },
): Promise<void> {
  await updateDoc(doc(db, 'players', userId), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Écrit seulement les pastilles « Nouveau » (effacées à la 1re partie d'un mode).
 * Sans cette écriture, le cloud garde la pastille et `restoreFromCloud` (union local + cloud) la fait revenir.
 */
export async function updateNewFeatureBadges(userId: string, newFeatureBadges: string[]): Promise<void> {
  await updateDoc(doc(db, 'players', userId), {
    newFeatureBadges,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Charge utile `updateSoloProgression` construite depuis l'état du store.
 * Point d'entrée UNIQUE : toute synchronisation de la progression (victoire, connexion, cérémonie)
 * l'utilise, pour qu'aucun champ (chapitres, cérémonies, pastilles) ne soit oublié quelque part.
 */
export function buildSoloProgressionPayload(s: {
  challengeStars: Record<string, number>;
  levelsCompleted: number;
  starStreak: number;
  quickFirstWins: number;
  improvedStarChallengeIds: string[];
  bestStarStreak: number;
  loyaltyBest: number;
  dailyPodium: { top10Percent: number; top3: number; first: number };
  rewardedChapters: number[];
  chapterCardsGranted: number[];
  collectedTreeCardIds: number[];
  seenTreeCardIds: number[];
  pendingCeremonies: string[];
  seenCeremonies: string[];
  newFeatureBadges: string[];
}) {
  return {
    challengeStars: s.challengeStars,
    levelsCompleted: s.levelsCompleted,
    starStreak: s.starStreak,
    quickFirstWins: s.quickFirstWins,
    improvedStarChallengeIds: s.improvedStarChallengeIds,
    bestStarStreak: s.bestStarStreak,
    loyaltyBest: s.loyaltyBest,
    dailyPodium: s.dailyPodium,
    rewardedChapters: s.rewardedChapters,
    chapterCardsGranted: s.chapterCardsGranted,
    collectedTreeCardIds: s.collectedTreeCardIds,
    seenTreeCardIds: s.seenTreeCardIds,
    pendingCeremonies: s.pendingCeremonies,
    seenCeremonies: s.seenCeremonies,
    newFeatureBadges: s.newFeatureBadges,
  };
}