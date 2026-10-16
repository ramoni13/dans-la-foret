// ============================================================
// JACKPOT SERVICE — Bandit manchot forestier (Défi du Jour)
// Collection Firestore : jackpot/daily
// Claims      Firestore : jackpotClaims/{uid}_{date}
// ============================================================

import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  Unsubscribe,
  increment,
} from 'firebase/firestore';
import { db } from './firebase';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface JackpotData {
  amount: number;
  lastUpdatedDate: string; // "YYYY-MM-DD"
}

// ── Constantes ────────────────────────────────────────────────────────────────

const JACKPOT_DOC   = doc(db, 'jackpot', 'daily');
const CLAIMS_COL    = 'jackpotClaims';
const JACKPOT_START = 200;   // valeur initiale / après remise à zéro
const JACKPOT_DAILY_INC = 50; // graines ajoutées chaque jour

// ── Écouter le jackpot en temps réel ─────────────────────────────────────────

export function subscribeJackpot(
  onUpdate: (data: JackpotData | null) => void,
): Unsubscribe {
  return onSnapshot(
    JACKPOT_DOC,
    snap => {
      if (!snap.exists()) {
        onUpdate({ amount: JACKPOT_START, lastUpdatedDate: '' });
      } else {
        onUpdate(snap.data() as JackpotData);
      }
    },
    () => onUpdate(null), // erreur réseau / hors-ligne
  );
}

// ── Incrémenter le jackpot (1x / jour, appelé dans _layout.tsx) ───────────────

export async function incrementJackpotIfNeeded(todayDate: string): Promise<void> {
  try {
    const snap = await getDoc(JACKPOT_DOC);
    if (!snap.exists()) {
      // Première initialisation
      await setDoc(JACKPOT_DOC, {
        amount: JACKPOT_START + JACKPOT_DAILY_INC,
        lastUpdatedDate: todayDate,
      });
      return;
    }
    const data = snap.data() as JackpotData;
    if (data.lastUpdatedDate === todayDate) return; // déjà incrémenté aujourd'hui
    await setDoc(JACKPOT_DOC, {
      amount: data.amount + JACKPOT_DAILY_INC,
      lastUpdatedDate: todayDate,
    });
  } catch {
    // Silencieux : pas bloquant
  }
}

// ── Réclamer le jackpot (transaction atomique) ─────────────────────────────────
// Retourne le gain effectif (0 si déjà réclamé ou erreur).

export interface ClaimResult {
  gain: number;      // graines obtenues
  isJackpot: boolean;
  alreadyClaimed: boolean;
  offline: boolean;
}

export async function claimJackpot(
  uid: string,
  date: string,
  isJackpot: boolean,
  localGain: number, // gain calculé localement (non-jackpot)
): Promise<ClaimResult> {
  const claimRef = doc(db, CLAIMS_COL, `${uid}_${date}`);

  try {
    let gain = 0;
    let alreadyClaimed = false;

    await runTransaction(db, async tx => {
      // Vérifier anti-doublon
      const claimSnap = await tx.get(claimRef);
      if (claimSnap.exists()) {
        alreadyClaimed = true;
        return;
      }

      if (isJackpot) {
        // Lire le montant actuel du jackpot
        const jackpotSnap = await tx.get(JACKPOT_DOC);
        const currentAmount = jackpotSnap.exists()
          ? (jackpotSnap.data() as JackpotData).amount
          : JACKPOT_START;
        gain = currentAmount;
        // Remettre le jackpot à la valeur initiale
        tx.set(JACKPOT_DOC, {
          amount: JACKPOT_START,
          lastUpdatedDate: date,
        });
      } else {
        gain = localGain;
      }

      // Écrire le claim pour éviter les doubles
      tx.set(claimRef, {
        uid,
        date,
        gain,
        isJackpot,
        claimedAt: serverTimestamp(),
      });
    });

    return { gain, isJackpot, alreadyClaimed, offline: false };
  } catch {
    // Hors-ligne ou transaction échouée → fallback gain fixe
    return { gain: isJackpot ? JACKPOT_START : localGain, isJackpot, alreadyClaimed: false, offline: true };
  }
}

// ── Vérifier si le joueur a déjà réclamé aujourd'hui ─────────────────────────

export async function hasAlreadyClaimed(uid: string, date: string): Promise<boolean> {
  try {
    const snap = await getDoc(doc(db, CLAIMS_COL, `${uid}_${date}`));
    return snap.exists();
  } catch {
    return false;
  }
}
