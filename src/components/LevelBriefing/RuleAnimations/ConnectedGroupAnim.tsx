// ============================================================
// ConnectedGroupAnim — 3 chiens toujours visibles, reliés par
// des lignes pulsées bleues pour illustrer la meute connexe.
// API Animated (legacy) — compatible web + native
// Cycle : 1800ms
// ============================================================

import React, { useEffect, useRef } from 'react';
import { View, Image, StyleSheet, Animated, Platform } from 'react-native';
import { ElementRegistry } from '../../../elements/ElementRegistry';
import { RuleCard } from '../../../data/levelMeta';

interface Props {
  rule: RuleCard;
  accessibilityLabel?: string;
}

const native = Platform.OS !== 'web';
const TOKEN_SIZE = 44;
const GAP = 12; // espace entre tokens

export const ConnectedGroupAnim: React.FC<Props> = ({ rule, accessibilityLabel }) => {
  const [elementId] = rule.elements;
  const def = ElementRegistry[elementId];

  // Ligne 1 (entre token 1 et 2) : opacity + scale
  const line1Op  = useRef(new Animated.Value(0)).current;
  // Ligne 2 (entre token 2 et 3) : opacity + scale
  const line2Op  = useRef(new Animated.Value(0)).current;
  // Glow sur les tokens : scale pulse
  const glowScale = useRef(new Animated.Value(1)).current;
  const glowOp    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        // Phase 1 (0→400ms) : ligne 1 s'allume
        Animated.timing(line1Op, { toValue: 1, duration: 400, useNativeDriver: native }),
        // Phase 2 (400→800ms) : ligne 2 s'allume
        Animated.timing(line2Op, { toValue: 1, duration: 400, useNativeDriver: native }),
        // Phase 3 (800→1200ms) : glow pulse sur les 3 tokens
        Animated.parallel([
          Animated.sequence([
            Animated.timing(glowScale, { toValue: 1.12, duration: 200, useNativeDriver: native }),
            Animated.timing(glowScale, { toValue: 1,    duration: 200, useNativeDriver: native }),
          ]),
          Animated.sequence([
            Animated.timing(glowOp, { toValue: 1, duration: 200, useNativeDriver: native }),
            Animated.timing(glowOp, { toValue: 0, duration: 200, useNativeDriver: native }),
          ]),
        ]),
        // Phase 4 (1200→1600ms) : tout s'éteint
        Animated.parallel([
          Animated.timing(line1Op,   { toValue: 0, duration: 300, useNativeDriver: native }),
          Animated.timing(line2Op,   { toValue: 0, duration: 300, useNativeDriver: native }),
        ]),
        // Phase 5 (1600→1800ms) : pause
        Animated.delay(200),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  if (!def) return null;

  const tokenColor = def.color;

  // Largeur d'une ligne de connexion entre deux tokens
  const lineWidth = GAP + 8;

  return (
    <View style={styles.container} accessibilityLabel={accessibilityLabel} accessible>

      {/* Token 1 */}
      <Animated.View style={{ transform: [{ scale: glowScale }] }}>
        <View style={[styles.token, { backgroundColor: tokenColor + '20', borderColor: '#2196F3' }]}>
          <Image source={def.icon} style={styles.image} resizeMode="contain" />
        </View>
        <Animated.View style={[styles.glowRing, { opacity: glowOp }]} />
      </Animated.View>

      {/* Ligne 1 */}
      <Animated.View style={[styles.line, { width: lineWidth, opacity: line1Op }]} />

      {/* Token 2 (central) */}
      <Animated.View style={{ transform: [{ scale: glowScale }] }}>
        <View style={[styles.token, { backgroundColor: tokenColor + '20', borderColor: '#2196F3' }]}>
          <Image source={def.icon} style={styles.image} resizeMode="contain" />
        </View>
        <Animated.View style={[styles.glowRing, { opacity: glowOp }]} />
      </Animated.View>

      {/* Ligne 2 */}
      <Animated.View style={[styles.line, { width: lineWidth, opacity: line2Op }]} />

      {/* Token 3 */}
      <Animated.View style={{ transform: [{ scale: glowScale }] }}>
        <View style={[styles.token, { backgroundColor: tokenColor + '20', borderColor: '#2196F3' }]}>
          <Image source={def.icon} style={styles.image} resizeMode="contain" />
        </View>
        <Animated.View style={[styles.glowRing, { opacity: glowOp }]} />
      </Animated.View>

    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 80,
  },
  token: {
    width: TOKEN_SIZE,
    height: TOKEN_SIZE,
    borderRadius: TOKEN_SIZE / 2,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: TOKEN_SIZE * 0.7,
    height: TOKEN_SIZE * 0.7,
  },
  glowRing: {
    position: 'absolute',
    top: -5,
    left: -5,
    width: TOKEN_SIZE + 10,
    height: TOKEN_SIZE + 10,
    borderRadius: (TOKEN_SIZE + 10) / 2,
    borderWidth: 2.5,
    borderColor: '#2196F3',
  },
  line: {
    height: 3,
    backgroundColor: '#2196F3',
    borderRadius: 2,
  },
});
