// ============================================================
// ForbidNeighborAnim — e1 approche, e2 tremble, croix → écartement
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

export const ForbidNeighborAnim: React.FC<Props> = ({ rule, accessibilityLabel }) => {
  const [e1Id, e2Id] = rule.elements;
  const def1 = ElementRegistry[e1Id];
  const def2 = ElementRegistry[e2Id];

  const e1X          = useRef(new Animated.Value(0)).current;
  const e2X          = useRef(new Animated.Value(0)).current;
  const crossOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        // Phase 1 (0→500ms) : e1 approche
        Animated.parallel([
          Animated.timing(e1X,          { toValue: 36, duration: 500, useNativeDriver: native }),
          Animated.timing(crossOpacity, { toValue: 0,  duration: 500, useNativeDriver: native }),
        ]),
        // Phase 2 (500→700ms) : e2 tremble (shake simplifié)
        Animated.parallel([
          Animated.timing(e1X, { toValue: 36, duration: 200, useNativeDriver: native }),
          Animated.sequence([
            Animated.timing(e2X, { toValue: 5,  duration: 40, useNativeDriver: native }),
            Animated.timing(e2X, { toValue: -5, duration: 40, useNativeDriver: native }),
            Animated.timing(e2X, { toValue: 5,  duration: 40, useNativeDriver: native }),
            Animated.timing(e2X, { toValue: -5, duration: 40, useNativeDriver: native }),
            Animated.timing(e2X, { toValue: 0,  duration: 40, useNativeDriver: native }),
          ]),
        ]),
        // Phase 3 (700→900ms) : croix apparaît
        Animated.timing(crossOpacity, { toValue: 1, duration: 200, useNativeDriver: native }),
        // Phase 4 (900→1300ms) : écartement
        Animated.parallel([
          Animated.timing(e1X,          { toValue: 0, duration: 400, useNativeDriver: native }),
          Animated.timing(crossOpacity, { toValue: 0, duration: 200, useNativeDriver: native }),
        ]),
        // Phase 5 (1300→1800ms) : pause
        Animated.delay(500),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  if (!def1 || !def2) return null;

  return (
    <View style={styles.container} accessibilityLabel={accessibilityLabel} accessible>
      <Animated.View style={{ transform: [{ translateX: e1X }] }}>
        <View style={[styles.token, { backgroundColor: def1.color + '20', borderColor: def1.color + '60' }]}>
          <Image source={def1.icon} style={styles.image} resizeMode="contain" />
        </View>
      </Animated.View>

      <Animated.View style={[styles.crossContainer, { opacity: crossOpacity }]}>
        <Text style={styles.cross}>✕</Text>
      </Animated.View>

      <Animated.View style={{ transform: [{ translateX: e2X }] }}>
        <View style={[styles.token, { backgroundColor: def2.color + '20', borderColor: def2.color + '60' }]}>
          <Image source={def2.icon} style={styles.image} resizeMode="contain" />
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
