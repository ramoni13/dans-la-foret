// SeedFlyAnimation — chaque graine monte vers le haut et déclenche +1 au compteur

import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View, Platform } from 'react-native';

const native = Platform.OS !== 'web';

const SEED_SIZE     = 24;
const STAGGER       = 100;  // ms entre le DÉBUT de chaque graine (la suivante démarre pendant le pop)
const POP_DURATION  = 80;   // ms pour l'apparition (pop)
const RISE_DURATION = 480;  // ms pour monter jusqu'au compteur

interface SeedProps {
  index:    number;
  fromX:    number; // centre X départ dans la carte
  fromY:    number; // centre Y départ dans la carte
  targetX:  number; // centre X compteur dans la carte
  targetY:  number; // centre Y compteur dans la carte
  onArrived: () => void;
}

function FlyingSeed({ index, fromX, fromY, targetX, targetY, onArrived }: SeedProps) {
  const opacity    = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const scale      = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const delay = index * STAGGER;
    const dx = targetX - fromX; // diagonale vers le centre du compteur
    const dy = targetY - fromY; // négatif = vers le haut

    const timer = setTimeout(() => {
      Animated.parallel([
        // Apparition (pop)
        Animated.timing(opacity, { toValue: 1, duration: POP_DURATION, useNativeDriver: native }),
        Animated.spring(scale,   { toValue: 1, damping: 8, stiffness: 300, useNativeDriver: native }),
        // Déplacement diagonal vers le compteur
        Animated.timing(translateX, {
          toValue:  dx,
          duration: RISE_DURATION,
          easing:   Easing.in(Easing.quad),
          useNativeDriver: native,
        }),
        Animated.timing(translateY, {
          toValue:  dy,
          duration: RISE_DURATION,
          easing:   Easing.in(Easing.quad),
          useNativeDriver: native,
        }),
        // Rétrécit à partir de 70% du trajet
        Animated.sequence([
          Animated.delay(RISE_DURATION * 0.7),
          Animated.timing(scale, {
            toValue:  0,
            duration: RISE_DURATION * 0.3,
            useNativeDriver: native,
          }),
        ]),
        // Disparaît à partir de 70% du trajet
        Animated.sequence([
          Animated.delay(RISE_DURATION * 0.7),
          Animated.timing(opacity, {
            toValue:  0,
            duration: RISE_DURATION * 0.3,
            useNativeDriver: native,
          }),
        ]),
      ]).start(() => {
        // Garantit zéro résidu visuel
        opacity.setValue(0);
        scale.setValue(0);
        onArrived();
      });
    }, delay);

    return () => clearTimeout(timer);
  }, []);

  return (
    <Animated.View
      style={[
        styles.seed,
        {
          left:    fromX - SEED_SIZE / 2,
          top:     fromY - SEED_SIZE / 2,
          opacity,
          transform: [{ translateX }, { translateY }, { scale }],
        },
      ]}
    >
      <Text style={styles.emoji}>🌱</Text>
    </Animated.View>
  );
}

// ── Composant principal ───────────────────────────────────────────────────────
interface SeedFlyAnimationProps {
  count:    number;
  fromX:    number;
  fromY:    number;
  targetX:  number; // centre X du compteur
  targetY:  number; // centre Y du compteur
  onSeedArrived: () => void;
}

export function SeedFlyAnimation({ count, fromX, fromY, targetX, targetY, onSeedArrived }: SeedFlyAnimationProps) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {Array.from({ length: count }, (_, i) => (
        <FlyingSeed
          key={i}
          index={i}
          fromX={fromX}
          fromY={fromY}
          targetX={targetX}
          targetY={targetY}
          onArrived={onSeedArrived}
        />
      ))}
    </View>
  );
}

// ── Hook pulse + halo ─────────────────────────────────────────────────────────
export function useCounterPulse() {
  const scale     = useRef(new Animated.Value(1)).current;
  const haloOpacity = useRef(new Animated.Value(0)).current;
  const haloScale  = useRef(new Animated.Value(0.8)).current;

  const pulse = () => {
    // Pulse scale
    scale.stopAnimation();
    Animated.sequence([
      Animated.spring(scale, { toValue: 1.35, damping: 4, stiffness: 500, useNativeDriver: native }),
      Animated.spring(scale, { toValue: 1.0,  damping: 6, stiffness: 300, useNativeDriver: native }),
    ]).start();

    // Halo vert qui s'expand et disparaît
    haloOpacity.setValue(0.85);
    haloScale.setValue(0.8);
    Animated.parallel([
      Animated.timing(haloOpacity, { toValue: 0,   duration: 450, easing: Easing.out(Easing.quad), useNativeDriver: native }),
      Animated.timing(haloScale,   { toValue: 1.9, duration: 450, easing: Easing.out(Easing.quad), useNativeDriver: native }),
    ]).start();
  };

  return { scale, haloOpacity, haloScale, pulse };
}

const styles = StyleSheet.create({
  seed: {
    position: 'absolute',
    width:    SEED_SIZE,
    height:   SEED_SIZE,
    alignItems:     'center',
    justifyContent: 'center',
  },
  emoji: {
    fontSize: SEED_SIZE - 4,
    lineHeight: SEED_SIZE,
  },
});
