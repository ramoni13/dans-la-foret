// ============================================================
// CATALOGUE DE MUSIQUES
// 2 types : "Ambiance Défi" (ingame) et "Ambiance Forêt" (hors défi)
// Chaque titre peut être "owned" (possédé) ou verrouillé (achat à 100 graines)
// ============================================================

export type MusicType = 'ingame' | 'menu';

export interface MusicTrack {
  id: string;
  title: string;          // Nom affiché au joueur
  type: MusicType;
  file: any;              // require() du fichier audio
  cost: number;           // 0 = gratuit (de base), >0 = à acheter
  description?: string;
}

// Catalogue complet des morceaux
// cost: 0 = inclus de base, 100 = achetable avec 100 graines
export const MUSIC_CATALOG: MusicTrack[] = [
  {
    id: 'manor_cocktail',
    title: 'Manor Cocktail',
    type: 'menu',
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    file: require('../../assets/musics/manor_cocktail.mp3'),
    cost: 0,
    description: 'Ambiance feutrée pour explorer les menus',
  },
  {
    id: 'foret_mystique',
    title: 'Forêt Mystique',
    type: 'ingame',
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    file: require('../../assets/musics/wtf2.mp3'),
    cost: 0,
    description: 'Musique immersive pour les défis',
  },
  {
    id: 'elek',
    title: 'Elek',
    type: 'ingame',
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    file: require('../../assets/musics/elek.mp3'),
    cost: 100,
    description: 'Rythme électro pour les défis intenses',
  },
];

// Morceaux gratuits (inclus par défaut)
export const FREE_TRACK_IDS = MUSIC_CATALOG
  .filter(t => t.cost === 0)
  .map(t => t.id);

// Seuil de graines pour débloquer un titre payant
export const MUSIC_UNLOCK_COST = 100;
