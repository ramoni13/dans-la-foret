// ============================================================
// ELEMENTTOKEN — Jeton dans la palette (tap pour sélectionner)
// - isFixed=true  → affichage seul (compteur vide), shake si touché
// - isFixed=false → tap pour sélectionner/désélectionner
// ============================================================

import React, { useCallback } from 'react';
import { StyleSheet, Image, Platform, TouchableOpacity } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { notificationError } from '../../utils/haptics';

import { ElementDefinition } from '../../core/models/Element';
import { Colors } from '../../constants/colors';

export const TOKEN_SIZE = 64;

interface ElementTokenProps {
  elementDef: ElementDefinition;
  isFixed?: boolean;
  onTap?: () => void;
  size?: number;
}

export const ElementToken: React.FC<ElementTokenProps> = ({
  elementDef,
  isFixed = false,
  onTap,
  size = TOKEN_SIZE,
}) => {
  const isWeb = Platform.OS === 'web';

  // ── Valeurs animées (mobile uniquement) ───────────────────
  const translateX = useSharedValue(0);

  // ── Haptics ───────────────────────────────────────────────
  const triggerError = useCallback(() => { notificationError(); }, []);

  // ── Shake (jeton vide / fixe) ─────────────────────────────
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

  // ── Gesture tap (mobile) ──────────────────────────────────
  const jsTap = useCallback(() => {
    if (onTap) onTap();
  }, [onTap]);

  const tapGesture = Gesture.Tap()
    .enabled(!isWeb)
    .onEnd(() => {
      'worklet';
      if (isFixed) {
        shakeFixed();
      } else {
        runOnJS(jsTap)();
      }
    });

  // ── Style animé (mobile) ──────────────────────────────────
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }), [translateX]);

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
  ];

  const iconSource = typeof elementDef.icon === 'string'
    ? { uri: elementDef.icon }
    : elementDef.icon;

  // ── Rendu WEB ─────────────────────────────────────────────
  if (isWeb) {
    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={isFixed ? triggerError : onTap}
        style={tokenStyle as any}
      >
        <Image
          source={iconSource}
          style={{ width: size * 0.7, height: size * 0.7 }}
          resizeMode="contain"
        />
      </TouchableOpacity>
    );
  }

  // ── Rendu MOBILE ──────────────────────────────────────────
  return (
    <GestureDetector gesture={tapGesture}>
      <Animated.View style={[...tokenStyle, animatedStyle]}>
        <Image
          source={iconSource}
          style={{ width: size * 0.7, height: size * 0.7 }}
          resizeMode="contain"
        />
      </Animated.View>
    </GestureDetector>
  );
};

const styles = StyleSheet.create({
  token: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    boxShadow: '0px 3px 5px rgba(0,0,0,0.2)' as any,
    elevation: 5,
  },
});
