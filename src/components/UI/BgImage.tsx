// ============================================================
// BgImage — Fond forêt plein écran partagé
//
// Utilise resizeMode="cover" sur les dimensions exactes de l'écran
// (useWindowDimensions) pour couvrir tout l'espace sans zone vide,
// quel que soit le ratio du device.
//
// overlay : opacité du calque sombre (défaut 0.20)
// ============================================================

import React from 'react';
import { Image, View, StyleSheet, useWindowDimensions } from 'react-native';

const BG_IMAGE = require('../../../assets/elements/sprites/fond-ecran.jpg');

interface BgImageProps {
  /** Opacité du calque sombre superposé (0–1). Défaut : 0.20 */
  overlay?: number;
}

export function BgImage({ overlay = 0.20 }: BgImageProps) {
  const { width, height } = useWindowDimensions();
  return (
    <>
      <Image
        source={BG_IMAGE}
        style={{ position: 'absolute', top: 0, left: 0, width, height }}
        resizeMode="cover"
      />
      <View
        style={[StyleSheet.absoluteFill, { backgroundColor: `rgba(0,0,0,${overlay})` }]}
        pointerEvents="none"
      />
    </>
  );
}
