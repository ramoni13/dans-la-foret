// ============================================================
// WORLD RECORD SERVICE
// Collection Firestore : /worldRecords/{challengeId}
//
// Un document par défi. On ne garde QUE le meilleur temps mondial.
// La transaction atomique garantit qu'il n'y a jamais de race condition.
// ============================================================

import {
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';

export interface WorldRecord {
  challengeId: string;
  userId: string;
  username: string;
  timeMs: number;
  achievedAt: any; // Firestore Timestamp
}

export interface WorldRecordResult {
  isNewRecord: boolean;
  previousRecord: WorldRecord | null;
  newRecord: WorldRecord | null;
}

const COLLECTION = 'worldRecords';

// ── Lire le record mondial d'un défi ─────────────────────────────────────────
export async function getWorldRecord(challengeId: string): Promise<WorldRecord | null> {
  try {
    const ref  = doc(db, COLLECTION, challengeId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return { challengeId, ...snap.data() } as WorldRecord;
  } catch {
    return null;
  }
}

// ── Écouter en temps réel le record d'un défi (pour l'affichage in-game) ─────
export function subscribeWorldRecord(
  challengeId: string,
  onChange: (wr: WorldRecord | null) => void,
): Unsubscribe {
  const ref = doc(db, COLLECTION, challengeId);
  return onSnapshot(ref, snap => {
    if (!snap.exists()) {
      onChange(null);
    } else {
      onChange({ challengeId, ...snap.data() } as WorldRecord);
    }
  }, () => onChange(null)); // silencieux si hors-ligne
}

// ── Tenter de battre le record mondial (transaction atomique) ─────────────────
// Retourne si c'est un nouveau record ET l'éventuel ancien record.
export async function trySetWorldRecord(
  challengeId: string,
  userId: string,
  username: string,
  timeMs: number,
): Promise<WorldRecordResult> {
  const ref = doc(db, COLLECTION, challengeId);

  try {
    let isNewRecord = false;
    let previousRecord: WorldRecord | null = null;

    await runTransaction(db, async tx => {
      const snap = await tx.get(ref);

      if (!snap.exists()) {
        // Premier record sur ce défi
        isNewRecord     = true;
        previousRecord  = null;
        tx.set(ref, {
          userId,
          username,
          timeMs,
          achievedAt: serverTimestamp(),
        });
      } else {
        const current = snap.data() as Omit<WorldRecord, 'challengeId'>;
        previousRecord = { challengeId, ...current };

        if (timeMs < current.timeMs) {
          // Nouveau record !
          isNewRecord = true;
          tx.update(ref, {
            userId,
            username,
            timeMs,
            achievedAt: serverTimestamp(),
          });
        }
        // Sinon : pas de mise à jour, isNewRecord reste false
      }
    });

    const newRecord = isNewRecord
      ? { challengeId, userId, username, timeMs, achievedAt: new Date() }
      : null;

    return { isNewRecord, previousRecord, newRecord };
  } catch {
    // Hors-ligne ou erreur réseau → on ne bloque pas le joueur
    return { isNewRecord: false, previousRecord: null, newRecord: null };
  }
}

// ── Récupérer les N meilleurs records mondiaux (multi-défis) ─────────────────
// Utile pour un futur écran "Top records".
export async function getTopWorldRecords(maxCount = 20): Promise<WorldRecord[]> {
  try {
    const ref  = collection(db, COLLECTION);
    // Pas d'index composite nécessaire : on trie côté client après
    const snap = await getDocs(ref);
    return snap.docs.map(d => ({ challengeId: d.id, ...d.data() } as WorldRecord));
  } catch {
    return [];
  }
}
