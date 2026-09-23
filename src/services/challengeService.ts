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
  query,
  where,
  getDocs,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
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
  challengerUid: string,
  challengerTime: number,
): Promise<{ winnerId: string }> {
  const winnerId = opponentTime <= challengerTime ? opponentUid : challengerUid;

  await updateDoc(doc(db, 'friendChallenges', friendChallengeId), {
    opponentTime,
    status: 'completed',
    winnerId,
    updatedAt: serverTimestamp(),
  });

  return { winnerId };
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
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() } as FriendChallengeDoc))
    // Filtrer côté client les défis expirés (Firestore ne purge pas automatiquement)
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
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() } as FriendChallengeDoc))
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

// Note : la purge des défis expirés (status → 'expired') sera gérée
// par une Cloud Function Firestore. Côté client, les défis expirés sont
// filtrés dans getReceivedChallenges() via leur champ expiresAt.
