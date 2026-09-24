// ============================================================
// LAYOUT TABS — Navigation par onglets
// Contient aussi la garde d'authentification (un seul onAuthChange dans l'app).
// ============================================================

import { Tabs, useRouter, useSegments } from 'expo-router';
import { Colors } from '../../src/constants/colors';
import { Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import React, { useEffect, useRef, useState } from 'react';
import { User } from 'firebase/auth';
import { usePlayerStore } from '../../src/store/playerStore';
import { onAuthChange } from '../../src/services/authService';
import { getPlayer } from '../../src/services/playerService';
import { updateDailyStreak } from '../../src/services/badgeService';
import { auth } from '../../src/services/firebase';

function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return (
    <Text style={{ fontSize: focused ? 26 : 22, opacity: focused ? 1 : 0.5 }}>
      {emoji}
    </Text>
  );
}

export default function TabsLayout() {
  const player   = usePlayerStore();
  const insets   = useSafeAreaInsets();
  const router   = useRouter();
  const segments = useSegments();

  // undefined = Firebase pas encore répondu, null = déconnecté, User = connecté
  const [user, setUser] = useState<User | null | undefined>(undefined);
  // Verrou anti-boucle : une seule redirection par changement d'état auth
  const redirectedRef = useRef(false);

  // ── Un seul abonnement Firebase Auth pour toute l'app ──────────────────────
  useEffect(() => {
    const unsub = onAuthChange(async (firebaseUser) => {
      setUser(firebaseUser);

      if (firebaseUser && !firebaseUser.isAnonymous) {
        // Restaurer le profil Firestore
        const profile = await getPlayer(firebaseUser.uid);
        if (profile) player.restoreFromCloud(profile);
      }
    });
    return unsub;
  }, []); // [] garanti : onAuthChange est stable

  // ── Garde d'authentification — sans boucle ─────────────────────────────────
  // Règle : si l'utilisateur n'est PAS connecté, il ne peut accéder qu'à /profile.
  // On n'utilise PAS router.replace vers /(tabs)/ après connexion pour ne pas
  // interférer avec la navigation normale de l'utilisateur.
  useEffect(() => {
    if (user === undefined) return; // Firebase pas encore répondu

    const inProfileTab = segments.some(s => s === 'profile');

    if (!user && !inProfileTab && !redirectedRef.current) {
      // Non connecté et pas sur le profil → forcer le profil
      redirectedRef.current = true;
      router.replace('/(tabs)/profile');
    } else if (user) {
      // Connecté : réinitialiser le verrou pour les prochaines déconnexions
      redirectedRef.current = false;
    }
  }, [user, segments]);

  // ── Connexion quotidienne ──────────────────────────────────────────────────
  useEffect(() => {
    const isNewDay = player.checkDailyLogin();
    if (isNewDay) {
      player.addSeeds(3);

      const uid    = auth.currentUser?.uid;
      const isAnon = auth.currentUser?.isAnonymous ?? true;
      if (uid && !isAnon) {
        const state = usePlayerStore.getState();
        updateDailyStreak(uid, state.dailyStreak, state.lastPlayedDate).catch(() => {});
      }
    }
  }, []); // Une seule fois au montage

  const tabBarPaddingBottom = insets.bottom + 6;
  const tabBarHeight = tabBarPaddingBottom + 44;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.forest.medium,
        tabBarInactiveTintColor: Colors.ui.textLight,
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: Colors.ui.card,
          borderTopColor: Colors.ui.border,
          height: tabBarHeight,
          paddingBottom: tabBarPaddingBottom,
          paddingTop: 6,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Accueil',
          tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="levels"
        options={{
          title: 'Défis',
          tabBarIcon: ({ focused }) => <TabIcon emoji="🌲" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="challenge"
        options={{
          title: 'Amis',
          tabBarIcon: ({ focused }) => <TabIcon emoji="⚔️" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ focused }) => <TabIcon emoji="👤" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
