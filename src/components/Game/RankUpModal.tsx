// ============================================================
// RANKUPMODAL — Modal célébrant un changement de rang forestier
// Confetti + feux d'artifice + aspiration de graines
// ============================================================

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
  Platform,
  LayoutChangeEvent,
} from 'react-native';

import { Colors } from '../../constants/colors';
import { RankDefinition } from '../../constants/badges';
import { Confetti, useConfetti } from './Confetti';
import { SeedFlyAnimation, useCounterPulse } from './SeedFlyAnimation';
import { notificationSuccess } from '../../utils/haptics';
import { usePlayerStore } from '../../store/playerStore';
import { useT } from '../../i18n';

const native = Platform.OS !== 'web';

// ── Graines récompenses par rang ──────────────────────────────────────────────
export const RANK_SEED_REWARDS: Record<string, number> = {
  promeneur:        0,
  bucheron:         5,
  sylviculteur:     15,
  garde_forestier:  30,
  technicien_onf:   60,
  ingenieur_forets: 100,
  esprit_foret:     200,
};

// ── Feux d'artifice ───────────────────────────────────────────────────────────

const FIREWORK_COLORS = [
  '#FFD700', '#FF6B35', '#4CAF50', '#2196F3',
  '#E91E63', '#9C27B0', '#FF9800', '#00BCD4',
  '#FFEB3B', '#F44336',
];
const PARTICLE_COUNT = 24;

interface Particle {
  x: Animated.Value;
  y: Animated.Value;
  opacity: Animated.Value;
  scale: Animated.Value;
  color: string;
}

function createParticles(): Particle[] {
  return Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
    x: new Animated.Value(0),
    y: new Animated.Value(0),
    opacity: new Animated.Value(0),
    scale: new Animated.Value(0),
    color: FIREWORK_COLORS[i % FIREWORK_COLORS.length],
  }));
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface RankUpModalProps {
  visible: boolean;
  newRank: RankDefinition;
  previousRankLabel: string;
  seedsAwarded: number;
  seedsBeforeGain?: number;
  onClose: () => void;
}

// ── Composant principal ───────────────────────────────────────────────────────

export const RankUpModal: React.FC<RankUpModalProps> = ({
  visible,
  newRank,
  previousRankLabel,
  seedsAwarded,
  seedsBeforeGain,
  onClose,
}) => {
  const language = usePlayerStore(s => s.language);
  const totalSeeds = usePlayerStore(s => s.seeds);

  // Compteur animé de graines
  // Si seedsBeforeGain est fourni, on l'utilise comme point de départ de l'animation.
  // Sinon, fallback sur totalSeeds - seedsAwarded.
  const startSeeds = seedsBeforeGain ?? (totalSeeds - seedsAwarded);
  const [displayedSeeds, setDisplayedSeeds] = useState(startSeeds);
  const [displayedGain, setDisplayedGain]   = useState(seedsAwarded);
  const [animDone, setAnimDone]             = useState(false);
  const arrivedCount = useRef(0);

  const { scale: counterScale, haloOpacity, haloScale, pulse } = useCounterPulse();
  const confettiPieces = useConfetti(visible);

  // Positions mesurées pour la SeedFlyAnimation
  const [fromX, setFromX] = useState(150);
  const [fromY, setFromY] = useState<number | null>(null);
  const [toX, setToX]     = useState(150);
  const [toY, setToY]     = useState<number | null>(null);

  // Déclencher l'animation de graines
  const [flyKey, setFlyKey]     = useState(0);
  const [flyActive, setFlyActive] = useState(false);

  // Feux d'artifice
  const particlesRef = useRef<Particle[]>(createParticles());
  const particles = particlesRef.current;

  // Animation d'entrée
  const cardScale   = useRef(new Animated.Value(0)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;

  const launchFireworks = useCallback(() => {
    particles.forEach(p => {
      p.x.setValue(0); p.y.setValue(0);
      p.opacity.setValue(0); p.scale.setValue(0);
    });
    const animations = particles.map((p, i) => {
      const angle    = (i / PARTICLE_COUNT) * Math.PI * 2;
      const distance = 70 + Math.random() * 80;
      const targetX  = Math.cos(angle) * distance;
      const targetY  = Math.sin(angle) * distance - 30;
      const duration = 500 + Math.random() * 400;
      const delay    = Math.random() * 120;
      return Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(p.opacity, { toValue: 1, duration: 80, useNativeDriver: native }),
          Animated.spring(p.scale,   { toValue: 1, damping: 8, stiffness: 300, useNativeDriver: native }),
          Animated.timing(p.x,       { toValue: targetX, duration, useNativeDriver: native }),
          Animated.timing(p.y,       { toValue: targetY, duration, useNativeDriver: native }),
          Animated.sequence([
            Animated.delay(duration * 0.6),
            Animated.timing(p.opacity, { toValue: 0, duration: duration * 0.4, useNativeDriver: native }),
          ]),
        ]),
      ]);
    });
    Animated.parallel(animations).start();
  }, []);

  useEffect(() => {
    if (visible) {
      arrivedCount.current = 0;
      setDisplayedSeeds(seedsBeforeGain ?? (totalSeeds - seedsAwarded));
      setDisplayedGain(seedsAwarded);
      setAnimDone(false);
      setFlyActive(false);
      cardScale.setValue(0);
      cardOpacity.setValue(0);

      Animated.parallel([
        Animated.spring(cardScale,   { toValue: 1, damping: 12, stiffness: 150, useNativeDriver: native }),
        Animated.timing(cardOpacity, { toValue: 1, duration: 200, useNativeDriver: native }),
      ]).start(() => {
        notificationSuccess();
        launchFireworks();
        if (seedsAwarded > 0) {
          const timer = setTimeout(() => {
            setFlyKey(k => k + 1);
            setFlyActive(true);
          }, 600);
          return () => clearTimeout(timer);
        }
      });
    }
  }, [visible]);

  const onSeedArrived = useCallback(() => {
    arrivedCount.current += 1;
    setDisplayedSeeds(prev => prev + 1);
    setDisplayedGain(prev => Math.max(0, prev - 1));
    pulse();
    if (arrivedCount.current >= Math.max(1, seedsAwarded)) {
      setAnimDone(true);
    }
  }, [seedsAwarded, pulse]);

  const onCounterLayout = useCallback((e: LayoutChangeEvent) => {
    const { x, y, height, width } = e.nativeEvent.layout;
    setToY(y + height / 2);
    setToX(x + width / 2);
  }, []);

  const onRewardLayout = useCallback((e: LayoutChangeEvent) => {
    const { x, y, height, width } = e.nativeEvent.layout;
    setFromY(y + height / 2);
    setFromX(x + width * 0.75);
  }, []);

  const rankLabel = language === 'en' ? newRank.labelEn : newRank.label;
  const particleCount = Math.max(1, Math.min(seedsAwarded, 12));

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        {/* Confetti plein écran */}
        <Confetti pieces={confettiPieces} />

        <Animated.View style={[styles.card, { transform: [{ scale: cardScale }], opacity: cardOpacity }]}>

          {/* Compteur graines — CIBLE */}
          <View style={styles.counterWrapper} onLayout={onCounterLayout}>
            <Animated.View
              style={[styles.halo, { opacity: haloOpacity, transform: [{ scale: haloScale }] }]}
              pointerEvents="none"
            />
            <Animated.View style={[styles.seedCounterBadge, { transform: [{ scale: counterScale }] }]}>
              <Text style={styles.seedCounterValue}>{displayedSeeds}</Text>
              <Text style={styles.seedCounterEmoji}>🌱</Text>
              {displayedGain > 0 && !animDone && (
                <View style={styles.seedGainBubble}>
                  <Text style={styles.seedGainText}>+{displayedGain}</Text>
                </View>
              )}
            </Animated.View>
          </View>

          {/* Feux d'artifice centrés sur l'emoji */}
          <View style={styles.fireworkCenter}>
            <Text style={styles.rankEmoji}>{newRank.emoji}</Text>
            {particles.map((p, i) => (
              <Animated.View
                key={i}
                style={[
                  styles.particle,
                  {
                    backgroundColor: p.color,
                    transform: [{ translateX: p.x }, { translateY: p.y }, { scale: p.scale }],
                    opacity: p.opacity,
                  },
                ]}
              />
            ))}
          </View>

          {/* Titres */}
          <Text style={styles.titleLabel}>Rang débloqué !</Text>
          <Text style={styles.rankName}>{rankLabel}</Text>
          <Text style={styles.promotion}>{previousRankLabel} → {rankLabel}</Text>

          {/* Récompense — SOURCE des graines */}
          <View style={styles.rewardRow} onLayout={onRewardLayout}>
            <Text style={styles.rewardLabel}>Récompense</Text>
            <Text style={styles.rewardValue}>+{seedsAwarded} 🌱</Text>
          </View>

          {/* Bouton */}
          <TouchableOpacity style={styles.btn} onPress={onClose} activeOpacity={0.85}>
            <Text style={styles.btnText}>Super !</Text>
          </TouchableOpacity>

          {/* Animation aspiration graines */}
          {flyActive && fromY !== null && toY !== null && seedsAwarded > 0 && (
            <SeedFlyAnimation
              key={flyKey}
              count={particleCount}
              fromX={fromX}
              fromY={fromY}
              targetX={toX}
              targetY={toY}
              onSeedArrived={onSeedArrived}
            />
          )}
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: Colors.ui.card,
    borderRadius: 24,
    padding: 24,
    width: 300,
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  counterWrapper: {
    position: 'relative',
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  halo: {
    position: 'absolute',
    width: 80,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.forest.accent,
    alignSelf: 'center',
  },
  seedCounterBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.ui.background,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignSelf: 'stretch',
    gap: 6,
  },
  seedCounterValue: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.ui.seed,
  },
  seedCounterEmoji: {
    fontSize: 18,
  },
  seedGainBubble: {
    backgroundColor: Colors.forest.accent,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  seedGainText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#fff',
  },
  fireworkCenter: {
    width: 100,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  rankEmoji: {
    fontSize: 52,
  },
  particle: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  titleLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.ui.textLight,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  rankName: {
    fontSize: 24,
    fontWeight: '900',
    color: Colors.forest.dark,
    textAlign: 'center',
  },
  promotion: {
    fontSize: 12,
    color: Colors.ui.textLight,
    textAlign: 'center',
  },
  rewardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.badges.orBg,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignSelf: 'stretch',
    borderWidth: 1,
    borderColor: Colors.badges.or + '60',
  },
  rewardLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.ui.textLight,
  },
  rewardValue: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.badges.or,
  },
  btn: {
    backgroundColor: Colors.forest.medium,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 32,
    alignSelf: 'stretch',
    alignItems: 'center',
    marginTop: 4,
  },
  btnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
  },
});
