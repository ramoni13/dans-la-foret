// ============================================================
// PURGE PROGRESSION v2 — service (bouton admin du Profil)
//
// Équivalent applicatif de `scripts/purgeProgressionV2.ts` : mêmes collections
// (`src/constants/purgeProgression.ts`), même principe en deux temps :
//   1. `countPurgeTargets()`     : DRY-RUN, compte sans rien écrire ni supprimer ;
//   2. `executePurge(username)`  : suppression réelle, par lots de 400.
//
// Réservé au compte administrateur : refusé ici AUSSI (pas seulement masqué dans l'interface).
// `foret_commune`, `players` et `metrics` ne sont jamais touchées.
// Le compte connecté doit avoir le droit d'écriture sur ces collections (règles Firestore, absentes du dépôt).
// ============================================================

import {
  collection,
  collectionGroup,
  getDocs,
  writeBatch,
  type DocumentReference,
} from 'firebase/firestore';
import { db } from './firebase';
import { isAdminAccount } from '../constants/devAccess';
import {
  PURGE_ROOT_COLLECTIONS,
  PURGE_GROUP_COLLECTIONS,
  chunkForBatches,
  getPurgeLabel,
  sumPurgeTargets,
  type PurgeTargetCount,
} from '../constants/purgeProgression';

export interface PurgeReport {
  targets: PurgeTargetCount[];
  total: number;
}

/** Lit les références de tous les documents à purger, par cible. */
async function listTargets(): Promise<Array<{ label: string; refs: DocumentReference[] }>> {
  const out: Array<{ label: string; refs: DocumentReference[] }> = [];
  for (const name of PURGE_ROOT_COLLECTIONS) {
    const snap = await getDocs(collection(db, name));
    out.push({ label: getPurgeLabel(name, false), refs: snap.docs.map(d => d.ref) });
  }
  for (const name of PURGE_GROUP_COLLECTIONS) {
    const snap = await getDocs(collectionGroup(db, name));
    out.push({ label: getPurgeLabel(name, true), refs: snap.docs.map(d => d.ref) });
  }
  return out;
}

function assertAdmin(username: string | null | undefined): void {
  if (!isAdminAccount(username)) throw new Error('Action réservée à un compte administrateur.');
}

/** DRY-RUN : compte les documents qui seraient supprimés. N'écrit ni ne supprime rien. */
export async function countPurgeTargets(username: string | null | undefined): Promise<PurgeReport> {
  assertAdmin(username);
  const targets = (await listTargets()).map(t => ({ label: t.label, count: t.refs.length }));
  return { targets, total: sumPurgeTargets(targets) };
}

/**
 * Suppression RÉELLE des documents de `PURGE_ROOT_COLLECTIONS` et `PURGE_GROUP_COLLECTIONS`.
 * Irréversible. `onProgress(supprimés, total)` est appelé après chaque lot.
 * Les documents sont relus au moment de l'exécution : le rapport renvoyé est celui de CE qui a été supprimé.
 */
export async function executePurge(
  username: string | null | undefined,
  onProgress?: (deleted: number, total: number) => void,
): Promise<PurgeReport> {
  assertAdmin(username);
  const targets = await listTargets();
  const total = targets.reduce((n, t) => n + t.refs.length, 0);
  let deleted = 0;
  onProgress?.(0, total);

  for (const t of targets) {
    for (const chunk of chunkForBatches(t.refs)) {
      const batch = writeBatch(db);
      for (const ref of chunk) batch.delete(ref);
      await batch.commit();
      deleted += chunk.length;
      onProgress?.(deleted, total);
    }
  }

  const report = targets.map(t => ({ label: t.label, count: t.refs.length }));
  return { targets: report, total: sumPurgeTargets(report) };
}
