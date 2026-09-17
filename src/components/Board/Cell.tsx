// ============================================================
// CELL — Case individuelle du plateau
// Affiche le jeton posé, la couleur d'état, et gère le tap
// Pulsation douce quand la case est en état 'valid' (bonus highlight)
// ============================================================

import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Image,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
  Platform,
} from 'react-native';
import { Colors } from '../../constants/colors';
import { ElementRegistry } from '../../elements/ElementRegistry';

export const CELL_SIZE = 64;

interface CellProps {
  cellIndex: number;
  elementId: string | null;
  isFixed: boolean;
  backgroundColor: string;
  isDragTarget: boolean;
  positionStyle: ViewStyle;                              // { left, top } calculés par BoardRenderer
  onPress: (cellIndex: number) => void;
  onDrop: (cellIndex: number, elementId: string) => void; // signature alignée avec BoardRenderer
}

export const Cell: React.FC<CellProps> = ({
  cellIndex,
  elementId,
  isFixed,
  backgroundColor,
  isDragTarget,
  positionStyle,
  onPress,
}) => {
  const elementDef = elementId ? ElementRegistry[elementId] : null;

  // ── Pulsation bonus highlight ────────────────────────────
  // Active uniquement quand la case est en état 'valid' (vert highlight)
  const isHighlighted = backgroundColor === Colors.cell.valid;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const loopRef   = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (isHighlighted) {
      // Boucle : opacité 1 → 0.45 → 1, durée totale ~1.2s
      loopRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.45,
            duration: 600,
            useNativeDriver: Platform.OS !== 'web',
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: Platform.OS !== 'web',
          }),
        ])
      );
      loopRef.current.start();
    } else {
      // Arrêt propre + reset
      loopRef.current?.stop();
      loopRef.current = null;
      pulseAnim.setValue(1);
    }
    return () => {
      loopRef.current?.stop();
    };
  }, [isHighlighted]);

  // Les cases fixes ne réagissent jamais au survol
  const isDropTarget = isDragTarget && !isFixed;

  const borderColor = isDropTarget
    ? Colors.cell.selected
    : isFixed
    ? Colors.cell.fixed
    : Colors.forest.medium;

  const borderWidth = isDropTarget ? 3 : isFixed ? 2 : 1.5;

  return (
    <TouchableOpacity
      activeOpacity={isFixed ? 1 : 0.7}
      onPress={() => !isFixed && onPress(cellIndex)}
      style={[
        styles.cell,
        positionStyle,
        {
          backgroundColor,
          borderColor,
          borderWidth,
          shadowOpacity: isDropTarget ? 0.4 : 0.15,
          elevation: isDropTarget ? 8 : 3,
        },
      ]}
    >
      {/* Overlay de pulsation — superposé sur la case, ne bloque pas les events */}
      {isHighlighted && (
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            styles.pulseOverlay,
            { opacity: pulseAnim },
          ]}
          pointerEvents="none"
        />
      )}

      {elementDef && (
        <Image
          source={
            typeof elementDef.icon === 'string'
              ? { uri: elementDef.icon }
              : elementDef.icon
          }
          style={[styles.icon, isFixed && styles.iconFixed]}
          resizeMode="contain"
        />
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: CELL_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  pulseOverlay: {
    borderRadius: CELL_SIZE / 2,
    backgroundColor: '#fff',   // flash blanc qui pulse sur le vert
  },
  icon: {
    width: CELL_SIZE * 0.72,
    height: CELL_SIZE * 0.72,
  },
  iconFixed: {
    opacity: 1,
  },
});
