// ============================================================
// LIMITES QUOTIDIENNES DES JOUEURS GRATUITS — logique pure
//
// Une seule source pour : la limite du Forestier, les jetons du Duel, les bonus du jour et le compteur de pubs de
// la Forêt commune (`adViews`, voir adRewards.ts). Aucune dépendance React / Zustand / Firebase : testé dans
// __tests__/dailyLimits.test.ts.
//
// Un jour = la date locale « YYYY-MM-DD » (même convention que `playerStore.checkDailyLogin`).
// Les compteurs vivent dans l'AsyncStorage ET dans Firestore (`players/{uid}.dailyLimits`) : fermer l'app,
// se déconnecter ou changer d'appareil ne remet donc pas les limites à zéro.
//
// Une pub ne rend que des utilisations de BONUS (recharge d'un bonus épuisé, joueur gratuit) : jamais de grille du
// Forestier ni de jeton de Duel (voir adRewards.ts). La fusion local/cloud des bonus raisonne donc en « consommé »
// (total offert moins restant) pour ne perdre ni une recharge faite sur un appareil, ni une consommation faite sur
// l'autre.
// ============================================================

import {
  AdViews,
  ONF_AD_RECHARGE_GRIDS,
  bonusPlacement,
  getAdViews,
  mergeAdViews,
  sanitizeAdViews,
} from './adRewards';

/** Grilles du Forestier jouables par jour (joueur gratuit). Illimitées pour un premium. */
export const ONF_DAILY_LIMIT = 3;
/** Jetons de Duel offerts par jour (joueur gratuit). Illimités pour un premium. */
export const FRIEND_TOKENS_PER_DAY = 3;
/** Utilisations offertes de chaque bonus par jour (joueur gratuit) ; une pub les remet à ce niveau. Illimitées pour un premium. */
export const BONUS_USES_PER_DAY = 3;

/** Identifiants des bonus rechargeables. */
const BONUS_IDS = ['reveal_cell', 'instinct'] as const;

/** Date locale « YYYY-MM-DD » (le jour des limites change à minuit, heure de l'appareil). */
export function todayLocalISO(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/** Compteurs qui se remettent à zéro chaque jour. */
export interface DailyLimits {
  /** Date du dernier remplissage des compteurs : s'ils sont d'un autre jour, ils sont périmés. */
  lastBonusResetDate: string | null;
  onfDailyCount: number;
  lastOnfDailyDate: string;
  friendChallengeTokens: number;
  dailyBonusUses: Record<string, number>;
  /** Pubs regardées aujourd'hui, par emplacement (recharges de bonus, Forêt commune). */
  adViews: AdViews;
}

/** Compteurs d'un jour neuf. */
export function createFreshDailyLimits(today: string): DailyLimits {
  return {
    lastBonusResetDate: today,
    onfDailyCount: 0,
    lastOnfDailyDate: today,
    friendChallengeTokens: FRIEND_TOKENS_PER_DAY,
    dailyBonusUses: { reveal_cell: BONUS_USES_PER_DAY, instinct: BONUS_USES_PER_DAY },
    adViews: {},
  };
}

/** Les compteurs sont-ils ceux d'aujourd'hui ? */
export function isLimitsOfDay(limits: Pick<DailyLimits, 'lastBonusResetDate'>, today: string): boolean {
  return limits.lastBonusResetDate === today;
}

/** Extrait les compteurs d'un état (store ou sauvegarde locale), sans partager d'objet. */
export function extractDailyLimits(s: DailyLimits): DailyLimits {
  return {
    lastBonusResetDate: s.lastBonusResetDate,
    onfDailyCount: s.onfDailyCount,
    lastOnfDailyDate: s.lastOnfDailyDate,
    friendChallengeTokens: s.friendChallengeTokens,
    dailyBonusUses: { ...s.dailyBonusUses },
    adViews: { ...(s.adViews ?? {}) },
  };
}

/**
 * Nombre de jetons de Duel valide : entier entre 0 et `max` (par défaut les 3 du jour). Valeur absente ou invalide :
 * `max` (jour neuf).
 */
export function clampFriendTokens(n: unknown, max: number = FRIEND_TOKENS_PER_DAY): number {
  const v = typeof n === 'number' && Number.isFinite(n) ? Math.floor(n) : max;
  return Math.min(max, Math.max(0, v));
}

function toCount(n: unknown): number {
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

function toBonusUses(n: unknown): number {
  const v = typeof n === 'number' && Number.isFinite(n) ? Math.floor(n) : BONUS_USES_PER_DAY;
  return Math.min(BONUS_USES_PER_DAY, Math.max(0, v));
}

/**
 * Compteurs lus depuis une source non fiable (AsyncStorage, Firestore). Renvoie `null` si la source ne contient
 * aucune date : on ne sait alors rien du jour, elle est ignorée. Les valeurs hors bornes sont ramenées dans les bornes.
 * Une source d'avant les recharges par bonus (champ `watchAdUsedToday`, sans `adViews`) est convertie : recharge unique
 * déjà faite = les deux bonus comptés comme déjà rechargés au maximum (aucune pub en plus). Les anciens emplacements
 * (grille Forestier, jeton de Duel, graines ×2) sont écartés : ils ne redonnent AUCUNE partie.
 */
export function sanitizeDailyLimits(raw: unknown): DailyLimits | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const date = typeof r.lastBonusResetDate === 'string' && r.lastBonusResetDate ? r.lastBonusResetDate : null;
  if (!date) return null;
  const uses = (r.dailyBonusUses && typeof r.dailyBonusUses === 'object' ? r.dailyBonusUses : {}) as Record<string, unknown>;
  return {
    lastBonusResetDate: date,
    onfDailyCount: toCount(r.onfDailyCount),
    lastOnfDailyDate: typeof r.lastOnfDailyDate === 'string' ? r.lastOnfDailyDate : date,
    friendChallengeTokens: clampFriendTokens(r.friendChallengeTokens),
    dailyBonusUses: {
      reveal_cell: toBonusUses(uses.reveal_cell),
      instinct: toBonusUses(uses.instinct),
    },
    adViews: sanitizeAdViews(r.adViews, r.watchAdUsedToday === true),
  };
}

/** Utilisations de bonus déjà consommées : total offert (base + recharges) moins le restant. */
function consumed(views: number, remaining: number): number {
  return BONUS_USES_PER_DAY * (1 + views) - remaining;
}

/**
 * Fusion des compteurs locaux et cloud, à la connexion. Règle : **le plus restrictif des deux, pour aujourd'hui**.
 *  - un compteur d'un autre jour est périmé et ignoré ;
 *  - aucune source du jour → jour neuf ; une seule → elle ;
 *  - les deux → grilles jouées : max ; jetons de Duel restants : min ; pubs regardées : max par emplacement ; et pour
 *    les bonus on fusionne la CONSOMMATION (max), puis on recompose le restant avec le plus grand nombre de recharges.
 *    Une recharge par pub faite sur un appareil est ainsi conservée, et une partie consommée sur l'autre aussi.
 * Se déconnecter, réinstaller ou changer d'appareil ne permet donc jamais de récupérer des parties du jour.
 */
export function mergeDailyLimits(local: DailyLimits | null, cloud: DailyLimits | null, today: string): DailyLimits {
  const l = local && isLimitsOfDay(local, today) ? local : null;
  const c = cloud && isLimitsOfDay(cloud, today) ? cloud : null;
  if (!l && !c) return createFreshDailyLimits(today);
  if (!l) return extractDailyLimits(c!);
  if (!c) return extractDailyLimits(l);

  const adViews = mergeAdViews(l.adViews, c.adViews);

  // Bonus : une pub remet le bonus à BONUS_USES_PER_DAY (elle n'est proposée qu'à 0), donc +BONUS_USES_PER_DAY au total.
  const bonusIds = Array.from(new Set<string>([...BONUS_IDS, ...Object.keys(l.dailyBonusUses), ...Object.keys(c.dailyBonusUses)]));
  const dailyBonusUses: Record<string, number> = {};
  for (const id of bonusIds) {
    const placement = bonusPlacement(id);
    const vl = placement ? getAdViews(l.adViews, placement) : 0;
    const vc = placement ? getAdViews(c.adViews, placement) : 0;
    const vm = placement ? getAdViews(adViews, placement) : 0;
    const used = Math.max(
      consumed(vl, l.dailyBonusUses[id] ?? BONUS_USES_PER_DAY),
      consumed(vc, c.dailyBonusUses[id] ?? BONUS_USES_PER_DAY),
    );
    dailyBonusUses[id] = Math.min(BONUS_USES_PER_DAY, Math.max(0, BONUS_USES_PER_DAY * (1 + vm) - used));
  }

  return {
    lastBonusResetDate: today,
    onfDailyCount: Math.max(l.onfDailyCount, c.onfDailyCount),
    lastOnfDailyDate: today,
    friendChallengeTokens: clampFriendTokens(Math.min(l.friendChallengeTokens, c.friendChallengeTokens)),
    dailyBonusUses,
    adViews,
  };
}

/** Les compteurs ont-ils changé ? (déclenche la sauvegarde cloud) */
export function dailyLimitsEqual(a: DailyLimits, b: DailyLimits): boolean {
  return JSON.stringify(extractDailyLimits(a)) === JSON.stringify(extractDailyLimits(b));
}

// ── Forestier ────────────────────────────────────────────────────────────────

export interface OnfLimitInput {
  onfDailyCount: number;
  /** Premium ou compte de démonstration : aucune limite. */
  exempt: boolean;
  /**
   * Recharges par vidéo faites aujourd'hui (`adViews.onf_recharge`, 0 ou 1). Chacune ajoute `ONF_AD_RECHARGE_GRIDS`
   * défis au quota offert ; `onfDailyCount` reste un cumul qui ne baisse jamais (la fusion local / cloud, au maximum,
   * ne peut donc pas perdre une recharge). Absent : 0.
   */
  onfRecharges?: number;
}

/** Quota de défis offert aujourd'hui (3 + 3 par recharge par vidéo). */
export function getOnfQuota(onfRecharges: number = 0): number {
  const n = Number.isFinite(onfRecharges) && onfRecharges > 0 ? Math.floor(onfRecharges) : 0;
  return ONF_DAILY_LIMIT + n * ONF_AD_RECHARGE_GRIDS;
}

/** Grilles du Forestier encore jouables aujourd'hui (`Infinity` si le joueur est exempté). */
export function getOnfRemaining({ onfDailyCount, exempt, onfRecharges = 0 }: OnfLimitInput): number {
  if (exempt) return Infinity;
  return Math.max(0, getOnfQuota(onfRecharges) - onfDailyCount);
}

/** La limite quotidienne du Forestier est-elle atteinte ? */
export function isOnfLimitReached(input: OnfLimitInput): boolean {
  return getOnfRemaining(input) === 0;
}
