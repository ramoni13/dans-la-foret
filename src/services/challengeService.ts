// ============================================================
// CHALLENGE SERVICE — Mode défi entre amis (Firestore)
// Collection : /friendChallenges/{id}
//
// Flux :
//   Joueur A cherche un ami par pseudo → génère un défi au niveau min(A,B)
//   → joue sans bonus → envoie directement à l'ami choisi
//   Joueur B reçoit le défi → peut refuser ou jouer → résultat comparé
//
// Le défi généré (fixedPlacements + availableTokens + solution) est
// stocké dans Firestore. La solution est lue uniquement pour valider
// le résultat de B côté serveur.
//
// Expiration : 1 semaine sans réponse de B.
// Récompense vainqueur : 15 graines.
// ============================================================

import {
  collection,
  doc,
  addDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  getDocs,
  serverTimestamp,
  runTransaction,
  Timestamp,
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { FixedPlacement, TokenCount } from '../core/models/Challenge';

export const CHALLENGE_WINNER_SEEDS = 15; // Graines gagnées par le vainqueur
const CHALLENGE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 1 semaine

export type FriendChallengeStatus =
  | 'pending'    // Joueur A a joué, attend que B accepte ou refuse
  | 'refused'    // Joueur B a refusé le défi
  | 'completed'  // Les deux ont joué, résultat disponible
  | 'expired';   // 1 semaine sans réponse de B

// Données du défi généré à la volée (plateau + solution)
export interface FriendChallengeData {
  boardId: string;
  fixedPlacements: FixedPlacement[];
  availableTokens: TokenCount[];
  solution: string[];            // Stockée pour valider le résultat de B
  level: number;                 // Niveau du défi (min des deux joueurs)
}

export interface FriendChallengeDoc {
  id?: string;
  // Données du défi généré
  challengeData: FriendChallengeData;
  // Joueur A (créateur)
  challengerUid: string;
  challengerName: string;
  challengerTime: number;        // Temps de A en ms (sans bonus)
  challengerLevel: number;       // Niveau de A au moment du défi
  // Joueur B (adversaire)
  opponentUid: string;           // Requis : le défi est toujours assigné à un ami précis
  opponentName: string;
  opponentLevel: number;         // Niveau de B au moment du défi
  opponentTime?: number;         // Temps de B en ms
  // Résultat
  status: FriendChallengeStatus;
  winnerId?: string;             // UID du gagnant
  rewardStatus?: 'pending' | 'claimed';
  // Méta
  createdAt?: Timestamp;
  expiresAt?: Timestamp;
  updatedAt?: Timestamp;
}

// ── Créer un défi (Joueur A a trouvé un ami et joué) ──────
export async function createFriendChallenge(
  challengeData: FriendChallengeData,
  challengerUid: string,
  challengerName: string,
  challengerTime: number,
  challengerLevel: number,
  opponentUid: string,
  opponentName: string,
  opponentLevel: number,
): Promise<string> {
  const expiresAt = new Date(Date.now() + CHALLENGE_EXPIRY_MS); // +1 semaine

  const ref = await addDoc(collection(db, 'friendChallenges'), {
    challengeData,
    challengerUid,
    challengerName,
    challengerTime,
    challengerLevel,
    opponentUid,
    opponentName,
    opponentLevel,
    status: 'pending',
    createdAt: serverTimestamp(),
    expiresAt: Timestamp.fromDate(expiresAt),
    updatedAt: serverTimestamp(),
  });

  return ref.id;
}

// ── Récupérer un défi par ID ───────────────────────────────
export async function getFriendChallenge(id: string): Promise<FriendChallengeDoc | null> {
  const snap = await getDoc(doc(db, 'friendChallenges', id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as FriendChallengeDoc;
}

// ── Répondre à un défi (Joueur B vient de jouer) ──────────
export async function answerFriendChallenge(
  friendChallengeId: string,
  opponentUid: string,
  opponentTime: number,
): Promise<{ winnerId: string }> {
  if (!auth.currentUser || auth.currentUser.isAnonymous || auth.currentUser.uid !== opponentUid) {
    throw new Error('Only the authenticated opponent can answer this challenge');
  }
  if (!Number.isFinite(opponentTime) || opponentTime < 0) {
    throw new Error('Opponent time is invalid');
  }

  const challengeRef = doc(db, 'friendChallenges', friendChallengeId);

  return runTransaction(db, async tx => {
    const challengeSnap = await tx.get(challengeRef);
    if (!challengeSnap.exists()) throw new Error('Friend challenge not found');

    const challenge = challengeSnap.data() as FriendChallengeDoc;
    if (challenge.opponentUid !== opponentUid) {
      throw new Error('Only the assigned opponent can answer this challenge');
    }
    if (challenge.status === 'completed' && challenge.winnerId) {
      return { winnerId: challenge.winnerId };
    }
    if (
      challenge.status !== 'pending' ||
      challenge.challengerUid === opponentUid ||
      !Number.isFinite(challenge.challengerTime) ||
      challenge.challengerTime < 0
    ) {
      throw new Error('Friend challenge cannot be settled by this player');
    }

    const winnerId = opponentTime <= challenge.challengerTime
      ? opponentUid
      : challenge.challengerUid;

    tx.update(challengeRef, {
      opponentTime,
      status: 'completed',
      winnerId,
      rewardStatus: 'pending',
      updatedAt: serverTimestamp(),
    });
    return { winnerId };
  });
}

/**
 * Le vainqueur réclame les graines depuis son propre compte. Le statut de réclamation et le solde
 * sont mis à jour dans la même transaction, ce qui empêche le double versement entre appareils.
 */
export async function claimFriendChallengeReward(
  friendChallengeId: string,
  winnerUid: string,
): Promise<{ claimed: boolean }> {
  if (!auth.currentUser || auth.currentUser.isAnonymous || auth.currentUser.uid !== winnerUid) {
    throw new Error('Only the authenticated winner can claim this reward');
  }

  const challengeRef = doc(db, 'friendChallenges', friendChallengeId);
  const winnerRef = doc(db, 'players', winnerUid);

  return runTransaction(db, async tx => {
    const challengeSnap = await tx.get(challengeRef);
    if (!challengeSnap.exists()) throw new Error('Friend challenge not found');

    const challenge = challengeSnap.data() as FriendChallengeDoc;
    const legacyUnclaimedChallengerWin =
      challenge.rewardStatus === undefined &&
      challenge.winnerId === challenge.challengerUid;
    if (
      challenge.status !== 'completed' ||
      challenge.winnerId !== winnerUid ||
      (challenge.rewardStatus !== 'pending' && !legacyUnclaimedChallengerWin)
    ) {
      return { claimed: false };
    }

    const winnerSnap = await tx.get(winnerRef);
    if (!winnerSnap.exists()) throw new Error('Winner player profile not found');
    const currentSeeds: unknown = winnerSnap.data().seeds;
    if (
      typeof currentSeeds !== 'number' ||
      !Number.isSafeInteger(currentSeeds) ||
      currentSeeds < 0 ||
      currentSeeds > Number.MAX_SAFE_INTEGER - CHALLENGE_WINNER_SEEDS
    ) {
      throw new Error('Winner player seed balance is invalid');
    }

    tx.update(challengeRef, {
      rewardStatus: 'claimed',
      updatedAt: serverTimestamp(),
    });
    tx.update(winnerRef, {
      seeds: currentSeeds + CHALLENGE_WINNER_SEEDS,
      updatedAt: serverTimestamp(),
    });
    return { claimed: true };
  });
}

// ── Refuser un défi (Joueur B refuse) ─────────────────────
export async function refuseFriendChallenge(
  friendChallengeId: string,
): Promise<void> {
  await updateDoc(doc(db, 'friendChallenges', friendChallengeId), {
    status: 'refused',
    updatedAt: serverTimestamp(),
  });
}

// ── Suppression physique des défis expirés ─────────────────
/**
 * Supprime de Firestore tous les documents expirés présents dans `docs`.
 * Appelé silencieusement après chaque lecture — pas de bloc sur l'UI.
 */
async function purgeExpiredDocs(
  docs: FriendChallengeDoc[],
  now: number,
): Promise<void> {
  const expired = docs.filter(d => {
    const exp = (d.expiresAt as Timestamp)?.toMillis() ?? Infinity;
    return exp <= now;
  });
  await Promise.all(
    expired.map(d => d.id ? deleteDoc(doc(db, 'friendChallenges', d.id)) : Promise.resolve()),
  );
}

// ── Défis reçus (statut pending uniquement — à répondre) ──
export async function getReceivedChallenges(
  myUid: string,
): Promise<FriendChallengeDoc[]> {
  // Uniquement les défis en attente de réponse
  const q = query(
    collection(db, 'friendChallenges'),
    where('opponentUid', '==', myUid),
    where('status', '==', 'pending'),
  );
  const snap = await getDocs(q);
  const now = Date.now();
  const all = snap.docs.map(d => ({ id: d.id, ...d.data() } as FriendChallengeDoc));
  // Purger physiquement les docs expirés (sans bloquer le retour)
  purgeExpiredDocs(all, now).catch(() => {});
  return all
    .filter(d => {
      const exp = (d.expiresAt as Timestamp)?.toMillis() ?? Infinity;
      return exp > now;
    })
    .sort((a, b) => {
      const ta = (a.createdAt as Timestamp)?.toMillis() ?? 0;
      const tb = (b.createdAt as Timestamp)?.toMillis() ?? 0;
      return tb - ta;
    });
}

// ── Défis envoyés par moi (tous statuts) ──────────────────
export async function getSentChallenges(
  challengerUid: string,
): Promise<FriendChallengeDoc[]> {
  // Requête simple sans orderBy pour éviter les index composites
  const q = query(
    collection(db, 'friendChallenges'),
    where('challengerUid', '==', challengerUid),
  );
  const snap = await getDocs(q);
  const now = Date.now();
  const all = snap.docs.map(d => ({ id: d.id, ...d.data() } as FriendChallengeDoc));
  // Purger physiquement les docs expirés
  purgeExpiredDocs(all, now).catch(() => {});
  return all
    .filter(d => {
      const exp = (d.expiresAt as Timestamp)?.toMillis() ?? Infinity;
      return exp > now;
    })
    .sort((a, b) => {
      const ta = (a.createdAt as Timestamp)?.toMillis() ?? 0;
      const tb = (b.createdAt as Timestamp)?.toMillis() ?? 0;
      return tb - ta;
    });
}

// ── Défis complétés impliquant un joueur (reçus + envoyés) ─
export async function getCompletedChallenges(
  myUid: string,
): Promise<FriendChallengeDoc[]> {
  const qSent = query(
    collection(db, 'friendChallenges'),
    where('challengerUid', '==', myUid),
    where('status', '==', 'completed'),
  );
  const qReceived = query(
    collection(db, 'friendChallenges'),
    where('opponentUid', '==', myUid),
    where('status', '==', 'completed'),
  );
  const [snapSent, snapReceived] = await Promise.all([getDocs(qSent), getDocs(qReceived)]);
  const sent = snapSent.docs.map(d => ({ id: d.id, ...d.data() } as FriendChallengeDoc));
  const received = snapReceived.docs.map(d => ({ id: d.id, ...d.data() } as FriendChallengeDoc));
  return [...sent, ...received].sort((a, b) => {
    const ta = (a.updatedAt as Timestamp)?.toMillis() ?? 0;
    const tb = (b.updatedAt as Timestamp)?.toMillis() ?? 0;
    return tb - ta;
  });
}

// Les défis expirés sont supprimés physiquement de Firestore par purgeExpiredDocs(),
// appelée dans getSentChallenges() et getReceivedChallenges() à chaque lecture.
