// ============================================================
// foretCommuneService — Cagnotte Forêt Commune (Firestore partagé)
//
// Document unique : /foret_commune/global
//   cagnottePoints : points vers le prochain arbre (0–9999, repart à 0)
//   totalTrees     : compteur cumulatif d'arbres plantés (jamais recalculé)
//   lastUpdated    : Timestamp Firebase
//
// Règle critique : totalTrees est incrémenté transactionnellement.
// On ne stocke jamais un total brut cumulatif de points.
// ============================================================

import {
  doc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { FORET_COMMUNE_POINTS_PER_TREE } from '../constants/foretCommune';

const GLOBAL_REF = () => doc(db, 'foret_commune', 'global');

export interface ForetCommuneData {
  cagnottePoints: number;
  totalTrees:     number;
}

// ── Lecture temps réel ────────────────────────────────────────────────────────

/**
 * Abonnement temps réel au document global de la Forêt Commune.
 * Retourne une fonction de désinscription à appeler au démontage.
 */
export function subscribeForetCommune(
  cb: (data: ForetCommuneData) => void,
): () => void {
  const ref = GLOBAL_REF();
  const unsub = onSnapshot(ref, (snap) => {
    if (snap.exists()) {
      const data = snap.data();
      cb({
        cagnottePoints: data.cagnottePoints ?? 0,
        totalTrees:     data.totalTrees     ?? 0,
      });
    } else {
      cb({ cagnottePoints: 0, totalTrees: 0 });
    }
  }, () => {
    // En cas d'erreur réseau, on renvoie des zéros sans crasher
    cb({ cagnottePoints: 0, totalTrees: 0 });
  });
  return unsub;
}

// ── Écriture atomique ─────────────────────────────────────────────────────────

/**
 * Ajoute `amount` points à la cagnotte commune de façon atomique.
 *
 * Si `cagnottePoints + amount` atteint ou dépasse FORET_COMMUNE_POINTS_PER_TREE :
 *   - totalTrees est incrémenté du nombre d'arbres gagnés
 *   - cagnottePoints repart du reste (newPoints % FORET_COMMUNE_POINTS_PER_TREE)
 *
 * Utilise une Transaction Firestore pour éviter les race conditions
 * entre plusieurs joueurs simultanés.
 */
export async function addForetCommunePoints(amount: number): Promise<void> {
  if (amount <= 0) return;

  const ref = GLOBAL_REF();

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists() ? snap.data() : { cagnottePoints: 0, totalTrees: 0 };

    const currentPoints = data.cagnottePoints ?? 0;
    const currentTrees  = data.totalTrees     ?? 0;

    const newPoints   = currentPoints + amount;
    const treesEarned = Math.floor(newPoints / FORET_COMMUNE_POINTS_PER_TREE);
    const remainder   = newPoints % FORET_COMMUNE_POINTS_PER_TREE;

    tx.set(ref, {
      cagnottePoints: remainder,
      totalTrees:     currentTrees + treesEarned,
      lastUpdated:    serverTimestamp(),
    }, { merge: true });
  });
}
