// ============================================================
// PremiumCelebrationModal — félicitations après le passage à premium
//
// Montée UNE fois à la racine (`app/_layout.tsx`) et pilotée par `premiumCelebrationStore`.
// Trois messages : 1 arbre planté, tout est illimité, badge « Ami de la Forêt » obtenu.
// Ambiance : feux d'artifice (PineconeBurst), pluie de confettis, paillettes qui scintillent.
// « Réduire les animations » : aucune particule, la carte apparaît simplement.
// ============================================================

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  ZoomIn,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BURST_COLORS } from '../../constants/pinecone';
import { BADGE_MAP, getBadgeTexts } from '../../constants/badges';
import { Colors } from '../../constants/colors';
import { useT } from '../../i18n';
import { usePlayerStore } from '../../store/playerStore';
import { usePremiumCelebrationStore } from '../../store/premiumCelebrationStore';
import { notificationSuccess } from '../../utils/haptics';
import { BurstShot, PineconeBurst } from '../Game/PineconeBurst';

const BADGE_ID = 'ami_de_la_foret';
const CONFETTI_COUNT = 36;
const SPARKLE_COUNT = 14;
const FIREWORK_INTERVAL_MS = 650;
const FIREWORK_DURATION_MS = 9000;
const MAX_LIVE_SHOTS = 6;

// ── Générateur pseudo-aléatoire déterministe (stable entre deux rendus) ──────
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// ── Pluie de confettis ───────────────────────────────────────────────────────
function ConfettiPiece({ index, width, height }: { index: number; width: number; height: number }) {
  const spec = useMemo(() => {
    const r = seeded(index * 97 + 5);
    return {
      x: r() * width,
      size: 7 + r() * 7,
      color: BURST_COLORS[Math.floor(r() * BURST_COLORS.length)] as string,
      duration: 2600 + r() * 2200,
      delay: Math.floor(r() * 1800),
      amp: 14 + r() * 26,
      turns: 1 + Math.floor(r() * 3),
      round: r() < 0.35,
    };
  }, [index, width]);

  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, { duration: spec.duration, easing: Easing.linear }),
      -1,
      false,
    );
    return () => cancelAnimation(progress);
  }, []);

  const style = useAnimatedStyle(() => {
    // Décalage initial : chaque pièce démarre à une phase différente (pas de « vague » unique).
    const t = (progress.value + spec.delay / 4400) % 1;
    return {
      opacity: t < 0.05 ? t / 0.05 : t > 0.9 ? (1 - t) / 0.1 : 1,
      transform: [
        { translateY: -30 + t * (height + 60) },
        { translateX: Math.sin(t * Math.PI * 2 * spec.turns) * spec.amp },
        { rotate: `${t * 360 * spec.turns}deg` },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        styles.confetti,
        {
          left: spec.x,
          width: spec.size,
          height: spec.round ? spec.size : spec.size * 0.55,
          borderRadius: spec.round ? spec.size / 2 : 1.5,
          backgroundColor: spec.color,
        },
        style,
      ]}
    />
  );
}

// ── Paillettes qui scintillent ───────────────────────────────────────────────
function Sparkle({ index, width, height }: { index: number; width: number; height: number }) {
  const spec = useMemo(() => {
    const r = seeded(index * 31 + 11);
    return {
      x: r() * (width - 24),
      y: r() * (height - 24),
      size: 14 + r() * 16,
      duration: 700 + r() * 700,
      delay: Math.floor(r() * 900),
      glyph: r() < 0.5 ? '✨' : '⭐',
    };
  }, [index, width, height]);

  const pulse = useSharedValue(0);

  useEffect(() => {
    pulse.value = withSequence(
      withTiming(0, { duration: spec.delay }),
      withRepeat(
        withSequence(
          withTiming(1, { duration: spec.duration, easing: Easing.inOut(Easing.quad) }),
          withTiming(0, { duration: spec.duration, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
        false,
      ),
    );
    return () => cancelAnimation(pulse);
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: pulse.value,
    transform: [{ scale: 0.4 + pulse.value * 0.9 }, { rotate: `${pulse.value * 40}deg` }],
  }));

  return (
    <Animated.Text style={[styles.sparkle, { left: spec.x, top: spec.y, fontSize: spec.size }, style]}>
      {spec.glyph}
    </Animated.Text>
  );
}

// ── Ligne d'information ──────────────────────────────────────────────────────
function InfoRow({
  emoji,
  title,
  desc,
  delay,
  accent,
}: {
  emoji: string;
  title: string;
  desc: string;
  delay: number;
  accent: string;
}) {
  return (
    <Animated.View
      entering={FadeInDown.delay(delay).duration(450).springify().damping(14)}
      style={[styles.row, { borderColor: accent }]}
    >
      <View style={[styles.rowIconWrap, { backgroundColor: accent + '33' }]}>
        <Text style={styles.rowIcon}>{emoji}</Text>
      </View>
      <View style={styles.rowTextWrap}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowDesc}>{desc}</Text>
      </View>
    </Animated.View>
  );
}

// ── Modale ───────────────────────────────────────────────────────────────────
export function PremiumCelebrationModal() {
  const visible = usePremiumCelebrationStore(s => s.visible);
  const hide = usePremiumCelebrationStore(s => s.hide);
  const lang = usePlayerStore(s => s.language);
  const t = useT();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const reduceMotion = useReducedMotion();

  const [shots, setShots] = useState<BurstShot[]>([]);
  const shotKey = useRef(0);

  const badge = BADGE_MAP[BADGE_ID];
  const badgeName = badge ? getBadgeTexts(badge, lang).label : 'Ami de la Forêt';

  // Feux d'artifice : un nouveau tir toutes les 650 ms pendant 9 s, dans la moitié haute de l'écran.
  useEffect(() => {
    if (!visible) {
      setShots([]);
      return;
    }
    notificationSuccess();
    if (reduceMotion) return;

    const rand = seeded(Date.now() % 100000);
    const fire = () => {
      shotKey.current += 1;
      const shot: BurstShot = {
        key: shotKey.current,
        x: width * (0.15 + rand() * 0.7),
        y: height * (0.1 + rand() * 0.4),
        radius: 90 + rand() * 60,
        count: 26 + Math.floor(rand() * 10),
      };
      setShots(prev => [...prev.slice(-(MAX_LIVE_SHOTS - 1)), shot]);
    };

    fire();
    const interval = setInterval(fire, FIREWORK_INTERVAL_MS);
    const stop = setTimeout(() => clearInterval(interval), FIREWORK_DURATION_MS);
    return () => {
      clearInterval(interval);
      clearTimeout(stop);
    };
  }, [visible, reduceMotion, width, height]);

  if (!visible) return null;

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={hide}
      statusBarTranslucent={Platform.OS === 'android'}
    >
      <View style={styles.overlay}>
        <Animated.View
          entering={ZoomIn.duration(500).springify().damping(12)}
          style={[styles.card, { marginTop: insets.top + 12, marginBottom: Math.max(insets.bottom, 16) }]}
        >
          <Text style={styles.heroEmoji}>🎉</Text>
          <Text style={styles.title}>{t('premium_celebrate_title')}</Text>
          <Text style={styles.subtitle}>{t('premium_celebrate_subtitle')}</Text>

          <View style={styles.rows}>
            <InfoRow
              emoji="🌳"
              title={t('premium_celebrate_tree_title')}
              desc={t('premium_celebrate_tree_desc')}
              delay={500}
              accent="#4CAF50"
            />
            <InfoRow
              emoji="♾️"
              title={t('premium_celebrate_unlimited_title')}
              desc={t('premium_celebrate_unlimited_desc')}
              delay={800}
              accent="#2196F3"
            />
            <InfoRow
              emoji={badge?.emoji ?? '🌲'}
              title={t('premium_celebrate_badge_title', { badge: badgeName })}
              desc={t('premium_celebrate_badge_desc')}
              delay={1100}
              accent="#FFC107"
            />
          </View>

          <Animated.View entering={FadeIn.delay(1400).duration(400)}>
            <TouchableOpacity style={styles.btn} onPress={hide} activeOpacity={0.85}>
              <Text style={styles.btnText}>{t('premium_celebrate_btn')}</Text>
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>

        {/* Décor festif : au-dessus de la carte, sans jamais intercepter les taps */}
        {!reduceMotion && (
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            {Array.from({ length: CONFETTI_COUNT }, (_, i) => (
              <ConfettiPiece key={`c${i}`} index={i} width={width} height={height} />
            ))}
            {Array.from({ length: SPARKLE_COUNT }, (_, i) => (
              <Sparkle key={`s${i}`} index={i} width={width} height={height} />
            ))}
          </View>
        )}
        <PineconeBurst shots={shots} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(5,15,8,0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: Colors.forest.dark,
    borderRadius: 22,
    padding: 22,
    width: '100%',
    maxWidth: 400,
    borderWidth: 2,
    borderColor: 'rgba(255,215,0,0.55)',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 22,
    elevation: 16,
  },
  heroEmoji: { fontSize: 52, textAlign: 'center' },
  title: {
    color: '#FFD700',
    fontSize: 28,
    fontWeight: '900',
    textAlign: 'center',
    marginTop: 4,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 15,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 21,
  },
  rows: { marginTop: 18, gap: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 12,
  },
  rowIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowIcon: { fontSize: 26 },
  rowTextWrap: { flex: 1 },
  rowTitle: { color: '#fff', fontSize: 16, fontWeight: '800', lineHeight: 21 },
  rowDesc: { color: 'rgba(255,255,255,0.72)', fontSize: 13, marginTop: 2, lineHeight: 18 },
  btn: {
    marginTop: 20,
    backgroundColor: '#FFD700',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    minHeight: 48,
  },
  btnText: { color: Colors.forest.dark, fontSize: 17, fontWeight: '900', letterSpacing: 0.3 },
  confetti: { position: 'absolute', top: 0 },
  sparkle: { position: 'absolute' },
});
