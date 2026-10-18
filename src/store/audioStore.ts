// ============================================================
// STORE AUDIO — Zustand
// Gestion des préférences musicales du joueur
//
// - 2 types : "Ambiance Défi" (ingame) et "Ambiance Forêt" (menu)
// - Morceau sélectionné par type (persisté dans AsyncStorage via useStorage)
// - Toggles on/off par type
// - Volume global
//
// Source de vérité des musiques débloquées :
//   audioStore.ownedTrackIds est calculé depuis FREE_TRACK_IDS + les pistes
//   dont le badge associé (BADGE_MUSIC_UNLOCK_MAP) figure dans earnedBadges.
//   → Appeler syncOwnedFromBadges(earnedBadges) à chaque changement de badges.
// ============================================================

import { create } from 'zustand';
import { FREE_TRACK_IDS, MusicType, MUSIC_CATALOG } from '../constants/music';

interface AudioState {
  // Préférences
  ingameEnabled: boolean;         // Musique activée pendant le défi
  menuEnabled: boolean;           // Musique activée hors défi (menus)
  volume: number;                 // 0.0 à 1.0

  // Morceaux sélectionnés
  selectedIngameTrackId: string;  // ID du morceau choisi pour ingame
  selectedMenuTrackId: string;    // ID du morceau choisi pour menu

  // Catalogue possédé (calculé depuis FREE_TRACK_IDS + paliers badges)
  ownedTrackIds: string[];

  // Morceau en cours de preview (lecture dans le profil)
  previewTrackId: string | null;

  // true après la première interaction utilisateur (requis par les navigateurs web
  // pour autoriser la lecture audio automatique)
  userHasInteracted: boolean;

  /**
   * ID de la piste dont le déblocage doit être affiché en modal (feu d'artifice).
   * Positionné par syncOwnedFromBadges() quand une nouvelle piste est débloquée.
   * Remis à null par dismissMusicUnlock() après affichage.
   */
  pendingMusicUnlockTrackId: string | null;

  // ── Actions ──────────────────────────────────────────────────
  setIngameEnabled: (v: boolean) => void;
  setMenuEnabled: (v: boolean) => void;
  setVolume: (v: number) => void;
  setSelectedTrack: (type: MusicType, trackId: string) => void;
  setPreviewTrack: (trackId: string | null) => void;
  signalUserInteraction: () => void;
  /** Efface le modal de déblocage musique en attente */
  dismissMusicUnlock: () => void;

  isTrackOwned: (trackId: string) => boolean;

  /**
   * Met à jour ownedTrackIds depuis les badges obtenus du joueur.
   * À appeler dès que playerStore.earnedBadges change (subscribe dans useStorage).
   * Logique : FREE_TRACK_IDS + pistes dont unlockBadgeId est dans earnedBadges.
   * @param silent  Si true, ne déclenche pas la modale (utilisé au chargement initial)
   */
  syncOwnedFromBadges: (earnedBadges: string[], silent?: boolean) => void;

  /**
   * Charge l'état audio persisté depuis AsyncStorage.
   * N'écrase PAS userHasInteracted ni previewTrackId.
   */
  hydrate: (data: Partial<Pick<AudioState,
    'ingameEnabled' | 'menuEnabled' | 'volume' |
    'selectedIngameTrackId' | 'selectedMenuTrackId'
  >>) => void;
}

// Morceau menu et ingame par défaut (les gratuits)
const DEFAULT_INGAME_TRACK = 'foret_mystique';
const DEFAULT_MENU_TRACK = 'manor_cocktail';

/** Calcule les IDs possédés depuis les badges obtenus du joueur */
function computeOwnedFromBadges(earnedBadges: string[]): string[] {
  const owned = new Set(FREE_TRACK_IDS);
  for (const track of MUSIC_CATALOG) {
    if (track.unlockBadgeId && earnedBadges.includes(track.unlockBadgeId)) {
      owned.add(track.id);
    }
  }
  return Array.from(owned);
}

export const useAudioStore = create<AudioState>((set, get) => ({
  ingameEnabled: true,
  menuEnabled: true,
  volume: 0.7,
  selectedIngameTrackId: DEFAULT_INGAME_TRACK,
  selectedMenuTrackId: DEFAULT_MENU_TRACK,
  ownedTrackIds: [...FREE_TRACK_IDS],
  previewTrackId: null,
  userHasInteracted: false,
  pendingMusicUnlockTrackId: null,

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

  dismissMusicUnlock: () => set({ pendingMusicUnlockTrackId: null }),

  isTrackOwned: (trackId) => {
    return get().ownedTrackIds.includes(trackId);
  },

  syncOwnedFromBadges: (earnedBadges, silent = false) => {
    const newOwned = computeOwnedFromBadges(earnedBadges);
    const current = get().ownedTrackIds;
    // Éviter un set() inutile si le contenu est identique
    if (
      newOwned.length === current.length &&
      newOwned.every(id => current.includes(id))
    ) return;

    if (silent) {
      // Chargement initial : mettre à jour la liste sans déclencher la modale
      set({ ownedTrackIds: newOwned });
      return;
    }

    // Détecter les pistes nouvellement débloquées pour déclencher la popup
    const newlyUnlocked = newOwned.filter(id => !current.includes(id));
    set({
      ownedTrackIds: newOwned,
      // On n'affiche que la première piste débloquée (les suivantes seront
      // visibles dans le profil). Si une popup est déjà en attente, on ne
      // l'écrase pas — elle sera affichée puis l'utilisateur verra la suivante
      // au prochain déblocage.
      pendingMusicUnlockTrackId: newlyUnlocked.length > 0
        ? (get().pendingMusicUnlockTrackId ?? newlyUnlocked[0])
        : get().pendingMusicUnlockTrackId,
    });
  },

  hydrate: (data) => {
    set(s => {
      // Ne PAS toucher ownedTrackIds ici : il est calculé exclusivement depuis
      // earnedBadges via syncOwnedFromBadges(), appelé après hydrate() dans useStorage.
      // L'écraser ici provoquerait une race condition si audio se charge après player.
      return {
        ...s,
        ingameEnabled:         data.ingameEnabled          ?? s.ingameEnabled,
        menuEnabled:           data.menuEnabled             ?? s.menuEnabled,
        volume:                data.volume                  ?? s.volume,
        selectedIngameTrackId: data.selectedIngameTrackId  ?? s.selectedIngameTrackId,
        selectedMenuTrackId:   data.selectedMenuTrackId    ?? s.selectedMenuTrackId,
      };
    });
  },
}));
