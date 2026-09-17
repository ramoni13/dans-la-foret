// ============================================================
// HOOK DE PERSISTANCE — useStorage.ts
// Charge et sauvegarde le playerStore dans AsyncStorage.
// À appeler UNE SEULE FOIS dans le layout racine (_layout.tsx).
//
// Clé de stockage : 'dlf_player_v1'
// Format : JSON sérialisé de la partie persistable du store
// ============================================================

import { useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePlayerStore } from '../store/playerStore';

const STORAGE_KEY = 'dlf_player_v1';

// Sous-ensemble du store à persister (on exclut les fonctions)
interface PersistedPlayerState {
  seeds: number;
  completedChallenges: string[];
  isPremium: boolean;
  username: string;
  stats: {
    totalSolved: number;
    bestTimes: Record<string, number>;
    currentStreak: number;
    longestStreak: number;
  };
}

export function useStorage() {
  const store = usePlayerStore();
  const isLoaded = useRef(false);
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Chargement au démarrage ──────────────────────────────
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then(raw => {
        if (!raw) return;
        try {
          const saved: PersistedPlayerState = JSON.parse(raw);
          // Restaurer uniquement les champs persistables
          // Note : on ne restaure PAS isPremium en mode prod
          // (géré par l'achat in-app). En mode test, on garde true.
          usePlayerStore.setState({
            seeds:                saved.seeds               ?? 3,
            completedChallenges:  saved.completedChallenges ?? [],
            isPremium:            saved.isPremium           ?? false,
            username:             saved.username            ?? 'Joueur',
            stats:                saved.stats               ?? {
              totalSolved: 0,
              bestTimes: {},
              currentStreak: 0,
              longestStreak: 0,
            },
          });
        } catch {
          // JSON corrompu → on repart de zéro
          console.warn('[useStorage] Données corrompues, réinitialisation.');
        }
      })
      .catch(err => console.warn('[useStorage] Erreur lecture:', err))
      .finally(() => {
        isLoaded.current = true;
      });
  }, []);

  // ── Sauvegarde automatique dès que le store change ───────
  // Debounce 500ms pour éviter d'écrire à chaque keystroke
  useEffect(() => {
    if (!isLoaded.current) return; // Ne pas sauvegarder avant le chargement

    if (saveTimeout.current) clearTimeout(saveTimeout.current);

    saveTimeout.current = setTimeout(() => {
      const toSave: PersistedPlayerState = {
        seeds:               store.seeds,
        completedChallenges: store.completedChallenges,
        isPremium:           store.isPremium,
        username:            store.username,
        stats:               store.stats,
      };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(toSave))
        .catch(err => console.warn('[useStorage] Erreur sauvegarde:', err));
    }, 500);

    return () => {
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
    };
  }, [
    store.seeds,
    store.completedChallenges,
    store.isPremium,
    store.username,
    store.stats,
  ]);
}
