// ============================================================
// LAYOUT TABS — Navigation par onglets
// ============================================================

import { Tabs } from 'expo-router';
import { Colors } from '../../src/constants/colors';
import { Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import React from 'react';

function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return (
    <Text style={{ fontSize: focused ? 26 : 22, opacity: focused ? 1 : 0.5 }}>
      {emoji}
    </Text>
  );
}

export default function TabsLayout() {
  // On récupère les insets réels du système (barre de navigation Android,
  // home indicator iOS, etc.) pour positionner la tab bar correctement
  const insets = useSafeAreaInsets();
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
