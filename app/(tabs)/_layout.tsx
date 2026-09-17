// ============================================================
// LAYOUT TABS — Navigation par onglets
// ============================================================

import { Tabs } from 'expo-router';
import { Colors } from '../../src/constants/colors';
import React from 'react';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.forest.medium,
        tabBarInactiveTintColor: Colors.ui.textLight,
        tabBarStyle: {
          backgroundColor: Colors.ui.card,
          borderTopColor: Colors.ui.border,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Accueil', tabBarIcon: () => null }}
      />
      <Tabs.Screen
        name="levels"
        options={{ title: 'Défis', tabBarIcon: () => null }}
      />
      <Tabs.Screen
        name="challenge"
        options={{ title: 'Amis', tabBarIcon: () => null }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Profil', tabBarIcon: () => null }}
      />
    </Tabs>
  );
}
