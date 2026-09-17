// ============================================================
// LAYOUT RACINE — Expo Router
// Garde d'authentification : redirige vers /auth si non connecté
// ============================================================

import { Stack, useRouter, useSegments } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native';
import React, { useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import { useStorage } from '../src/hooks/useStorage';
import { onAuthChange } from '../src/services/authService';

// Composant interne pour brancher la persistance
function StorageBridge() {
  useStorage();
  return null;
}

// Garde d'authentification
// Si l'utilisateur n'est pas connecté et essaie d'accéder à autre chose
// que l'onglet profil → redirige vers le profil pour se connecter
function AuthGuard({ children }: { children: React.ReactNode }) {
  const [user, setUser]       = useState<User | null | undefined>(undefined);
  const router                = useRouter();
  const segments              = useSegments();

  useEffect(() => {
    const unsub = onAuthChange(u => setUser(u));
    return unsub;
  }, []);

  useEffect(() => {
    if (user === undefined) return; // Encore en chargement

    const inProfileTab = segments.includes('profile');

    if (!user && !inProfileTab) {
      // Non connecté et pas sur le profil → rediriger vers profil pour se connecter
      router.replace('/(tabs)/profile');
    } else if (user && inProfileTab) {
      // Vient de se connecter depuis le profil → rediriger vers l'accueil
      router.replace('/(tabs)/');
    }
  }, [user]);

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <StorageBridge />
      <AuthGuard>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="game/[challengeId]"
            options={{ animation: 'slide_from_right' }}
          />
        </Stack>
      </AuthGuard>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
