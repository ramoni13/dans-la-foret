// ============================================================
// GAME LAYOUT — Desactive le swipe-to-go-back iOS
// pour empecher le bypass de la confirmation d'abandon
// ============================================================

import React from 'react';
import { Stack } from 'expo-router';

export default function GameLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        gestureEnabled: false,
      }}
    />
  );
}
