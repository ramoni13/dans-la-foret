// ============================================================
// FALINGLEAVES — Particules en arrière-plan du jeu
// Thèmes : feuilles (défaut), papillons, oiseaux
// 100% Animated natif, aucune dépendance externe
// ============================================================

import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Dimensions, Platform } from 'react-native';
import { usePlayerStore, VisualEffect } from '../../store/playerStore';

const native = Platform.OS !== 'web';

// ── Emojis par thème ─────────────────────────────────────────
const THEME_EMOJIS: Record<VisualEffect, string[]> = {
  leaves:      ['🍃', '🍂', '🌿', '🍁'],
  butterflies: ['🦋', '🦋', '🌸', '🪻'],
  birds:       ['🐦', '🕊️', '🐦‍⬛', '🪶'],
  none:        [],
};

const PARTICLE_COUNT = native ? 12 : 8;

interface Particle {
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

function createParticle(i: number, emojis: string[]): Particle {
  const { width } = Dimensions.get('screen');
  return {
    x:        new Animated.Value(0),
    y:        new Animated.Value(-60),
    rotate:   new Animated.Value(0),
    opacity:  new Animated.Value(0),
    emoji:    emojis[i % emojis.length],
    size:     native ? 20 + Math.floor(Math.random() * 14) : 16 + Math.floor(Math.random() * 12),
    startX:   Math.random() * width,
    delay:    i * 1200 + Math.random() * 800,
    duration: 4000 + Math.random() * 3000,
  };
}

function animateParticle(particle: Particle, onDone: () => void) {
  const { width, height } = Dimensions.get('screen');
  const swayX = (Math.random() - 0.5) * 100;
  particle.startX = Math.random() * width;

  particle.x.setValue(0);
  particle.y.setValue(-80);
  particle.rotate.setValue(0);
  particle.opacity.setValue(0);

  Animated.sequence([
    Animated.delay(particle.delay),
    Animated.parallel([
      Animated.timing(particle.opacity, {
        toValue: native ? 0.9 : 0.75,
        duration: 500,
        useNativeDriver: native,
      }),
      Animated.timing(particle.y, {
        toValue: height + 100,
        duration: particle.duration,
        useNativeDriver: native,
      }),
      Animated.sequence([
        Animated.timing(particle.x, { toValue: swayX,      duration: particle.duration / 3, useNativeDriver: native }),
        Animated.timing(particle.x, { toValue: -swayX / 2, duration: particle.duration / 3, useNativeDriver: native }),
        Animated.timing(particle.x, { toValue: swayX / 3,  duration: particle.duration / 3, useNativeDriver: native }),
      ]),
      Animated.timing(particle.rotate, {
        toValue: 4,
        duration: particle.duration,
        useNativeDriver: native,
      }),
      Animated.sequence([
        Animated.delay(particle.duration * 0.8),
        Animated.timing(particle.opacity, {
          toValue: 0,
          duration: particle.duration * 0.2,
          useNativeDriver: native,
        }),
      ]),
    ]),
  ]).start(onDone);
}

export function FallingLeaves() {
  const visualEffect = usePlayerStore(s => s.visualEffect);

  const emojis = THEME_EMOJIS[visualEffect] ?? THEME_EMOJIS.leaves;
  const particles = useRef<Particle[]>(
    emojis.length > 0
      ? Array.from({ length: PARTICLE_COUNT }, (_, i) => createParticle(i, emojis))
      : []
  ).current;

  // Re-assign emojis when theme changes (within same ref lifecycle)
  useEffect(() => {
    if (emojis.length === 0) return;
    particles.forEach((p, i) => {
      p.emoji = emojis[i % emojis.length];
    });
  }, [visualEffect]);

  useEffect(() => {
    if (emojis.length === 0 || particles.length === 0) return;

    const timeouts: ReturnType<typeof setTimeout>[] = [];
    particles.forEach((particle, i) => {
      const initialDelay = i * 600;
      const t = setTimeout(() => {
        particle.delay = 0;
        const loop = () => animateParticle(particle, loop);
        loop();
      }, initialDelay);
      timeouts.push(t);
    });

    return () => {
      timeouts.forEach(clearTimeout);
      particles.forEach(p => {
        p.x.stopAnimation();
        p.y.stopAnimation();
        p.rotate.stopAnimation();
        p.opacity.stopAnimation();
      });
    };
  }, []);

  // Si désactivé, ne rien rendre
  if (visualEffect === 'none' || emojis.length === 0) return null;

  return (
    <View style={styles.container} pointerEvents="none">
      {particles.map((particle, i) => (
        <Animated.Text
          key={i}
          style={[
            styles.particle,
            {
              left:     particle.startX,
              fontSize: particle.size,
              opacity:  particle.opacity,
              transform: [
                { translateX: particle.x },
                { translateY: particle.y },
                { rotate: particle.rotate.interpolate({
                  inputRange:  [0, 3],
                  outputRange: ['0deg', '540deg'],
                })},
              ],
            },
          ]}
        >
          {particle.emoji}
        </Animated.Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    zIndex: 5,
    elevation: 5,
  },
  particle: {
    position: 'absolute',
    top: 0,
  },
});
