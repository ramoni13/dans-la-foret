// ============================================================
// ChainAnim — bucheron → flèche → tas_buches (→ chalet conditionnel)
// API Animated (legacy) — compatible web + native
// Cycle : 2200ms
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
const TOKEN_SIZE = 42;

export const ChainAnim: React.FC<Props> = ({ rule, accessibilityLabel }) => {
  const [e1Id, e2Id] = rule.elements;
  const def1    = ElementRegistry[e1Id];   // bucheron
  const def2    = ElementRegistry[e2Id];   // tas_buches
  const defChal = ElementRegistry['chalet'];

  const arrow1Op  = useRef(new Animated.Value(0)).current;
  const tasGlowOp = useRef(new Animated.Value(0)).current;
  const tasScale  = useRef(new Animated.Value(1)).current;
  const arrow2Op  = useRef(new Animated.Value(0)).current;
  const chalOp    = useRef(new Animated.Value(0)).current;
  const chalGlowOp = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        // Phase 1 (0→500) : flèche 1
        Animated.timing(arrow1Op, { toValue: 1, duration: 400, useNativeDriver: native }),
        // Phase 2 (500→800) : tas glow
        Animated.parallel([
          Animated.timing(tasGlowOp, { toValue: 1,   duration: 200, useNativeDriver: native }),
          Animated.timing(tasScale,  { toValue: 1.1, duration: 200, useNativeDriver: native }),
        ]),
        Animated.parallel([
          Animated.timing(tasGlowOp, { toValue: 0, duration: 100, useNativeDriver: native }),
          Animated.timing(tasScale,  { toValue: 1, duration: 100, useNativeDriver: native }),
        ]),
        // Phase 3 (800→1200) : flèche 2 + chalet apparaissent (conditionnels, opacity 0.6)
        Animated.parallel([
          Animated.timing(arrow2Op, { toValue: 0.6, duration: 400, useNativeDriver: native }),
          Animated.timing(chalOp,   { toValue: 0.6, duration: 400, useNativeDriver: native }),
        ]),
        // Phase 4 (1200→1800) : chalet glow
        Animated.parallel([
          Animated.timing(chalGlowOp, { toValue: 0.7, duration: 300, useNativeDriver: native }),
        ]),
        Animated.timing(chalGlowOp, { toValue: 0, duration: 200, useNativeDriver: native }),
        // Phase 5 (1800→2200) : pause + reset
        Animated.parallel([
          Animated.timing(arrow1Op,  { toValue: 0, duration: 100, useNativeDriver: native }),
          Animated.timing(arrow2Op,  { toValue: 0, duration: 100, useNativeDriver: native }),
          Animated.timing(chalOp,    { toValue: 0, duration: 100, useNativeDriver: native }),
        ]),
        Animated.delay(300),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  if (!def1 || !def2) return null;

  return (
    <View style={styles.container} accessibilityLabel={accessibilityLabel} accessible>
      {/* Bucheron */}
      <View style={[styles.token, { backgroundColor: def1.color + '20', borderColor: def1.color + '60' }]}>
        <Image source={def1.icon} style={styles.image} resizeMode="contain" />
      </View>

      {/* Flèche 1 */}
      <Animated.View style={{ opacity: arrow1Op }}>
        <Svg width={28} height={18} viewBox="0 0 28 18">
          <Defs>
            <Marker id="ch_a1" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto">
              <Path d="M0,0 L0,5 L5,2.5 Z" fill="#4CAF50" />
            </Marker>
          </Defs>
          <Line x1="2" y1="9" x2="22" y2="9" stroke="#4CAF50" strokeWidth="2" markerEnd="url(#ch_a1)" />
        </Svg>
      </Animated.View>

      {/* Tas de bûches */}
      <Animated.View style={{ transform: [{ scale: tasScale }] }}>
        <View style={[styles.token, { backgroundColor: def2.color + '20', borderColor: def2.color + '60' }]}>
          <Image source={def2.icon} style={styles.image} resizeMode="contain" />
        </View>
        <Animated.View style={[styles.glowRing, { borderColor: '#4CAF50', opacity: tasGlowOp }]} />
      </Animated.View>

      {/* Flèche 2 conditionnelle */}
      <Animated.View style={{ opacity: arrow2Op }}>
        <Svg width={28} height={18} viewBox="0 0 28 18">
          <Defs>
            <Marker id="ch_a2" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto">
              <Path d="M0,0 L0,5 L5,2.5 Z" fill="#8BC34A" />
            </Marker>
          </Defs>
          <Line x1="2" y1="9" x2="22" y2="9" stroke="#8BC34A" strokeWidth="2" strokeDasharray="3,2" markerEnd="url(#ch_a2)" />
        </Svg>
      </Animated.View>

      {/* Chalet conditionnel */}
      {defChal && (
        <Animated.View style={{ opacity: chalOp }}>
          <View style={[styles.token, { backgroundColor: defChal.color + '20', borderColor: defChal.color + '40' }]}>
            <Image source={defChal.icon} style={styles.image} resizeMode="contain" />
          </View>
          <Animated.View style={[styles.glowRing, { borderColor: '#8BC34A', opacity: chalGlowOp }]} />
        </Animated.View>
      )}
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
