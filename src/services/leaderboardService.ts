// ============================================================
// LEADERBOARD SERVICE (Lot C)
// Collection Firestore : /leaderboard/{userId}
//
// Un SEUL document par joueur, écrit par UN SEUL point d'entrée (`publishLeaderboardEntry`), appelé depuis
// `(tabs)/_layout.tsx` à chaque changement de progression, quel que soit le mode de jeu (Solo, Journalier, Forestier,
// Duel, Herbier, trophées). Avant : seule une victoire Solo mettait le classement à jour.
//
// Champs publiés (voir constants/leaderboardRank.ts) :
//   starsRank        — score empaqueté du classement « Étoiles » (étoiles > ⭐⭐⭐ > trophées > premier arrivé)
//   stars, threeStars, trophies, levelsCompleted, level, herbier — affichage
//   dailyRankPousse / dailyRankGrandChene — score empaqueté du Journalier de CHAQUE ligue (écrit par sealDailyRecord)
//
// Chaque classement = UNE requête `orderBy(champ, 'desc').limit(100)` : aucun re-tri côté client, aucun index composite
// (les index mono-champ sont automatiques). Les anciennes entrées (sans `starsRank`) sont ignorées par Firestore.
// ============================================================

import {
  collection,
  deleteField,
  doc,
  getCountFromServer,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';
import type { DailyLeague } from '../constants/dailyLeagues';
import {
  DailyWinsEntry,
  LEADERBOARD_TOP,
  LeaderboardEntry,
  LeaderboardInput,
  StarsStanding,
  buildLeaderboardEntry,
  dailyRankField,
  parseDailyWinsEntry,
  parseLeaderboardEntry,
  unpackStarsRank,
} from '../constants/leaderboardRank';

const COLLECTION = 'leaderboard';

// ── Publication unique ────────────────────────────────────────────────────────

type Prev = (StarsStanding & { reachedAtMin: number }) | null;
interface Cache { uid: string; sig: string; prev: Prev }
let cache: Cache | null = null;

/** À appeler à la déconnexion : le prochain compte relit sa position publiée. */
export function resetLeaderboardCache(): void {
  cache = null;
}

/**
 * Publie la position du joueur. Idempotent : rien n'est écrit si l'entrée n'a pas changé depuis la dernière publication.
 * « Le premier arrivé » (`reachedAt`) est conservé tant que le résultat ne change pas : republier ne fait jamais reculer.
 * Un joueur sans étoile (profil remis à zéro) est retiré du classement des étoiles.
 * Silencieux en cas d'erreur réseau : ne bloque jamais la progression locale. Retourne `true` si une écriture a eu lieu.
 */
export async function publishLeaderboardEntry(input: LeaderboardInput): Promise<boolean> {
  try {
    if (!input.userId) return false;
    const ref = doc(db, COLLECTION, input.userId);

    if (!cache || cache.uid !== input.userId) {
      const snap = await getDoc(ref);
      const existing = snap.exists() ? parseLeaderboardEntry(snap.data()) : null;
      cache = {
        uid: input.userId,
        sig: '',
        prev: existing ? { ...unpackStarsRank(existing.starsRank) } : null,
      };
    }

    const entry = buildLeaderboardEntry(input, cache.prev, Date.now());

    if (!entry) {
      // Plus aucune étoile : retirer l'ancienne position (une seule fois)
      if (!cache.prev) return false;
      await setDoc(ref, { starsRank: deleteField(), updatedAt: serverTimestamp() }, { merge: true });
      cache.prev = null;
      cache.sig = '';
      return true;
    }

    const sig = JSON.stringify(entry);
    if (sig === cache.sig) return false;
    await setDoc(ref, { ...entry, updatedAt: serverTimestamp() }, { merge: true });
    cache.sig = sig;
    cache.prev = { ...unpackStarsRank(entry.starsRank) };
    return true;
  } catch {
    return false;
  }
}

// ── Classement « Étoiles » ────────────────────────────────────────────────────

/** Top N des étoiles en temps réel (une requête serveur triée sur `starsRank`). */
export function subscribeStarsLeaderboard(
  onChange: (entries: LeaderboardEntry[]) => void,
  maxCount: number = LEADERBOARD_TOP,
): Unsubscribe {
  const q = query(collection(db, COLLECTION), orderBy('starsRank', 'desc'), limit(maxCount));
  return onSnapshot(q, snap => {
    const entries: LeaderboardEntry[] = [];
    for (const d of snap.docs) {
      const e = parseLeaderboardEntry(d.data());
      if (e) entries.push(e);
    }
    onChange(entries);
  }, () => onChange([]));
}

/** Position d'un joueur hors du top affiché : nombre de joueurs strictement devant lui + 1. `null` si indisponible. */
export async function getStarsPosition(starsRank: number): Promise<number | null> {
  try {
    const q = query(collection(db, COLLECTION), where('starsRank', '>', starsRank));
    const snap = await getCountFromServer(q);
    return snap.data().count + 1;
  } catch {
    return null;
  }
}

// ── Classement « Journalier » (une ligue à la fois) ──────────────────────────
// Pas de comptage de position hors du top : le score d'un joueur dans une ligue n'est connu que de Firestore.

/** Top N du Journalier d'UNE ligue en temps réel. Les deux ligues ne sont jamais mélangées. */
export function subscribeDailyWinsLeaderboard(
  league: DailyLeague,
  onChange: (entries: DailyWinsEntry[]) => void,
  maxCount: number = LEADERBOARD_TOP,
): Unsubscribe {
  const field = dailyRankField(league);
  const q = query(collection(db, COLLECTION), orderBy(field, 'desc'), limit(maxCount));
  return onSnapshot(q, snap => {
    const entries: DailyWinsEntry[] = [];
    for (const d of snap.docs) {
      const e = parseDailyWinsEntry(d.data(), league);
      if (e) entries.push(e);
    }
    onChange(entries);
  }, () => onChange([]));
}
