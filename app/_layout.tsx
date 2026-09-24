// ============================================================
// LAYOUT RACINE — Expo Router
// Rôle minimal : fournir GestureHandlerRootView + persistance AsyncStorage.
// La garde d'authentification est gérée dans (tabs)/_layout.tsx
// pour éviter deux abonnements onAuthChange simultanés.
// ============================================================

import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native';
import React from 'react';
import { useStorage } from '../src/hooks/useStorage';

// Composant interne pour brancher la persistance AsyncStorage
function StorageBridge() {
  useStorage();
  return null;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <StorageBridge />
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
