// ============================================================
// SUPPRESSION DE COMPTE (droit à l'effacement, RGPD art. 17 ; exigence Apple 5.1.1(v) et Google Play)
//
// Logique PURE (aucune dépendance React / Firebase), testée par __tests__/accountDeletion.test.ts.
// Le service `src/services/accountDeletionService.ts` exécute ce plan.
//
// Ordre imposé :
//   1. ré-authentification (Firebase exige une connexion récente pour `deleteUser`) ;
//   2. suppression des données Firestore du joueur (tant qu'il est encore authentifié : après `deleteUser`,
//      les règles Firestore refuseraient toute écriture) ;
//   3. suppression du compte Firebase Auth, EN DERNIER ;
//   4. nettoyage local (store + AsyncStorage).
// ============================================================

/** Méthode de ré-authentification selon le fournisseur du compte. */
export type ReauthMethod = 'password' | 'google' | 'none';

/**
 * Choisit la ré-authentification à partir des `providerId` du compte (`user.providerData`).
 * Mot de passe prioritaire (il fonctionne sur toutes les plateformes) ; Google : popup web uniquement.
 */
export function getReauthMethod(providerIds: readonly string[]): ReauthMethod {
  if (providerIds.includes('password')) return 'password';
  if (providerIds.includes('google.com')) return 'google';
  return 'none';
}

/** Une cible Firestore à effacer pour un joueur donné. */
export type DeletionTarget =
  | { kind: 'doc'; collection: string; id: string }
  | { kind: 'query'; collection: string; field: string; value: string }
  | { kind: 'group_query'; group: string; field: string; value: string };

/** Documents « à un seul joueur », identifiés par son uid. */
export const DELETION_UID_DOCS: readonly string[] = ['players', 'leaderboard', 'metrics'];

/**
 * Plan complet des données Firestore à effacer pour `uid`. L'ordre compte : le profil `players/{uid}` est
 * supprimé EN DERNIER parmi les données Firestore (si une étape échoue avant, le profil reste cohérent et la
 * suppression peut être relancée depuis l'app).
 *
 * Non effacés (non personnels) : `foret_commune/global` (compteur collectif anonyme), `jackpot/daily`.
 */
export function buildDeletionPlan(uid: string): DeletionTarget[] {
  if (!uid) return [];
  return [
    // Résultats du Défi du Jour : dailyChallenges/{date}_{ligue}/results/{uid} (pseudo + temps)
    { kind: 'group_query', group: 'results', field: 'userId', value: uid },
    // Gains du bandit manchot : jackpotClaims/{uid}_{date}
    { kind: 'query', collection: 'jackpotClaims', field: 'uid', value: uid },
    // Défis entre amis où le joueur est l'une des deux parties (pseudo, temps)
    { kind: 'query', collection: 'friendChallenges', field: 'challengerUid', value: uid },
    { kind: 'query', collection: 'friendChallenges', field: 'opponentUid', value: uid },
    // Records du monde détenus (pseudo public) : le record disparaît, le prochain joueur pourra le reprendre
    { kind: 'query', collection: 'worldRecords', field: 'userId', value: uid },
    // Documents à un seul joueur ; `players` en dernier
    { kind: 'doc', collection: 'leaderboard', id: uid },
    { kind: 'doc', collection: 'metrics', id: uid },
    { kind: 'doc', collection: 'players', id: uid },
  ];
}

/** Libellé lisible d'une cible (journal, message d'erreur). */
export function describeTarget(t: DeletionTarget): string {
  switch (t.kind) {
    case 'doc': return `${t.collection}/${t.id}`;
    case 'query': return `${t.collection} (${t.field})`;
    case 'group_query': return `${t.group}/* (${t.field})`;
  }
}

/** Clés AsyncStorage à effacer sur l'appareil après la suppression. */
export const DELETION_LOCAL_KEYS: readonly string[] = ['dlf_player_v1', 'dlf_audio_v1'];

/** Taille maximale d'un lot d'écriture Firestore (limite 500, marge). */
export const DELETION_BATCH_SIZE = 400;

export function chunk<T>(items: readonly T[], size = DELETION_BATCH_SIZE): T[][] {
  const out: T[][] = [];
  const n = Math.max(1, Math.floor(size));
  for (let i = 0; i < items.length; i += n) out.push(items.slice(i, i + n));
  return out;
}

/** Erreurs de suppression traduites en clé i18n. */
export type DeletionErrorKey =
  | 'account_delete_err_password'
  | 'account_delete_err_recent_login'
  | 'account_delete_err_network'
  | 'account_delete_err_cancelled'
  | 'account_delete_err_generic';

export function mapDeletionError(code: string | undefined | null): DeletionErrorKey {
  switch (code) {
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
    case 'auth/missing-password':
    case 'auth/invalid-login-credentials':
      return 'account_delete_err_password';
    case 'auth/requires-recent-login':
    case 'auth/user-mismatch':
    case 'auth/too-many-requests':
      return 'account_delete_err_recent_login';
    case 'auth/network-request-failed':
    case 'unavailable':
      return 'account_delete_err_network';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'account_delete_err_cancelled';
    default:
      return 'account_delete_err_generic';
  }
}

/** Mot de confirmation à taper avant la suppression (évite un effacement par erreur). */
export function getDeletionConfirmWord(lang: 'fr' | 'en'): string {
  return lang === 'en' ? 'DELETE' : 'SUPPRIMER';
}

export function isDeletionConfirmed(input: string, lang: 'fr' | 'en'): boolean {
  return input.trim().toUpperCase() === getDeletionConfirmWord(lang);
}
