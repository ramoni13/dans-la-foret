// ============================================================
// LAYOUT TABS — Navigation par onglets
// ============================================================

import { Tabs } from 'expo-router';
import { Colors } from '../../src/constants/colors';
import { Text, Platform } from 'react-native';
import React from 'react';

function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return (
    <Text style={{ fontSize: focused ? 26 : 22, opacity: focused ? 1 : 0.5 }}>
      {emoji}
    </Text>
  );
}

export default function TabsLayout() {
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
          // Sur iOS/Android on laisse le système gérer le safe-area bottom
          // On fixe une hauteur suffisante pour que les icônes soient visibles
          height: Platform.OS === 'ios' ? 82 : Platform.OS === 'android' ? 68 : 60,
          paddingBottom: Platform.OS === 'ios' ? 24 : Platform.OS === 'android' ? 10 : 8,
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
