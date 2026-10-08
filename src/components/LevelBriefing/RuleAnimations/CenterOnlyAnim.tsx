// ============================================================
// CenterOnlyAnim — grille 4×4 schématique
//   12 cases de bord = rouge + croix (interdit)
//    4 cases centrales = dorées, champignon pulse (autorisé)
//
// Centrales (indices dans grille 4×4, ligne par ligne) :
//   [5, 6, 9, 10]
//
// API Animated (legacy) — compatible web + native
// Cycle : 1800ms
// ============================================================

import React, { useEffect, useRef } from 'react';
import { View, Image, StyleSheet, Text, Animated, Platform } from 'react-native';
import { ElementRegistry } from '../../../elements/ElementRegistry';
import { getSpriteOrIcon } from './sprites';
import { RuleCard } from '../../../data/levelMeta';

interface Props {
  rule: RuleCard;
  accessibilityLabel?: string;
}

const native = Platform.OS !== 'web';
const CELL = 40;
const GAP  = 5;

// Grille 4×4 — indices 0..15
// Cases centrales (champignon autorisé) : 5, 6, 9, 10
const CENTER_CELLS = new Set([5, 6, 9, 10]);

export const CenterOnlyAnim: React.FC<Props> = ({ rule, accessibilityLabel }) => {
  const [elementId] = rule.elements;
  const def = ElementRegistry[elementId];

  // Pulse du champignon sur les cases centrales
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 600, useNativeDriver: native }),
        Animated.timing(pulse, { toValue: 0, duration: 600, useNativeDriver: native }),
        Animated.delay(600),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  if (!def) return null;

  const tokenScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1.08] });
  const tokenOp    = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1.0]  });

  return (
    <View style={styles.container} accessibilityLabel={accessibilityLabel} accessible>
      <View style={styles.grid}>
        {Array.from({ length: 16 }, (_, i) => {
          const isCenter = CENTER_CELLS.has(i);
          return (
            <View
              key={i}
              style={[styles.cell, isCenter ? styles.cellCenter : styles.cellEdge]}
            >
              {isCenter ? (
                <Animated.View style={{ transform: [{ scale: tokenScale }], opacity: tokenOp }}>
                  <Image source={getSpriteOrIcon(elementId, def.icon as any)} style={styles.tokenImg} resizeMode="contain" />
                </Animated.View>
              ) : (
                <Text style={styles.cross}>{'\u2715'}</Text>
              )}
            </View>
          );
        })}
      </View>

      {/* Légende */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, styles.legendDotCenter]} />
          <Text style={styles.legendText}>Centre</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, styles.legendDotEdge]} />
          <Text style={styles.legendText}>Bord</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: CELL * 4 + GAP * 3,
    gap: GAP,
  },
  cell: {
    width: CELL,
    height: CELL,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellCenter: {
    backgroundColor: 'rgba(212,160,23,0.20)',
    borderColor: '#D4A017',
  },
  cellEdge: {
    backgroundColor: 'rgba(244,67,54,0.13)',
    borderColor: '#F44336',
  },
  tokenImg: {
    width: CELL * 0.68,
    height: CELL * 0.68,
  },
  cross: {
    fontSize: 15,
    fontWeight: '900',
    color: '#F44336',
  },
  legend: {
    flexDirection: 'row',
    gap: 20,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendDotCenter: {
    backgroundColor: '#D4A017',
  },
  legendDotEdge: {
    backgroundColor: '#F44336',
  },
  legendText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
  },
});
