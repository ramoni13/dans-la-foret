// ============================================================
// NoSameNeighborAnim — deux tokens identiques s'approchent → ❌ → reculent
// API Animated (legacy) — compatible web + native
// Cycle : 1500ms
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
const TOKEN_SIZE = 52;

export const NoSameNeighborAnim: React.FC<Props> = ({ rule, accessibilityLabel }) => {
  const [elementId] = rule.elements;
  const def = ElementRegistry[elementId];

  const rightX      = useRef(new Animated.Value(0)).current;
  const crossOpacity = useRef(new Animated.Value(0)).current;
  const flashScale   = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        // Phase 1 (0→400ms) : approche
        Animated.parallel([
          Animated.timing(rightX,      { toValue: -38, duration: 400, useNativeDriver: native }),
          Animated.timing(flashScale,  { toValue: 1,   duration: 400, useNativeDriver: native }),
          Animated.timing(crossOpacity,{ toValue: 0,   duration: 400, useNativeDriver: native }),
        ]),
        // Phase 2 (400→600ms) : flash rouge
        Animated.parallel([
          Animated.timing(crossOpacity,{ toValue: 1,   duration: 100, useNativeDriver: native }),
          Animated.timing(flashScale,  { toValue: 1.2, duration: 100, useNativeDriver: native }),
          Animated.timing(rightX,      { toValue: -38, duration: 200, useNativeDriver: native }),
        ]),
        // Phase 3 (600→900ms) : recul
        Animated.parallel([
          Animated.timing(rightX,      { toValue: 0, duration: 300, useNativeDriver: native }),
          Animated.timing(crossOpacity,{ toValue: 0, duration: 200, useNativeDriver: native }),
          Animated.timing(flashScale,  { toValue: 1, duration: 300, useNativeDriver: native }),
        ]),
        // Phase 4 (900→1500ms) : pause
        Animated.delay(600),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  if (!def) return null;

  return (
    <View style={styles.container} accessibilityLabel={accessibilityLabel} accessible>
      {/* Token gauche (fixe) */}
      <View style={[styles.token, { backgroundColor: def.color + '20', borderColor: def.color + '60' }]}>
        <Image source={def.icon} style={styles.image} resizeMode="contain" />
      </View>

      {/* Croix centrale */}
      <Animated.View style={[styles.crossContainer, { opacity: crossOpacity }]}>
        <Text style={styles.cross}>✕</Text>
      </Animated.View>

      {/* Token droit (se déplace) */}
      <Animated.View style={{ transform: [{ translateX: rightX }, { scale: flashScale }] }}>
        <View style={[styles.token, { backgroundColor: def.color + '20', borderColor: def.color + '60' }]}>
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
    height: 80,
    gap: 20,
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
  crossContainer: {
    position: 'absolute',
    alignSelf: 'center',
    zIndex: 10,
  },
  cross: {
    fontSize: 28,
    color: '#F44336',
    fontWeight: '900',
  },
});
