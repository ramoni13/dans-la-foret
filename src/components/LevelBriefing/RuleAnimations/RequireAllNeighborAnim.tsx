// ============================================================
// RequireAllNeighborAnim — Montre que TOUS les exemplaires d'un
// élément (ex: ours) doivent être voisins d'un autre (ex: ruche).
// Layout : 3 tokens à gauche avec flèches → 1 token central à droite.
// Les flèches s'allument séquentiellement puis glow vert final.
// API Animated (legacy) — compatible web + native
// Cycle : 2400ms
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
const TARGET_SIZE = 48;

export const RequireAllNeighborAnim: React.FC<Props> = ({ rule, accessibilityLabel }) => {
  // elements: ['ours', 'ours', 'ours', 'ruche']
  // Les N-1 premiers = sources, le dernier = cible
  const sourceId = rule.elements[0];
  const targetId = rule.elements[rule.elements.length - 1];
  const sourceDef = ElementRegistry[sourceId];
  const targetDef = ElementRegistry[targetId];

  const arrow1Op = useRef(new Animated.Value(0)).current;
  const arrow2Op = useRef(new Animated.Value(0)).current;
  const arrow3Op = useRef(new Animated.Value(0)).current;
  const glowScale = useRef(new Animated.Value(1)).current;
  const glowOp = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        // Phase 1 : flèche 1 s'allume
        Animated.timing(arrow1Op, { toValue: 1, duration: 300, useNativeDriver: native }),
        // Phase 2 : flèche 2 s'allume
        Animated.timing(arrow2Op, { toValue: 1, duration: 300, useNativeDriver: native }),
        // Phase 3 : flèche 3 s'allume
        Animated.timing(arrow3Op, { toValue: 1, duration: 300, useNativeDriver: native }),
        // Phase 4 : glow vert sur la cible
        Animated.parallel([
          Animated.timing(glowScale, { toValue: 1.15, duration: 400, useNativeDriver: native }),
          Animated.timing(glowOp, { toValue: 1, duration: 400, useNativeDriver: native }),
        ]),
        // Phase 5 : maintien
        Animated.delay(400),
        // Phase 6 : tout s'éteint
        Animated.parallel([
          Animated.timing(arrow1Op, { toValue: 0, duration: 300, useNativeDriver: native }),
          Animated.timing(arrow2Op, { toValue: 0, duration: 300, useNativeDriver: native }),
          Animated.timing(arrow3Op, { toValue: 0, duration: 300, useNativeDriver: native }),
          Animated.timing(glowScale, { toValue: 1, duration: 300, useNativeDriver: native }),
          Animated.timing(glowOp, { toValue: 0, duration: 300, useNativeDriver: native }),
        ]),
        // Pause
        Animated.delay(200),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  if (!sourceDef || !targetDef) return null;

  const renderSourceRow = (arrowOp: Animated.Value, key: string) => (
    <View key={key} style={styles.sourceRow}>
      <View style={[styles.sourceToken, { backgroundColor: sourceDef.color + '20', borderColor: sourceDef.color + '60' }]}>
        <Image source={getSpriteOrIcon(sourceId, sourceDef.icon)} style={styles.sourceImage} resizeMode="contain" />
      </View>
      <Animated.View style={[styles.arrow, { opacity: arrowOp }]}>
        <Text style={styles.arrowText}>{'\u2192'}</Text>
      </Animated.View>
    </View>
  );

  return (
    <View style={styles.container} accessibilityLabel={accessibilityLabel} accessible>
      {/* 3 sources avec flèches */}
      <View style={styles.sourcesColumn}>
        {renderSourceRow(arrow1Op, 'src1')}
        {renderSourceRow(arrow2Op, 'src2')}
        {renderSourceRow(arrow3Op, 'src3')}
      </View>

      {/* Cible centrale (ruche) */}
      <Animated.View style={{ transform: [{ scale: glowScale }] }}>
        <View style={[styles.targetToken, { backgroundColor: targetDef.color + '20', borderColor: targetDef.color + '60' }]}>
          <Image source={getSpriteOrIcon(targetId, targetDef.icon)} style={styles.targetImage} resizeMode="contain" />
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
    height: 110,
    gap: 2,
  },
  sourcesColumn: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 2,
  },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sourceToken: {
    width: TOKEN_SIZE,
    height: TOKEN_SIZE,
    borderRadius: TOKEN_SIZE / 2,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sourceImage: {
    width: TOKEN_SIZE * 0.65,
    height: TOKEN_SIZE * 0.65,
  },
  arrow: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowText: {
    fontSize: 20,
    color: '#4CAF50',
    fontWeight: '700',
  },
  targetToken: {
    width: TARGET_SIZE,
    height: TARGET_SIZE,
    borderRadius: TARGET_SIZE / 2,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  targetImage: {
    width: TARGET_SIZE * 0.7,
    height: TARGET_SIZE * 0.7,
  },
  glowRing: {
    position: 'absolute',
    top: -5,
    left: -5,
    width: TARGET_SIZE + 10,
    height: TARGET_SIZE + 10,
    borderRadius: (TARGET_SIZE + 10) / 2,
    borderWidth: 2.5,
    borderColor: '#4CAF50',
  },
});
