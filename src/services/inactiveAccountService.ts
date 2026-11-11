// ============================================================
// PURGE DES COMPTES INACTIFS (conservation : 2 ans, comptes gratuits seulement)
//
// `runInactivePurgeIfDue(admin)` est appelée au démarrage de l'app (`(tabs)/_layout.tsx`), après la connexion.
// Elle ne fait rien sauf si (logique pure : `shouldRunInactivePurge`, src/constants/inactiveAccounts.ts) :
//   - le drapeau `INACTIVE_PURGE_ON_LAUNCH` est à true ;
//   - le compte connecté est administrateur (seul compte autorisé par les règles Firestore à effacer les
//     données d'un autre joueur ; un joueur ordinaire ne lance JAMAIS la purge) ;
//   - elle n'a pas déjà tourné aujourd'hui sur cet appareil.
//
// Déroulement :
//   1. candidats : `metrics` dont `lastSeenAt` est antérieur à la date limite, puis `players` dont `updatedAt`
//      est antérieur (comptes sans document `metrics`) ; index simples, aucun index composite ;
//   2. pour chaque candidat, relecture de `players/{uid}` et `metrics/{uid}` puis décision
//      (`decideInactiveAccount`) : un compte PREMIUM n'est jamais supprimé, tout doute conserve le compte ;
//   3. effacement des données Firestore avec le même plan que la suppression par le joueur
//      (`eraseAccountData`, profil `players/{uid}` en dernier).
//
// LIMITE : le SDK client Firebase ne peut pas supprimer le compte Firebase Auth d'un AUTRE utilisateur. Le compte
// Auth (uid + e-mail) reste donc en place ; il est à supprimer depuis la console Firebase (liste renvoyée dans le
// compte-rendu) ou par une Cloud Function (SDK Admin : `auth().deleteUser`). Si le joueur revient, il retrouve un
// profil neuf (`(tabs)/_layout.tsx` recrée le profil manquant).
// ============================================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  where,
} from 'firebase/firestore';
import { db } from './firebase';
import { eraseAccountData } from './accountDeletionService';
import { INACTIVE_PURGE_ON_LAUNCH } from '../constants/featureFlags';
import { isAdminAccount, isDevAccount } from '../constants/devAccess';
import { todayLocalISO } from '../constants/dailyLimits';
import {
  INACTIVE_PURGE_MAX_PER_RUN,
  INACTIVE_PURGE_QUERY_LIMIT,
  INACTIVE_PURGE_STORAGE_KEY,
  createEmptyReport,
  decideInactiveAccount,
  getInactivityCutoff,
  mergeCandidateUids,
  shouldRunInactivePurge,
  type InactiveCandidate,
  type InactivePurgeReport,
} from '../constants/inactiveAccounts';

/** Lit les uid dont la date `field` de la collection est antérieure à la date limite. */
async function findStaleUids(collectionName: string, field: string, cutoff: Date): Promise<string[]> {
  const snap = await getDocs(query(
    collection(db, collectionName),
    where(field, '<', Timestamp.fromDate(cutoff)),
    limit(INACTIVE_PURGE_QUERY_LIMIT),
  ));
  return snap.docs.map(d => d.id);
}

async function loadCandidate(uid: string): Promise<InactiveCandidate> {
  const [playerSnap, metricsSnap] = await Promise.all([
    getDoc(doc(db, 'players', uid)),
    getDoc(doc(db, 'metrics', uid)),
  ]);
  const p = playerSnap.exists() ? playerSnap.data() : undefined;
  const m = metricsSnap.exists() ? metricsSnap.data() : undefined;
  return {
    uid,
    username: (p?.username as string | undefined) ?? null,
    playerIsPremium: p?.isPremium === true,
    metricsIsPremium: m?.isPremium === true,
    lastSeenAt: m?.lastSeenAt,
    playerUpdatedAt: p?.updatedAt,
    playerCreatedAt: p?.createdAt,
    hasPlayerDoc: playerSnap.exists(),
  };
}

/**
 * Un passage de purge (sans la garde « une fois par jour »). Réservé à l'administrateur.
 * `currentUid` n'est jamais supprimé. Les comptes de développement non plus.
 */
export async function purgeInactiveAccounts(opts: {
  adminUsername: string | null | undefined;
  currentUid: string;
  now?: Date;
}): Promise<InactivePurgeReport> {
  if (!isAdminAccount(opts.adminUsername)) throw new Error('Action réservée à un compte administrateur.');
  const now = opts.now ?? new Date();
  const cutoff = getInactivityCutoff(now);
  const report = createEmptyReport();

  // Chaque requête est indépendante : si l'une est refusée (règles, index), l'autre est quand même utilisée.
  const lists = await Promise.all([
    findStaleUids('metrics', 'lastSeenAt', cutoff).catch(err => { console.warn('[inactivePurge] metrics', err); return []; }),
    findStaleUids('players', 'updatedAt', cutoff).catch(err => { console.warn('[inactivePurge] players', err); return []; }),
  ]);
  const uids = mergeCandidateUids(lists);

  for (const uid of uids) {
    if (report.deleted.length >= INACTIVE_PURGE_MAX_PER_RUN) break;
    report.examined += 1;
    try {
      const candidate = await loadCandidate(uid);
      const decision = decideInactiveAccount(candidate, {
        now,
        protectedUids: [opts.currentUid],
        isProtectedUsername: u => isDevAccount(u) || isAdminAccount(u),
      });
      if (decision === 'keep_premium') { report.keptPremium += 1; continue; }
      if (decision !== 'delete') continue;
      const residual = await eraseAccountData(uid);
      report.deleted.push(uid);
      if (residual.length > 0) report.residual[uid] = residual;
    } catch (err) {
      console.warn('[inactivePurge] échec pour', uid, err);
      report.failed.push(uid);
    }
  }
  return report;
}

/**
 * Point d'entrée du démarrage : lance la purge au plus une fois par jour, en arrière-plan.
 * Ne lève jamais d'erreur (le démarrage de l'app n'en dépend pas). Renvoie `null` si rien n'a tourné.
 */
export async function runInactivePurgeIfDue(opts: {
  username: string | null | undefined;
  currentUid: string;
}): Promise<InactivePurgeReport | null> {
  try {
    const today = todayLocalISO();
    const isAdmin = isAdminAccount(opts.username);
    if (!INACTIVE_PURGE_ON_LAUNCH || !isAdmin) return null;
    const lastRunDate = await AsyncStorage.getItem(INACTIVE_PURGE_STORAGE_KEY);
    if (!shouldRunInactivePurge({ enabled: INACTIVE_PURGE_ON_LAUNCH, isAdmin, lastRunDate, today })) return null;

    // Marqué AVANT le passage : un échec (réseau, règles) n'est pas retenté en boucle le même jour.
    await AsyncStorage.setItem(INACTIVE_PURGE_STORAGE_KEY, today);
    const report = await purgeInactiveAccounts({ adminUsername: opts.username, currentUid: opts.currentUid });
    if (report.deleted.length > 0 || report.failed.length > 0) {
      console.info(
        '[inactivePurge] examinés :', report.examined,
        '· supprimés :', report.deleted.length,
        '· premium conservés :', report.keptPremium,
        '· échecs :', report.failed.length,
        '· comptes Auth à supprimer dans la console Firebase :', report.deleted,
      );
    }
    return report;
  } catch (err) {
    console.warn('[inactivePurge] passage impossible', err);
    return null;
  }
}
