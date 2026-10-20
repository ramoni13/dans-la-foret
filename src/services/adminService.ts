// ============================================================
// ADMIN SERVICE — Outils d'administration de la base joueurs
// Réservé à l'usage interne (Ramoni uniquement).
// ============================================================

import {
  collection,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
  serverTimestamp,
  orderBy,
  query,
} from 'firebase/firestore';
import { db } from './firebase';
import { MUSIC_CATALOG } from '../constants/music';

export interface AdminPlayerSummary {
  userId: string;
  username: string;
  seeds: number;
  completedCount: number;
  earnedBadgesCount: number;
  createdAt?: any;
}

// ── Récupérer tous les joueurs (résumé) ───────────────────────────────────────
export async function getAllPlayers(): Promise<AdminPlayerSummary[]> {
  const q = query(collection(db, 'players'), orderBy('username'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      userId: data.userId ?? d.id,
      username: data.username ?? 'Joueur',
      seeds: data.seeds ?? 0,
      completedCount: (data.completedChallenges ?? []).length,
      earnedBadgesCount: (data.earnedBadges ?? []).length,
      createdAt: data.createdAt ?? null,
    };
  });
}

// ── Réinitialiser un joueur (tout sauf username / email / mot de passe) ────────
// Conserve : userId, username, usernameLower, email, createdAt
// Remet à zéro : toutes les statistiques, badges, progression, graines
export async function resetPlayer(userId: string, username: string): Promise<void> {
  const ref = doc(db, 'players', userId);

  const resetData = {
    userId,
    username,
    usernameLower: username.trim().toLowerCase(),
    seeds: 0,
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
      dailyPlayed: 0,
      dailyWon: 0,
      friendPlayed: 0,
      avgResolutionMs: 0,
      totalResolutionCount: 0,
      speedBadgeHits: {},
      abandonCount: {},
    },
    isPremium: false,
    earnedBadges: [],
    badgeShowcase: [],
    dailyStreak: 0,
    lastPlayedDate: '',
    onfSolvedCount: 0,
    completedOnfChallengeIds: [],
    activeBadgeGoals: [],
    goalCounters: {},
    dailyChallengeStatus: 'none',
    lastDailyChallengeDate: '',
    dailyChallengeStreak: 0,
    longestDailyChallengeStreak: 0,
    friendNotifBadgeEnabled: true,
    language: 'fr',
    updatedAt: serverTimestamp(),
    // createdAt est volontairement absent → setDoc merge le conservera
  };

  // merge: false → remplace tout le document (sauf les champs absents comme createdAt
  // que l'on ne veut pas écraser). On utilise setDoc sans merge pour repartir proprement,
  // puis on relira createdAt depuis le document existant au besoin.
  // Ici on choisit merge:true pour conserver createdAt et email s'il existe.
  await setDoc(ref, resetData, { merge: true });
}

// ── Supprimer complètement un joueur de Firestore ─────────────────────────────
// Ne supprime PAS le compte Firebase Auth (pas d'accès Admin SDK côté client).
// Le document Firestore est effacé ; l'utilisateur verra un profil vierge
// à la prochaine connexion (recréé par le flux normal de l'app).
export async function deletePlayer(userId: string): Promise<void> {
  await deleteDoc(doc(db, 'players', userId));
}

// ── Métriques agrégées ────────────────────────────────────────────────────────

export interface PlayerMetrics {
  userId: string;
  username: string;
  createdAt?: any;
  seeds: number;
  isPremium: boolean;
  completedChallenges: number;
  earnedBadges: number;
  onfSolvedCount: number;
  dailyStreak: number;
  dailyChallengeStreak: number;
  longestDailyChallengeStreak: number;
  dailyChallengeStatus: string;
  stats: {
    totalSolved: number;
    currentStreak: number;
    longestStreak: number;
    noErrorStreak: number;
    friendWins: number;
    totalFriendsInvited: number;
    topDEJCount: number;
    improvedChallengesCount: number;
    dailyPlayed: number;
    dailyWon: number;
    friendPlayed: number;
    avgResolutionMs: number;
    totalResolutionCount: number;
    onfPerfectCount: number;
    onfSpeedCount: number;
    dailyPerfectCount: number;
    dailySpeedCount: number;
  };
}

export interface TrackMetrics {
  trackId: string;
  title: string;
  type: 'ingame' | 'menu';
  totalPlays: number;
  /** Nombre de joueurs ayant ce titre sélectionné (ingame ou menu selon type) */
  selectedByCount: number;
}

export interface MusicMetrics {
  /** Métriques par piste (triées par écoutes décroissantes) */
  tracks: TrackMetrics[];
  /** % de joueurs ayant coupé le son Ambiance Défi */
  pctIngameMuted: number;
  /** % de joueurs ayant coupé le son Ambiance Forêt */
  pctMenuMuted: number;
  /** Nombre de joueurs avec la donnée audio disponible (ingameAudioEnabled renseigné) */
  playersWithAudioData: number;
}

export interface GlobalMetrics {
  totalPlayers: number;
  activeLast7Days: number;    // lastPlayedDate dans les 7 derniers jours
  activeLast30Days: number;
  totalCompletedChallenges: number;
  totalBadgesEarned: number;
  totalSeedsInCirculation: number;
  totalOnfSolved: number;
  totalDailyWon: number;
  totalDailyPlayed: number;
  avgBadgesPerPlayer: number;
  avgChallengesPerPlayer: number;
  avgResolutionMs: number;
  music: MusicMetrics;
  players: PlayerMetrics[];
}

export async function getMetrics(): Promise<GlobalMetrics> {
  const snap = await getDocs(collection(db, 'players'));

  const now = new Date();
  const day7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const day30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const toDate = (s: string): Date | null => {
    if (!s) return null;
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  };

  let totalCompleted = 0;
  let totalBadges = 0;
  let totalSeeds = 0;
  let totalOnf = 0;
  let totalDailyWon = 0;
  let totalDailyPlayed = 0;
  let totalAvgResMs = 0;
  let totalResCount = 0;
  let active7 = 0;
  let active30 = 0;

  // ── Métriques musicales ─────────────────────────────────────────────────────
  // Compteurs cumulatifs par piste (play counts + sélections)
  const totalPlayCounts: Record<string, number> = {};
  const selectedIngameCounts: Record<string, number> = {};
  const selectedMenuCounts: Record<string, number> = {};
  let ingameMutedCount = 0;
  let menuMutedCount = 0;
  let playersWithAudioData = 0;

  // Initialiser les compteurs pour toutes les pistes du catalogue
  for (const track of MUSIC_CATALOG) {
    totalPlayCounts[track.id] = 0;
    if (track.type === 'ingame') selectedIngameCounts[track.id] = 0;
    else selectedMenuCounts[track.id] = 0;
  }

  const players: PlayerMetrics[] = snap.docs.map((d) => {
    const data = d.data();
    const stats = data.stats ?? {};
    const lastPlayed = toDate(data.lastPlayedDate ?? '');

    const completed = (data.completedChallenges ?? []).length;
    const badges = (data.earnedBadges ?? []).length;
    const seeds = data.seeds ?? 0;
    const onf = data.onfSolvedCount ?? 0;
    const dWon = stats.dailyWon ?? 0;
    const dPlayed = stats.dailyPlayed ?? 0;
    const avgMs = stats.avgResolutionMs ?? 0;
    const resCount = stats.totalResolutionCount ?? 0;

    totalCompleted += completed;
    totalBadges += badges;
    totalSeeds += seeds;
    totalOnf += onf;
    totalDailyWon += dWon;
    totalDailyPlayed += dPlayed;
    if (avgMs > 0 && resCount > 0) {
      totalAvgResMs += avgMs * resCount;
      totalResCount += resCount;
    }
    if (lastPlayed) {
      if (lastPlayed >= day7) active7++;
      if (lastPlayed >= day30) active30++;
    }

    // Agrégation musicale
    const playCounts: Record<string, number> = data.trackPlayCounts ?? {};
    for (const [trackId, count] of Object.entries(playCounts)) {
      if (trackId in totalPlayCounts) {
        totalPlayCounts[trackId] += (count as number);
      }
    }
    const selIngame = data.selectedIngameTrackId ?? '';
    if (selIngame && selIngame in selectedIngameCounts) {
      selectedIngameCounts[selIngame]++;
    }
    const selMenu = data.selectedMenuTrackId ?? '';
    if (selMenu && selMenu in selectedMenuCounts) {
      selectedMenuCounts[selMenu]++;
    }
    // ingameAudioEnabled est undefined pour les anciens profils → on ne compte que si renseigné
    if (data.ingameAudioEnabled !== undefined || data.menuAudioEnabled !== undefined) {
      playersWithAudioData++;
      if (data.ingameAudioEnabled === false) ingameMutedCount++;
      if (data.menuAudioEnabled   === false) menuMutedCount++;
    }

    return {
      userId: data.userId ?? d.id,
      username: data.username ?? 'Joueur',
      createdAt: data.createdAt ?? null,
      seeds,
      isPremium: data.isPremium ?? false,
      completedChallenges: completed,
      earnedBadges: badges,
      onfSolvedCount: onf,
      dailyStreak: data.dailyStreak ?? 0,
      dailyChallengeStreak: data.dailyChallengeStreak ?? 0,
      longestDailyChallengeStreak: data.longestDailyChallengeStreak ?? 0,
      dailyChallengeStatus: data.dailyChallengeStatus ?? 'none',
      stats: {
        totalSolved: stats.totalSolved ?? 0,
        currentStreak: stats.currentStreak ?? 0,
        longestStreak: stats.longestStreak ?? 0,
        noErrorStreak: stats.noErrorStreak ?? 0,
        friendWins: stats.friendWins ?? 0,
        totalFriendsInvited: stats.totalFriendsInvited ?? 0,
        topDEJCount: stats.topDEJCount ?? 0,
        improvedChallengesCount: stats.improvedChallengesCount ?? 0,
        dailyPlayed: dPlayed,
        dailyWon: dWon,
        friendPlayed: stats.friendPlayed ?? 0,
        avgResolutionMs: avgMs,
        totalResolutionCount: resCount,
        onfPerfectCount: stats.onfPerfectCount ?? 0,
        onfSpeedCount: stats.onfSpeedCount ?? 0,
        dailyPerfectCount: stats.dailyPerfectCount ?? 0,
        dailySpeedCount: stats.dailySpeedCount ?? 0,
      },
    };
  });

  // Construire les métriques par piste
  const trackMetrics: TrackMetrics[] = MUSIC_CATALOG.map(track => ({
    trackId: track.id,
    title: track.title,
    type: track.type,
    totalPlays: totalPlayCounts[track.id] ?? 0,
    selectedByCount: track.type === 'ingame'
      ? (selectedIngameCounts[track.id] ?? 0)
      : (selectedMenuCounts[track.id] ?? 0),
  })).sort((a, b) => b.totalPlays - a.totalPlays);

  const audioBase = playersWithAudioData || 1;
  const musicMetrics: MusicMetrics = {
    tracks: trackMetrics,
    pctIngameMuted: Math.round((ingameMutedCount / audioBase) * 1000) / 10,
    pctMenuMuted:   Math.round((menuMutedCount   / audioBase) * 1000) / 10,
    playersWithAudioData,
  };

  const n = players.length || 1;
  return {
    totalPlayers: players.length,
    activeLast7Days: active7,
    activeLast30Days: active30,
    totalCompletedChallenges: totalCompleted,
    totalBadgesEarned: totalBadges,
    totalSeedsInCirculation: totalSeeds,
    totalOnfSolved: totalOnf,
    totalDailyWon,
    totalDailyPlayed,
    avgBadgesPerPlayer: Math.round((totalBadges / n) * 10) / 10,
    avgChallengesPerPlayer: Math.round((totalCompleted / n) * 10) / 10,
    avgResolutionMs: totalResCount > 0 ? Math.round(totalAvgResMs / totalResCount) : 0,
    music: musicMetrics,
    players: players.sort((a, b) => b.completedChallenges - a.completedChallenges),
  };
}
