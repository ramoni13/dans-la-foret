// ============================================================
// PURGE PROGRESSION v2 — données partagées, logique pure
//
// Source UNIQUE des collections purgées : lue par `scripts/purgeProgressionV2.ts` (ligne de commande)
// et par `src/services/purgeProgressionService.ts` (bouton admin du Profil).
// Voir docs/purge-progression-v2.md.
//
// SÉCURITÉ : `foret_commune` est volontairement absente des deux listes. Ne JAMAIS l'y ajouter sans accord
// explicite et séparé de l'utilisateur.
// ============================================================

/** Collections racine purgées (documents supprimés un par un). */
export const PURGE_ROOT_COLLECTIONS = [
  'leaderboard',      // classement général
  'worldRecords',     // records du monde par défi
  'jackpot',          // jackpot du Défi du Jour
  'jackpotClaims',    // réclamations du jackpot
  'friendChallenges', // défis entre amis en cours (basés sur d'anciens niveaux)
] as const;

/** Sous-collections purgées via collectionGroup (`dailyChallenges/{date}_{ligue}/results/{uid}` et anciens chemins). */
export const PURGE_GROUP_COLLECTIONS = [
  'results',
] as const;

/** Collections délibérément NON purgées. */
export const PURGE_PRESERVED = ['foret_commune', 'players', 'metrics'] as const;

/** Mot à saisir pour déverrouiller la suppression réelle depuis l'application. */
export const PURGE_CONFIRM_WORD = 'PURGER';

/** Taille d'un lot d'écriture Firestore (la limite est de 500 opérations par lot). */
export const PURGE_BATCH_SIZE = 400;

/** La saisie déverrouille-t-elle la suppression ? (casse et espaces autour ignorés, mot exact sinon). */
export function isPurgeConfirmed(input: string | null | undefined): boolean {
  return (input ?? '').trim().toUpperCase() === PURGE_CONFIRM_WORD;
}

export interface PurgeTargetCount {
  /** Libellé affiché : `leaderboard`, `*\/results`… */
  label: string;
  count: number;
}

/** Libellé d'une cible de purge (sous-collection : préfixe `* /`). */
export function getPurgeLabel(name: string, group: boolean): string {
  return group ? `*/${name}` : name;
}

/** Nombre total de documents à supprimer (valeurs invalides ignorées). */
export function sumPurgeTargets(targets: readonly PurgeTargetCount[] | null | undefined): number {
  let total = 0;
  for (const t of targets ?? []) {
    if (Number.isFinite(t.count) && t.count > 0) total += Math.floor(t.count);
  }
  return total;
}

/** Découpe une liste en lots de taille bornée (`size` ≥ 1). */
export function chunkForBatches<T>(items: readonly T[], size: number = PURGE_BATCH_SIZE): T[][] {
  const n = Math.max(1, Math.floor(size));
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += n) out.push(items.slice(i, i + n));
  return out;
}

/**
 * La suppression réelle est-elle autorisée ? Trois conditions cumulées : compte administrateur,
 * mot de confirmation exact, et quelque chose à supprimer.
 */
export function canRunPurge(opts: { isAdmin: boolean; confirmInput: string; total: number; busy: boolean }): boolean {
  return opts.isAdmin && !opts.busy && opts.total > 0 && isPurgeConfirmed(opts.confirmInput);
}
