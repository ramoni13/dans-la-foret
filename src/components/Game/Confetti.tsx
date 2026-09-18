// ============================================================
// CONFETTI — Composant et hook réutilisables
// Utilisé dans VictoryModal et FriendResultModal
// 100% Animated natif, aucune dépendance externe
// ============================================================

import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Dimensions, Platform } from 'react-native';

// useNativeDriver non supporté sur web
const native = Platform.OS !== 'web';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

const CONFETTI_COLORS = [
  '#FFD700', '#FF6B35', '#4CAF50', '#2196F3',
  '#E91E63', '#9C27B0', '#FF9800', '#00BCD4',
];
const CONFETTI_COUNT = 30;

export interface ConfettiPiece {
  x:       Animated.Value;
  y:       Animated.Value;
  rotate:  Animated.Value;
  opacity: Animated.Value;
  scale:   Animated.Value;
  color:   string;
  size:    number;
  startX:  number;
}

export function useConfetti(visible: boolean) {
  const pieces = useRef<ConfettiPiece[]>(
    Array.from({ length: CONFETTI_COUNT }, (_, i) => ({
      x:       new Animated.Value(0),
      y:       new Animated.Value(0),
      rotate:  new Animated.Value(0),
      opacity: new Animated.Value(0),
      scale:   new Animated.Value(0),
      color:   CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      size:    8 + Math.random() * 8,
      startX:  Math.random() * SCREEN_W,
    }))
  ).current;

  useEffect(() => {
    // Reset dans tous les cas
    pieces.forEach(p => {
      p.x.stopAnimation();
      p.y.stopAnimation();
      p.rotate.stopAnimation();
      p.opacity.stopAnimation();
      p.scale.stopAnimation();
      p.x.setValue(0);
      p.y.setValue(0);
      p.rotate.setValue(0);
      p.opacity.setValue(0);
      p.scale.setValue(0);
    });

    if (!visible) return;

    // Délai de 400ms pour laisser le Modal s'ouvrir avant de lancer les confettis
    const timeout = setTimeout(() => {
      const animations = pieces.map((p, i) => {
        const delay    = i * 40;
        const duration = 1200 + Math.random() * 800;
        const targetX  = (Math.random() - 0.5) * SCREEN_W * 0.8;
        const targetY  = SCREEN_H * 0.5 + Math.random() * SCREEN_H * 0.3;

        return Animated.sequence([
          Animated.delay(delay),
          Animated.parallel([
            Animated.timing(p.opacity, { toValue: 1,       duration: 100,              useNativeDriver: native }),
            Animated.spring(p.scale,   { toValue: 1,       damping: 8, stiffness: 200, useNativeDriver: native }),
            Animated.timing(p.x,       { toValue: targetX, duration,                   useNativeDriver: native }),
            Animated.timing(p.y,       { toValue: targetY, duration,                   useNativeDriver: native }),
            Animated.timing(p.rotate,  { toValue: 6,       duration,                   useNativeDriver: native }),
            Animated.sequence([
              Animated.delay(duration * 0.6),
              Animated.timing(p.opacity, { toValue: 0, duration: duration * 0.4, useNativeDriver: native }),
            ]),
          ]),
        ]);
      });

    Animated.parallel(animations).start();
    }, 400);

    return () => clearTimeout(timeout);
  }, [visible]);

  return pieces;
}

const confettiContainerStyle = {
  position: 'absolute' as const,
  top: 0, left: 0, right: 0, bottom: 0,
  // Dans un Modal React Native, le dernier enfant est toujours au-dessus
  // zIndex suffit, elevation n'est pas nécessaire ici
  zIndex: 9999,
};

export function Confetti({ pieces }: { pieces: ConfettiPiece[] | null }) {
  if (!pieces || pieces.length === 0) return null;
  return (
    <View style={confettiContainerStyle} pointerEvents="none">
      {pieces.map((p, i) => (
        <Animated.View
          key={i}
          style={[
            styles.piece,
            {
              left:            p.startX,
              top:             SCREEN_H * 0.1,
              width:           p.size,
              height:          p.size,
              backgroundColor: p.color,
              borderRadius:    i % 3 === 0 ? p.size / 2 : 2,
              opacity:         p.opacity,
              transform: [
                { translateX: p.x },
                { translateY: p.y },
                { scale:      p.scale },
                { rotate: p.rotate.interpolate({
                  inputRange:  [0, 6],
                  outputRange: ['0deg', '1080deg'],
                })},
              ],
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  piece: { position: 'absolute' },
});
