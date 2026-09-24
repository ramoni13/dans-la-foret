// ============================================================
// STORE AUDIO — Zustand
// Gestion des préférences musicales du joueur
// - 2 types : "Ambiance Défi" (ingame) et "Ambiance Forêt" (menu)
// - Morceaux possédés (free + achetés)
// - Morceau sélectionné par type
// - Toggles on/off par type
// - Volume global
// ============================================================

import { create } from 'zustand';
import { FREE_TRACK_IDS, MusicType, MUSIC_CATALOG, MUSIC_UNLOCK_COST } from '../constants/music';

interface AudioState {
  // Préférences
  ingameEnabled: boolean;         // Musique activée pendant le défi
  menuEnabled: boolean;           // Musique activée hors défi (menus)
  volume: number;                 // 0.0 à 1.0

  // Morceaux sélectionnés
  selectedIngameTrackId: string;  // ID du morceau choisi pour ingame
  selectedMenuTrackId: string;    // ID du morceau choisi pour menu

  // Catalogue possédé
  ownedTrackIds: string[];        // IDs des titres débloqués/possédés

  // Compteur de graines accumulées vers l'achat du prochain titre
  // Clé = track ID en attente, valeur = graines accumulées (0..100)
  seedsTowardUnlock: Record<string, number>;

  // Morceau en cours de preview (lecture dans le profil)
  previewTrackId: string | null;

  // true après la première interaction utilisateur (requis par les navigateurs web
  // pour autoriser la lecture audio automatique)
  userHasInteracted: boolean;

  // ── Actions ──────────────────────────────────────────────────
  setIngameEnabled: (v: boolean) => void;
  setMenuEnabled: (v: boolean) => void;
  setVolume: (v: number) => void;
  setSelectedTrack: (type: MusicType, trackId: string) => void;
  setPreviewTrack: (trackId: string | null) => void;
  signalUserInteraction: () => void;

  // Ajoute des graines vers un déblocage (retourne true si le titre est maintenant débloqué)
  addSeedsTowardTrack: (trackId: string, amount: number) => boolean;
  unlockTrack: (trackId: string) => void;
  isTrackOwned: (trackId: string) => boolean;

  // Charge l'état depuis AsyncStorage (appelé au démarrage)
  hydrate: (data: Partial<AudioState>) => void;
}

// Morceau menu et ingame par défaut (les gratuits)
const DEFAULT_INGAME_TRACK = 'foret_mystique';
const DEFAULT_MENU_TRACK = 'manor_cocktail';

export const useAudioStore = create<AudioState>((set, get) => ({
  ingameEnabled: true,
  menuEnabled: true,
  volume: 0.7,
  selectedIngameTrackId: DEFAULT_INGAME_TRACK,
  selectedMenuTrackId: DEFAULT_MENU_TRACK,
  ownedTrackIds: [...FREE_TRACK_IDS],
  seedsTowardUnlock: {},
  previewTrackId: null,
  userHasInteracted: false,

  setIngameEnabled: (v) => set({ ingameEnabled: v }),
  setMenuEnabled: (v) => set({ menuEnabled: v }),
  setVolume: (v) => set({ volume: Math.max(0, Math.min(1, v)) }),

  setSelectedTrack: (type, trackId) => {
    if (type === 'ingame') {
      set({ selectedIngameTrackId: trackId });
    } else {
      set({ selectedMenuTrackId: trackId });
    }
  },

  setPreviewTrack: (trackId) => set({ previewTrackId: trackId }),

  // Appelé une seule fois au premier clic/touch — autorise la lecture audio
  signalUserInteraction: () => {
    if (get().userHasInteracted) return; // idempotent
    set({ userHasInteracted: true });
  },

  addSeedsTowardTrack: (trackId, amount) => {
    const state = get();
    if (state.ownedTrackIds.includes(trackId)) return false;

    const current = state.seedsTowardUnlock[trackId] ?? 0;
    const next = current + amount;

    if (next >= MUSIC_UNLOCK_COST) {
      // Déblocage !
      set(s => ({
        ownedTrackIds: [...s.ownedTrackIds, trackId],
        seedsTowardUnlock: {
          ...s.seedsTowardUnlock,
          [trackId]: MUSIC_UNLOCK_COST,
        },
      }));
      return true;
    } else {
      set(s => ({
        seedsTowardUnlock: {
          ...s.seedsTowardUnlock,
          [trackId]: next,
        },
      }));
      return false;
    }
  },

  unlockTrack: (trackId) => {
    set(s => ({
      ownedTrackIds: s.ownedTrackIds.includes(trackId)
        ? s.ownedTrackIds
        : [...s.ownedTrackIds, trackId],
    }));
  },

  isTrackOwned: (trackId) => {
    return get().ownedTrackIds.includes(trackId);
  },

  hydrate: (data) => {
    set(s => ({
      ...s,
      ...data,
      // Toujours s'assurer que les morceaux gratuits sont dans ownedTrackIds
      ownedTrackIds: Array.from(new Set([
        ...FREE_TRACK_IDS,
        ...(data.ownedTrackIds ?? s.ownedTrackIds),
      ])),
    }));
  },
}));
