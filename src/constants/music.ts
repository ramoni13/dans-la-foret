// ============================================================
// CATALOGUE DE MUSIQUES
// 2 types : "Ambiance Défi" (ingame) et "Ambiance Forêt" (hors défi)
//
// Déblocage :
//   - unlockBadgeId absent → gratuit, disponible dès le début
//   - unlockBadgeId: 'vitesse_Loup' → débloqué quand le joueur obtient ce badge
//
// Convention : 1 badge spécifique = 1 titre. Pas d'ambiguïté possible.
// Pour ajouter un titre : créer une entrée avec le badge narrativement cohérent.
// ============================================================

export type MusicType = 'ingame' | 'menu';

export interface MusicTrack {
  id: string;
  title: string;
  type: MusicType;
  file: any;              // require() du fichier audio
  /**
   * ID d'un badge SPÉCIFIQUE (BADGE_DEFINITIONS[].id) requis pour débloquer ce titre.
   * undefined = gratuit (libre d'accès dès le début).
   * Le titre est débloqué dès que playerStore.earnedBadges contient cet ID.
   */
  unlockBadgeId?: string;
  description?: string;
}

export const MUSIC_CATALOG: MusicTrack[] = [
  // ── Ambiance Forêt (menu) — gratuits ──────────────────────────────────────
  {
    id: 'manor_cocktail',
    title: 'Manor Cocktail',
    type: 'menu',
    file: require('../../assets/musics/manor_cocktail.mp3'),
    description: 'Ambiance feutrée pour explorer les menus',
  },

  // ── Ambiance Forêt (menu) — débloquables ────────────────────────────────
  {
    id: 'jardin_japonais',
    title: 'Jardin Japonais',
    type: 'menu',
    file: require('../../assets/musics/Jardin Japonais_F.mp3'),
    unlockBadgeId: 'exploration_graine', // 🌱 Premiers pas — niveaux 1 à 3 complétés
    description: 'Sérénité zen pour accompagner vos explorations',
  },
  {
    id: 'swaying_groove',
    title: 'Swaying Groove',
    type: 'menu',
    file: require('../../assets/musics/Swaying Groove_F.mp3'),
    unlockBadgeId: 'regularite_aube',    // 🌅 L'Aube du Joueur — 3 jours de suite
    description: 'Un groove doux pour les habitués de la forêt',
  },
  {
    id: 'woodland_pulse',
    title: 'Woodland Pulse',
    type: 'menu',
    file: require('../../assets/musics/Woodland Pulse_F.mp3'),
    unlockBadgeId: 'daily_first',        // 🌅 Premier Pas Quotidien — 1er défi du jour réussi
    description: 'Les pulsations naturelles de la forêt',
  },
  {
    id: 'lilting_swing',
    title: 'Lilting Swing',
    type: 'menu',
    file: require('../../assets/musics/Lilting Swing_F.mp3'),
    unlockBadgeId: 'social_lion',        // 🦁 Chasseur solitaire — 5 victoires contre des amis
    description: 'Mélodie légère et balancée pour les esprits sociaux',
  },
  {
    id: 'sun_warmed_groove',
    title: 'Sun-Warmed Groove',
    type: 'menu',
    file: require('../../assets/musics/Sun-Warmed Groove_F.mp3'),
    unlockBadgeId: 'saisonnier_hiver',   // ❄️ Flocon de neige — 5 défis en hiver
    description: 'Chaleur dorée d\'un groove ensoleillé, baume contre le froid',
  },

  // ── Ambiance Défi (ingame) — gratuits ─────────────────────────────────────
  {
    id: 'foret_mystique',
    title: 'Forêt Mystique',
    type: 'ingame',
    file: require('../../assets/musics/wtf2.mp3'),
    description: 'Musique immersive pour les défis',
  },

  // ── Ambiance Défi (ingame) — débloquables ────────────────────────────────
  {
    id: 'forest_breath',
    title: 'Forest Breath',
    type: 'ingame',
    file: require('../../assets/musics/Forest Breath_D.mp3'),
    unlockBadgeId: 'precision_pousse',   // 🌱 Première pousse — 1er défi sans erreur
    description: 'Le souffle apaisant de la forêt pour rester concentré',
  },
  {
    id: 'pulsation_douce',
    title: 'Pulsation Douce',
    type: 'ingame',
    file: require('../../assets/musics/Pulsation Douce_D.mp3'),
    unlockBadgeId: 'vitesse_tortue',     // 🐢 Patience de la tortue — défi en < 30 s
    description: 'Un rythme doux pour les esprits méthodiques',
  },
  {
    id: 'deep_sub_pulse',
    title: 'Deep Sub Pulse',
    type: 'ingame',
    file: require('../../assets/musics/Deep Sub Pulse_D.mp3'),
    unlockBadgeId: 'exploration_herbe',  // 🌿 Explorateur confirmé — niveaux 1 à 5 complétés
    description: 'Basses profondes pour les explorateurs aguerris',
  },
  {
    id: 'elek',
    title: 'Elek',
    type: 'ingame',
    file: require('../../assets/musics/elek.mp3'),
    unlockBadgeId: 'vitesse_loup',       // 🦊 Ruse du Loup — défi en < 20 s
    description: 'Rythme électro pour les défis intenses',
  },
  {
    id: 'boucle_hypnotique',
    title: 'Boucle Hypnotique',
    type: 'ingame',
    file: require('../../assets/musics/Boucle Hypnotique_D.mp3'),
    unlockBadgeId: 'social_poignee',     // 🤝 Première rencontre — 1er défi ami
    description: 'Boucle hypnotique pour entrer dans la zone de concentration',
  },
  {
    id: 'neo_classical_motivation',
    title: 'Neo Classical Motivation',
    type: 'ingame',
    file: require('../../assets/musics/Neo Classical Motivation_D.mp3'),
    unlockBadgeId: 'amelioration_cycle', // 🔄 Persévérant — rejoue le même défi 3 fois
    description: 'Orchestrations néo-classiques pour booster la motivation',
  },
  {
    id: 'moonlit_beach_shuffle',
    title: 'Moonlit Beach Shuffle',
    type: 'menu',
    file: require('../../assets/musics/Moonlit Beach Shuffle_F.mp3'),
    unlockBadgeId: 'amelioration_graphe', // 📈 En progression — améliore ton meilleur temps
    description: 'Shuffle nocturne au clair de lune pour les esprits en quête de progression',
  },
];

/** IDs des titres gratuits (pas de badge requis) */
export const FREE_TRACK_IDS = MUSIC_CATALOG
  .filter(t => !t.unlockBadgeId)
  .map(t => t.id);

/**
 * Map : badgeId → MusicTrack qu'il débloque.
 * Utilisé par BadgeCard et BadgeDetailModal pour afficher l'indicateur musical.
 */
export const BADGE_MUSIC_UNLOCK_MAP: Record<string, MusicTrack> = Object.fromEntries(
  MUSIC_CATALOG
    .filter(t => t.unlockBadgeId)
    .map(t => [t.unlockBadgeId!, t])
);
