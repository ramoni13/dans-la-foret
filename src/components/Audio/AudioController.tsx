// ============================================================
// AUDIOCONTROLLER — Composant invisible
// Placé dans _layout.tsx, il synchronise expo-av avec le store.
// Reçoit `isInGame` en prop (true quand l'écran game/[id] est actif).
// ============================================================

import { useEffect, useRef } from 'react';
import { useAudioStore } from '../../store/audioStore';
import { audioService } from '../../services/audioService';
import { MUSIC_CATALOG } from '../../constants/music';
import { usePlayerStore } from '../../store/playerStore';
import { incrementTrackPlayCount, updateAudioEnabled } from '../../services/playerService';

interface AudioControllerProps {
  isInGame: boolean;
}

export function AudioController({ isInGame }: AudioControllerProps) {
  const ingameEnabled       = useAudioStore(s => s.ingameEnabled);
  const menuEnabled         = useAudioStore(s => s.menuEnabled);
  const volume              = useAudioStore(s => s.volume);
  const selectedIngame      = useAudioStore(s => s.selectedIngameTrackId);
  const selectedMenu        = useAudioStore(s => s.selectedMenuTrackId);
  const ownedTrackIds       = useAudioStore(s => s.ownedTrackIds);
  const previewTrackId      = useAudioStore(s => s.previewTrackId);
  const userHasInteracted   = useAudioStore(s => s.userHasInteracted);

      // Catalogue statique (ne change jamais en runtime) — mémoïsé en ref
  const catalogRef = useRef(MUSIC_CATALOG.map(t => ({ id: t.id, type: t.type, file: t.file })));

  const userId = usePlayerStore(s => s.userId);

  // Brancher le callback de métriques d'écoute (fire-and-forget, Firestore)
  useEffect(() => {
    audioService.onTrackStarted = (trackId) => {
      if (userId) {
        incrementTrackPlayCount(userId, trackId).catch(() => {});
      }
    };
    return () => { audioService.onTrackStarted = null; };
  }, [userId]);

  // Persister l'état audio activé/coupé en Firestore à chaque changement
  useEffect(() => {
    if (!userId) return;
    updateAudioEnabled(userId, ingameEnabled, menuEnabled).catch(() => {});
  }, [userId, ingameEnabled, menuEnabled]);

  // Synchroniser le service audio à chaque changement
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (cancelled) return;

      if (previewTrackId) {
        // Un preview est en cours → on coupe la musique principale silencieusement
        await audioService.stopForPreview();
        return;
      }

      if (cancelled) return;
      await audioService.syncFromStore({
        ingameEnabled,
        menuEnabled,
        volume,
        selectedIngameTrackId: selectedIngame,
        selectedMenuTrackId: selectedMenu,
        isInGame,
        ownedTrackIds,
        catalog: catalogRef.current,
        userHasInteracted,
      });
    };

    run().catch(() => {});

    // Si les deps changent avant la fin de l'opération async, on ignore le résultat
    return () => { cancelled = true; };
  }, [
    ingameEnabled,
    menuEnabled,
    volume,
    selectedIngame,
    selectedMenu,
    isInGame,
    ownedTrackIds,
    previewTrackId,
    userHasInteracted,
  ]);

  // Nettoyage à la destruction (ex: unload de l'app)
  useEffect(() => {
    return () => {
      audioService.dispose();
    };
  }, []);

  return null; // Composant invisible
}
