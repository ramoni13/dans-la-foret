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
  {
    id: 'manor_cocktail',
    title: 'Manor Cocktail',
    type: 'menu',
    file: require('../../assets/musics/manor_cocktail.mp3'),
    description: 'Ambiance feutrée pour explorer les menus',
  },
  {
    id: 'foret_mystique',
    title: 'Forêt Mystique',
    type: 'ingame',
    file: require('../../assets/musics/wtf2.mp3'),
    description: 'Musique immersive pour les défis',
  },
  {
    id: 'elek',
    title: 'Elek',
    type: 'ingame',
    file: require('../../assets/musics/elek.mp3'),
    unlockBadgeId: 'vitesse_Loup',   // 🦊 Ruse du Loup — terminer un défi en < 20 s
    description: 'Rythme électro pour les défis intenses',
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
