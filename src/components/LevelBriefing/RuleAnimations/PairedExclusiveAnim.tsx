// ============================================================
// PairedExclusiveAnim — Montre qu'un élément ne peut être couplé
// qu'à UN SEUL partenaire, pas deux.
// Layout : [e1] → [e2] ✓   puis   [e1] → [e2] [e2] ✕
// elements: ['cerf', 'biche', 'biche'] — e1 = source, e2+e3 = 2 cibles
// API Animated (legacy) — compatible web + native
// Cycle : 3600ms
// ============================================================

import React, { useEffect, useRef } from 'react';
import { View, Image, Text, StyleSheet, Animated, Platform } from 'react-native';
import { ElementRegistry } from '../../../elements/ElementRegistry';
import { getSpriteOrIcon } from './sprites';
import { RuleCard } from '../../../data/levelMeta';

interface Props {
  rule: RuleCard;
  accessibilityLabel?: string;
}

const native = Platform.OS !== 'web';
const TOKEN_SIZE = 40;

export const PairedExclusiveAnim: React.FC<Props> = ({ rule, accessibilityLabel }) => {
  // elements: ['cerf', 'biche', 'biche']
  const sourceId = rule.elements[0];
  const targetId = rule.elements[1];
  const sourceDef = ElementRegistry[sourceId];
  const targetDef = ElementRegistry[targetId];

  // Phase 1 : OK (1→1)
  const phase1Op = useRef(new Animated.Value(0)).current;
  const checkOp = useRef(new Animated.Value(0)).current;

  // Phase 2 : interdit (1→2)
  const phase2Op = useRef(new Animated.Value(0)).current;
  const crossOp = useRef(new Animated.Value(0)).current;
  const shakeX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        // ── Phase 1 : 1 cerf → 1 biche = OK ──
        Animated.timing(phase1Op, { toValue: 1, duration: 300, useNativeDriver: native }),
        Animated.timing(checkOp, { toValue: 1, duration: 300, useNativeDriver: native }),
        Animated.delay(600),
        // Masquer phase 1
        Animated.parallel([
          Animated.timing(phase1Op, { toValue: 0, duration: 200, useNativeDriver: native }),
          Animated.timing(checkOp, { toValue: 0, duration: 200, useNativeDriver: native }),
        ]),

        // ── Phase 2 : 1 cerf → 2 biches = INTERDIT ──
        Animated.timing(phase2Op, { toValue: 1, duration: 300, useNativeDriver: native }),
        // Tremblement
        Animated.sequence([
          Animated.timing(shakeX, { toValue: 4, duration: 40, useNativeDriver: native }),
          Animated.timing(shakeX, { toValue: -4, duration: 40, useNativeDriver: native }),
          Animated.timing(shakeX, { toValue: 4, duration: 40, useNativeDriver: native }),
          Animated.timing(shakeX, { toValue: -4, duration: 40, useNativeDriver: native }),
          Animated.timing(shakeX, { toValue: 0, duration: 40, useNativeDriver: native }),
        ]),
        // Croix rouge
        Animated.timing(crossOp, { toValue: 1, duration: 200, useNativeDriver: native }),
        Animated.delay(800),
        // Reset
        Animated.parallel([
          Animated.timing(phase2Op, { toValue: 0, duration: 200, useNativeDriver: native }),
          Animated.timing(crossOp, { toValue: 0, duration: 200, useNativeDriver: native }),
        ]),
        Animated.delay(300),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  if (!sourceDef || !targetDef) return null;

  return (
    <View style={styles.container} accessibilityLabel={accessibilityLabel} accessible>

      {/* ── Phase 1 : 1→1 OK ── */}
      <Animated.View style={[styles.phaseRow, { opacity: phase1Op }]}>
        <View style={[styles.token, { backgroundColor: sourceDef.color + '20', borderColor: sourceDef.color + '60' }]}>
          <Image source={getSpriteOrIcon(sourceId, sourceDef.icon)} style={styles.image} resizeMode="contain" />
        </View>
        <Text style={styles.arrow}>{'\u2194'}</Text>
        <View style={[styles.token, { backgroundColor: targetDef.color + '20', borderColor: targetDef.color + '60' }]}>
          <Image source={getSpriteOrIcon(targetId, targetDef.icon)} style={styles.image} resizeMode="contain" />
        </View>
        <Animated.View style={{ opacity: checkOp }}>
          <Text style={styles.check}>{'\u2713'}</Text>
        </Animated.View>
      </Animated.View>

      {/* ── Phase 2 : 1→2 INTERDIT ── */}
      <Animated.View style={[styles.phaseRow, { opacity: phase2Op, transform: [{ translateX: shakeX }] }]}>
        <View style={[styles.token, { backgroundColor: sourceDef.color + '20', borderColor: sourceDef.color + '60' }]}>
          <Image source={getSpriteOrIcon(sourceId, sourceDef.icon)} style={styles.image} resizeMode="contain" />
        </View>
        <Text style={styles.arrow}>{'\u2194'}</Text>
        <View style={[styles.token, { backgroundColor: targetDef.color + '20', borderColor: targetDef.color + '60' }]}>
          <Image source={getSpriteOrIcon(targetId, targetDef.icon)} style={styles.image} resizeMode="contain" />
        </View>
        <View style={[styles.token, { backgroundColor: targetDef.color + '20', borderColor: targetDef.color + '60' }]}>
          <Image source={getSpriteOrIcon(targetId, targetDef.icon)} style={styles.image} resizeMode="contain" />
        </View>
        <Animated.View style={[styles.crossWrap, { opacity: crossOp }]}>
          <Text style={styles.cross}>{'\u2715'}</Text>
        </Animated.View>
      </Animated.View>

    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 100,
  },
  phaseRow: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
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
    width: TOKEN_SIZE * 0.65,
    height: TOKEN_SIZE * 0.65,
  },
  arrow: {
    fontSize: 22,
    color: '#4CAF50',
    fontWeight: '700',
  },
  check: {
    fontSize: 26,
    color: '#4CAF50',
    fontWeight: '900',
    marginLeft: 4,
  },
  crossWrap: {
    marginLeft: 4,
  },
  cross: {
    fontSize: 26,
    color: '#F44336',
    fontWeight: '900',
  },
});
