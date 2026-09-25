// ============================================================
// RequireNeighborAnim — flèche pulsée entre deux tokens, glow vert
// API Animated (legacy) — compatible web + native
// Cycle : 1200ms
// ============================================================

import React, { useEffect, useRef } from 'react';
import { View, Image, Text, StyleSheet, Animated, Platform } from 'react-native';
import { ElementRegistry } from '../../../elements/ElementRegistry';
import { RuleCard } from '../../../data/levelMeta';

interface Props {
  rule: RuleCard;
  accessibilityLabel?: string;
}

const native = Platform.OS !== 'web';
const TOKEN_SIZE = 48;

export const RequireNeighborAnim: React.FC<Props> = ({ rule, accessibilityLabel }) => {
  const [e1Id, e2Id] = rule.elements;
  const def1 = ElementRegistry[e1Id];
  const def2 = ElementRegistry[e2Id];

  const arrowOpacity = useRef(new Animated.Value(0.3)).current;
  const glowScale    = useRef(new Animated.Value(1)).current;
  const glowOpacity  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(arrowOpacity, { toValue: 1,    duration: 600, useNativeDriver: native }),
          Animated.timing(glowScale,    { toValue: 1.08, duration: 600, useNativeDriver: native }),
          Animated.timing(glowOpacity,  { toValue: 1,    duration: 600, useNativeDriver: native }),
        ]),
        Animated.parallel([
          Animated.timing(arrowOpacity, { toValue: 0.3, duration: 600, useNativeDriver: native }),
          Animated.timing(glowScale,    { toValue: 1,   duration: 600, useNativeDriver: native }),
          Animated.timing(glowOpacity,  { toValue: 0,   duration: 600, useNativeDriver: native }),
        ]),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  if (!def1 || !def2) return null;

  return (
    <View style={styles.container} accessibilityLabel={accessibilityLabel} accessible>
      {/* Token 1 */}
      <Animated.View style={{ transform: [{ scale: glowScale }] }}>
        <View style={[styles.token, { backgroundColor: def1.color + '20', borderColor: def1.color + '60' }]}>
          <Image source={def1.icon} style={styles.image} resizeMode="contain" />
        </View>
        <Animated.View style={[styles.glowRing, { borderColor: '#4CAF50', opacity: glowOpacity }]} />
      </Animated.View>

                        {/* Flèche Unicode — remplace le SVG pour éviter les IDs globaux dupliqués sur le web */}
      <Animated.View style={[styles.arrow, { opacity: arrowOpacity }]}>
        <Text style={styles.arrowText}>→</Text>
      </Animated.View>

      {/* Token 2 */}
      <Animated.View style={{ transform: [{ scale: glowScale }] }}>
        <View style={[styles.token, { backgroundColor: def2.color + '20', borderColor: def2.color + '60' }]}>
          <Image source={def2.icon} style={styles.image} resizeMode="contain" />
        </View>
        <Animated.View style={[styles.glowRing, { borderColor: '#4CAF50', opacity: glowOpacity }]} />
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
    gap: 4,
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
          arrow: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 48,
  },
  arrowText: {
    fontSize: 28,
    color: '#4CAF50',
    fontWeight: '700',
    textAlign: 'center',
  },
  glowRing: {
    position: 'absolute',
    top: -4,
    left: -4,
    width: TOKEN_SIZE + 8,
    height: TOKEN_SIZE + 8,
    borderRadius: (TOKEN_SIZE + 8) / 2,
    borderWidth: 2,
  },
});
