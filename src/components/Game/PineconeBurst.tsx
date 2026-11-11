// ============================================================
// PineconeBurst — gerbe de confettis / feu d'artifice (Reanimated)
//
// Un « tir » = N particules qui partent d'un point, s'écartent en cercle puis retombent en s'éteignant.
// `shots` : liste de tirs (centre dans le repère du parent, absoluteFill). Chaque tir a une clé unique :
// ajouter un tir en rejoue un nouveau, sans toucher aux précédents.
// « Réduire les animations » : rien n'est affiché (la fête est purement décorative).
// ============================================================

import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { BurstParticle, buildBurstParticles } from '../../constants/pinecone';

export interface BurstShot {
  key: number;
  x: number;
  y: number;
  /** Portée de la gerbe (px). */
  radius?: number;
  /** Nombre de particules. */
  count?: number;
  /** Retard avant le départ (ms) : pour échelonner plusieurs tirs. */
  delay?: number;
}

const DURATION = 900;
const GRAVITY = 46; // px de chute supplémentaire pendant le vol

function Particle({ p, delay }: { p: BurstParticle; delay: number }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      delay + p.delay,
      withTiming(1, { duration: DURATION, easing: Easing.out(Easing.cubic) }),
    );
    return () => cancelAnimation(progress);
  }, []);

  const style = useAnimatedStyle(() => {
    const t = progress.value;
    // Opacité : pleine au départ, s'éteint sur le dernier tiers du vol.
    const opacity = t <= 0 ? 0 : t < 0.65 ? 1 : Math.max(0, 1 - (t - 0.65) / 0.35);
    return {
      opacity,
      transform: [
        { translateX: p.dx * t },
        { translateY: p.dy * t + GRAVITY * t * t },
        { rotate: `${p.spin * 180 * t}deg` },
        { scale: 0.4 + 0.6 * Math.min(1, t * 4) },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        styles.particle,
        {
          width: p.size,
          height: p.round ? p.size : p.size * 0.6,
          borderRadius: p.round ? p.size / 2 : 1.5,
          backgroundColor: p.color,
        },
        style,
      ]}
    />
  );
}

function Shot({ shot }: { shot: BurstShot }) {
  const particles = React.useMemo(
    () => buildBurstParticles(shot.count ?? 22, shot.radius ?? 90, shot.key * 7919 + 13),
    [shot.key],
  );
  return (
    <View style={[styles.shot, { left: shot.x, top: shot.y }]} pointerEvents="none">
      {particles.map((p, i) => (
        <Particle key={i} p={p} delay={shot.delay ?? 0} />
      ))}
    </View>
  );
}

export function PineconeBurst({ shots }: { shots: BurstShot[] }) {
  const reduceMotion = useReducedMotion();
  if (reduceMotion || shots.length === 0) return null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {shots.map(s => (
        <Shot key={s.key} shot={s} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  // Le point (left, top) est le centre du tir : les particules sont centrées dessus.
  shot: { position: 'absolute', width: 0, height: 0 },
  particle: { position: 'absolute' },
});
