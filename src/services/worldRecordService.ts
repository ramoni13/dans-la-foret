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
export async function getTopWorldRecords(maxCount = 20): Promise<WorldRecord[]> {
  try {
    const ref  = collection(db, COLLECTION);
    const snap = await getDocs(ref);
    return snap.docs.map(d => ({ challengeId: d.id, ...d.data() } as WorldRecord));
  } catch {
    return [];
  }
}

/** Écoute en temps réel tous les records mondiaux (indexés par challengeId) */
export function subscribeAllWorldRecords(
  onChange: (records: Map<string, WorldRecord>) => void,
): Unsubscribe {
  const ref = collection(db, COLLECTION);
  return onSnapshot(ref, snap => {
    const map = new Map<string, WorldRecord>();
    for (const d of snap.docs) {
      map.set(d.id, { challengeId: d.id, ...d.data() } as WorldRecord);
    }
    onChange(map);
  }, () => onChange(new Map()));
}

// ── Classement par nombre de records détenus ─────────────────────────────────
export interface RecordHolderEntry {
  userId: string;
  username: string;
  recordCount: number;
}

/** Écoute en temps réel tous les records et agrège par joueur */
export function subscribeRecordHolders(
  onChange: (holders: RecordHolderEntry[]) => void,
): Unsubscribe {
  const ref = collection(db, COLLECTION);
  return onSnapshot(ref, snap => {
    const byUser = new Map<string, { username: string; count: number }>();
    for (const d of snap.docs) {
      const data = d.data() as Omit<WorldRecord, 'challengeId'>;
      const existing = byUser.get(data.userId);
      if (existing) {
        existing.count += 1;
      } else {
        byUser.set(data.userId, { username: data.username, count: 1 });
      }
    }
    const holders: RecordHolderEntry[] = [];
    for (const [userId, { username, count }] of byUser) {
      holders.push({ userId, username, recordCount: count });
    }
    holders.sort((a, b) => b.recordCount - a.recordCount);
    onChange(holders);
  }, () => onChange([]));
}
