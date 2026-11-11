// ============================================================
// starSoundService — joue la note du pop d'une étoile (Progression v2, C7)
//
// - Réutilise expo-audio (`createAudioPlayer`), comme audioService.
// - Respecte les préférences : aucun son si le joueur a coupé le son en jeu
//   (`ingameEnabled`) ou avant la première interaction (web).
// - Silencieux en cas d'erreur : un son raté ne doit jamais bloquer une victoire.
// - Chaque note est jouée par un lecteur dédié, libéré à la fin (notes courtes).
// ============================================================

import { createAudioPlayer } from 'expo-audio';
import { useAudioStore } from '../store/audioStore';
import { getStarToneDataUri } from '../utils/starTones';

const RELEASE_AFTER_MS = 900;

/** Joue la note de l'étoile `index` (0, 1, 2 : de plus en plus aiguë). */
export function playStarTone(index: number): void {
  try {
    const { ingameEnabled, userHasInteracted, volume } = useAudioStore.getState();
    if (!ingameEnabled || !userHasInteracted) return;
    const player = createAudioPlayer(getStarToneDataUri(index));
    player.volume = Math.max(0, Math.min(1, volume));
    player.play();
    setTimeout(() => {
      try { player.release(); } catch { /* déjà libéré */ }
    }, RELEASE_AFTER_MS);
  } catch {
    // silencieux
  }
}
