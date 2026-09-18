// ============================================================
// MOBILEDRAGGERHOST — Fantôme visuel pendant le drag (mobile natif)
// Rendu au niveau de GestureHandlerRootView (niveau racine)
// Suit le doigt en position absolute, toujours au-dessus de tout
// ============================================================

import React from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { ElementRegistry } from '../../elements/ElementRegistry';
import { Colors } from '../../constants/colors';

export const GHOST_SIZE = 72;

interface MobileDragGhostProps {
  elementId: string | null;
  x: number;  // coordonnées écran absolues
  y: number;
  visible: boolean;
}

export const MobileDragGhost: React.FC<MobileDragGhostProps> = ({
  elementId,
  x,
  y,
  visible,
}) => {
  if (!visible || !elementId) return null;

  const elementDef = ElementRegistry[elementId];
  if (!elementDef) return null;

  const iconSource = typeof elementDef.icon === 'string'
    ? { uri: elementDef.icon }
    : elementDef.icon;

  return (
    <View
      style={[
        styles.ghost,
        {
          left: x - GHOST_SIZE / 2,
          top: y - GHOST_SIZE / 2,
          borderColor: elementDef.color,
          backgroundColor: elementDef.color + '33',
        },
      ]}
      pointerEvents="none"
    >
      <Image
        source={iconSource}
        style={styles.icon}
        resizeMode="contain"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  ghost: {
    position: 'absolute',
    width: GHOST_SIZE,
    height: GHOST_SIZE,
    borderRadius: GHOST_SIZE / 2,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 9999,   // toujours au-dessus de tout sur Android
    zIndex: 9999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    transform: [{ scale: 1.15 }],
    opacity: 0.92,
  },
  icon: {
    width: GHOST_SIZE * 0.7,
    height: GHOST_SIZE * 0.7,
  },
});
