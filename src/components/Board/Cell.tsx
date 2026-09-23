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
  positionStyle: ViewStyle;
  onPress: (cellIndex: number) => void;
  onDrop: (cellIndex: number, elementId: string) => void;
  onCellDragStart?: (cellIndex: number, elementId: string, x: number, y: number) => void;
  onCellDragMove?: (x: number, y: number) => void;
  onCellDragEnd?: (x: number, y: number) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// CellComponent — composant interne (non exporté directement)
//
// Le composant est enveloppé dans React.memo (voir export `Cell` en bas)
// avec une comparaison personnalisée qui EXCLUT les callbacks.
//
// POURQUOI c'est critique pour Android :
//   Quand wrappedCellDragStart appelle setGhostState/setDraggingElement dans
//   [challengeId].tsx, React re-rend BoardRenderer et TOUTES ses Cell.
//   Chaque re-render recrée Gesture.Pan() → GestureDetector reçoit un nouvel
//   objet gesture → reconfigure le recognizer natif Android EN MID-GESTURE
//   → crash natif brutal (SIGSEGV / IllegalStateException C++).
//
//   React.memo empêche ce re-render : pendant le drag, les props visuelles de
//   Cell (elementId, backgroundColor, isDragTarget…) ne changent pas. Seuls
//   ghostState/draggingElement changent dans le parent → les Cell sont skippées
//   → Gesture.Pan() n'est pas recréé → pas de crash.
//
// Les callbacks (onCellDragStart, etc.) sont maintenus à jour via des refs
// internes, évitant toute stale closure malgré l'absence de re-render.
// ─────────────────────────────────────────────────────────────────────────────
const CellComponent: React.FC<CellProps> = ({
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
  const isDraggable = !isFixed && elementId !== null && !!onCellDragStart;
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

  // ── Valeurs animées mobile ────────────────────────────────
  const cellOpacity = useSharedValue(1);
  const cellScale   = useSharedValue(1);

  const animatedCellStyle = useAnimatedStyle(() => ({
    opacity: cellOpacity.value,
    transform: [{ scale: cellScale.value }],
  }), [cellOpacity, cellScale]);

  // ── Refs stables pour les callbacks passés à runOnJS ────────
  // React.memo empêche le re-render de Cell pendant le drag, donc les props
  // (et les callbacks) ne sont pas mis à jour par React. On utilise des refs
  // pour que jsDragStart/End lisent toujours les valeurs courantes.
  const elementIdRef       = useRef(elementId);
  const cellIndexRef       = useRef(cellIndex);
  const onCellDragStartRef = useRef(onCellDragStart);
  const onCellDragMoveRef  = useRef(onCellDragMove);
  const onCellDragEndRef   = useRef(onCellDragEnd);
  const onPressRef         = useRef(onPress);
  const isFixedRef         = useRef(isFixed);

  elementIdRef.current       = elementId;
  cellIndexRef.current       = cellIndex;
  onCellDragStartRef.current = onCellDragStart;
  onCellDragMoveRef.current  = onCellDragMove;
  onCellDragEndRef.current   = onCellDragEnd;
  onPressRef.current         = onPress;
  isFixedRef.current         = isFixed;

  // Wrappers stables (useCallback []) — référence fixe capturée par runOnJS
  const jsDragStart = useCallback((x: number, y: number) => {
    const eid = elementIdRef.current;
    if (eid) onCellDragStartRef.current?.(cellIndexRef.current, eid, x, y);
  }, []);

  const jsDragMove = useCallback((x: number, y: number) => {
    onCellDragMoveRef.current?.(x, y);
  }, []);

  const jsDragEnd = useCallback((x: number, y: number) => {
    onCellDragEndRef.current?.(x, y);
  }, []);

  const jsPress = useCallback(() => {
    if (!isFixedRef.current) onPressRef.current(cellIndexRef.current);
  }, []);

  // ── Gesture Pan mobile ───────────────────────────────────────
  // Recréé à chaque render — safe car React.memo empêche tout re-render
  // pendant un drag actif (les props visuelles ne changent pas en mid-gesture).
  const panGesture = Gesture.Pan()
    .enabled(isDraggable && Platform.OS !== 'web')
    .minDistance(8)
    .onStart((e) => {
      'worklet';
      cellOpacity.value = withTiming(0.35);
      cellScale.value   = withSpring(0.85, { damping: 12 });
      runOnJS(jsDragStart)(e.absoluteX, e.absoluteY);
    })
    .onUpdate((e) => {
      'worklet';
      runOnJS(jsDragMove)(e.absoluteX, e.absoluteY);
    })
    .onEnd((e) => {
      'worklet';
      cellOpacity.value = withTiming(1);
      cellScale.value   = withSpring(1, { damping: 12 });
      runOnJS(jsDragEnd)(e.absoluteX, e.absoluteY);
    })
    .onFinalize(() => {
      'worklet';
      cellOpacity.value = withTiming(1);
      cellScale.value   = withSpring(1, { damping: 12 });
    });

  const tapGesture = Gesture.Tap()
    .enabled(Platform.OS !== 'web')
    .onEnd(() => {
      'worklet';
      runOnJS(jsPress)();
    });

  const mobileGesture = Gesture.Exclusive(panGesture, tapGesture);

  // ── Gestion web (mouse + touch) ───────────────────────────
  const dragStartPos  = useRef<{ x: number; y: number } | null>(null);
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
    if (isDraggingRef.current) onCellDragMove?.(clientX, clientY);
  };

  const handlePointerUp = (clientX: number, clientY: number) => {
    if (!isDraggable || !elementId) return;
    if (isDraggingRef.current) onCellDragEnd?.(clientX, clientY);
    dragStartPos.current = null;
    isDraggingRef.current = false;
  };

  const webDragProps = Platform.OS === 'web' && isDraggable ? {
    onMouseDown: (e: any) => {
      e.preventDefault();
      handlePointerDown(e.clientX, e.clientY);
      const onMove = (ev: MouseEvent) => handlePointerMove(ev.clientX, ev.clientY);
      const onUp   = (ev: MouseEvent) => {
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
        onPress={() => !isFixed && !isDraggingRef.current && onPress(cellIndex)}
        style={[styles.cell, positionStyle, cellStyle, { cursor: isDraggable ? ('grab' as any) : undefined }]}
        {...webDragProps}
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
// Comparaison personnalisée : on exclut intentionnellement les callbacks car :
//   1. Ils sont stables (useCallback dans [challengeId].tsx)
//   2. Ils sont mis à jour via refs internes même si Cell ne se re-rend pas
// On ne compare que les props qui déterminent l'apparence visuelle.
export const Cell = React.memo(CellComponent, (prev, next) =>
  prev.cellIndex       === next.cellIndex       &&
  prev.elementId       === next.elementId       &&
  prev.isFixed         === next.isFixed         &&
  prev.backgroundColor === next.backgroundColor &&
  prev.isDragTarget    === next.isDragTarget    &&
  prev.positionStyle   === next.positionStyle
);
