// ============================================================
// CATALOGUE DE MUSIQUES
// 2 types : "Ambiance Défi" (ingame) et "Ambiance Forêt" (hors défi)
//
// Déblocage (Progression v2, C8 / D11) — voir src/constants/musicUnlocks.ts :
//   - `unlock` absent → gratuit, disponible dès le début (2 titres) ;
//   - { type: 'chapter', chapter: N } → débloqué à la fin du chapitre N (7 titres) ;
//   - { type: 'trophy', id }          → débloqué par un trophée précis (palier « pierre » de 5 séries) ;
//   - { type: 'seeds', cost }         → prévu pour plus tard, non utilisé.
//
// Convention : 1 déblocage précis = 1 titre. Pour ajouter un titre : créer une entrée ici ET son déblocage
// dans `MUSIC_UNLOCKS` (musicUnlocks.ts).
// ============================================================

import { MUSIC_UNLOCKS, FREE_MUSIC_IDS, MusicUnlock } from './musicUnlocks';
export type MusicType = 'ingame' | 'menu';

export interface MusicTrack {
  id: string;
  title: string;
  type: MusicType;
  file: any;              // require() du fichier audio
  /**
   * Déblocage du titre (`MUSIC_UNLOCKS`). undefined = gratuit (libre d'accès dès le début).
   * Renseigné automatiquement depuis `musicUnlocks.ts` : ne pas l'écrire à la main dans le catalogue.
   */
  unlock?: MusicUnlock;
  description?: string;
}

const RAW_CATALOG: MusicTrack[] = [
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
    description: 'Sérénité zen pour accompagner vos explorations',
  },
  {
    id: 'swaying_groove',
    title: 'Swaying Groove',
    type: 'menu',
    file: require('../../assets/musics/Swaying Groove_F.mp3'),
    description: 'Un groove doux pour les habitués de la forêt',
  },
  {
    id: 'woodland_pulse',
    title: 'Woodland Pulse',
    type: 'menu',
    file: require('../../assets/musics/Woodland Pulse_F.mp3'),
    description: 'Les pulsations naturelles de la forêt',
  },
  {
    id: 'lilting_swing',
    title: 'Lilting Swing',
    type: 'menu',
    file: require('../../assets/musics/Lilting Swing_F.mp3'),
    description: 'Mélodie légère et balancée pour les esprits sociaux',
  },
  {
    id: 'sun_warmed_groove',
    title: 'Sun-Warmed Groove',
    type: 'menu',
    file: require('../../assets/musics/Sun-Warmed Groove_F.mp3'),
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
    description: 'Le souffle apaisant de la forêt pour rester concentré',
  },
  {
    id: 'pulsation_douce',
    title: 'Pulsation Douce',
    type: 'ingame',
    file: require('../../assets/musics/Pulsation Douce_D.mp3'),
    description: 'Un rythme doux pour les esprits méthodiques',
  },
  {
    id: 'deep_sub_pulse',
    title: 'Deep Sub Pulse',
    type: 'ingame',
    file: require('../../assets/musics/Deep Sub Pulse_D.mp3'),
    description: 'Basses profondes pour les explorateurs aguerris',
  },
  {
    id: 'elek',
    title: 'Elek',
    type: 'ingame',
    file: require('../../assets/musics/elek.mp3'),
    description: 'Rythme électro pour les défis intenses',
  },
  {
    id: 'boucle_hypnotique',
    title: 'Boucle Hypnotique',
    type: 'ingame',
    file: require('../../assets/musics/Boucle Hypnotique_D.mp3'),
    description: 'Boucle hypnotique pour entrer dans la zone de concentration',
  },
  {
    id: 'neo_classical_motivation',
    title: 'Neo Classical Motivation',
    type: 'ingame',
    file: require('../../assets/musics/Neo Classical Motivation_D.mp3'),
    description: 'Orchestrations néo-classiques pour booster la motivation',
  },
  {
    id: 'moonlit_beach_shuffle',
    title: 'Moonlit Beach Shuffle',
    type: 'menu',
    file: require('../../assets/musics/Moonlit Beach Shuffle_F.mp3'),
    description: 'Shuffle nocturne au clair de lune pour les esprits en quête de progression',
  },
];

/** Catalogue complet : les fichiers de `RAW_CATALOG` + le déblocage de `MUSIC_UNLOCKS`. */
export const MUSIC_CATALOG: MusicTrack[] = RAW_CATALOG.map(track => {
  const unlock = MUSIC_UNLOCKS[track.id];
  return unlock ? { ...track, unlock } : track;
});

/** IDs des titres gratuits (pas de déblocage requis) */
export const FREE_TRACK_IDS = MUSIC_CATALOG
  .filter(t => !t.unlock)
  .map(t => t.id);

/**
 * Titre offert par un TROPHÉE précis (le palier « pierre » de 5 séries) : identifiant du trophée → titre.
 * Remplace l'ancien `BADGE_MUSIC_UNLOCK_MAP` (badge → titre), construit depuis `MUSIC_UNLOCKS`.
 */
export const TROPHY_MUSIC_UNLOCK_MAP: Record<string, MusicTrack> = Object.fromEntries(
  MUSIC_CATALOG
    .filter((t): t is MusicTrack & { unlock: { type: 'trophy'; id: string } } => t.unlock?.type === 'trophy')
    .map(t => [t.unlock.id, t]),
);

/** Tous les identifiants du catalogue (pour `computeOwnedMusic`). */
export const MUSIC_TRACK_IDS: string[] = MUSIC_CATALOG.map(t => t.id);

export { FREE_MUSIC_IDS, MUSIC_UNLOCKS };
