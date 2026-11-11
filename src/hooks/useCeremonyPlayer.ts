// ============================================================
// useCeremonyPlayer — joue la file des cérémonies de chapitre (Progression v2, C7 / Lot 4)
//
// Règles (C7) :
//   - jamais PENDANT une partie ni par-dessus la VictoryModal : le hook n'est monté que sur l'accueil,
//     donc une cérémonie n'apparaît qu'au RETOUR sur l'accueil ;
//   - si l'app a été fermée avant la cérémonie, elle est rejouée à l'ouverture suivante de l'accueil
//     (la file est persistée) ;
//   - une cérémonie n'est marquée VUE qu'une fois terminée ou quittée : fermée en cours de route
//     (app tuée), elle reste en file ;
//   - une seule cérémonie à la fois ; les suivantes s'enchaînent après un court temps de respiration.
//
// Le parent affiche <CeremonyModal> avec l'état retourné et branche `onTryNow` / `onClose`.
// ============================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { PROGRESSION_V2 } from '../constants/featureFlags';
import { getNextCeremony, parseChapterCeremonyId, getTryNowDestination, CeremonyDestination } from '../constants/ceremonies';
import { getChapter, getChapterSeeds } from '../constants/progression';
import { usePlayerStore } from '../store/playerStore';
import { auth } from '../services/firebase';
import { buildSoloProgressionPayload, updateSoloProgression } from '../services/playerService';

/** Délai avant d'ouvrir la cérémonie : laisse l'accueil s'afficher et l'utilisateur se repérer. */
const OPEN_DELAY_MS = 700;

export interface CeremonyPlayerState {
  /** Une cérémonie est-elle ouverte ? */
  visible: boolean;
  /** Chapitre de la cérémonie ouverte (1 à 7), 0 si aucune. */
  chapterId: number;
  /** Graines avant versement (départ de l'animation du compteur). */
  seedsBefore: number;
  /** « Plus tard » / fermeture : marque la cérémonie vue puis passe à la suivante. */
  onClose: () => void;
  /** « Essayer maintenant » : marque la cérémonie vue puis renvoie la destination à ouvrir. */
  onTryNow: () => CeremonyDestination;
}

/**
 * @param enabled false → ne joue rien (non connecté, autre écran affiché au-dessus, etc.)
 */
export function useCeremonyPlayer(enabled: boolean): CeremonyPlayerState {
  const pending = usePlayerStore(s => s.pendingCeremonies);
  const [current, setCurrent] = useState<string | null>(null);
  const [seedsBefore, setSeedsBefore] = useState(0);
  const focusedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = () => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
  };

  /** Ouvre la prochaine cérémonie en attente, si l'accueil est affiché et qu'aucune n'est déjà ouverte. */
  const tryOpen = useCallback(() => {
    if (!PROGRESSION_V2 || !enabled || !focusedRef.current) return;
    clearTimer();
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      if (!focusedRef.current) return;
      const state = usePlayerStore.getState();
      const next = getNextCeremony(state.pendingCeremonies);
      if (!next) return;
      setCurrent(prev => {
        if (prev) return prev; // déjà ouverte
        // Les graines de ce chapitre sont DÉJÀ versées au store (grantChapterRewards) : le compteur de la
        // cérémonie part du total moins ce gain, pour que les graines qui volent le fassent monter.
        const n = parseChapterCeremonyId(next);
        const chapter = n === null ? null : getChapter(n);
        const gain = chapter && state.rewardedChapters.includes(chapter.id) ? getChapterSeeds(chapter) : 0;
        setSeedsBefore(Math.max(0, state.seeds - gain));
        return next;
      });
    }, OPEN_DELAY_MS);
  }, [enabled]);

  // Retour sur l'accueil (ou premier affichage) → tenter d'ouvrir
  useFocusEffect(
    useCallback(() => {
      focusedRef.current = true;
      tryOpen();
      return () => {
        focusedRef.current = false;
        clearTimer();
      };
    }, [tryOpen]),
  );

  // La file change (victoire qui met une cérémonie en file, synchronisation cloud) → tenter d'ouvrir
  useEffect(() => { tryOpen(); }, [pending, enabled]);

  useEffect(() => clearTimer, []);

  /** Sauvegarde cloud de la file (best-effort : la file locale est la source de vérité immédiate). */
  const syncCloud = () => {
    const uid = auth.currentUser?.uid;
    const anon = auth.currentUser?.isAnonymous ?? true;
    if (!uid || anon) return;
    updateSoloProgression(uid, buildSoloProgressionPayload(usePlayerStore.getState())).catch(() => {});
  };

  /** Marque la cérémonie courante vue, ferme, et prépare la suivante. */
  const finish = useCallback(() => {
    const id = current;
    if (id) usePlayerStore.getState().markCeremonySeen(id);
    setCurrent(null);
    syncCloud();
    // enchaîne la suivante (déclenché par le changement de `pending`, mais on assure le cas « focus déjà pris »)
    tryOpen();
  }, [current, tryOpen]);

  const onClose = useCallback(() => finish(), [finish]);

  const onTryNow = useCallback((): CeremonyDestination => {
    const n = current ? parseChapterCeremonyId(current) : null;
    const chapter = n === null ? null : getChapter(n);
    const destination = chapter ? getTryNowDestination(chapter) : '/(tabs)/';
    finish();
    return destination;
  }, [current, finish]);

  const chapterId = current ? parseChapterCeremonyId(current) ?? 0 : 0;
  return { visible: current !== null && chapterId > 0, chapterId, seedsBefore, onClose, onTryNow };
}
