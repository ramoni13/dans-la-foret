// ============================================================
// LAYOUT TABS — Navigation par onglets
// ============================================================

import { Tabs } from 'expo-router';
import { Colors } from '../../src/constants/colors';
import { Text } from 'react-native';
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
          height: 60,
          paddingBottom: 8,
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
