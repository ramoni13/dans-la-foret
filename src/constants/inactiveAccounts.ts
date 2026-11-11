// ============================================================
// COMPTES INACTIFS — durée de conservation (RGPD art. 5.1.e)
//
// Engagement de la politique de confidentialité (Site/confidentialite.html, § 5) et des CGU (§ 3) :
//   - un compte GRATUIT sans aucune connexion depuis 2 ans est supprimé avec ses données ;
//   - un compte PREMIUM n'est JAMAIS supprimé pour inactivité (il contient un achat à durée illimitée).
//
// Logique PURE (aucune dépendance React / Firebase), testée par __tests__/inactiveAccounts.test.ts.
// Exécution : src/services/inactiveAccountService.ts, lancée une fois par jour au démarrage de l'app.
// ============================================================

/** Durée d'inactivité au-delà de laquelle un compte gratuit est supprimé, en années calendaires. */
export const INACTIVITY_RETENTION_YEARS = 2;

/** Nombre maximal de comptes supprimés par passage (le démarrage de l'app reste léger ; la suite le lendemain). */
export const INACTIVE_PURGE_MAX_PER_RUN = 50;

/** Nombre maximal de candidats lus par requête Firestore. */
export const INACTIVE_PURGE_QUERY_LIMIT = 200;

/** Clé AsyncStorage : date locale (YYYY-MM-DD) du dernier passage de la vérification. */
export const INACTIVE_PURGE_STORAGE_KEY = 'dlf_inactive_purge_last_run';

/** Date limite : toute activité ANTÉRIEURE à cet instant est trop ancienne. */
export function getInactivityCutoff(now: Date = new Date(), years: number = INACTIVITY_RETENTION_YEARS): Date {
  const cutoff = new Date(now.getTime());
  cutoff.setFullYear(cutoff.getFullYear() - years);
  return cutoff;
}

/**
 * Convertit une date Firestore (Timestamp, `{ seconds }`), un `Date`, un nombre (ms) ou une chaîne ISO en ms.
 * Renvoie `null` si la valeur est absente ou illisible (ex. `serverTimestamp()` pas encore résolu).
 */
export function toMillis(value: unknown): number | null {
  if (value == null) return null;
  if (value instanceof Date) {
    const ms = value.getTime();
    return Number.isFinite(ms) ? ms : null;
  }
  if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? value : null;
  if (typeof value === 'string') {
    const ms = Date.parse(value);
    return Number.isFinite(ms) ? ms : null;
  }
  if (typeof value === 'object') {
    const v = value as { toMillis?: () => number; seconds?: unknown };
    if (typeof v.toMillis === 'function') {
      const ms = v.toMillis();
      return Number.isFinite(ms) ? ms : null;
    }
    if (typeof v.seconds === 'number' && Number.isFinite(v.seconds)) return v.seconds * 1000;
  }
  return null;
}

/** Données lues pour un compte candidat. */
export interface InactiveCandidate {
  uid: string;
  username?: string | null;
  /** `players/{uid}.isPremium` */
  playerIsPremium?: boolean | null;
  /** `metrics/{uid}.isPremium` (copie, prise en compte par prudence) */
  metricsIsPremium?: boolean | null;
  /** `metrics/{uid}.lastSeenAt` : dernière ouverture de l'app par le joueur connecté */
  lastSeenAt?: unknown;
  /** `players/{uid}.updatedAt` : dernière écriture du profil (repli si `metrics` absent) */
  playerUpdatedAt?: unknown;
  /** `players/{uid}.createdAt` */
  playerCreatedAt?: unknown;
  /** Le document `players/{uid}` existe-t-il ? */
  hasPlayerDoc: boolean;
}

export type InactiveDecision =
  | 'delete'
  | 'keep_premium'
  | 'keep_active'
  | 'keep_no_date'
  | 'keep_protected';

/** Dernière activité connue (la plus récente des dates disponibles), ou `null` si aucune n'est lisible. */
export function getLastActivityMs(c: Pick<InactiveCandidate, 'lastSeenAt' | 'playerUpdatedAt' | 'playerCreatedAt'>): number | null {
  const dates = [toMillis(c.lastSeenAt), toMillis(c.playerUpdatedAt), toMillis(c.playerCreatedAt)]
    .filter((ms): ms is number => ms !== null);
  return dates.length > 0 ? Math.max(...dates) : null;
}

/**
 * Décide du sort d'un compte. Par prudence, tout doute conserve le compte :
 *   - premium (profil OU métriques) → conservé, toujours ;
 *   - compte protégé (compte connecté, comptes de développement) → conservé ;
 *   - aucune date lisible → conservé ;
 *   - activité la plus récente postérieure à la date limite → conservé.
 */
export function decideInactiveAccount(
  c: InactiveCandidate,
  opts: { now?: Date; protectedUids?: readonly string[]; isProtectedUsername?: (u: string | null | undefined) => boolean } = {},
): InactiveDecision {
  if (c.playerIsPremium === true || c.metricsIsPremium === true) return 'keep_premium';
  if (opts.protectedUids?.includes(c.uid)) return 'keep_protected';
  if (opts.isProtectedUsername?.(c.username ?? null)) return 'keep_protected';
  const last = getLastActivityMs(c);
  if (last === null) return 'keep_no_date';
  const cutoff = getInactivityCutoff(opts.now ?? new Date()).getTime();
  return last < cutoff ? 'delete' : 'keep_active';
}

/**
 * La vérification doit-elle tourner maintenant ?
 *   - `enabled` : drapeau `INACTIVE_PURGE_ON_LAUNCH` (passer à false quand une tâche serveur prend le relais) ;
 *   - `isAdmin` : seul un compte administrateur a le droit (règles Firestore) d'effacer les données d'autrui ;
 *   - une seule fois par jour (date locale du dernier passage).
 */
export function shouldRunInactivePurge(p: {
  enabled: boolean;
  isAdmin: boolean;
  lastRunDate: string | null | undefined;
  today: string;
}): boolean {
  if (!p.enabled || !p.isAdmin) return false;
  return p.lastRunDate !== p.today;
}

/** Fusionne et dédoublonne des listes d'uid candidats, en respectant un plafond. */
export function mergeCandidateUids(lists: ReadonlyArray<readonly string[]>, max: number = INACTIVE_PURGE_QUERY_LIMIT * 2): string[] {
  const seen = new Set<string>();
  for (const list of lists) {
    for (const uid of list) {
      if (uid && !seen.has(uid)) seen.add(uid);
      if (seen.size >= max) return [...seen];
    }
  }
  return [...seen];
}

/**
 * Le compte Firebase Auth a-t-il été créé il y a plus de `minAgeMs` ? (`user.metadata.creationTime`, chaîne date)
 * Sert à distinguer un compte purgé pour inactivité (profil effacé, compte Auth ancien) d'une inscription en cours
 * (compte Auth tout neuf, profil pas encore écrit). Date illisible → `false` (on ne recrée rien).
 */
export function isAuthAccountOlderThan(creationTime: string | null | undefined, minAgeMs: number, now: Date = new Date()): boolean {
  const created = toMillis(creationTime ?? null);
  if (created === null) return false;
  return now.getTime() - created > minAgeMs;
}

/** Compte-rendu d'un passage. */
export interface InactivePurgeReport {
  examined: number;
  deleted: string[];
  keptPremium: number;
  failed: string[];
  /** Cibles non critiques restées en place, par uid supprimé. */
  residual: Record<string, string[]>;
}

export function createEmptyReport(): InactivePurgeReport {
  return { examined: 0, deleted: [], keptPremium: 0, failed: [], residual: {} };
}
