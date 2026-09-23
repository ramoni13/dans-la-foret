// ============================================================
// CELL — Case individuelle du plateau
// Affiche le jeton posé, la couleur d'état, et gère le tap
// Pulsation douce quand la case est en état 'valid' (bonus highlight)
// ============================================================

import React, { useCallback, useEffect, useMemo, useRef } from 'react';
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

  // ── Refs stables pour les callbacks worklet ──────────────────
  // runOnJS sur Android capture la référence de la fonction au moment où
  // le gesture object est instancié par Reanimated. Si un re-render survient
  // (ex : placement d'un élément qui met à jour playerBoard), le worklet
  // continuerait d'appeler l'ancienne version du callback avec d'anciennes
  // valeurs de elementId/cellIndex. Les refs garantissent que le worklet
  // appelle toujours la version courante, sans recréer le gesture object.
  const callCellDragStartRef = useRef<(x: number, y: number) => void>(() => {});
  const callCellDragMoveRef  = useRef<(x: number, y: number) => void>(() => {});
  const callCellDragEndRef   = useRef<(x: number, y: number) => void>(() => {});
  const callOnPressRef       = useRef<() => void>(() => {});

  // Mise à jour des refs à chaque render (pas de stale closure)
  callCellDragStartRef.current = (x: number, y: number) => {
    if (elementId) onCellDragStart?.(cellIndex, elementId, x, y);
  };
  callCellDragMoveRef.current = (x: number, y: number) => {
    onCellDragMove?.(x, y);
  };
  callCellDragEndRef.current = (x: number, y: number) => {
    onCellDragEnd?.(x, y);
  };
  callOnPressRef.current = () => {
    if (!isFixed) onPress(cellIndex);
  };

  // Wrappers stables (référence fixe) que runOnJS peut capturer une fois
  const callCellDragStart = useCallback((x: number, y: number) => {
    callCellDragStartRef.current(x, y);
  }, []);

  const callCellDragMove = useCallback((x: number, y: number) => {
    callCellDragMoveRef.current(x, y);
  }, []);

  const callCellDragEnd = useCallback((x: number, y: number) => {
    callCellDragEndRef.current(x, y);
  }, []);

  const callOnPress = useCallback(() => {
    callOnPressRef.current();
  }, []);

  // ── Valeurs animées mobile (opacité pendant le drag) ──────────
  const cellOpacity = useSharedValue(1);
  const cellScale   = useSharedValue(1);

  // SharedValue d'activation : lisible depuis le worklet UI thread.
  // Mis à jour à chaque render pour refléter l'état réel sans recréer le gesture.
  // On utilise une SharedValue (et non une ref JS) car les worklets Reanimated
  // s'exécutent sur le thread UI Android et n'ont pas accès aux objets JS.
  const isDraggableSV = useSharedValue(
    !isFixed && elementId !== null && Platform.OS !== 'web' ? 1 : 0
  );
  // Mise à jour synchrone à chaque render (pas d'animation, juste assignation)
  isDraggableSV.value = !isFixed && elementId !== null && Platform.OS !== 'web' ? 1 : 0;

  const animatedCellStyle = useAnimatedStyle(() => ({
    opacity: cellOpacity.value,
    transform: [{ scale: cellScale.value }],
  }), [cellOpacity, cellScale]);

  // ── Gesture Pan mobile (grille → grille) ────────────────────
  // useMemo : le gesture object est créé UNE SEULE FOIS par instance de Cell.
  // Les callbacks (callCellDragStart, etc.) ont des références stables (useCallback [],
  // qui délèguent via refs). L'activation est contrôlée par isDraggableSV
  // lisible depuis le worklet UI thread, sans recréer le gesture object.
  //
  // POURQUOI useMemo([]) ici ?
  // Sur Android, RNGH reconfigure le recognizer natif chaque fois que GestureDetector
  // reçoit un nouveau gesture object. Si un drag est en cours entre onStart et onEnd
  // et qu'un re-render survient (ex: playerBoard change après un placement), la
  // reconfiguration du recognizer en mid-gesture provoque un crash natif Android.
  // Le gesture object doit donc rester stable pendant toute la vie du composant.
  const panGesture = useMemo(() => Gesture.Pan()
    .minDistance(8)   // seuil pour distinguer tap vs drag
    // onStart (et non onBegin) : se déclenche SEULEMENT après minDistance.
    .onStart((e) => {
      'worklet';
      if (isDraggableSV.value === 0) return;
      cellOpacity.value = withTiming(0.35);
      cellScale.value   = withSpring(0.85, { damping: 12 });
      runOnJS(callCellDragStart)(e.absoluteX, e.absoluteY);
    })
    .onUpdate((e) => {
      'worklet';
      if (isDraggableSV.value === 0) return;
      runOnJS(callCellDragMove)(e.absoluteX, e.absoluteY);
    })
    .onEnd((e) => {
      'worklet';
      cellOpacity.value = withTiming(1);
      cellScale.value   = withSpring(1, { damping: 12 });
      if (isDraggableSV.value === 0) return;
      runOnJS(callCellDragEnd)(e.absoluteX, e.absoluteY);
    })
    .onFinalize(() => {
      'worklet';
      // Sécurité : toujours restaurer l'apparence même si le gesture est annulé
      cellOpacity.value = withTiming(1);
      cellScale.value   = withSpring(1, { damping: 12 });
    }),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  []); // ← [] intentionnel : le gesture object NE DOIT PAS être recréé

  // Tap gesture (pour le tap normal sur la case)
  // useMemo pour la même raison que panGesture : stabilité de l'objet gesture.
  // Le tap est toujours actif (callOnPress vérifie isFixed en interne).
  // Gesture.Exclusive(pan, tap) garantit que si le pan est reconnu (minDistance=8),
  // le tap est annulé — donc pas de double-déclenchement.
  const tapGesture = useMemo(() => Gesture.Tap()
    .onEnd(() => {
      'worklet';
      runOnJS(callOnPress)();
    }),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  []); // ← [] intentionnel

  // Sur mobile : Pan prioritaire sur Tap (le tap ne se déclenche que si pas de pan)
  // useMemo pour éviter de recréer le gesture composé à chaque render
  const mobileGesture = useMemo(
    () => Gesture.Exclusive(panGesture, tapGesture),
    [panGesture, tapGesture]
  );

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
