// ============================================================
// LAYOUT TABS — Navigation par onglets
// ============================================================

import { Tabs } from 'expo-router';
import { Colors } from '../../src/constants/colors';
import { Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import React, { useEffect } from 'react';
import { usePlayerStore } from '../../src/store/playerStore';
import { onAuthChange } from '../../src/services/authService';
import { getPlayer } from '../../src/services/playerService';

function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return (
    <Text style={{ fontSize: focused ? 26 : 22, opacity: focused ? 1 : 0.5 }}>
      {emoji}
    </Text>
  );
}

export default function TabsLayout() {
  const player = usePlayerStore();
  const insets = useSafeAreaInsets();

  // Restaurer le profil depuis Firestore dès le montage de l'app,
  // quel que soit l'onglet ouvert — garantit que currentLevel est correct
  // même si l'utilisateur n'ouvre jamais l'onglet Profil.
  useEffect(() => {
    const unsub = onAuthChange(async (user) => {
      if (user && !user.isAnonymous) {
        const profile = await getPlayer(user.uid);
        if (profile) player.restoreFromCloud(profile);
      }
    });
    return unsub;
  }, []);
  // paddingBottom = inset bas réel + espace interne pour les icônes
  const tabBarPaddingBottom = insets.bottom + 6;
  const tabBarHeight = tabBarPaddingBottom + 44; // 44 = hauteur minimale des icônes

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
          tabBarIcon: ({ focused }) => <TabIcon emoji="🧑‍🌳" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
