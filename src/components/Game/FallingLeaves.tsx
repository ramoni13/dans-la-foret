// ============================================================
// FALINGLEAVES — Feuilles qui tombent en arrière-plan du jeu
// 100% Animated natif, aucune dépendance externe
// Rendu en position absolute derrière le plateau
// ============================================================

import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Dimensions, Platform } from 'react-native';

const native = Platform.OS !== 'web';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

const LEAF_EMOJIS = ['🍃', '🍂', '🌿', '🍁'];
const LEAF_COUNT  = 8;

interface Leaf {
  x:       Animated.Value;
  y:       Animated.Value;
  rotate:  Animated.Value;
  opacity: Animated.Value;
  emoji:   string;
  size:    number;
  startX:  number;
  delay:   number;
  duration: number;
}

function createLeaf(i: number): Leaf {
  return {
    x:        new Animated.Value(0),
    y:        new Animated.Value(-60),
    rotate:   new Animated.Value(0),
    opacity:  new Animated.Value(0),
    emoji:    LEAF_EMOJIS[i % LEAF_EMOJIS.length],
    size:     16 + Math.floor(Math.random() * 12),
    startX:   Math.random() * SCREEN_W,
    delay:    i * 1800 + Math.random() * 1000,
    duration: 5000 + Math.random() * 4000,
  };
}

function animateLeaf(leaf: Leaf, onDone: () => void) {
  const swayX = (Math.random() - 0.5) * 80;

  leaf.x.setValue(0);
  leaf.y.setValue(-60);
  leaf.rotate.setValue(0);
  leaf.opacity.setValue(0);

  Animated.sequence([
    Animated.delay(leaf.delay),
    Animated.parallel([
      Animated.timing(leaf.opacity, {
        toValue: 0.75,
        duration: 600,
        useNativeDriver: native,
      }),
      Animated.timing(leaf.y, {
        toValue: SCREEN_H + 60,
        duration: leaf.duration,
        useNativeDriver: native,
      }),
      Animated.sequence([
        Animated.timing(leaf.x, { toValue: swayX,      duration: leaf.duration / 3, useNativeDriver: native }),
        Animated.timing(leaf.x, { toValue: -swayX / 2, duration: leaf.duration / 3, useNativeDriver: native }),
        Animated.timing(leaf.x, { toValue: swayX / 3,  duration: leaf.duration / 3, useNativeDriver: native }),
      ]),
      Animated.timing(leaf.rotate, {
        toValue: 3,
        duration: leaf.duration,
        useNativeDriver: native,
      }),
      Animated.sequence([
        Animated.delay(leaf.duration * 0.75),
        Animated.timing(leaf.opacity, {
          toValue: 0,
          duration: leaf.duration * 0.25,
          useNativeDriver: native,
        }),
      ]),
    ]),
  ]).start(onDone);
}

export function FallingLeaves() {
  const leaves = useRef<Leaf[]>(
    Array.from({ length: LEAF_COUNT }, (_, i) => createLeaf(i))
  ).current;

  useEffect(() => {
    // Lance chaque feuille en boucle infinie
    leaves.forEach(leaf => {
      const loop = () => animateLeaf(leaf, loop);
      loop();
    });

    return () => {
      leaves.forEach(leaf => {
        leaf.x.stopAnimation();
        leaf.y.stopAnimation();
        leaf.rotate.stopAnimation();
        leaf.opacity.stopAnimation();
      });
    };
  }, []);

  return (
    <View style={styles.container} pointerEvents="none">
      {leaves.map((leaf, i) => (
        <Animated.Text
          key={i}
          style={[
            styles.leaf,
            {
              left:     leaf.startX,
              fontSize: leaf.size,
              opacity:  leaf.opacity,
              transform: [
                { translateX: leaf.x },
                { translateY: leaf.y },
                { rotate: leaf.rotate.interpolate({
                  inputRange:  [0, 3],
                  outputRange: ['0deg', '540deg'],
                })},
              ],
            },
          ]}
        >
          {leaf.emoji}
        </Animated.Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
    pointerEvents: 'none',
  },
  leaf: {
    position: 'absolute',
    top: 0,
  },
});
