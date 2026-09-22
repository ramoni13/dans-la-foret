// ============================================================
// CELL — Case individuelle du plateau
// Affiche le jeton posé, la couleur d'état, et gère le tap
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
  withSpring,
  withTiming,
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
  positionStyle: ViewStyle;                              // { left, top } calculés par BoardRenderer
  onPress: (cellIndex: number) => void;
  onDrop: (cellIndex: number, elementId: string) => void; // signature alignée avec BoardRenderer
  // Drag depuis la grille (case → case)
  onCellDragStart?: (cellIndex: number, elementId: string, x: number, y: number) => void;
  onCellDragMove?: (x: number, y: number) => void;
  onCellDragEnd?: (x: number, y: number) => void;
}

export const Cell: React.FC<CellProps> = ({
  cellIndex,
  elementId,
  isFixed,
  backgroundColor,
  isDragTarget,
  positionStyle,
  onPress,
  onCellDragStart,
  onCellDragMove,
  onCellDragEnd,
}) => {
  // Une case est draggable si elle contient un élément posé par le joueur (non fixe)
  const isDraggable = !isFixed && elementId !== null && !!onCellDragStart;
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

  // ── Callbacks JS stables (pour runOnJS depuis worklet) ──────────
  const callCellDragStart = useCallback((x: number, y: number) => {
    if (elementId) onCellDragStart?.(cellIndex, elementId, x, y);
  }, [cellIndex, elementId, onCellDragStart]);

  const callCellDragMove = useCallback((x: number, y: number) => {
    onCellDragMove?.(x, y);
  }, [onCellDragMove]);

  const callCellDragEnd = useCallback((x: number, y: number) => {
    onCellDragEnd?.(x, y);
  }, [onCellDragEnd]);

  const callOnPress = useCallback(() => {
    if (!isFixed) onPress(cellIndex);
  }, [isFixed, cellIndex, onPress]);

  // ── Valeurs animées mobile (opacité pendant le drag) ──────────
  const cellOpacity = useSharedValue(1);
  const cellScale   = useSharedValue(1);

  const animatedCellStyle = useAnimatedStyle(() => ({
    opacity: cellOpacity.value,
    transform: [{ scale: cellScale.value }],
  }), [cellOpacity, cellScale]);

  // ── Gesture Pan mobile (grille → grille) ────────────────────
  const panGesture = Gesture.Pan()
    .enabled(!isFixed && !!(elementId) && Platform.OS !== 'web')
    .minDistance(6)   // seuil pour distinguer tap vs drag
    .onBegin((e) => {
      'worklet';
      cellOpacity.value = withTiming(0.35);
      cellScale.value   = withSpring(0.85, { damping: 12 });
      runOnJS(callCellDragStart)(e.absoluteX, e.absoluteY);
    })
    .onUpdate((e) => {
      'worklet';
      runOnJS(callCellDragMove)(e.absoluteX, e.absoluteY);
    })
    .onEnd((e) => {
      'worklet';
      cellOpacity.value = withTiming(1);
      cellScale.value   = withSpring(1, { damping: 12 });
      runOnJS(callCellDragEnd)(e.absoluteX, e.absoluteY);
    })
    .onFinalize(() => {
      'worklet';
      // Sécurité : toujours restaurer l'apparence
      cellOpacity.value = withTiming(1);
      cellScale.value   = withSpring(1, { damping: 12 });
    });

  // Tap gesture (pour le tap normal sur la case)
  const tapGesture = Gesture.Tap()
    .enabled(!isFixed && Platform.OS !== 'web')
    .onEnd(() => {
      'worklet';
      runOnJS(callOnPress)();
    });

  // Sur mobile : Pan prioritaire sur Tap (le tap ne se déclenche que si pas de pan)
  const mobileGesture = Gesture.Exclusive(panGesture, tapGesture);

  // ── Gestion du drag depuis la case (WEB : mouse + touch) ──
  // On utilise un ref pour distinguer drag vs tap :
  // si le pointeur a bougé de plus de 5px → c'est un drag, pas un tap
  const dragStartPos = useRef<{ x: number; y: number } | null>(null);
  const isDraggingRef = useRef(false);

  const handlePointerDown = (clientX: number, clientY: number) => {
    if (!isDraggable || !elementId) return;
    dragStartPos.current = { x: clientX, y: clientY };
    isDraggingRef.current = false;
  };

  const handlePointerMove = (clientX: number, clientY: number) => {
    if (!isDraggable || !elementId || !dragStartPos.current) return;
    const dx = clientX - dragStartPos.current.x;
    const dy = clientY - dragStartPos.current.y;
    if (!isDraggingRef.current && Math.sqrt(dx * dx + dy * dy) > 5) {
      isDraggingRef.current = true;
      onCellDragStart?.(cellIndex, elementId, clientX, clientY);
    }
    if (isDraggingRef.current) {
      onCellDragMove?.(clientX, clientY);
    }
  };

  const handlePointerUp = (clientX: number, clientY: number) => {
    if (!isDraggable || !elementId) return;
    if (isDraggingRef.current) {
      onCellDragEnd?.(clientX, clientY);
    }
    dragStartPos.current = null;
    isDraggingRef.current = false;
  };

  const webDragProps = Platform.OS === 'web' && isDraggable ? {
    onMouseDown: (e: any) => {
      e.preventDefault();
      handlePointerDown(e.clientX, e.clientY);
      const onMove = (ev: MouseEvent) => handlePointerMove(ev.clientX, ev.clientY);
      const onUp = (ev: MouseEvent) => {
        handlePointerUp(ev.clientX, ev.clientY);
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    },
    onTouchStart: (e: any) => {
      const t = e.touches[0];
      if (!t) return;
      handlePointerDown(t.clientX, t.clientY);
      const onMove = (ev: TouchEvent) => {
        const touch = ev.touches[0];
        if (touch) handlePointerMove(touch.clientX, touch.clientY);
      };
      const onUp = (ev: TouchEvent) => {
        const touch = ev.changedTouches[0];
        if (touch) handlePointerUp(touch.clientX, touch.clientY);
        document.removeEventListener('touchmove', onMove);
        document.removeEventListener('touchend', onUp);
      };
      document.addEventListener('touchmove', onMove, { passive: true });
      document.addEventListener('touchend', onUp, { passive: true });
    },
  } : {};

  // ── Contenu commun (image + overlay pulsation) ──────────────
  const cellContent = (
    <>
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
    </>
  );

  const cellStyleProps = [
    styles.cell,
    positionStyle,
    {
      backgroundColor,
      borderColor,
      borderWidth,
      shadowOpacity: isDropTarget ? 0.4 : 0.15,
      elevation: isDropTarget ? 8 : 3,
    },
  ];

  // ── Rendu WEB ──────────────────────────────────────────────
  if (Platform.OS === 'web') {
    return (
      <TouchableOpacity
        activeOpacity={isFixed ? 1 : 0.7}
        onPress={() => !isFixed && !isDraggingRef.current && onPress(cellIndex)}
        style={[
          ...cellStyleProps,
          { cursor: isDraggable ? ('grab' as any) : undefined },
        ]}
        {...webDragProps}
      >
        {cellContent}
      </TouchableOpacity>
    );
  }

  // ── Rendu MOBILE ─────────────────────────────────────────
  // GestureDetector gère Pan (drag) + Tap (press) de façon exclusive
  return (
    <GestureDetector gesture={mobileGesture}>
      <ReAnimated.View style={[...cellStyleProps, animatedCellStyle]}>
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
