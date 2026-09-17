// ============================================================
// ELEMENTTOKEN — Jeton draggable ou fixe
// - isFixed=true  → affichage seul, shake si touché
// - isFixed=false → drag & drop
//   • Mobile : react-native-gesture-handler + reanimated
//   • Web    : onMouseDown natif → ghost via DragGhost (portail)
// ============================================================

import React, { useCallback } from 'react';
import { StyleSheet, Image, View, Platform } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { impactMedium, notificationError } from '../../utils/haptics';

import { ElementDefinition } from '../../core/models/Element';
import { Colors } from '../../constants/colors';

export const TOKEN_SIZE = 64;

interface ElementTokenProps {
  elementDef: ElementDefinition;
  isFixed?: boolean;
  onDragStart?: (elementId: string) => void;
  onDragMove?: (x: number, y: number) => void;
  onDragEnd?: (x: number, y: number) => void;
  // Spécifique web : démarre le ghost depuis useWebDrag
  onWebMouseDown?: (elementId: string, x: number, y: number) => void;
  onTap?: () => void;
  positionStyle?: object;
  size?: number;
}

export const ElementToken: React.FC<ElementTokenProps> = ({
  elementDef,
  isFixed = false,
  onDragStart,
  onDragMove,
  onDragEnd,
  onWebMouseDown,
  onTap,
  positionStyle,
  size = TOKEN_SIZE,
}) => {
  const isWeb = Platform.OS === 'web';

  // ── Valeurs animées (mobile uniquement) ───────────────────
  const scale      = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const opacity    = useSharedValue(1);
  const zIndex     = useSharedValue(1);

  // ── Haptics ───────────────────────────────────────────────
  const triggerImpact = useCallback(() => { impactMedium(); }, []);
  const triggerError  = useCallback(() => { notificationError(); }, []);

  // ── Shake (jeton fixe) ────────────────────────────────────
  const shakeFixed = useCallback(() => {
    'worklet';
    translateX.value = withSequence(
      withTiming(-8, { duration: 50 }),
      withTiming(8,  { duration: 50 }),
      withTiming(-6, { duration: 50 }),
      withTiming(6,  { duration: 50 }),
      withTiming(0,  { duration: 50 })
    );
    runOnJS(triggerError)();
  }, [translateX, triggerError]);

  // ── Gesture mobile (Pan) ──────────────────────────────────
  const panGesture = Gesture.Pan()
    .enabled(!isFixed && !isWeb)
    .onBegin(() => {
      'worklet';
      scale.value   = withSpring(1.2, { damping: 12 });
      zIndex.value  = 999;
      opacity.value = withTiming(0.85);
      runOnJS(triggerImpact)();
      if (onDragStart) runOnJS(onDragStart)(elementDef.id);
    })
    .onUpdate((e) => {
      'worklet';
      translateX.value = e.translationX;
      translateY.value = e.translationY;
      if (onDragMove) runOnJS(onDragMove)(e.absoluteX, e.absoluteY);
    })
    .onEnd((e) => {
      'worklet';
      translateX.value = withSpring(0, { damping: 15, stiffness: 200 });
      translateY.value = withSpring(0, { damping: 15, stiffness: 200 });
      scale.value      = withSpring(1, { damping: 12 });
      opacity.value    = withTiming(1);
      zIndex.value     = 1;
      if (onDragEnd) runOnJS(onDragEnd)(e.absoluteX, e.absoluteY);
    });

  // ── Gesture tap (jeton fixe) ──────────────────────────────
  const tapGesture = Gesture.Tap()
    .enabled(isFixed)
    .onEnd(() => {
      'worklet';
      shakeFixed();
    });

  const gesture = isFixed ? tapGesture : panGesture;

  // ── Style animé (mobile) ──────────────────────────────────
  // En reanimated v4 sans plugin Babel, il faut passer les dépendances explicitement
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
    opacity: opacity.value,
    zIndex: zIndex.value,
    elevation: zIndex.value === 999 ? 999 : 3,
  }), [translateX, translateY, scale, opacity, zIndex]);

  const borderColor = isFixed ? Colors.cell.fixed : elementDef.color;

  const tokenStyle = [
    styles.token,
    {
      width: size,
      height: size,
      borderRadius: size / 2,
      borderColor,
      backgroundColor: isFixed
        ? Colors.cell.fixed + '33'
        : elementDef.color + '22',
    },
    positionStyle,
  ];

  const iconSource = typeof elementDef.icon === 'string'
    ? { uri: elementDef.icon }
    : elementDef.icon;

  // ── Rendu WEB ─────────────────────────────────────────────
  // On n'utilise pas GestureDetector/Animated sur le web :
  // le ghost est géré par DragGhost + useWebDrag dans le parent
  if (isWeb) {
    return (
      <View
        style={tokenStyle as any}
        // @ts-ignore — événements web valides (mouse + touch)
        onMouseDown={!isFixed ? (e: React.MouseEvent) => {
          e.preventDefault();
          if (onWebMouseDown) onWebMouseDown(elementDef.id, e.clientX, e.clientY);
        } : undefined}
        onTouchStart={!isFixed ? (e: React.TouchEvent) => {
          e.preventDefault();
          const t = e.touches[0];
          if (t && onWebMouseDown) onWebMouseDown(elementDef.id, t.clientX, t.clientY);
        } : undefined}
        onClick={isFixed ? triggerError : onTap}
      >
        <Image
          source={iconSource}
          style={{ width: size * 0.7, height: size * 0.7 }}
          resizeMode="contain"
        />
        {isFixed && <View style={styles.fixedBadge} />}
      </View>
    );
  }

  // ── Rendu MOBILE ──────────────────────────────────────────
  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[...tokenStyle, animatedStyle]}>
        <Image
          source={iconSource}
          style={{ width: size * 0.7, height: size * 0.7 }}
          resizeMode="contain"
        />
        {isFixed && <View style={styles.fixedBadge} />}
      </Animated.View>
    </GestureDetector>
  );
};

const styles = StyleSheet.create({
  token: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    boxShadow: '0px 3px 5px rgba(0,0,0,0.2)' as any, // web-friendly
    elevation: 5,
    cursor: 'grab' as any,
  },
  fixedBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.cell.fixed,
    borderWidth: 1,
    borderColor: '#fff',
  },
});
