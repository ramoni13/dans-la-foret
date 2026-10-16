// ============================================================
// CATALOGUE DES BADGES — Dans la Forêt
// 60 badges au total : 53 standard + 5 secrets + 2 records
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

// ── Récompenses en graines par rareté ─────────────────────────────────────────
export const BADGE_SEED_REWARDS: Record<BadgeRarity, number> = {
  bois:    5,
  pierre:  15,
  or:      30,
  cristal: 75,
};

// ── Catalogue complet (60 badges) ─────────────────────────────────────────────
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
    id: 'vitesse_loup',
    emoji: '🦊',
    label: 'Ruse du Loup',
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
  // ── Badge vitesse endurance (refonte badges) ──────────────────────────────────
  {
    id: 'vitesse_marathon',
    emoji: '🏅',
    label: 'Coureur de fond',
    description: 'Accumule 20 victoires en dessous du seuil vitesse tortue',
    rarity: 'or', category: 'vitesse', isSecret: false, isSeasonal: false,
    translations: { en: { label: 'Long-distance Runner', description: 'Accumulate 20 wins under the turtle speed threshold' } },
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
    description: '5 défis consécutifs terminés du premier coup sans erreur',
    rarity: 'pierre', category: 'precision', isSecret: false, isSeasonal: false,
    translations: { en: { label: 'Lynx Eye', description: '5 puzzles in a row completed on the first try without any mistake' } },
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

  // ── Badge Pose Parfaite (refonte badges) ─────────────────
  {
    id: 'precision_parfaite',
    emoji: '🎯',
    label: 'Pose Parfaite',
    description: 'Gagne 3 défis consécutifs sans déplacer de jeton posé, sans erreur, sans bonus, et sans avoir abandonné ce défi',
    rarity: 'or', category: 'precision', isSecret: false, isSeasonal: false,
    translations: { en: { label: 'Perfect Placement', description: 'Win 3 consecutive puzzles without moving placed tokens, no mistakes, no bonus, and without having abandoned that puzzle' } },
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
    description: 'Défie un nouvel ami pour la première fois',
    rarity: 'bois', category: 'social', isSecret: false, isSeasonal: false,
    translations: { en: { label: 'First Meeting', description: 'Challenge a new friend for the first time' } },
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
    emoji: '🥉',
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
  // ── Badge amélioration intermédiaire (refonte badges) ─────────────────────────
  {
    id: 'amelioration_discipline',
    emoji: '📊',
    label: 'Disciple du progrès',
    description: 'Améliore ton temps sur 5 défis différents',
    rarity: 'pierre', category: 'amelioration', isSecret: false, isSeasonal: false,
    translations: { en: { label: 'Progress Disciple', description: 'Improve your time on 5 different puzzles' } },
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

  // ══════════════════════════════════════════════════════════
  // DÉFI JOURNALIER (4 badges)
  // ══════════════════════════════════════════════════════════
  {
    id: 'daily_first',
    emoji: '🌅',
    label: 'Premier Pas Quotidien',
    description: 'Réussis ton premier défi journalier',
    rarity: 'bois', category: 'regularite', isSecret: false, isSeasonal: false,
    translations: { en: { label: 'First Daily Step', description: 'Complete your first daily challenge' } },
  },
  {
    id: 'daily_week',
    emoji: '📅',
    label: 'Semaine Parfaite',
    description: 'Réussis 7 défis journaliers consécutifs',
    rarity: 'pierre', category: 'regularite', isSecret: false, isSeasonal: false,
    translations: { en: { label: 'Perfect Week', description: 'Complete 7 consecutive daily challenges' } },
  },
  {
    id: 'daily_month',
    emoji: '🗓️',
    label: 'Forestier Assidu',
    description: 'Réussis 30 défis journaliers consécutifs',
    rarity: 'or', category: 'regularite', isSecret: false, isSeasonal: false,
    translations: { en: { label: 'Dedicated Forester', description: 'Complete 30 consecutive daily challenges' } },
  },
  {
    id: 'daily_champion',
    emoji: '👑',
    label: 'Champion du Jour',
    description: 'Termine #1 mondial sur un défi journalier',
    rarity: 'cristal', category: 'regularite', isSecret: false, isSeasonal: false,
    translations: { en: { label: 'Daily Champion', description: 'Finish #1 worldwide on a daily challenge' } },
  },
  // ── Badges daily complémentaires (refonte badges) ─────────
  {
    id: 'daily_perfect',
    emoji: '🏅',
    label: 'Quotidien sans faute',
    description: 'Réussis 10 défis journaliers sans aucune erreur de validation',
    rarity: 'or', category: 'regularite', isSecret: false, isSeasonal: false,
    translations: { en: { label: 'Flawless Daily', description: 'Complete 10 daily challenges without any validation mistake' } },
  },
  {
    id: 'daily_speed',
    emoji: '⚡',
    label: 'Forestier matinal',
    description: 'Réussis 3 défis journaliers en moins de 3 minutes',
    rarity: 'pierre', category: 'regularite', isSecret: false, isSeasonal: false,
    translations: { en: { label: 'Morning Forester', description: 'Complete 3 daily challenges in under 3 minutes' } },
  },
  // ══════════════════════════════════════════════════════════
  // MODE ONF — GRILLE FORESTIÈRE (5 badges)
  // ══════════════════════════════════════════════════════════
  {
    id: 'onf_premier',
    emoji: '🌲',
    label: 'Forestier en herbe',
    description: 'Résous ta première grille ONF',
    rarity: 'bois', category: 'exploration', isSecret: false, isSeasonal: false,
    translations: { en: { label: 'Budding Forester', description: 'Solve your first ONF grid' } },
  },
  {
    id: 'onf_forestier',
    emoji: '🌳',
    label: 'Forestier confirmé',
    description: 'Résous 10 grilles ONF',
    rarity: 'pierre', category: 'exploration', isSecret: false, isSeasonal: false,
    translations: { en: { label: 'Confirmed Forester', description: 'Solve 10 ONF grids' } },
  },
  {
    id: 'onf_maitre',
    emoji: '🏆',
    label: 'Maître de la forêt',
    description: 'Résous 50 grilles ONF',
    rarity: 'or', category: 'exploration', isSecret: false, isSeasonal: false,
    translations: { en: { label: 'Forest Master', description: 'Solve 50 ONF grids' } },
  },
  {
    id: 'onf_precision',
    emoji: '🎯',
    label: 'Grille sans faute',
    description: 'Valide 3 grilles ONF sans aucune erreur',
    rarity: 'pierre', category: 'exploration', isSecret: false, isSeasonal: false,
    translations: { en: { label: 'Flawless Grid', description: 'Validate 3 ONF grids without any mistake' } },
  },
  {
    id: 'onf_speed',
    emoji: '⚡',
    label: 'Sudoku express',
    description: 'Résous 3 grilles ONF en moins de 2 minutes',
    rarity: 'pierre', category: 'exploration', isSecret: false, isSeasonal: false,
    translations: { en: { label: 'Express Sudoku', description: 'Solve 3 ONF grids in under 2 minutes' } },
  },

  // ── Badges défis amis (refonte badges) ───────────────────────────────────────
  {
    id: 'ami_challenger',
    emoji: '🤝',
    label: 'Premier défi',
    description: 'Lance ton premier défi à un ami',
    rarity: 'bois', category: 'social', isSecret: false, isSeasonal: false,
    translations: { en: { label: 'First Challenge', description: 'Send your first challenge to a friend' } },
  },
  {
    id: 'ami_serial',
    emoji: '🏆',
    label: 'Prédateur de la Forêt',
    description: 'Gagne 100 défis contre des amis',
    rarity: 'cristal', category: 'social', isSecret: false, isSeasonal: false,
    translations: { en: { label: 'Forest Predator', description: 'Win 100 friend challenges' } },
  },

  // ── Badge premium exclusif ────────────────────────────────────────────────────
  {
    id: 'ami_de_la_foret',
    emoji: '🌲',
    label: 'Ami de la Forêt',
    description: 'A soutenu la forêt et l\'ONF en passant en premium',
    rarity: 'or', category: 'exploration', isSecret: false, isSeasonal: false,
    translations: { en: { label: 'Friend of the Forest', description: 'Supported the forest and the ONF with a premium purchase' } },
  },
];

// ── Système de rangs forestiers ───────────────────────────────────────────────

/** Valeur en points de chaque rareté de badge */
export const RARITY_POINTS: Record<BadgeRarity, number> = {
  bois:    5,
  pierre:  10,
  or:      20,
  cristal: 50,
};

/**
 * Points attribués selon le type de défi complété.
 * Solo=1pt, Ami=2pts, ONF=3pts, Daily=5pts
 */
export const ACTIVITY_POINTS = {
  solo:   1,
  friend: 2,
  onf:    3,
  daily:  5,
} as const;

/**
 * Score maximum atteignable via les badges uniquement.
 * 12×Bois(5) + 17×Pierre(10) + 15×Or(20) + 7×Cristal(50) = 60+170+300+350 = 880
 */
export const MAX_BADGE_SCORE = 880;

export interface RankDefinition {
  /** Identifiant unique du rang */
  id: string;
  /** Intitulé du métier (FR) */
  label: string;
  /** Intitulé anglais */
  labelEn: string;
  /** Emoji représentant le rang */
  emoji: string;
  /** Score minimum requis (badges + activité) */
  minScore: number;
}

/**
 * Paliers recalibrés pour intégrer la composante activité (défis).
 *
 * Score de référence (joueur régulier 6 mois) :
 *   ~400 pts badges + ~100 pts solo + ~40 pts amis + ~150 pts ONF + ~900 pts daily ≈ 1590 pts
 *
 * Score hardcore (1 an, tous les badges) :
 *   880 pts badges + 150 solo + 100 amis + 200 ONF + 1825 daily ≈ 3155 pts
 */
export const RANK_DEFINITIONS: RankDefinition[] = [
  { id: 'promeneur',          label: 'Promeneur',              labelEn: 'Wanderer',             emoji: '🚶', minScore: 0    },
  { id: 'bucheron',           label: 'Bûcheron',               labelEn: 'Lumberjack',           emoji: '🪓', minScore: 30   },
  { id: 'sylviculteur',       label: 'Sylviculteur',           labelEn: 'Silviculturist',       emoji: '🌱', minScore: 100  },
  { id: 'garde_forestier',    label: 'Garde Forestier',        labelEn: 'Forest Ranger',        emoji: '🌲', minScore: 300  },
  { id: 'technicien_onf',     label: 'Technicien ONF',         labelEn: 'ONF Technician',       emoji: '🗺️', minScore: 700  },
  { id: 'ingenieur_forets',   label: 'Ingénieur des Forêts',   labelEn: 'Forest Engineer',      emoji: '🏔️', minScore: 1500 },
  { id: 'esprit_foret',       label: 'Esprit de la Forêt',     labelEn: 'Spirit of the Forest', emoji: '✨', minScore: 3000 },
];

/**
 * Calcule le score de badge pondéré par rareté pour un ensemble de badges obtenus.
 * Bois=5pts, Pierre=10pts, Or=20pts, Cristal=50pts
 */
export function getBadgeScore(earnedBadgeIds: string[]): number {
  const earnedSet = new Set(earnedBadgeIds);
  return BADGE_DEFINITIONS.reduce((total, badge) => {
    if (earnedSet.has(badge.id)) {
      return total + RARITY_POINTS[badge.rarity];
    }
    return total;
  }, 0);
}

/**
 * Paramètres d'activité du joueur nécessaires au calcul du score de rang.
 */
export interface PlayerActivityStats {
  /** Nombre de défis solo complétés */
  soloCompleted: number;
  /** Nombre de défis entre amis complétés (victoires joueur B) */
  friendCompleted: number;
  /** Nombre de grilles ONF résolues */
  onfCompleted: number;
  /** Nombre de défis du jour réussis */
  dailyCompleted: number;
}

/**
 * Calcule la contribution de l'activité (défis) au score de rang.
 * Solo=1pt, Ami=2pts, ONF=3pts, Daily=5pts
 */
export function getPlayerActivityScore(stats: PlayerActivityStats): number {
  return (
    stats.soloCompleted   * ACTIVITY_POINTS.solo   +
    stats.friendCompleted * ACTIVITY_POINTS.friend  +
    stats.onfCompleted    * ACTIVITY_POINTS.onf     +
    stats.dailyCompleted  * ACTIVITY_POINTS.daily
  );
}

/**
 * Calcule le score de rang global : badges + activité.
 * C'est ce score qui détermine le rang forestier du joueur.
 */
export function getPlayerScore(
  earnedBadgeIds: string[],
  stats: PlayerActivityStats,
): number {
  return getBadgeScore(earnedBadgeIds) + getPlayerActivityScore(stats);
}

/**
 * Retourne le rang correspondant à un score donné.
 * Toujours le rang le plus élevé dont le minScore est ≤ score.
 */
export function getRank(score: number): RankDefinition {
  let current = RANK_DEFINITIONS[0];
  for (const rank of RANK_DEFINITIONS) {
    if (score >= rank.minScore) current = rank;
  }
  return current;
}

/**
 * Retourne le rang suivant (null si déjà au rang maximum).
 */
export function getNextRank(score: number): RankDefinition | null {
  for (const rank of RANK_DEFINITIONS) {
    if (score < rank.minScore) return rank;
  }
  return null;
}

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
