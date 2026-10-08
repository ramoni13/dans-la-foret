// ============================================================
// ChainAnim — element1 → fleche → element2 (→ element3 optionnel)
// Supporte 2 ou 3 elements dans rule.elements :
//   2 elements : bucheron → bûches (niveau 11)
//   3 elements : bûches → chalet (niveau 12+)
// API Animated (legacy) — compatible web + native
// ============================================================

import React, { useEffect, useRef } from 'react';
import { View, Image, Text, StyleSheet, Animated, Platform } from 'react-native';
import { ElementRegistry } from '../../../elements/ElementRegistry';
import { RuleCard } from '../../../data/levelMeta';
import { getSpriteOrIcon } from './sprites';

interface Props {
  rule: RuleCard;
  accessibilityLabel?: string;
}

const native = Platform.OS !== 'web';
const TOKEN_SIZE = 42;

export const ChainAnim: React.FC<Props> = ({ rule, accessibilityLabel }) => {
  const [e1Id, e2Id, e3Id] = rule.elements;
  const def1    = ElementRegistry[e1Id];   // bucheron (or tas_buches)
  const def2    = ElementRegistry[e2Id];   // tas_buches (or chalet)
  // 3e element optionnel : si present dans la regle, on l'affiche
  const defChal = e3Id ? ElementRegistry[e3Id] : null;

  const arrow1Op  = useRef(new Animated.Value(0)).current;
  const tasGlowOp = useRef(new Animated.Value(0)).current;
  const tasScale  = useRef(new Animated.Value(1)).current;
  const arrow2Op  = useRef(new Animated.Value(0)).current;
  const chalOp    = useRef(new Animated.Value(0)).current;
  const chalGlowOp = useRef(new Animated.Value(0)).current;

  const hasThird = !!defChal;

  useEffect(() => {
    const steps: Animated.CompositeAnimation[] = [
      // Phase 1 : fleche 1
      Animated.timing(arrow1Op, { toValue: 1, duration: 400, useNativeDriver: native }),
      // Phase 2 : element 2 glow
      Animated.parallel([
        Animated.timing(tasGlowOp, { toValue: 1,   duration: 200, useNativeDriver: native }),
        Animated.timing(tasScale,  { toValue: 1.1, duration: 200, useNativeDriver: native }),
      ]),
      Animated.parallel([
        Animated.timing(tasGlowOp, { toValue: 0, duration: 100, useNativeDriver: native }),
        Animated.timing(tasScale,  { toValue: 1, duration: 100, useNativeDriver: native }),
      ]),
    ];

    if (hasThird) {
      // Phase 3 : fleche 2 + 3e element apparaissent
      steps.push(
        Animated.parallel([
          Animated.timing(arrow2Op, { toValue: 0.6, duration: 400, useNativeDriver: native }),
          Animated.timing(chalOp,   { toValue: 0.6, duration: 400, useNativeDriver: native }),
        ]),
        // Phase 4 : 3e element glow
        Animated.timing(chalGlowOp, { toValue: 0.7, duration: 300, useNativeDriver: native }),
        Animated.timing(chalGlowOp, { toValue: 0, duration: 200, useNativeDriver: native }),
      );
    }

    // Phase finale : reset + pause
    const resets = [
      Animated.timing(arrow1Op, { toValue: 0, duration: 100, useNativeDriver: native }),
    ];
    if (hasThird) {
      resets.push(
        Animated.timing(arrow2Op, { toValue: 0, duration: 100, useNativeDriver: native }),
        Animated.timing(chalOp,   { toValue: 0, duration: 100, useNativeDriver: native }),
      );
    }
    steps.push(Animated.parallel(resets), Animated.delay(300));

    const loop = Animated.loop(Animated.sequence(steps));
    loop.start();
    return () => loop.stop();
  }, [hasThird]);

  if (!def1 || !def2) return null;

  return (
    <View style={styles.container} accessibilityLabel={accessibilityLabel} accessible>
      {/* Bucheron */}
      <View style={[styles.token, { backgroundColor: def1.color + '20', borderColor: def1.color + '60' }]}>
          <Image source={getSpriteOrIcon(e1Id, def1.icon)} style={styles.image} resizeMode="contain" />
      </View>

                        {/* Flèche 1 — Unicode pour éviter les IDs SVG globaux dupliqués sur le web */}
      <Animated.View style={[styles.arrowWrapper, { opacity: arrow1Op }]}>
        <Text style={styles.arrow}>→</Text>
      </Animated.View>

      {/* Bûches */}
      <Animated.View style={{ transform: [{ scale: tasScale }] }}>
        <View style={[styles.token, { backgroundColor: def2.color + '20', borderColor: def2.color + '60' }]}>
          <Image source={getSpriteOrIcon(e2Id, def2.icon)} style={styles.image} resizeMode="contain" />
        </View>
        <Animated.View style={[styles.glowRing, { borderColor: '#4CAF50', opacity: tasGlowOp }]} />
      </Animated.View>

                        {/* Flèche 2 conditionnelle — Unicode */}
      <Animated.View style={[styles.arrowWrapper, { opacity: arrow2Op }]}>
        <Text style={[styles.arrow, styles.arrowDashed]}>→</Text>
      </Animated.View>

      {/* Chalet conditionnel */}
      {defChal && (
        <Animated.View style={{ opacity: chalOp }}>
          <View style={[styles.token, { backgroundColor: defChal.color + '20', borderColor: defChal.color + '40' }]}>
            <Image source={getSpriteOrIcon(e3Id, defChal.icon)} style={styles.image} resizeMode="contain" />
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
  arrowWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
  },
  arrow: {
    fontSize: 20,
    color: '#4CAF50',
    fontWeight: '700',
  },
  arrowDashed: {
    color: '#8BC34A',
    opacity: 0.8,
  },
});
