// ============================================================
// FALINGLEAVES — Feuilles qui tombent en arrière-plan du jeu
// 100% Animated natif, aucune dépendance externe
// Rendu en position absolute derrière le plateau
// ============================================================

import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Dimensions, Platform } from 'react-native';

const native = Platform.OS !== 'web';

// On écoute les changements de dimensions (rotation, etc.)
let SCREEN_W = Dimensions.get('window').width;
let SCREEN_H = Dimensions.get('window').height;

const LEAF_EMOJIS = ['🍃', '🍂', '🌿', '🍁'];
const LEAF_COUNT  = native ? 12 : 8;

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
  const { width } = Dimensions.get('window');
  return {
    x:        new Animated.Value(0),
    y:        new Animated.Value(-60),
    rotate:   new Animated.Value(0),
    opacity:  new Animated.Value(0),
    emoji:    LEAF_EMOJIS[i % LEAF_EMOJIS.length],
    size:     native ? 20 + Math.floor(Math.random() * 14) : 16 + Math.floor(Math.random() * 12),
    startX:   Math.random() * width,
    delay:    i * 1200 + Math.random() * 800,
    duration: 4000 + Math.random() * 3000,
  };
}

function animateLeaf(leaf: Leaf, onDone: () => void) {
  const { width, height } = Dimensions.get('window');
  const swayX = (Math.random() - 0.5) * 100;
  // Recalcule startX aléatoire à chaque cycle
  leaf.startX = Math.random() * width;

  leaf.x.setValue(0);
  leaf.y.setValue(-80);
  leaf.rotate.setValue(0);
  leaf.opacity.setValue(0);

  Animated.sequence([
    Animated.delay(leaf.delay),
    Animated.parallel([
      Animated.timing(leaf.opacity, {
        toValue: native ? 0.9 : 0.75,
        duration: 500,
        useNativeDriver: native,
      }),
      Animated.timing(leaf.y, {
        toValue: height + 80,
        duration: leaf.duration,
        useNativeDriver: native,
      }),
      Animated.sequence([
        Animated.timing(leaf.x, { toValue: swayX,      duration: leaf.duration / 3, useNativeDriver: native }),
        Animated.timing(leaf.x, { toValue: -swayX / 2, duration: leaf.duration / 3, useNativeDriver: native }),
        Animated.timing(leaf.x, { toValue: swayX / 3,  duration: leaf.duration / 3, useNativeDriver: native }),
      ]),
      Animated.timing(leaf.rotate, {
        toValue: 4,
        duration: leaf.duration,
        useNativeDriver: native,
      }),
      Animated.sequence([
        Animated.delay(leaf.duration * 0.8),
        Animated.timing(leaf.opacity, {
          toValue: 0,
          duration: leaf.duration * 0.2,
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
    // Lance chaque feuille en boucle infinie avec un délai initial échelonné
    const timeouts: ReturnType<typeof setTimeout>[] = [];
    leaves.forEach((leaf, i) => {
      // Délai initial échelonné pour éviter que toutes les feuilles partent en même temps
      const initialDelay = i * 600;
      const t = setTimeout(() => {
        leaf.delay = 0; // Pas de délai supplémentaire après le premier cycle
        const loop = () => animateLeaf(leaf, loop);
        loop();
      }, initialDelay);
      timeouts.push(t);
    });

    return () => {
      timeouts.forEach(clearTimeout);
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
    // zIndex 5 : au-dessus du fond/plateau mais sous les modals et boutons
    // pointerEvents="none" (sur le composant) empêche tout blocage d'interaction
    zIndex: 5,
    elevation: 5, // Android
  },
  leaf: {
    position: 'absolute',
    top: 0,
  },
});
