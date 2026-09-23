// ============================================================
// SingletonAnim — deuxième ruche apparaît → flash rouge → disparaît, badge "×1"
// API Animated (legacy) — compatible web + native
// Cycle : 1800ms
// ============================================================

import React, { useEffect, useRef } from 'react';
import { View, Image, StyleSheet, Text, Animated, Platform } from 'react-native';
import { ElementRegistry } from '../../../elements/ElementRegistry';
import { RuleCard } from '../../../data/levelMeta';

interface Props {
  rule: RuleCard;
  accessibilityLabel?: string;
}

const native = Platform.OS !== 'web';
const TOKEN_SIZE = 48;

export const SingletonAnim: React.FC<Props> = ({ rule, accessibilityLabel }) => {
  const [elementId] = rule.elements;
  const def = ElementRegistry[elementId];

  const op2        = useRef(new Animated.Value(0)).current;
  const scale2     = useRef(new Animated.Value(1)).current;
  const badgeOp    = useRef(new Animated.Value(0)).current;
  const badgeScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        // Phase 1 (0→500) : ruche 2 apparaît
        Animated.timing(op2, { toValue: 1, duration: 500, useNativeDriver: native }),
        // Phase 2 (500→700) : ruche 2 scale + rouge (via scale)
        Animated.timing(scale2, { toValue: 1.2, duration: 200, useNativeDriver: native }),
        // Phase 3 (700→900) : ruche 2 disparaît
        Animated.parallel([
          Animated.timing(op2,    { toValue: 0,   duration: 200, useNativeDriver: native }),
          Animated.timing(scale2, { toValue: 0.5, duration: 200, useNativeDriver: native }),
        ]),
        // Phase 4 (900→1200) : badge ×1 pulse vert
        Animated.parallel([
          Animated.timing(badgeOp,    { toValue: 1,   duration: 150, useNativeDriver: native }),
          Animated.timing(badgeScale, { toValue: 1.4, duration: 150, useNativeDriver: native }),
        ]),
        Animated.parallel([
          Animated.timing(badgeOp,    { toValue: 0.6, duration: 150, useNativeDriver: native }),
          Animated.timing(badgeScale, { toValue: 1,   duration: 150, useNativeDriver: native }),
        ]),
        // Phase 5 (1200→1800) : pause + reset
        Animated.parallel([
          Animated.timing(badgeOp,    { toValue: 0, duration: 100, useNativeDriver: native }),
          Animated.timing(scale2,     { toValue: 1, duration: 100, useNativeDriver: native }),
        ]),
        Animated.delay(500),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  if (!def) return null;

  return (
    <View style={styles.container} accessibilityLabel={accessibilityLabel} accessible>
      {/* Ruche 1 (stable) + badge ×1 */}
      <View style={styles.tokenWrapper}>
        <View style={[styles.token, { backgroundColor: def.color + '20', borderColor: def.color + '60' }]}>
          <Image source={def.icon} style={styles.image} resizeMode="contain" />
        </View>
        <Animated.View style={[styles.badge, { opacity: badgeOp, transform: [{ scale: badgeScale }] }]}>
          <Text style={styles.badgeText}>×1</Text>
        </Animated.View>
      </View>

      {/* Séparateur */}
      <Text style={styles.plus}>+</Text>

      {/* Ruche 2 (flash rouge, apparaît puis disparaît) */}
      <Animated.View style={{ opacity: op2, transform: [{ scale: scale2 }] }}>
        <View style={[styles.token, { backgroundColor: '#F4433620', borderColor: '#F44336' }]}>
          <Image source={def.icon} style={styles.image} resizeMode="contain" />
        </View>
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
    gap: 12,
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
  badge: {
    backgroundColor: '#4CAF5020',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4CAF50',
  },
  plus: {
    fontSize: 20,
    color: '#F44336',
    fontWeight: '700',
  },
});
