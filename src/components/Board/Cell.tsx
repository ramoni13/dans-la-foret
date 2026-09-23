// ============================================================
// CELL — Case individuelle du plateau
// Affiche le jeton posé, la couleur d'état, et gère le tap.
// Les jetons posés ne sont pas déplaçables par drag :
// le tap suffit pour les retirer (retour palette).
// Pulsation douce quand la case est en état 'valid' (bonus highlight)
// ============================================================

import React, { useCallback, useEffect, useRef } from 'react';
import {
  Animated,
  Image,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
  Platform,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import ReAnimated, {
  useSharedValue,
  useAnimatedStyle,
  runOnJS,
} from 'react-native-reanimated';
import { Colors } from '../../constants/colors';
import { ElementRegistry } from '../../elements/ElementRegistry';

export const CELL_SIZE = 64;

interface CellProps {
  cellIndex: number;
  elementId: string | null;
  isFixed: boolean;
  backgroundColor: string;
  isDragTarget: boolean;
  positionStyle: ViewStyle;
  onPress: (cellIndex: number) => void;
  onDrop: (cellIndex: number, elementId: string) => void;
}

const CellComponent: React.FC<CellProps> = ({
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
  const isHighlighted = backgroundColor === Colors.cell.valid;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const loopRef   = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (isHighlighted) {
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
      loopRef.current?.stop();
      loopRef.current = null;
      pulseAnim.setValue(1);
    }
    return () => { loopRef.current?.stop(); };
  }, [isHighlighted]);

  const isDropTarget = isDragTarget && !isFixed;
  const borderColor  = isDropTarget ? Colors.cell.selected : isFixed ? Colors.cell.fixed : Colors.forest.medium;
  const borderWidth  = isDropTarget ? 3 : isFixed ? 2 : 1.5;

  // ── Refs stables pour les callbacks passés à runOnJS ────────
  const cellIndexRef = useRef(cellIndex);
  const onPressRef   = useRef(onPress);
  const isFixedRef   = useRef(isFixed);
  cellIndexRef.current = cellIndex;
  onPressRef.current   = onPress;
  isFixedRef.current   = isFixed;

  // ── Valeurs animées (conservées pour compatibilité ReAnimated) ──
  const cellOpacity = useSharedValue(1);
  const cellScale   = useSharedValue(1);

  const animatedCellStyle = useAnimatedStyle(() => ({
    opacity: cellOpacity.value,
    transform: [{ scale: cellScale.value }],
  }), [cellOpacity, cellScale]);

  const jsPress = useCallback(() => {
    if (!isFixedRef.current) onPressRef.current(cellIndexRef.current);
  }, []);

  // ── Gesture Tap uniquement (mobile) — pas de Pan ────────────
  const tapGesture = Gesture.Tap()
    .enabled(Platform.OS !== 'web')
    .onEnd(() => {
      'worklet';
      runOnJS(jsPress)();
    });

  const mobileGesture = tapGesture;

  // ── Styles ────────────────────────────────────────────────
  const cellStyle = {
    backgroundColor,
    borderColor,
    borderWidth,
    shadowOpacity: isDropTarget ? 0.4 : 0.15,
    elevation:     isDropTarget ? 8 : 3,
  };

  // ── Contenu ───────────────────────────────────────────────
  const cellContent = (
    <>
      {isHighlighted && (
        <Animated.View
          style={[StyleSheet.absoluteFill, styles.pulseOverlay, { opacity: pulseAnim }]}
          pointerEvents="none"
        />
      )}
      {elementDef && (
        <Image
          source={typeof elementDef.icon === 'string' ? { uri: elementDef.icon } : elementDef.icon}
          style={[styles.icon, isFixed && styles.iconFixed]}
          resizeMode="contain"
        />
      )}
    </>
  );

  // ── Rendu WEB ─────────────────────────────────────────────
  if (Platform.OS === 'web') {
    return (
      <TouchableOpacity
        activeOpacity={isFixed ? 1 : 0.7}
        onPress={() => !isFixed && onPress(cellIndex)}
        style={[styles.cell, positionStyle, cellStyle]}
      >
        {cellContent}
      </TouchableOpacity>
    );
  }

  // ── Rendu MOBILE ──────────────────────────────────────────
  return (
    <GestureDetector gesture={mobileGesture}>
      <ReAnimated.View style={[styles.cell, positionStyle, cellStyle, animatedCellStyle]}>
        {cellContent}
      </ReAnimated.View>
    </GestureDetector>
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
    backgroundColor: '#fff',
  },
  icon: {
    width: CELL_SIZE * 0.72,
    height: CELL_SIZE * 0.72,
  },
  iconFixed: {
    opacity: 1,
  },
});

// ── Export avec React.memo ────────────────────────────────────────────────────
// Comparaison personnalisée sur les props visuelles uniquement.
// onPress est mis à jour via ref interne, pas besoin de le comparer.
export const Cell = React.memo(CellComponent, (prev, next) =>
  prev.cellIndex       === next.cellIndex       &&
  prev.elementId       === next.elementId       &&
  prev.isFixed         === next.isFixed         &&
  prev.backgroundColor === next.backgroundColor &&
  prev.isDragTarget    === next.isDragTarget    &&
  prev.positionStyle   === next.positionStyle
);
