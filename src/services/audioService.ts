// ============================================================
// SERVICE AUDIO — expo-av
// Gère la lecture en boucle des 2 pistes musicales :
//   - "Ambiance Forêt"  : musique de menu (hors jeu)
//   - "Ambiance Défi"   : musique pendant le jeu
// Le service est un singleton. Il reçoit l'état du store via
// syncFromStore() appelé par le composant AudioController.
// ============================================================

import { Audio } from 'expo-av';
import { Platform } from 'react-native';
import { MusicType } from '../constants/music';

/**
 * Sur web, expo-av stocke l'élément <audio> DOM dans sound._key.
 * unloadForSound() ne met pas ontimeupdate = null, donc le navigateur
 * continue à tirer l'event sur un objet déjà libéré → crash "emit".
 * On neutralise le handler AVANT tout arrêt.
 */
function silenceWebAudioElement(sound: Audio.Sound) {
  if (Platform.OS !== 'web') return;
  try {
    const el = (sound as any)._key as HTMLAudioElement | null;
    if (el && typeof el.ontimeupdate !== 'undefined') {
      el.ontimeupdate = null;
      el.onerror     = null;
      el.onended     = null;
    }
  } catch (_) { /* ignoré — accès interne non garanti */ }
}

interface PlayState {
  ingameEnabled: boolean;
  menuEnabled: boolean;
  volume: number;
  selectedIngameTrackId: string;
  selectedMenuTrackId: string;
  isInGame: boolean;              // true = écran de jeu actif
  ownedTrackIds: string[];
  catalog: Array<{ id: string; type: MusicType; file: any }>;
  userHasInteracted: boolean;     // requis sur web avant toute lecture auto
}

class AudioService {
  private sound: Audio.Sound | null = null;
  private currentTrackId: string | null = null;
  private currentState: PlayState | null = null;
  private stopPromise: Promise<void> | null = null;
  private audioModeInitialized = false;

  /** Appelé par AudioController à chaque changement d'état */
  async syncFromStore(state: PlayState) {
    this.currentState = state;

    // Attendre la fin d'un arrêt en cours avant d'évaluer l'état
    if (this.stopPromise) await this.stopPromise;

    // Sur web, ne pas démarrer la musique avant une interaction utilisateur
    if (!state.userHasInteracted) return;

    // Déterminer la piste souhaitée
    const desiredTrackId = this._resolveDesiredTrack(state);

    if (!desiredTrackId) {
      // Musique désactivée ou aucune piste valide
      await this._stop();
      return;
    }

    if (desiredTrackId === this.currentTrackId && this.sound) {
      // Même piste — juste mettre à jour le volume
      try {
        await this.sound.setVolumeAsync(state.volume);
      } catch (_) {/* ignoré */}
      return;
    }

    // Changer de piste
    await this._playTrack(desiredTrackId, state);
  }

  /** Arrêt complet (ex: preview en cours → on arrête la musique principale) */
  async stopForPreview() {
    await this._stop();
  }

  /** Reprend la lecture principale après un preview */
  async resumeAfterPreview() {
    if (!this.currentState) return;
    await this.syncFromStore(this.currentState);
  }

  private _resolveDesiredTrack(state: PlayState): string | null {
    if (state.isInGame) {
      if (!state.ingameEnabled) return null;
      // Vérifier que la piste est bien possédée
      if (state.ownedTrackIds.includes(state.selectedIngameTrackId)) {
        return state.selectedIngameTrackId;
      }
      return null;
    } else {
      if (!state.menuEnabled) return null;
      if (state.ownedTrackIds.includes(state.selectedMenuTrackId)) {
        return state.selectedMenuTrackId;
      }
      return null;
    }
  }

    private async _initAudioMode() {
    if (this.audioModeInitialized) return;
    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        staysActiveInBackground: false,
      });
      this.audioModeInitialized = true;
    } catch (e) {
      console.warn('[AudioService] setAudioModeAsync error:', e);
    }
  }

  private async _playTrack(trackId: string, state: PlayState) {
    const track = state.catalog.find(t => t.id === trackId);
    if (!track) return;

    // Attendre la fin d'un éventuel arrêt en cours avant de lancer la nouvelle piste
    if (this.stopPromise) await this.stopPromise;

    // Arrêter l'actuel
    await this._stop();

    try {
      // Initialisation du mode audio une seule fois (évite le crash Android au cold start)
      await this._initAudioMode();

      const { sound } = await Audio.Sound.createAsync(
        track.file,
        {
          isLooping: true,
          volume: state.volume,
          shouldPlay: true,
        }
      );

      this.sound = sound;
      this.currentTrackId = trackId;
    } catch (e) {
      console.warn('[AudioService] Erreur lecture:', e);
    }
  }

  private _stop(): Promise<void> {
    if (!this.sound) return Promise.resolve();

    const s = this.sound;
    // Détacher immédiatement la référence pour que les callbacks
    // en vol ne touchent plus un objet déjà libéré (bug web expo-av)
    this.sound = null;
    this.currentTrackId = null;

    this.stopPromise = (async () => {
      try {
        // 1. Neutraliser le handler DOM ontimeupdate AVANT tout (fix bug web expo-av)
        silenceWebAudioElement(s);
        // 2. Retirer le callback JS (niveau expo-av)
        s.setOnPlaybackStatusUpdate(null);
        // 3. Arrêter la lecture
        await s.stopAsync();
        // 4. Petit délai pour vider la file d'events du navigateur
        await new Promise(r => setTimeout(r, 50));
        // 5. Libérer la mémoire
        await s.unloadAsync();
      } catch (_) {/* ignoré */}
      this.stopPromise = null;
    })();

    return this.stopPromise;
  }

    /** Joue un aperçu d'une piste (une seule fois, sans boucle) */
  async playPreview(trackFile: any, volume: number): Promise<Audio.Sound | null> {
    try {
      await this._initAudioMode();
      const { sound } = await Audio.Sound.createAsync(
        trackFile,
        { isLooping: false, volume, shouldPlay: true }
      );
      return sound;
    } catch (e) {
      console.warn('[AudioService] Erreur preview:', e);
      return null;
    }
  }

  /** Arrête et libère proprement un son de preview (safe sur web) */
  async stopPreviewSound(sound: Audio.Sound): Promise<void> {
    try {
      // 1. Neutraliser le handler DOM ontimeupdate AVANT tout (fix bug web expo-av)
      silenceWebAudioElement(sound);
      // 2. Retirer le callback JS (niveau expo-av)
      sound.setOnPlaybackStatusUpdate(null);
      // 3. Arrêter la lecture
      await sound.stopAsync();
      // 4. Vider la file d'events du navigateur
      await new Promise(r => setTimeout(r, 50));
      // 5. Libérer la mémoire
      await sound.unloadAsync();
    } catch (_) {/* ignoré */}
  }

    async dispose() {
    await this._stop();
    this.audioModeInitialized = false;
  }
}

export const audioService = new AudioService();
