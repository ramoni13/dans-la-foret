// ============================================================
// CATALOGUE DES TROPHÉES — Dans la Forêt (Progression v2, C8 / Lot 8)
//
// Les trophées REMPLACENT les badges (sans migration : le profil a été remis à zéro au Lot 1).
//   - 60 trophées de SÉRIE (15 séries × 4 paliers) : générés depuis `TROPHY_SERIES` (trophies.ts),
//     la rareté est déterminée par le palier (bois, pierre, or, cristal) ;
//   - 14 SURPRISES (badges uniques, conservés tels quels : mêmes identifiants, mêmes textes) ;
//   - 1 trophée FINAL « Esprit accompli » (fin du chapitre 7).
// Soit 75 trophées. Le stockage reste `playerStore.earnedBadges` (aucun champ renommé).
//
// Aucun « objectif actif » : tout trophée dont la condition est remplie est décerné.
// ============================================================

import { FINAL_TROPHY, TIER_RARITIES, TROPHY_SERIES, buildTrophyId, getTierTarget, TrophyRarity } from './trophies';

/** Rareté d'un trophée : bois, pierre, or, cristal (le palier pour une série). */
export type BadgeRarity = TrophyRarity;

/** Famille d'affichage (filtres de la collection). */
export type BadgeCategory =
  | 'solo' | 'daily' | 'onf' | 'duel' | 'herbier' | 'fidelite'
  | 'surprise' | 'final';

export interface BadgeDefinition {
  id: string;
  emoji: string;
  label: string;          // FR (langue par défaut)
  description: string;    // FR (langue par défaut)
  rarity: BadgeRarity;
  category: BadgeCategory;
  isSecret: boolean;      // true = affiché « ??? » avant obtention
  isSeasonal: boolean;    // true = disponible sur période limitée
  seasonStart?: string;   // ex: "10-01" (mois-jour)
  seasonEnd?: string;     // ex: "11-30"
  /** Série et palier (1 à 4) pour un trophée de série ; absents des surprises et du trophée final. */
  seriesId?: string;
  tier?: number;
  /** Traductions dans les autres langues (FR est la valeur principale) */
  translations?: {
    en?: { label: string; description: string };
  };
}

// ── Récompenses en graines par rareté ─────────────────────────────────────────
export const BADGE_SEED_REWARDS: Record<BadgeRarity, number> = {
  bois:    5,
  pierre:  15,
  or:      30,
  cristal: 75,
};

// ── Surprises : badges uniques conservés tels quels ───────────────────────────
// Catégorie d'origine remplacée par 'surprise' ; tout le reste (id, textes, rareté, saison) est inchangé.
const SURPRISES: BadgeDefinition[] = [
  {
    id: "regularite_lune",
    emoji: "🌙",
    label: "Veilleur de lune",
    description: "Joue entre 22h et 6h pendant 3 jours consécutifs",
    rarity: "pierre", category: "surprise", isSecret: false, isSeasonal: false,
    translations: { en: { label: "Moon Watcher", description: "Play between 10pm and 6am for 3 consecutive days" } },
  },
  {
    id: "regularite_soleil",
    emoji: "☀️",
    label: "Lève-tôt du bois",
    description: "Joue entre 6h et 9h pendant 5 jours consécutifs",
    rarity: "or", category: "surprise", isSecret: false, isSeasonal: false,
    translations: { en: { label: "Forest Early Bird", description: "Play between 6am and 9am for 5 consecutive days" } },
  },
  {
    id: "secret_fantome",
    emoji: "🌙",
    label: "Le Fantôme",
    description: "Joue exactement à minuit (00:00)",
    rarity: "cristal", category: "surprise", isSecret: true, isSeasonal: false,
    translations: { en: { label: "The Ghost", description: "Play at exactly midnight (00:00)" } },
  },
  {
    id: "secret_noel",
    emoji: "🎄",
    label: "Noël en forêt",
    description: "Joue le 25 décembre",
    rarity: "or", category: "surprise", isSecret: true, isSeasonal: false,
    translations: { en: { label: "Christmas in the Forest", description: "Play on December 25th" } },
  },
  {
    id: "secret_paques",
    emoji: "🐣",
    label: "L'Oeuf de Pâques",
    description: "Joue un dimanche matin entre 7h et 9h",
    rarity: "pierre", category: "surprise", isSecret: true, isSeasonal: false,
    translations: { en: { label: "The Easter Egg", description: "Play on a Sunday morning between 7am and 9am" } },
  },
  {
    id: "secret_boucle",
    emoji: "🔁",
    label: "Déjà-vu",
    description: "Rejoue le même défi 10 fois de suite",
    rarity: "pierre", category: "surprise", isSecret: true, isSeasonal: false,
    translations: { en: { label: "Déjà-vu", description: "Replay the same puzzle 10 times" } },
  },
  {
    id: "secret_coeur_brise",
    emoji: "💔",
    label: "Acharnement",
    description: "Échoue 5 fois sur le même défi",
    rarity: "bois", category: "surprise", isSecret: true, isSeasonal: false,
    translations: { en: { label: "Stubborn", description: "Fail 5 times on the same puzzle" } },
  },
  {
    id: "saisonnier_automne",
    emoji: "🍂",
    label: "Esprit d'automne",
    description: "Complète 5 défis pendant la saison d'automne",
    rarity: "pierre", category: "surprise", isSecret: false, isSeasonal: true,
    seasonStart: "09-22", seasonEnd: "12-20",
    translations: { en: { label: "Autumn Spirit", description: "Complete 5 puzzles during the autumn season" } },
  },
  {
    id: "saisonnier_hiver",
    emoji: "❄️",
    label: "Flocon de neige",
    description: "Complète 5 défis pendant la saison d'hiver",
    rarity: "pierre", category: "surprise", isSecret: false, isSeasonal: true,
    seasonStart: "12-21", seasonEnd: "03-19",
    translations: { en: { label: "Snowflake", description: "Complete 5 puzzles during the winter season" } },
  },
  {
    id: "saisonnier_printemps",
    emoji: "🌸",
    label: "Fleur de printemps",
    description: "Complète 5 défis pendant la saison de printemps",
    rarity: "pierre", category: "surprise", isSecret: false, isSeasonal: true,
    seasonStart: "03-20", seasonEnd: "06-20",
    translations: { en: { label: "Spring Blossom", description: "Complete 5 puzzles during the spring season" } },
  },
  {
    id: "saisonnier_ete",
    emoji: "☀️",
    label: "Soleil d'été",
    description: "Complète 5 défis pendant la saison d'été",
    rarity: "pierre", category: "surprise", isSecret: false, isSeasonal: true,
    seasonStart: "06-21", seasonEnd: "09-21",
    translations: { en: { label: "Summer Sun", description: "Complete 5 puzzles during the summer season" } },
  },
  {
    id: "record_first",
    emoji: "🌍",
    label: "Premier sur Terre",
    description: "Établis le tout premier record mondial sur un défi (aucun joueur n'avait encore de temps)",
    rarity: "or", category: "surprise", isSecret: false, isSeasonal: false,
    translations: { en: { label: "First on Earth", description: "Set the very first world record on a puzzle (no player had a time yet)" } },
  },
  {
    id: "record_mondial",
    emoji: "🏆",
    label: "Record du monde",
    description: "Bats le record mondial de temps sur un défi",
    rarity: "cristal", category: "surprise", isSecret: false, isSeasonal: false,
    translations: { en: { label: "World Record", description: "Beat the world record time on a puzzle" } },
  },
  {
    id: "ami_de_la_foret",
    emoji: "🌲",
    label: "Ami de la Forêt",
    description: "A soutenu la forêt et Planète Urgence en passant en premium",
    rarity: "or", category: "surprise", isSecret: false, isSeasonal: false,
    translations: { en: { label: "Friend of the Forest", description: "Supported the forest and Planète Urgence with a premium purchase" } },
  },
];

// ── Trophée final ─────────────────────────────────────────────────────────────
const FINAL: BadgeDefinition = {
  id: FINAL_TROPHY,
  emoji: '🌟',
  label: 'Esprit accompli',
  description: 'Terminer les 21 niveaux : le dernier chapitre est achevé.',
  rarity: 'cristal', category: 'final', isSecret: false, isSeasonal: false,
  translations: { en: { label: 'Spirit Fulfilled', description: 'Finish all 21 levels: the last chapter is complete.' } },
};

// ── Trophées de série : générés depuis le catalogue des séries ───────────────
// Les libellés FR / EN passent par l'i18n (`trophy_{serie}_name`, `trophy_{serie}_desc`) ; `label` et
// `description` ci-dessous sont les valeurs de repli (FR) pour les écrans qui ne traduisent pas.
const SERIES_TROPHIES: BadgeDefinition[] = TROPHY_SERIES.flatMap(series =>
  [1, 2, 3, 4].map(tier => ({
    id: buildTrophyId(series.id, tier),
    emoji: series.emoji,
    label: series.id + ' ' + tier,
    description: '',
    rarity: TIER_RARITIES[tier - 1],
    category: series.family as BadgeCategory,
    isSecret: false,
    isSeasonal: false,
    seriesId: series.id,
    tier,
  })),
);

/** Catalogue complet : séries, puis surprises, puis trophée final. */
export const BADGE_DEFINITIONS: BadgeDefinition[] = [...SERIES_TROPHIES, ...SURPRISES, FINAL];

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Map d'accès rapide par ID */
export const BADGE_MAP: Record<string, BadgeDefinition> = Object.fromEntries(
  BADGE_DEFINITIONS.map(b => [b.id, b])
);

/**
 * Retourne le label et la description d'un trophée dans la langue demandée.
 * Fallback FR si la traduction n'existe pas. Les trophées de série sont traduits par les écrans (i18n).
 */
export function getBadgeTexts(badge: BadgeDefinition, lang: string): { label: string; description: string } {
  const t = badge.translations?.[lang as 'en'];
  if (t) return t;
  return { label: badge.label, description: badge.description };
}

/**
 * Textes d'un trophée dans la langue du joueur, en tenant compte des séries.
 *   - trophée de SÉRIE : nom et description viennent de l'i18n (`trophy_{série}_name` / `_desc`, avec le seuil du
 *     palier en variable `{{target}}`) ; le Podium a une description par palier (`trophy_podium_tier_N`) ;
 *   - surprise / trophée final : textes portés par le catalogue (FR) et ses traductions.
 * `t` est la fonction de `useT()` ; `target` est le seuil du palier (voir `getSeriesThresholds`).
 */
export function getTrophyTexts(
  badge: BadgeDefinition,
  lang: string,
  t: (key: string, vars?: Record<string, string>) => string,
  target?: number,
): { label: string; description: string } {
  if (badge.seriesId && badge.tier) {
    target = target ?? getTierTarget(badge.seriesId, badge.tier);
    return {
      label: t(`trophy_${badge.seriesId}_name`),
      description: badge.seriesId === 'podium'
        ? t(`trophy_podium_tier_${badge.tier}`)
        : t(`trophy_${badge.seriesId}_desc`, { target: String(target ?? '') }),
    };
  }
  return getBadgeTexts(badge, lang);
}

/** Nombre total de trophées (hors secrets) pour l'affichage X / N */
export const TOTAL_NON_SECRET_BADGES = BADGE_DEFINITIONS.filter(b => !b.isSecret).length;

/** Nombre total de trophées secrets */
export const TOTAL_SECRET_BADGES = BADGE_DEFINITIONS.filter(b => b.isSecret).length;

/**
 * Vérifie si une date correspond à la saison d'un trophée saisonnier.
 * seasonStart / seasonEnd sont au format "MM-DD".
 */
export function isInSeason(badge: BadgeDefinition, date: Date): boolean {
  if (!badge.isSeasonal || !badge.seasonStart || !badge.seasonEnd) return false;

  const month = date.getMonth() + 1;
  const day   = date.getDate();
  const mmdd  = `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  // L'hiver chevauche le changement d'année (12-21 → 03-19)
  if (badge.seasonStart > badge.seasonEnd) {
    return mmdd >= badge.seasonStart || mmdd <= badge.seasonEnd;
  }
  return mmdd >= badge.seasonStart && mmdd <= badge.seasonEnd;
}
