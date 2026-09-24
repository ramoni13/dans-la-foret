// ============================================================
// BADGETOAST — Notification in-game badge débloqué
// Slide-in depuis le haut, bouton OK pour valider, feux d'artifice
// ============================================================

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Platform,
  Dimensions,
} from 'react-native';

import { BADGE_MAP, BadgeRarity, getBadgeTexts } from '../../constants/badges';
import { Colors } from '../../constants/colors';
import { notificationSuccess } from '../../utils/haptics';
import { useT } from '../../i18n';
import { usePlayerStore } from '../../store/playerStore';

const native = Platform.OS !== 'web';
const { width: SCREEN_W } = Dimensions.get('window');

// Couleurs des feux d'artifice
const FIREWORK_COLORS = [
  '#FFD700', '#FF6B35', '#4CAF50', '#2196F3',
  '#E91E63', '#9C27B0', '#FF9800', '#00BCD4',
  '#FFEB3B', '#F44336',
];
const PARTICLE_COUNT = 18;

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

interface BadgeToastProps {
  /** File de badges à afficher (IDs). */
  queue: string[];
  /** Appelé quand la file est épuisée */
  onQueueEmpty?: () => void;
}

const RARITY_BG: Record<BadgeRarity, string> = {
  bois:    Colors.badges.boisBg,
  pierre:  Colors.badges.pierreBg,
  or:      Colors.badges.orBg,
  cristal: Colors.badges.cristalBg,
};

const RARITY_BORDER: Record<BadgeRarity, string> = {
  bois:    Colors.badges.bois,
  pierre:  Colors.badges.pierre,
  or:      Colors.badges.or,
  cristal: Colors.badges.cristal,
};

export const BadgeToast: React.FC<BadgeToastProps> = ({
  queue,
  onQueueEmpty,
}) => {
  const t = useT();
  const language = usePlayerStore(state => state.language);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [visible, setVisible] = useState(false);
  const translateY  = useRef(new Animated.Value(-160)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim   = useRef(new Animated.Value(0.85)).current;

  // Feux d'artifice — créés une seule fois, réutilisés
  const particlesRef = useRef<Particle[]>(createParticles());
  const particles = particlesRef.current;

  const currentBadgeId = queue[currentIndex];
  const currentBadge   = currentBadgeId ? BADGE_MAP[currentBadgeId] : null;

  // ── Feux d'artifice ─────────────────────────────────────────────────────────
  const launchFireworks = () => {
    // Reset
    particles.forEach(p => {
      p.x.setValue(0);
      p.y.setValue(0);
      p.opacity.setValue(0);
      p.scale.setValue(0);
    });

    const animations = particles.map((p, i) => {
      const angle    = (i / PARTICLE_COUNT) * Math.PI * 2;
      const distance = 60 + Math.random() * 60;
      const targetX  = Math.cos(angle) * distance;
      const targetY  = Math.sin(angle) * distance - 20;
      const duration = 500 + Math.random() * 300;
      const delay    = Math.random() * 100;

      return Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(p.opacity, { toValue: 1,      duration: 80,      useNativeDriver: native }),
          Animated.spring(p.scale,   { toValue: 1,      damping: 8, stiffness: 300, useNativeDriver: native }),
          Animated.timing(p.x,       { toValue: targetX, duration,          useNativeDriver: native }),
          Animated.timing(p.y,       { toValue: targetY, duration,          useNativeDriver: native }),
          Animated.sequence([
            Animated.delay(duration * 0.5),
            Animated.timing(p.opacity, { toValue: 0, duration: duration * 0.5, useNativeDriver: native }),
          ]),
        ]),
      ]);
    });

    Animated.parallel(animations).start();
  };

  // ── Animations slide-in ─────────────────────────────────────────────────────
  const slideIn = () => {
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        damping: 14,
        stiffness: 200,
        useNativeDriver: native,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: native,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        damping: 12,
        stiffness: 180,
        useNativeDriver: native,
      }),
    ]).start(() => {
      // Lancer les feux d'artifice 150ms après l'entrée
      setTimeout(launchFireworks, 150);
    });
  };

  const slideOut = (onDone?: () => void) => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -160,
        duration: 250,
        useNativeDriver: native,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: native,
      }),
      Animated.timing(scaleAnim, {
        toValue: 0.85,
        duration: 200,
        useNativeDriver: native,
      }),
    ]).start(() => {
      translateY.setValue(-160);
      opacityAnim.setValue(0);
      scaleAnim.setValue(0.85);
      onDone?.();
    });
  };

  // ── Afficher le badge courant ────────────────────────────────────────────────
  useEffect(() => {
    if (currentIndex >= queue.length) {
      setVisible(false);
      onQueueEmpty?.();
      return;
    }

    if (!BADGE_MAP[queue[currentIndex]]) {
      setCurrentIndex(i => i + 1);
      return;
    }

    setVisible(true);
    slideIn();
    notificationSuccess();
  }, [currentIndex, queue.length]);

  // Reset quand une nouvelle file arrive
  useEffect(() => {
    if (queue.length > 0) {
      setCurrentIndex(0);
    }
  }, [queue]);

  const handleOK = () => {
    slideOut(() => {
      if (currentIndex + 1 >= queue.length) {
        onQueueEmpty?.();
      } else {
        setCurrentIndex(i => i + 1);
      }
    });
  };

  if (!visible || !currentBadge) return null;

  const bgColor     = RARITY_BG[currentBadge.rarity] ?? '#fff';
  const borderColor = RARITY_BORDER[currentBadge.rarity] ?? Colors.ui.border;
  const texts       = getBadgeTexts(currentBadge, language);
  const remaining   = queue.length - currentIndex;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY }, { scale: scaleAnim }],
          opacity: opacityAnim,
          backgroundColor: bgColor,
          borderColor,
        },
      ]}
      pointerEvents="box-none"
    >
      {/* Feux d'artifice — derrière le contenu */}
      <View style={styles.fireworksLayer} pointerEvents="none">
        {particles.map((p, i) => (
          <Animated.View
            key={i}
            style={[
              styles.particle,
              {
                backgroundColor: p.color,
                opacity: p.opacity,
                transform: [
                  { translateX: p.x },
                  { translateY: p.y },
                  { scale: p.scale },
                ],
              },
            ]}
          />
        ))}
      </View>

      {/* Contenu principal */}
      <View style={styles.content}>
        {/* Gauche : emoji + point de rareté */}
        <View style={styles.left}>
          <Text style={styles.emoji}>{currentBadge.emoji}</Text>
          <View style={[styles.rarityDot, { backgroundColor: borderColor }]} />
        </View>

        {/* Centre : textes */}
        <View style={styles.textBlock}>
          <Text style={styles.headline}>{t('badge_unlocked')}</Text>
          <Text style={styles.label} numberOfLines={1}>{texts.label}</Text>
          <Text style={styles.desc} numberOfLines={2}>{texts.description}</Text>
        </View>

        {/* Droite : compteur + bouton OK */}
        <View style={styles.right}>
          {remaining > 1 && (
            <View style={[styles.counter, { backgroundColor: borderColor }]}>
              <Text style={styles.counterText}>{remaining}</Text>
            </View>
          )}
          <TouchableOpacity
            style={[styles.okBtn, { backgroundColor: borderColor }]}
            onPress={handleOK}
            activeOpacity={0.8}
          >
            <Text style={styles.okText}>
              {remaining > 1 ? t('badge_next') : t('badge_ok')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    borderRadius: 18,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 14,
    elevation: 16,
    zIndex: 9999,
    overflow: 'hidden',
  },
  fireworksLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  particle: {
    position: 'absolute',
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 10,
  },
  left: {
    alignItems: 'center',
    gap: 4,
  },
  emoji: {
    fontSize: 32,
  },
  rarityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  textBlock: {
    flex: 1,
    gap: 2,
  },
  headline: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.forest.dark,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  label: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.ui.text,
  },
  desc: {
    fontSize: 11,
    color: Colors.ui.textLight,
    lineHeight: 15,
  },
  right: {
    alignItems: 'center',
    gap: 6,
  },
  counter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#fff',
  },
  okBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    minWidth: 50,
    alignItems: 'center',
  },
  okText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#fff',
  },
});
