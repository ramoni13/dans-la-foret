// ============================================================
// LAYOUT RACINE — Expo Router
// Rôle minimal : fournir GestureHandlerRootView + persistance AsyncStorage.
// La garde d'authentification est gérée dans (tabs)/_layout.tsx
// pour éviter deux abonnements onAuthChange simultanés.
// ============================================================

import { Stack, useSegments } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet, Platform } from 'react-native';
import React, { useCallback, useEffect } from 'react';
import { useStorage } from '../src/hooks/useStorage';
import { AudioController } from '../src/components/Audio/AudioController';
import { useAudioStore } from '../src/store/audioStore';
// Patch expo-av web : neutralise le crash "emit" dans ontimeupdate lors du unload.
// Metro choisit automatiquement .web.ts sur web et .ts (stub vide) sur natif.
import '../src/services/exponentAVPatch';

// ── Error Boundary audio ──────────────────────────────────────────────────────
// Isole AudioBridge du reste de l'app : si l'audio crash pour n'importe
// quelle raison (asset manquant, codec non supporté, etc.), l'app continue
// de fonctionner normalement, juste sans musique.
class AudioErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: Error) {
    console.warn('[AudioErrorBoundary] Audio désactivé suite à une erreur:', error.message);
  }
  render() {
    if (this.state.hasError) return null; // Silence : pas de musique, mais app vivante
    return this.props.children;
  }
}

// Composant interne pour brancher la persistance AsyncStorage
function StorageBridge() {
  useStorage();
  return null;
}

// Détecte si l'écran de jeu est actif (route game/[challengeId])
// et écoute la première interaction utilisateur pour autoriser l'audio web
function AudioBridge() {
  const segments            = useSegments();
  const isInGame            = segments.length > 0 && segments[0] === 'game';
  const signalInteraction   = useAudioStore(s => s.signalUserInteraction);
  const userHasInteracted   = useAudioStore(s => s.userHasInteracted);

  // Sur web : écouter le premier clic/toucher au niveau du document
  // (phase de capture, avant tout handler React) pour débloquer l'audio
  useEffect(() => {
    if (userHasInteracted || Platform.OS !== 'web') return;

    const handler = () => {
      signalInteraction();
    };

    document.addEventListener('click',      handler, { once: true, capture: true });
    document.addEventListener('touchstart', handler, { once: true, capture: true });
    document.addEventListener('keydown',    handler, { once: true, capture: true });

    return () => {
      document.removeEventListener('click',      handler, true);
      document.removeEventListener('touchstart', handler, true);
      document.removeEventListener('keydown',    handler, true);
    };
  }, [userHasInteracted, signalInteraction]);

      // Sur mobile natif : l'audio est autorisé sans interaction préalable.
  // On diffère de 500ms pour laisser Android initialiser le contexte audio
  // natif avant le premier Audio.setAudioModeAsync (évite le crash cold start).
  useEffect(() => {
    if (Platform.OS !== 'web' && !userHasInteracted) {
      const t = setTimeout(() => signalInteraction(), 500);
      return () => clearTimeout(t);
    }
  }, []);

  return <AudioController isInGame={isInGame} />;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <StorageBridge />
      <AudioErrorBoundary>
        <AudioBridge />
      </AudioErrorBoundary>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="game/[challengeId]"
          options={{ animation: 'slide_from_right' }}
        />
      </Stack>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
