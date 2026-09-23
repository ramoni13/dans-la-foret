// ============================================================
// RequireNeighborAnim — flèche pulsée entre deux tokens, glow vert
// API Animated (legacy) — compatible web + native
// Cycle : 1200ms
// ============================================================

import React, { useEffect, useRef } from 'react';
import { View, Image, StyleSheet, Animated, Platform } from 'react-native';
import Svg, { Path, Defs, Marker, Line } from 'react-native-svg';
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

      {/* Flèche SVG */}
      <Animated.View style={[styles.arrow, { opacity: arrowOpacity }]}>
        <Svg width={48} height={24} viewBox="0 0 48 24">
          <Defs>
            <Marker id="rna_arrowhead" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
              <Path d="M0,0 L0,6 L6,3 Z" fill="#4CAF50" />
            </Marker>
          </Defs>
          <Line
            x1="2" y1="12" x2="40" y2="12"
            stroke="#4CAF50" strokeWidth="2.5"
            markerEnd="url(#rna_arrowhead)"
          />
        </Svg>
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
