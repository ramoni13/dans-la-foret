// ============================================================
// LAYOUT RACINE — Expo Router
// Rôle minimal : fournir GestureHandlerRootView + persistance AsyncStorage.
// La garde d'authentification est gérée dans (tabs)/_layout.tsx
// pour éviter deux abonnements onAuthChange simultanés.
// ============================================================

import { Stack, useSegments } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet, Platform, TouchableOpacity, Text, View } from 'react-native';
import React, { useCallback, useEffect } from 'react';
import { useStorage } from '../src/hooks/useStorage';
import { AudioController } from '../src/components/Audio/AudioController';
import { useAudioStore } from '../src/store/audioStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';


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

// ── Bouton son flottant (visible uniquement sur les pages menu, pas en jeu) ──
function SoundButton() {
  const segments     = useSegments();
  const menuEnabled  = useAudioStore(s => s.menuEnabled);
  const setMenu      = useAudioStore(s => s.setMenuEnabled);
  const insets       = useSafeAreaInsets();

  // Visible uniquement sur les tabs, pas pendant le jeu
  const isInGame = segments.length > 0 && segments[0] === 'game';
  if (isInGame) return null;

  return (
    <TouchableOpacity
      style={[styles.soundBtn, { top: insets.top + 10 }]}
      onPress={() => setMenu(!menuEnabled)}
      activeOpacity={0.75}
      accessibilityLabel={menuEnabled ? 'Couper le son' : 'Activer le son'}
    >
      <Text style={styles.soundIcon}>{menuEnabled ? '🔊' : '🔇'}</Text>
    </TouchableOpacity>
  );
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
        <Stack.Screen
          name="game/daily"
          options={{ animation: 'slide_from_right' }}
        />
      </Stack>
      <SoundButton />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  soundBtn: {
    position: 'absolute',
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.20)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  soundIcon: {
    fontSize: 20,
  },
});
