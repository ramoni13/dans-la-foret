// ============================================================
// CATALOGUE DES BADGES — Dans la Forêt
// 41 badges au total : 36 standard + 5 secrets
// ============================================================

export type BadgeRarity = 'bois' | 'pierre' | 'or' | 'cristal';
export type BadgeCategory =
  | 'vitesse'
  | 'precision'
  | 'regularite'
  | 'social'
  | 'amelioration'
  | 'exploration'
  | 'secret'
  | 'saisonnier';

export interface BadgeDefinition {
  id: string;
  emoji: string;
  label: string;          // FR (langue par défaut)
  description: string;    // FR (langue par défaut)
  rarity: BadgeRarity;
  category: BadgeCategory;
  isSecret: boolean;      // true = affiché "??? Badge secret" avant obtention
  isSeasonal: boolean;    // true = disponible sur période limitée
  seasonStart?: string;   // ex: "10-01" (mois-jour)
  seasonEnd?: string;     // ex: "11-30"
  /** Traductions dans les autres langues (FR est la valeur principale) */
  translations?: {
    en?: { label: string; description: string };
  };
}

// ── Seuils de déblocage de contenu ────────────────────────────────────────────
export type RarityUnlockId =
  | 'seeds_10'
  | 'seeds_50'
  | 'bonus_instinct'
  | 'bonus_flash'
  | 'theme_automne'
  | 'theme_hiver'
  | 'theme_foret_mystique'
  | 'mode_zen'
  | 'defi_journalier'
  | 'niveau_14'
  | 'avatar_esprit';

export interface RarityUnlock {
  rarity: BadgeRarity;
  count: number;         // Nombre de badges de cette rareté requis
  unlock: RarityUnlockId;
  label: string;
}

export const RARITY_UNLOCKS: RarityUnlock[] = [
  // ── Bois (9 badges bois) ──────────────────────────────────
  { rarity: 'bois',    count: 3,  unlock: 'seeds_10',           label: '+10 Graines offertes' },
  { rarity: 'bois',    count: 6,  unlock: 'mode_zen',           label: 'Mode Zen débloqué' },
  { rarity: 'bois',    count: 9,  unlock: 'defi_journalier',    label: 'Défi journalier débloqué' },
  // ── Pierre (9 badges pierre) ──────────────────────────────
  { rarity: 'pierre',  count: 3,  unlock: 'theme_automne',      label: 'Thème Automne débloqué' },
  { rarity: 'pierre',  count: 5,  unlock: 'bonus_flash',        label: 'Bonus Flash débloqué' },
  { rarity: 'pierre',  count: 7,  unlock: 'seeds_50',           label: '+50 Graines offertes' },
  { rarity: 'pierre',  count: 9,  unlock: 'theme_hiver',        label: 'Thème Hiver débloqué' },
  // ── Or (14 badges or) ─────────────────────────────────────
  { rarity: 'or',      count: 3,  unlock: 'bonus_instinct',     label: 'Bonus Instinct débloqué' },
  { rarity: 'or',      count: 7,  unlock: 'theme_foret_mystique', label: 'Thème Forêt Mystique débloqué' },
  { rarity: 'or',      count: 12, unlock: 'niveau_14',          label: 'Niveau 14 débloqué' },
  // ── Cristal (9 badges cristal) ────────────────────────────
  { rarity: 'cristal', count: 3,  unlock: 'avatar_esprit',      label: 'Avatar Esprit de la Forêt débloqué' },
];

// ── Récompenses en graines par rareté ─────────────────────────────────────────
export const BADGE_SEED_REWARDS: Record<BadgeRarity, number> = {
  bois:    5,
  pierre:  15,
  or:      30,
  cristal: 75,
};

// ── Catalogue complet (41 badges) ─────────────────────────────────────────────
export const BADGE_DEFINITIONS: BadgeDefinition[] = [

  // ══════════════════════════════════════════════════════════
  // VITESSE (5 badges)
  // ══════════════════════════════════════════════════════════
  {
    id: 'vitesse_tortue',
    emoji: '🐢',
    label: 'Patience de la tortue',
    description: 'Termine un défi en moins de 30 s (niveau 1) — le seuil augmente de 10 s par niveau',
    rarity: 'bois', category: 'vitesse', isSecret: false, isSeasonal: false,
    translations: { en: { label: 'Turtle\'s Patience', description: 'Finish a puzzle in under 30 s (level 1) — threshold increases by 10 s per level' } },
  },
  {
    id: 'vitesse_renard',
    emoji: '🦊',
    label: 'Ruse du renard',
    description: 'Termine un défi en moins de 20 s (niveau 1) — le seuil augmente de 7 s par niveau',
    rarity: 'pierre', category: 'vitesse', isSecret: false, isSeasonal: false,
    translations: { en: { label: 'Fox\'s Cunning', description: 'Finish a puzzle in under 20 s (level 1) — threshold increases by 7 s per level' } },
  },
  {
    id: 'vitesse_oiseau',
    emoji: '🐦',
    label: 'Vol de l\'oiseau',
    description: 'Termine un défi en moins de 12 s (niveau 1) — le seuil augmente de 5 s par niveau',
    rarity: 'or', category: 'vitesse', isSecret: false, isSeasonal: false,
    translations: { en: { label: 'Bird\'s Flight', description: 'Finish a puzzle in under 12 s (level 1) — threshold increases by 5 s per level' } },
  },
  {
    id: 'vitesse_eclair',
    emoji: '⚡',
    label: 'Éclair de la forêt',
    description: 'Termine un défi en moins de 7 s (niveau 1) — le seuil augmente de 3 s par niveau',
    rarity: 'or', category: 'vitesse', isSecret: false, isSeasonal: false,
    translations: { en: { label: 'Forest Lightning', description: 'Finish a puzzle in under 7 s (level 1) — threshold increases by 3 s per level' } },
  },
  {
    id: 'vitesse_tornade',
    emoji: '🌪️',
    label: 'Tornade sylvestre',
    description: 'Termine un défi en moins de 4 s (niveau 1) — le seuil augmente de 2 s par niveau — presque impossible !',
    rarity: 'cristal', category: 'vitesse', isSecret: false, isSeasonal: false,
    translations: { en: { label: 'Forest Tornado', description: 'Finish a puzzle in under 4 s (level 1) — threshold increases by 2 s per level — nearly impossible!' } },
  },

  // ══════════════════════════════════════════════════════════
  // PRÉCISION (5 badges)
  // ══════════════════════════════════════════════════════════
  {
    id: 'precision_pousse',
    emoji: '🌱',
    label: 'Première pousse',
    description: 'Termine un défi du premier coup, sans jamais appuyer sur Valider en étant faux',
    rarity: 'bois', category: 'precision', isSecret: false, isSeasonal: false,
    translations: { en: { label: 'First Sprout', description: 'Complete a puzzle on the first try without ever pressing Validate incorrectly' } },
  },
  {
    id: 'precision_oeil',
    emoji: '🎯',
    label: 'Œil de lynx',
    description: '3 défis consécutifs terminés du premier coup sans erreur',
    rarity: 'pierre', category: 'precision', isSecret: false, isSeasonal: false,
    translations: { en: { label: 'Lynx Eye', description: '3 puzzles in a row completed on the first try without any mistake' } },
  },
  {
    id: 'precision_hibou',
    emoji: '🦉',
    label: 'Sagesse du hibou',
    description: '10 défis consécutifs terminés du premier coup sans erreur',
    rarity: 'or', category: 'precision', isSecret: false, isSeasonal: false,
    translations: { en: { label: 'Owl\'s Wisdom', description: '10 puzzles in a row completed on the first try without any mistake' } },
  },
  {
    id: 'precision_arc',
    emoji: '🏹',
    label: 'Archère de la forêt',
    description: '25 défis consécutifs terminés du premier coup sans erreur',
    rarity: 'or', category: 'precision', isSecret: false, isSeasonal: false,
    translations: { en: { label: 'Forest Archer', description: '25 puzzles in a row completed on the first try without any mistake' } },
  },
  {
    id: 'precision_couronne',
    emoji: '👑',
    label: 'Maître incontesté',
    description: '50 défis consécutifs terminés du premier coup sans erreur',
    rarity: 'cristal', category: 'precision', isSecret: false, isSeasonal: false,
    translations: { en: { label: 'Undisputed Master', description: '50 puzzles in a row completed on the first try without any mistake' } },
  },

  // ══════════════════════════════════════════════════════════
  // RÉGULARITÉ (6 badges)
  // ══════════════════════════════════════════════════════════
  {
    id: 'regularite_aube',
    emoji: '🌅',
    label: 'L\'Aube du Joueur',
    description: 'Joue 3 jours de suite',
    rarity: 'bois', category: 'regularite', isSecret: false, isSeasonal: false,
    translations: { en: { label: 'Player\'s Dawn', description: 'Play 3 days in a row' } },
  },
  {
    id: 'regularite_fougere',
    emoji: '🌿',
    label: 'Fougère persistante',
    description: 'Joue 7 jours de suite',
    rarity: 'pierre', category: 'regularite', isSecret: false, isSeasonal: false,
    translations: { en: { label: 'Persistent Fern', description: 'Play 7 days in a row' } },
  },
  {
    id: 'regularite_lune',
    emoji: '🌙',
    label: 'Veilleur de lune',
    description: 'Joue entre 22h et 6h pendant 3 jours consécutifs',
    rarity: 'pierre', category: 'regularite', isSecret: false, isSeasonal: false,
    translations: { en: { label: 'Moon Watcher', description: 'Play between 10pm and 6am for 3 consecutive days' } },
  },
  {
    id: 'regularite_soleil',
    emoji: '☀️',
    label: 'Lève-tôt du bois',
    description: 'Joue entre 6h et 9h pendant 5 jours consécutifs',
    rarity: 'or', category: 'regularite', isSecret: false, isSeasonal: false,
    translations: { en: { label: 'Forest Early Bird', description: 'Play between 6am and 9am for 5 consecutive days' } },
  },
  {
    id: 'regularite_arbre',
    emoji: '🌳',
    label: 'Habitué des bois',
    description: 'Joue 30 jours de suite',
    rarity: 'or', category: 'regularite', isSecret: false, isSeasonal: false,
    translations: { en: { label: 'Forest Regular', description: 'Play 30 days in a row' } },
  },
  {
    id: 'regularite_foret',
    emoji: '🌲',
    label: 'Gardien de la forêt',
    description: 'Joue 100 jours de suite',
    rarity: 'cristal', category: 'regularite', isSecret: false, isSeasonal: false,
    translations: { en: { label: 'Forest Guardian', description: 'Play 100 days in a row' } },
  },

  // ══════════════════════════════════════════════════════════
  // SOCIAL (6 badges)
  // ══════════════════════════════════════════════════════════
  {
    id: 'social_poignee',
    emoji: '🤝',
    label: 'Première rencontre',
    description: 'Défie un ami pour la première fois',
    rarity: 'bois', category: 'social', isSecret: false, isSeasonal: false,
    translations: { en: { label: 'First Meeting', description: 'Challenge a friend for the first time' } },
  },
  {
    id: 'social_lion',
    emoji: '🦁',
    label: 'Chasseur solitaire',
    description: 'Gagne 5 défis contre des amis',
    rarity: 'pierre', category: 'social', isSecret: false, isSeasonal: false,
    translations: { en: { label: 'Lone Hunter', description: 'Win 5 challenges against friends' } },
  },
  {
    id: 'social_loup',
    emoji: '🐺',
    label: 'Chef de meute',
    description: 'Gagne 20 défis contre des amis',
    rarity: 'or', category: 'social', isSecret: false, isSeasonal: false,
    translations: { en: { label: 'Pack Leader', description: 'Win 20 challenges against friends' } },
  },
  {
    id: 'social_roi',
    emoji: '👑',
    label: 'Roi de la forêt',
    description: 'Gagne 50 défis contre des amis',
    rarity: 'or', category: 'social', isSecret: false, isSeasonal: false,
    translations: { en: { label: 'King of the Forest', description: 'Win 50 challenges against friends' } },
  },
  {
    id: 'social_cirque',
    emoji: '🎪',
    label: 'Organisateur de fêtes',
    description: 'Invite 5 amis à jouer',
    rarity: 'pierre', category: 'social', isSecret: false, isSeasonal: false,
    translations: { en: { label: 'Party Organizer', description: 'Invite 5 friends to play' } },
  },
  {
    id: 'social_trophee',
    emoji: '🏆',
    label: 'Champion du défi du jour',
    description: 'Entre dans le top 3 du défi du jour 5 fois',
    rarity: 'cristal', category: 'social', isSecret: false, isSeasonal: false,
    translations: { en: { label: 'Daily Challenge Champion', description: 'Reach the top 3 of the daily challenge 5 times' } },
  },

  // ══════════════════════════════════════════════════════════
  // AMÉLIORATION (4 badges)
  // ══════════════════════════════════════════════════════════
  {
    id: 'amelioration_graphe',
    emoji: '📈',
    label: 'En progression',
    description: 'Améliore ton meilleur temps sur un défi déjà complété',
    rarity: 'bois', category: 'amelioration', isSecret: false, isSeasonal: false,
    translations: { en: { label: 'Improving', description: 'Beat your best time on a previously completed puzzle' } },
  },
  {
    id: 'amelioration_cycle',
    emoji: '🔄',
    label: 'Persévérant',
    description: 'Rejoue le même défi 3 fois',
    rarity: 'bois', category: 'amelioration', isSecret: false, isSeasonal: false,
    translations: { en: { label: 'Persistent', description: 'Replay the same puzzle 3 times' } },
  },
  {
    id: 'amelioration_fusee',
    emoji: '🚀',
    label: 'Sur orbite',
    description: 'Améliore ton temps sur 10 défis différents',
    rarity: 'pierre', category: 'amelioration', isSecret: false, isSeasonal: false,
    translations: { en: { label: 'In Orbit', description: 'Improve your time on 10 different puzzles' } },
  },
  {
    id: 'amelioration_etoile',
    emoji: '💫',
    label: 'Perfection absolue',
    description: 'Termine en moins de 20% du temps estimé sans aucune erreur',
    rarity: 'or', category: 'amelioration', isSecret: false, isSeasonal: false,
    translations: { en: { label: 'Absolute Perfection', description: 'Complete in under 20% of estimated time with no mistakes' } },
  },

  // ══════════════════════════════════════════════════════════
  // EXPLORATION (6 badges)
  // ══════════════════════════════════════════════════════════
  {
    id: 'exploration_graine',
    emoji: '🌱',
    label: 'Premiers pas',
    description: 'Complète entièrement les niveaux 1 à 3',
    rarity: 'bois', category: 'exploration', isSecret: false, isSeasonal: false,
    translations: { en: { label: 'First Steps', description: 'Fully complete levels 1 to 3' } },
  },
  {
    id: 'exploration_herbe',
    emoji: '🌿',
    label: 'Explorateur confirmé',
    description: 'Complète entièrement les niveaux 1 à 5',
    rarity: 'pierre', category: 'exploration', isSecret: false, isSeasonal: false,
    translations: { en: { label: 'Confirmed Explorer', description: 'Fully complete levels 1 to 5' } },
  },
  {
    id: 'exploration_chene',
    emoji: '🌳',
    label: 'Vieux chêne',
    description: 'Complète entièrement les niveaux 1 à 9',
    rarity: 'or', category: 'exploration', isSecret: false, isSeasonal: false,
    translations: { en: { label: 'Old Oak', description: 'Fully complete levels 1 to 9' } },
  },
  {
    id: 'exploration_crane',
    emoji: '💀',
    label: 'Maître des profondeurs',
    description: 'Complète entièrement tous les niveaux disponibles',
    rarity: 'cristal', category: 'exploration', isSecret: false, isSeasonal: false,
    translations: { en: { label: 'Master of the Depths', description: 'Fully complete all available levels' } },
  },
  {
    id: 'exploration_cible',
    emoji: '🎯',
    label: 'Sans bonus',
    description: 'Complète un niveau entier sans utiliser aucun bonus',
    rarity: 'or', category: 'exploration', isSecret: false, isSeasonal: false,
    translations: { en: { label: 'Bonus-free', description: 'Complete an entire level without using any bonus' } },
  },
  {
    id: 'exploration_collectionneur',
    emoji: '⚡',
    label: 'Collectionneur',
    description: 'Complète 50 défis au total',
    rarity: 'pierre', category: 'exploration', isSecret: false, isSeasonal: false,
    translations: { en: { label: 'Collector', description: 'Complete 50 puzzles in total' } },
  },

  // ══════════════════════════════════════════════════════════
  // SECRETS (5 badges — affichés "???" avant obtention)
  // ══════════════════════════════════════════════════════════
  {
    id: 'secret_fantome',
    emoji: '🌙',
    label: 'Le Fantôme',
    description: 'Joue exactement à minuit (00:00)',
    rarity: 'cristal', category: 'secret', isSecret: true, isSeasonal: false,
    translations: { en: { label: 'The Ghost', description: 'Play at exactly midnight (00:00)' } },
  },
  {
    id: 'secret_noel',
    emoji: '🎄',
    label: 'Noël en forêt',
    description: 'Joue le 25 décembre',
    rarity: 'or', category: 'secret', isSecret: true, isSeasonal: false,
    translations: { en: { label: 'Christmas in the Forest', description: 'Play on December 25th' } },
  },
  {
    id: 'secret_paques',
    emoji: '🐣',
    label: 'L\'Oeuf de Pâques',
    description: 'Joue un dimanche matin entre 7h et 9h',
    rarity: 'pierre', category: 'secret', isSecret: true, isSeasonal: false,
    translations: { en: { label: 'The Easter Egg', description: 'Play on a Sunday morning between 7am and 9am' } },
  },
  {
    id: 'secret_boucle',
    emoji: '🔁',
    label: 'Déjà-vu',
    description: 'Rejoue le même défi 10 fois de suite',
    rarity: 'pierre', category: 'secret', isSecret: true, isSeasonal: false,
    translations: { en: { label: 'Déjà-vu', description: 'Replay the same puzzle 10 times' } },
  },
  {
    id: 'secret_coeur_brise',
    emoji: '💔',
    label: 'Acharnement',
    description: 'Échoue 5 fois sur le même défi',
    rarity: 'bois', category: 'secret', isSecret: true, isSeasonal: false,
    translations: { en: { label: 'Stubborn', description: 'Fail 5 times on the same puzzle' } },
  },

  // ══════════════════════════════════════════════════════════
  // SAISONNIERS (4 badges)
  // ══════════════════════════════════════════════════════════
  {
    id: 'saisonnier_automne',
    emoji: '🍂',
    label: 'Esprit d\'automne',
    description: 'Complète 5 défis pendant la saison d\'automne',
    rarity: 'pierre', category: 'saisonnier', isSecret: false, isSeasonal: true,
    seasonStart: '09-22', seasonEnd: '12-20',
    translations: { en: { label: 'Autumn Spirit', description: 'Complete 5 puzzles during the autumn season' } },
  },
  {
    id: 'saisonnier_hiver',
    emoji: '❄️',
    label: 'Flocon de neige',
    description: 'Complète 5 défis pendant la saison d\'hiver',
    rarity: 'pierre', category: 'saisonnier', isSecret: false, isSeasonal: true,
    seasonStart: '12-21', seasonEnd: '03-19',
    translations: { en: { label: 'Snowflake', description: 'Complete 5 puzzles during the winter season' } },
  },
  {
    id: 'saisonnier_printemps',
    emoji: '🌸',
    label: 'Fleur de printemps',
    description: 'Complète 5 défis pendant la saison de printemps',
    rarity: 'pierre', category: 'saisonnier', isSecret: false, isSeasonal: true,
    seasonStart: '03-20', seasonEnd: '06-20',
    translations: { en: { label: 'Spring Blossom', description: 'Complete 5 puzzles during the spring season' } },
  },
  {
    id: 'saisonnier_ete',
    emoji: '☀️',
    label: 'Soleil d\'été',
    description: 'Complète 5 défis pendant la saison d\'été',
    rarity: 'pierre', category: 'saisonnier', isSecret: false, isSeasonal: true,
    seasonStart: '06-21', seasonEnd: '09-21',
    translations: { en: { label: 'Summer Sun', description: 'Complete 5 puzzles during the summer season' } },
  },

  // ══════════════════════════════════════════════════════════
  // RECORDS MONDIAUX (2 badges)
  // ══════════════════════════════════════════════════════════
  {
    id: 'record_first',
    emoji: '🌍',
    label: 'Premier sur Terre',
    description: 'Établis le tout premier record mondial sur un défi (aucun joueur n\'avait encore de temps)',
    rarity: 'or', category: 'exploration', isSecret: false, isSeasonal: false,
    translations: { en: { label: 'First on Earth', description: 'Set the very first world record on a puzzle (no player had a time yet)' } },
  },
  {
    id: 'record_mondial',
    emoji: '🏆',
    label: 'Record du monde',
    description: 'Bats le record mondial de temps sur un défi',
    rarity: 'cristal', category: 'exploration', isSecret: false, isSeasonal: false,
    translations: { en: { label: 'World Record', description: 'Beat the world record time on a puzzle' } },
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Map d'accès rapide par ID */
export const BADGE_MAP: Record<string, BadgeDefinition> = Object.fromEntries(
  BADGE_DEFINITIONS.map(b => [b.id, b])
);

/**
 * Retourne le label et la description d'un badge dans la langue demandée.
 * Fallback FR si la traduction n'existe pas.
 */
export function getBadgeTexts(badge: BadgeDefinition, lang: string): { label: string; description: string } {
  const t = badge.translations?.[lang as 'en'];
  if (t) return t;
  return { label: badge.label, description: badge.description };
}

/** Nombre total de badges (hors secrets) pour l'affichage X/36 */
export const TOTAL_NON_SECRET_BADGES = BADGE_DEFINITIONS.filter(b => !b.isSecret).length;

/** Nombre total de badges secrets */
export const TOTAL_SECRET_BADGES = BADGE_DEFINITIONS.filter(b => b.isSecret).length;

/**
 * Vérifie si une date correspond à la saison d'un badge saisonnier.
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
