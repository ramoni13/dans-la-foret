// ============================================================
// SERVICE AUDIO — expo-audio (remplace expo-av, New Architecture)
// Gère la lecture en boucle des 2 pistes musicales :
//   - "Ambiance Forêt"  : musique de menu (hors jeu)
//   - "Ambiance Défi"   : musique pendant le jeu
// Le service est un singleton. Il reçoit l'état du store via
// syncFromStore() appelé par le composant AudioController.
// ============================================================

import { createAudioPlayer, setAudioModeAsync, AudioPlayer } from 'expo-audio';
import { MusicType } from '../constants/music';

interface PlayState {
  ingameEnabled: boolean;
  menuEnabled: boolean;
  volume: number;
  selectedIngameTrackId: string;
  selectedMenuTrackId: string;
  isInGame: boolean;
  ownedTrackIds: string[];
  catalog: Array<{ id: string; type: MusicType; file: any }>;
  userHasInteracted: boolean;
}

class AudioService {
  private player: AudioPlayer | null = null;
  private currentTrackId: string | null = null;
  private currentState: PlayState | null = null;
  private audioModeInitialized = false;

  /** Appelé par AudioController à chaque changement d'état */
  async syncFromStore(state: PlayState) {
    this.currentState = state;

    // Sur web, attendre une interaction utilisateur avant toute lecture
    if (!state.userHasInteracted) return;

    const desiredTrackId = this._resolveDesiredTrack(state);

    if (!desiredTrackId) {
      this._stop();
      return;
    }

    if (desiredTrackId === this.currentTrackId && this.player) {
      // Même piste — juste mettre à jour le volume
      try { this.player.volume = state.volume; } catch (_) {}
      return;
    }

    await this._playTrack(desiredTrackId, state);
  }

  /** Arrêt pour laisser place à un preview */
  stopForPreview() {
    this._stop();
  }

  /** Reprend après un preview */
  async resumeAfterPreview() {
    if (!this.currentState) return;
    await this.syncFromStore(this.currentState);
  }

  private _resolveDesiredTrack(state: PlayState): string | null {
    if (state.isInGame) {
      if (!state.ingameEnabled) return null;
      return state.ownedTrackIds.includes(state.selectedIngameTrackId)
        ? state.selectedIngameTrackId
        : null;
    } else {
      if (!state.menuEnabled) return null;
      return state.ownedTrackIds.includes(state.selectedMenuTrackId)
        ? state.selectedMenuTrackId
        : null;
    }
  }

  private async _initAudioMode() {
    if (this.audioModeInitialized) return;
    try {
      await setAudioModeAsync({ playsInSilentMode: true });
      this.audioModeInitialized = true;
    } catch (e) {
      console.warn('[AudioService] setAudioModeAsync error:', e);
    }
  }

  private async _playTrack(trackId: string, state: PlayState) {
    const track = state.catalog.find(t => t.id === trackId);
    if (!track) return;

    this._stop();

    try {
      await this._initAudioMode();

      const player = createAudioPlayer(track.file);
      player.volume = state.volume;
      player.loop = true;
      player.play();

      this.player = player;
      this.currentTrackId = trackId;
    } catch (e) {
      console.warn('[AudioService] Erreur lecture:', e);
    }
  }

  private _stop() {
    if (!this.player) return;
    try {
      this.player.pause();
      this.player.release();
    } catch (_) {}
    this.player = null;
    this.currentTrackId = null;
  }

  /** Joue un aperçu d'une piste (sans boucle) */
  async playPreview(trackFile: any, volume: number): Promise<AudioPlayer | null> {
    try {
      await this._initAudioMode();
      const player = createAudioPlayer(trackFile);
      player.volume = volume;
      player.loop = false;
      player.play();
      return player;
    } catch (e) {
      console.warn('[AudioService] Erreur preview:', e);
      return null;
    }
  }

  /** Arrête et libère un player de preview */
  stopPreviewSound(player: AudioPlayer): void {
    try {
      player.pause();
      player.release();
    } catch (_) {}
  }

  dispose() {
    this._stop();
    this.audioModeInitialized = false;
  }
}

export const audioService = new AudioService();
