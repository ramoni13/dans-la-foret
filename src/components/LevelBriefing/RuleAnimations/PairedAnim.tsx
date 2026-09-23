// ============================================================
// PairedAnim — cerf et biche avec compteurs "×1", flèche ↔
// API Animated (legacy) — compatible web + native
// Cycle : 1800ms
// ============================================================

import React, { useEffect, useRef } from 'react';
import { View, Image, StyleSheet, Text, Animated, Platform } from 'react-native';
import Svg, { Path, Defs, Marker } from 'react-native-svg';
import { ElementRegistry } from '../../../elements/ElementRegistry';
import { RuleCard } from '../../../data/levelMeta';

interface Props {
  rule: RuleCard;
  accessibilityLabel?: string;
}

const native = Platform.OS !== 'web';
const TOKEN_SIZE = 48;

export const PairedAnim: React.FC<Props> = ({ rule, accessibilityLabel }) => {
  const [e1Id, e2Id] = rule.elements;
  const def1 = ElementRegistry[e1Id];
  const def2 = ElementRegistry[e2Id];

  const op1         = useRef(new Animated.Value(0)).current;
  const op2         = useRef(new Animated.Value(0)).current;
  const arrowOp     = useRef(new Animated.Value(0)).current;
  const counterScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        // Phase 1 (0→400) : e1 apparaît
        Animated.timing(op1, { toValue: 1, duration: 400, useNativeDriver: native }),
        // Phase 2 (400→800) : e2 apparaît
        Animated.timing(op2, { toValue: 1, duration: 400, useNativeDriver: native }),
        // Phase 3 (800→1200) : flèche ↔
        Animated.timing(arrowOp, { toValue: 1, duration: 400, useNativeDriver: native }),
        // Phase 4 (1200→1600) : compteurs pulsent
        Animated.sequence([
          Animated.timing(counterScale, { toValue: 1.3, duration: 200, useNativeDriver: native }),
          Animated.timing(counterScale, { toValue: 1,   duration: 200, useNativeDriver: native }),
        ]),
        // Phase 5 (1600→1800) : reset
        Animated.parallel([
          Animated.timing(op1,      { toValue: 0, duration: 100, useNativeDriver: native }),
          Animated.timing(op2,      { toValue: 0, duration: 100, useNativeDriver: native }),
          Animated.timing(arrowOp,  { toValue: 0, duration: 100, useNativeDriver: native }),
          Animated.timing(counterScale, { toValue: 1, duration: 100, useNativeDriver: native }),
        ]),
        Animated.delay(100),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  if (!def1 || !def2) return null;

  return (
    <View style={styles.container} accessibilityLabel={accessibilityLabel} accessible>
      {/* e1 (cerf) */}
      <Animated.View style={[styles.tokenWrapper, { opacity: op1 }]}>
        <View style={[styles.token, { backgroundColor: def1.color + '20', borderColor: def1.color + '60' }]}>
          <Image source={def1.icon} style={styles.image} resizeMode="contain" />
        </View>
        <Animated.View style={{ transform: [{ scale: counterScale }] }}>
          <Text style={styles.counter}>×1</Text>
        </Animated.View>
      </Animated.View>

      {/* Flèche ↔ */}
      <Animated.View style={{ opacity: arrowOp }}>
        <Svg width={40} height={24} viewBox="0 0 40 24">
          <Defs>
            <Marker id="pa_ar1" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto">
              <Path d="M0,0 L0,5 L5,2.5 Z" fill="#4CAF50" />
            </Marker>
            <Marker id="pa_ar2" markerWidth="5" markerHeight="5" refX="1" refY="2.5" orient="auto-start-reverse">
              <Path d="M0,0 L0,5 L5,2.5 Z" fill="#4CAF50" />
            </Marker>
          </Defs>
          <Path
            d="M5,12 L35,12"
            stroke="#4CAF50"
            strokeWidth="2"
            markerEnd="url(#pa_ar1)"
            markerStart="url(#pa_ar2)"
          />
        </Svg>
      </Animated.View>

      {/* e2 (biche) */}
      <Animated.View style={[styles.tokenWrapper, { opacity: op2 }]}>
        <View style={[styles.token, { backgroundColor: def2.color + '20', borderColor: def2.color + '60' }]}>
          <Image source={def2.icon} style={styles.image} resizeMode="contain" />
        </View>
        <Animated.View style={{ transform: [{ scale: counterScale }] }}>
          <Text style={styles.counter}>×1</Text>
        </Animated.View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 90,
    gap: 8,
  },
  tokenWrapper: {
    alignItems: 'center',
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
  counter: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4CAF50',
  },
});
