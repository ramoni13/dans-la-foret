// ============================================================
// starSoundService — joue la note du pop d'une étoile (Progression v2, C7)
//
// - Réutilise expo-audio (`createAudioPlayer`), comme audioService.
// - Respecte les préférences : aucun son si le joueur a coupé le son en jeu
//   (`ingameEnabled`) ou avant la première interaction (web).
// - Signale les erreurs sans bloquer le déroulement d'une victoire.
// - Chaque note est jouée par un lecteur dédié, libéré à la fin (notes courtes).
// ============================================================

import { createAudioPlayer } from 'expo-audio';
import { useAudioStore } from '../store/audioStore';

const PINECONE_TONES = [
  require('../../assets/sounds/pinecone-do.wav'),
  require('../../assets/sounds/pinecone-mi.wav'),
  require('../../assets/sounds/pinecone-sol.wav'),
] as const;
const LEVEL_COMPLETE_TONE = require('../../assets/sounds/level-complete.wav');

const RELEASE_AFTER_MS = 900;

function playTone(source: number, label: string): void {
  const { ingameEnabled, userHasInteracted, volume } = useAudioStore.getState();
  if (!ingameEnabled || !userHasInteracted) return;

  try {
    const player = createAudioPlayer(source);
    player.volume = Math.max(0, Math.min(1, volume));
    player.play();
    setTimeout(() => {
      try {
        player.release();
      } catch (error) {
        console.warn(`[StarSoundService] Erreur de libération (${label}):`, error);
      }
    }, RELEASE_AFTER_MS);
  } catch (error) {
    console.warn(`[StarSoundService] Erreur de lecture (${label}):`, error);
  }
}

/** Joue le pop doux d'une pomme de pin, en Do–Mi–Sol selon son rang. */
export function playStarTone(index: number): void {
  const rank = Number.isFinite(index)
    ? Math.max(0, Math.min(PINECONE_TONES.length - 1, Math.floor(index)))
    : 0;
  playTone(PINECONE_TONES[rank], `pomme de pin ${rank + 1}`);
}

/** Joue la courte cadence Do–Mi–Sol–Do à la validation d'un niveau. */
export function playLevelCompleteTone(): void {
  playTone(LEVEL_COMPLETE_TONE, 'validation de niveau');
}
