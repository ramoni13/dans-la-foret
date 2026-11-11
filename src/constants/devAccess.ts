// ============================================================
// CONTOURNEMENTS « DÉVELOPPEUR » — point d'entrée UNIQUE
//
// Règle transverse A de la Progression v2 : plus aucun nom de compte codé
// en dur dans les écrans. Tout passe par ces helpers purs.
//
// TODO avant publication : retirer ou vider ces listes (les contournements
// ne doivent pas exister en production).
// ============================================================

/** Compte de démonstration : contourne déblocages, jetons amis et limite quotidienne Forestier. */
export const DEMO_USERNAMES: readonly string[] = ['planete'];

/** Comptes de développement : accès anticipé aux modes (ex. Défi du Jour). Inclut le compte démo. */
export const DEV_USERNAMES: readonly string[] = ['Ramoni', 'Cedric', 'planete'];

/** Comptes administrateur : outils admin, bouton « Rejouer » du Défi du Jour, roulette rejouable. */
export const ADMIN_USERNAMES: readonly string[] = ['Ramoni'];

function has(list: readonly string[], username: string | null | undefined): boolean {
  return !!username && list.includes(username);
}

/** Compte démo (`planete`). */
export function isDemoAccount(username: string | null | undefined): boolean {
  return has(DEMO_USERNAMES, username);
}

/** Compte de développement (accès anticipé aux modes). */
export function isDevAccount(username: string | null | undefined): boolean {
  return has(DEV_USERNAMES, username);
}

/** Compte administrateur (outils admin). */
export function isAdminAccount(username: string | null | undefined): boolean {
  return has(ADMIN_USERNAMES, username);
}
