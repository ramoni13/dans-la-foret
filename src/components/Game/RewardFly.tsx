// ============================================================
// RewardFly — récompenses volantes vers un compteur (Progression v2, C7)
//
// Remplace SeedFlyAnimation. Même principe (chaque récompense monte vers son compteur et
// déclenche `onArrived`), mais :
//   - migré vers react-native-reanimated (règle transverse A / D8) ;
//   - cible 'seeds' (🌱) ou 'stars' (pomme de pin dorée) ;
//   - respecte « réduire les animations » : la récompense apparaît en fondu sur place puis
//     s'éteint, sans trajet (les arrivées sont quand même signalées, donc les compteurs
//     restent justes).
// ============================================================

import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import type { RewardTarget } from '../../store/rewardFlyStore';
import { PineconeIcon } from './PineconeIcon';

const ITEM_SIZE = 24;
const STAGGER = 70;         // ms entre le DÉBUT de chaque récompense
const POP_DURATION = 60;    // ms d'apparition
const RISE_DURATION = 360;  // ms de trajet vers le compteur
const REDUCED_DURATION = 220; // ms du fondu quand les animations sont réduites

// Les récompenses « étoiles » sont des pommes de pin dorées (PineconeIcon) ; seul l'emoji des graines est affiché tel quel.
const EMOJI: Record<RewardTarget, string> = { seeds: '🌱', stars: '⭐' };

interface FlyingItemProps {
  target: RewardTarget;
  index: number;
  fromX: number;
  fromY: number;
  targetX: number;
  targetY: number;
  reduceMotion: boolean;
  onArrived: () => void;
}

function FlyingItem({
  target, index, fromX, fromY, targetX, targetY, reduceMotion, onArrived,
}: FlyingItemProps) {
  const opacity = useSharedValue(0);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(0);
  // Garde : onArrived ne doit être appelé qu'UNE fois, même si l'animation est relancée.
  const arrivedRef = useRef(false);
  const onArrivedRef = useRef(onArrived);
  onArrivedRef.current = onArrived;

  useEffect(() => {
    const delay = index * STAGGER;
    const dx = targetX - fromX;
    const dy = targetY - fromY;
    const arrive = () => {
      if (arrivedRef.current) return;
      arrivedRef.current = true;
      onArrivedRef.current();
    };

    if (reduceMotion) {
      // Fondu sur place : pas de trajet.
      scale.value = 1;
      opacity.value = withDelay(
        delay,
        withSequence(
          withTiming(1, { duration: REDUCED_DURATION / 2 }),
          withTiming(0, { duration: REDUCED_DURATION / 2 }, (finished) => {
            if (finished) scheduleOnRN(arrive);
          }),
        ),
      );
    } else {
      opacity.value = withDelay(
        delay,
        withSequence(
          withTiming(1, { duration: POP_DURATION }),
          withDelay(RISE_DURATION * 0.7 - POP_DURATION, withTiming(0, { duration: RISE_DURATION * 0.3 })),
        ),
      );
      scale.value = withDelay(
        delay,
        withSequence(
          withSpring(1, { damping: 8, stiffness: 300 }),
          withDelay(
            Math.max(0, RISE_DURATION * 0.7 - 250),
            withTiming(0, { duration: RISE_DURATION * 0.3 }),
          ),
        ),
      );
      translateX.value = withDelay(
        delay,
        withTiming(dx, { duration: RISE_DURATION, easing: Easing.in(Easing.quad) }),
      );
      translateY.value = withDelay(
        delay,
        withTiming(dy, { duration: RISE_DURATION, easing: Easing.in(Easing.quad) }, (finished) => {
          if (finished) scheduleOnRN(arrive);
        }),
      );
    }

    return () => {
      cancelAnimation(opacity);
      cancelAnimation(scale);
      cancelAnimation(translateX);
      cancelAnimation(translateY);
    };
    // Les coordonnées sont figées au montage : le parent remonte le composant (key) pour rejouer.
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <Animated.View
      style={[styles.item, { left: fromX - ITEM_SIZE / 2, top: fromY - ITEM_SIZE / 2 }, style]}
    >
      {target === 'stars'
        ? <PineconeIcon size={ITEM_SIZE} variant="gold" />
        : <Text style={styles.emoji}>{EMOJI[target]}</Text>}
    </Animated.View>
  );
}

// ── Composant principal ───────────────────────────────────────────────────────

export interface RewardFlyProps {
  /** 'seeds' (🌱) ou 'stars' (pomme de pin dorée). */
  target: RewardTarget;
  count: number;
  fromX: number;
  fromY: number;
  /** Centre du compteur visé, dans le même repère que fromX / fromY. */
  targetX: number;
  targetY: number;
  /** Appelé une fois par récompense arrivée. */
  onArrived: () => void;
}

export function RewardFly({
  target, count, fromX, fromY, targetX, targetY, onArrived,
}: RewardFlyProps) {
  const reduceMotion = useReducedMotion();
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {Array.from({ length: count }, (_, i) => (
        <FlyingItem
          key={i}
          target={target}
          index={i}
          fromX={fromX}
          fromY={fromY}
          targetX={targetX}
          targetY={targetY}
          reduceMotion={reduceMotion}
          onArrived={onArrived}
        />
      ))}
    </View>
  );
}

// ── Hook : pulse + halo d'un compteur ────────────────────────────────────────

/**
 * Rebond + halo d'un compteur quand une récompense arrive.
 * Retourne des styles Reanimated prêts à appliquer, et `pulse()` à appeler à chaque arrivée.
 * Avec « réduire les animations » : halo seul (fondu), sans rebond.
 */
export function useCounterPulse() {
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const haloOpacity = useSharedValue(0);
  const haloScale = useSharedValue(0.8);

  const pulse = () => {
    if (reduceMotion) {
      haloScale.value = 1.2;
      haloOpacity.value = withSequence(
        withTiming(0.6, { duration: 120 }),
        withTiming(0, { duration: 300 }),
      );
      return;
    }
    cancelAnimation(scale);
    scale.value = withSequence(
      withSpring(1.35, { damping: 4, stiffness: 500 }),
      withSpring(1.0, { damping: 6, stiffness: 300 }),
    );
    haloOpacity.value = 0.85;
    haloScale.value = 0.8;
    haloOpacity.value = withTiming(0, { duration: 450, easing: Easing.out(Easing.quad) });
    haloScale.value = withTiming(1.9, { duration: 450, easing: Easing.out(Easing.quad) });
  };

  const counterStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const haloStyle = useAnimatedStyle(() => ({
    opacity: haloOpacity.value,
    transform: [{ scale: haloScale.value }],
  }));

  return { counterStyle, haloStyle, pulse };
}

const styles = StyleSheet.create({
  item: {
    position: 'absolute',
    width: ITEM_SIZE,
    height: ITEM_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    fontSize: ITEM_SIZE - 4,
    lineHeight: ITEM_SIZE,
  },
});
