// ============================================================
// CHALLENGE SERVICE — Mode défi entre amis (Firestore)
// Collection : /friendChallenges/{id}
//
// Flux :
//   Joueur A génère un défi inédit → joue sans bonus → envoie le lien
//   Joueur B reçoit le lien → joue le même défi sans bonus → résultat comparé
//
// Le défi généré (fixedPlacements + availableTokens + solution) est
// stocké dans Firestore. La solution est lue uniquement pour valider
// le résultat de B côté serveur (règles Firestore à durcir en Phase 6).
// ============================================================

import {
  collection,
  doc,
  addDoc,
  getDoc,
  updateDoc,
  query,
  where,
  orderBy,
  getDocs,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { FixedPlacement, TokenCount } from '../core/models/Challenge';

export type FriendChallengeStatus =
  | 'pending'    // Joueur A a joué, attend que B accepte
  | 'completed'  // Les deux ont joué, résultat disponible
  | 'expired';   // 48h sans réponse de B

// Données du défi généré à la volée (plateau + solution)
export interface FriendChallengeData {
  boardId: string;
  fixedPlacements: FixedPlacement[];
  availableTokens: TokenCount[];
  solution: string[];            // Stockée pour valider le résultat de B
}

export interface FriendChallengeDoc {
  id?: string;
  // Données du défi généré
  challengeData: FriendChallengeData;
  // Joueur A (créateur)
  challengerUid: string;
  challengerName: string;
  challengerTime: number;        // Temps de A en ms (sans bonus)
  // Joueur B (adversaire)
  opponentUid?: string;
  opponentName?: string;
  opponentTime?: number;         // Temps de B en ms
  // Résultat
  status: FriendChallengeStatus;
  winnerId?: string;             // UID du gagnant
  // Méta
  createdAt?: Timestamp;
  expiresAt?: Timestamp;
  updatedAt?: Timestamp;
}

// ── Créer un défi (Joueur A vient de jouer) ───────────────
export async function createFriendChallenge(
  challengeData: FriendChallengeData,
  challengerUid: string,
  challengerName: string,
  challengerTime: number,
  opponentUid?: string,    // Optionnel : si connu, le défi est assigné directement
  opponentName?: string,
): Promise<string> {
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // +48h

  const ref = await addDoc(collection(db, 'friendChallenges'), {
    challengeData,
    challengerUid,
    challengerName,
    challengerTime,
    ...(opponentUid ? { opponentUid } : {}),
    ...(opponentName ? { opponentName } : {}),
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
  opponentName: string,
  opponentTime: number,
  challengerTime: number,
): Promise<void> {
  const winnerId = opponentTime <= challengerTime ? opponentUid : 'challenger';

  await updateDoc(doc(db, 'friendChallenges', friendChallengeId), {
    opponentUid,
    opponentName,
    opponentTime,
    status: 'completed',
    winnerId,
    updatedAt: serverTimestamp(),
  });
}

// ── Défis reçus (statut pending, pas encore répondus par moi) ─
export async function getReceivedChallenges(
  myUid: string,
): Promise<FriendChallengeDoc[]> {
  // Requête simple sans orderBy pour éviter les index composites
  const q = query(
    collection(db, 'friendChallenges'),
    where('opponentUid', '==', myUid),
    where('status', '==', 'pending'),
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
  // Requêtes simples sans orderBy pour éviter les index composites
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
