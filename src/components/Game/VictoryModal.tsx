// ============================================================
// VICTORYMODAL
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

const native = Platform.OS !== 'web';

import { formatTime } from '../../utils/boardUtils';
import { Colors } from '../../constants/colors';
import { DifficultyLevel } from '../../core/models/Challenge';
import { notificationSuccess } from '../../utils/haptics';
import { Confetti, ConfettiPiece } from './Confetti';
import { BadgeProgressInline } from '../Badges/BadgeProgressInline';
import { BadgeToast } from '../Badges/BadgeToast';
import { BadgeProgress } from '../../core/engine/badgeEngine';
import { WorldRecord } from '../../services/worldRecordService';
import { usePlayerStore } from '../../store/playerStore';
import { SeedFlyAnimation, useCounterPulse } from './SeedFlyAnimation';
import { useT } from '../../i18n';

interface VictoryModalProps {
  visible: boolean;
  elapsedTime: number;
  seedsEarned: number;
  seedsBeforeGain?: number;
  difficulty: DifficultyLevel;
  challengeNumber: number;
  onNextChallenge: () => void;
  nextChallengeLabel?: string;
  onBackToMenu: () => void;
  confettiPieces?: ConfettiPiece[];
  closestBadges?: BadgeProgress[];
  obtainedBadgeIds?: string[];
  newGoalBadgeIds?: string[];
  badgeQueue?: string[];
  onBadgeQueueEmpty?: () => void;
  worldRecord?: WorldRecord | null;
  isNewWorldRecord?: boolean;
  previousRecordHolder?: string | null;
  // ── PERFECT x2 ────────────────────────────────────────────────────────────
  isPerfectRun?: boolean;
  perfectSeedsBonus?: number;
  onPerfectBonusCollected?: () => void;
}

const DIFFICULTY_EMOJIS: Partial<Record<DifficultyLevel, string>> = {
  niveau_1: '🌱', niveau_2: '🌿', niveau_3: '🌳',
  niveau_4: '🦊', niveau_5: '🏕️', niveau_6: '🌲',
  niveau_7: '🐺', niveau_8: '🏔️', niveau_9: '🏹',
  niveau_10: '🐽', niveau_11: '🏔️',
  niveau_12: '⚡', niveau_13: '💀',
};

export const VictoryModal: React.FC<VictoryModalProps> = ({
  visible, elapsedTime, seedsEarned, seedsBeforeGain, difficulty, challengeNumber,
  onNextChallenge, nextChallengeLabel, onBackToMenu, confettiPieces,
  closestBadges = [], obtainedBadgeIds = [], newGoalBadgeIds = [], badgeQueue = [], onBadgeQueueEmpty,
  worldRecord = null, isNewWorldRecord = false, previousRecordHolder = null,
  isPerfectRun = false, perfectSeedsBonus = 0, onPerfectBonusCollected,
}) => {
  const t = useT();

  // ── Compteur affiché ─────────────────────────────────────────────────────
  // totalSeeds = vrai total incluant le gain (addSeeds déjà appelé)
  // Si seedsBeforeGain est fourni, on l'utilise comme point de départ de l'animation.
  // Sinon, on recalcule à partir du store (fallback).
  const totalSeeds = usePlayerStore(s => s.seeds);
  const startSeeds = seedsBeforeGain ?? (totalSeeds - seedsEarned);
  const [displayedSeeds, setDisplayedSeeds] = useState(startSeeds);
  const [displayedGain, setDisplayedGain]   = useState(seedsEarned);
  const [animDone, setAnimDone]             = useState(false);
  const arrivedCount  = useRef(0);
  // Nombre de particules capturé au démarrage de la 1re animation (stable, ne change pas mid-vol)
  const launchedCount = useRef(0);

  useEffect(() => {
    if (visible) {
      const start = seedsBeforeGain ?? (totalSeeds - seedsEarned);
      setDisplayedSeeds(start); // part du vrai score avant gain → monte vers totalSeeds
      setDisplayedGain(seedsEarned);
      setAnimDone(false);
      arrivedCount.current = 0;
    }
  }, [visible]);

  // Mise à jour du gain affiché si seedsEarned change après l'ouverture
  // (cas : badges + rang calculés dans le useEffect de [challengeId].tsx après isVictory)
  // On ne réinitialise que si l'animation n'a pas encore démarré (arrivedCount = 0).
  useEffect(() => {
    if (visible && arrivedCount.current === 0) {
      setDisplayedGain(seedsEarned);
    }
  }, [seedsEarned]);

  // ── Animation entrée carte ────────────────────────────────────────────────
  const scaleAnim   = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      notificationSuccess();
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, damping: 12, stiffness: 150, useNativeDriver: native }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 200, useNativeDriver: native }),
      ]).start();
    } else {
      scaleAnim.setValue(0);
      opacityAnim.setValue(0);
    }
  }, [visible]);

  // ── Positions mesurées dans la carte (via onLayout) ───────────────────────
  const [fromY, setFromY] = useState<number | null>(null);
  const [fromX, setFromX] = useState<number>(225); // 75% de statsRow, recalculé
  const [toY, setToY]     = useState<number | null>(null);
  const [toX, setToX]     = useState<number>(150); // centre du compteur, recalculé

  const onCounterLayout = useCallback((e: LayoutChangeEvent) => {
    const { x, y, height, width } = e.nativeEvent.layout;
    setToY(y + height / 2);
    setToX(x + width / 2);
  }, []);

  const onStatsLayout = useCallback((e: LayoutChangeEvent) => {
    const { x, y, height, width } = e.nativeEvent.layout;
    setFromY(y + height / 2);
    setFromX(x + width * 0.75);
  }, []);

  // ── Pulse et halo ─────────────────────────────────────────────────────────
  const { scale: counterScale, haloOpacity, haloScale, pulse } = useCounterPulse();

  // ── Callback : une graine arrive au compteur ──────────────────────────────
  const onSeedArrived = useCallback(() => {
    arrivedCount.current += 1;
    setDisplayedSeeds(prev => prev + 1);             // compteur haut monte vers totalSeeds
    setDisplayedGain(prev => Math.max(0, prev - 1)); // gain bas descend vers 0
    pulse();
    // Comparaison sur launchedCount.current (stable), pas sur seedsEarned (peut changer)
    if (arrivedCount.current >= launchedCount.current) {
      setAnimDone(true);
      // Si run parfait : déclencher l'overlay après la fin de la 1re animation
      if (isPerfectRun && perfectSeedsBonus > 0) {
        setTimeout(() => setShowPerfectOverlay(true), 500);
      }
    }
  }, [pulse, isPerfectRun, perfectSeedsBonus]);

  // ── Déclenchement : 600ms après l'ouverture ──────────────────────────────
  const [flyKey, setFlyKey]   = useState(0);
  const [flyActive, setFlyActive] = useState(false);
  // particleCount est figé au moment du lancement — ne dépend pas de seedsEarned changeant
  const [particleCount, setParticleCount] = useState(0);
  // Ref pour éviter le double-déclenchement si seedsEarned change pendant le délai de 600ms
  const flyScheduledRef = useRef(false);

  useEffect(() => {
    if (!visible) {
      setFlyActive(false);
      flyScheduledRef.current = false;
      return;
    }
    if (seedsEarned <= 0) return;
    // Ne pas re-déclencher si déjà planifié ou en cours
    if (flyScheduledRef.current || flyActive) return;
    flyScheduledRef.current = true;
    // Capturer la valeur au moment de la planification
    const count = Math.max(1, seedsEarned);
    const t = setTimeout(() => {
      setParticleCount(count);
      launchedCount.current = count;
      arrivedCount.current  = 0;
      setFlyKey(k => k + 1);
      setFlyActive(true);
    }, 600);
    return () => clearTimeout(t);
  }, [visible, seedsEarned]);

  // ── PERFECT x2 ────────────────────────────────────────────────────────────
  const [showPerfectOverlay, setShowPerfectOverlay] = useState(false);
  const [perfectFlyActive, setPerfectFlyActive]     = useState(false);
  const [perfectFlyKey, setPerfectFlyKey]           = useState(0);
  const perfectScaleAnim = useRef(new Animated.Value(0)).current;
  const perfectOpacityAnim = useRef(new Animated.Value(0)).current;

  // Reset à chaque ouverture/fermeture
  useEffect(() => {
    if (!visible) {
      setShowPerfectOverlay(false);
      setPerfectFlyActive(false);
      perfectScaleAnim.setValue(0);
      perfectOpacityAnim.setValue(0);
    }
  }, [visible]);

  // Lancer l'animation PERFECT quand showPerfectOverlay passe à true
  useEffect(() => {
    if (!showPerfectOverlay) return;
    // Apparition + pulse
    perfectScaleAnim.setValue(0);
    perfectOpacityAnim.setValue(0);
    Animated.parallel([
      Animated.timing(perfectOpacityAnim, { toValue: 1, duration: 200, useNativeDriver: native }),
      Animated.spring(perfectScaleAnim, { toValue: 1, damping: 7, stiffness: 200, useNativeDriver: native }),
    ]).start(() => {
      // Réafficher le gain bonus dans le label stats
      if (perfectSeedsBonus > 0) setDisplayedGain(perfectSeedsBonus);
      // Appeler le callback pour addSeeds côté parent (le x2 effectif)
      onPerfectBonusCollected?.();
      // Délai visuel avant de lancer la 2e pluie de graines
      setTimeout(() => {
        setPerfectFlyKey(k => k + 1);
        setPerfectFlyActive(true);
      }, 400);
    });
  }, [showPerfectOverlay]);

  // ── Rendu ─────────────────────────────────────────────────────────────────
  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
      <Animated.View style={[styles.backdrop, { opacity: opacityAnim }]}>
        <Animated.View
          style={[styles.card, { transform: [{ scale: scaleAnim }] }]}
        >

          {/* ── Compteur — CIBLE des graines ────────────────────────── */}
          <View style={styles.counterWrapper} onLayout={onCounterLayout}>
            {/* Halo vert qui pulse */}
            <Animated.View
              style={[
                styles.halo,
                {
                  opacity:   haloOpacity,
                  transform: [{ scale: haloScale }],
                },
              ]}
              pointerEvents="none"
            />
            <Animated.View
              style={[styles.seedCounterBadge, { transform: [{ scale: counterScale }] }]}
            >
              <Text style={styles.seedCounterValue}>{displayedSeeds}</Text>
              <Text style={styles.seedCounterEmoji}>🌱</Text>
              {displayedGain > 0 && !animDone && (
                <View style={styles.seedGainBubble}>
                  <Text style={styles.seedGainText}>+{displayedGain}</Text>
                </View>
              )}
            </Animated.View>
          </View>

          {/* ── Titre ────────────────────────────────────────────────────── */}
          <Text style={styles.emoji}>🎉</Text>
          <Text style={styles.title}>{t('victory_title')}</Text>
          {challengeNumber > 0 && (
            <Text style={styles.subtitle}>
              {DIFFICULTY_EMOJIS[difficulty] ?? ''} {t('level_prefix')} {difficulty.replace('niveau_', '')} — {t('victory_challenge_label', { number: String(challengeNumber) })}
            </Text>
          )}

          {/* ── Stats — SOURCE ────────────────────────────────────────────── */}
          <View style={styles.statsRow} onLayout={onStatsLayout}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{formatTime(elapsedTime)}</Text>
              <Text style={styles.statLabel}>{t('victory_stat_time')}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statValue}>+{displayedGain} 🌱</Text>
              <Text style={styles.statLabel}>{t('victory_stat_seeds')}</Text>
            </View>
          </View>

          {/* ── Record mondial ───────────────────────────────────────────── */}
          {isNewWorldRecord ? (
            <View style={styles.wrBanner}>
              <Text style={styles.wrBannerEmoji}>🌍🏆</Text>
              <View style={styles.wrBannerText}>
                <Text style={styles.wrBannerTitle}>{t('wr_new_record')}</Text>
                <Text style={styles.wrBannerTime}>{formatTime(elapsedTime)}</Text>
                {previousRecordHolder && (
                  <Text style={styles.wrPreviousHolder}>{t('wr_beaten_from', { username: previousRecordHolder })}</Text>
                )}
              </View>
            </View>
          ) : worldRecord ? (
            <View style={styles.wrInfo}>
              <Text style={styles.wrInfoLabel}>{t('wr_record_label')}</Text>
              <Text style={styles.wrInfoTime}>{formatTime(worldRecord.timeMs)}</Text>
              <Text style={styles.wrInfoHolder}>{t('wr_held_by', { username: worldRecord.username })}</Text>
            </View>
          ) : null}

          {closestBadges.length > 0 && (
            <View style={styles.badgeProgressWrapper}>
              <BadgeProgressInline closestBadges={closestBadges} obtainedBadgeIds={obtainedBadgeIds} newGoalBadgeIds={newGoalBadgeIds} />
            </View>
          )}

          <TouchableOpacity style={styles.btnPrimary} onPress={onNextChallenge} activeOpacity={0.8}>
            <Text style={styles.btnPrimaryText}>{nextChallengeLabel ?? t('victory_next_challenge')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnSecondary} onPress={onBackToMenu} activeOpacity={0.8}>
            <Text style={styles.btnSecondaryText}>{t('victory_back_menu')}</Text>
          </TouchableOpacity>

          {/*
            Graines volantes — absoluteFill dans la carte.
            fromY et toY sont dans le référentiel de la carte (via onLayout).
            Même parent → même système de coordonnées. Aucune conversion.
            flyKey force le remontage si on rejoue.
          */}
          {flyActive && fromY !== null && toY !== null && (
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

          {/* ── Overlay PERFECT x2 ──────────────────────────────────────── */}
          {showPerfectOverlay && (
            <Animated.View
              style={[
                styles.perfectOverlay,
                { opacity: perfectOpacityAnim, transform: [{ scale: perfectScaleAnim }] },
              ]}
              pointerEvents="none"
            >
              <Text style={styles.perfectLabel}>{t('perfect_run_label')}</Text>
              <Text style={styles.perfectSub}>{t('victory_perfect_bonus', { count: String(perfectSeedsBonus) })}</Text>
            </Animated.View>
          )}

          {/* ── 2e pluie de graines (bonus parfait) ─────────────────────── */}
          {perfectFlyActive && fromY !== null && toY !== null && (
            <SeedFlyAnimation
              key={`perfect_${perfectFlyKey}`}
              count={Math.max(1, perfectSeedsBonus)}
              fromX={fromX}
              fromY={fromY}
              targetX={toX}
              targetY={toY}
              onSeedArrived={() => {
                setDisplayedSeeds(prev => prev + 1);
                setDisplayedGain(prev => Math.max(0, prev - 1));
                pulse();
              }}
            />
          )}

        </Animated.View>
      </Animated.View>

      <Confetti pieces={confettiPieces ?? null} />

      {badgeQueue.length > 0 && onBadgeQueueEmpty && (
        <BadgeToast queue={badgeQueue} onQueueEmpty={onBadgeQueueEmpty} />
      )}
    </Modal>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: Colors.ui.card,
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    width: '100%',
    maxWidth: 360,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 16,
    overflow: 'visible',
  },

  // ── Compteur ──────────────────────────────────────────────────────────────
  counterWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  halo: {
    position: 'absolute',
    width: 90,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#6FCF5A',
  },
  seedCounterBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.forest.dark,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    gap: 6,
    shadowColor: Colors.forest.medium,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.45,
    shadowRadius: 6,
    elevation: 6,
  },
  seedCounterValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFF8E7',
    minWidth: 28,
    textAlign: 'center',
  },
  seedCounterEmoji: { fontSize: 20 },
  seedGainBubble: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: Colors.forest.accent,
    borderRadius: 10,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  seedGainText: { fontSize: 10, fontWeight: '800', color: '#fff' },

  // ── Titre ─────────────────────────────────────────────────────────────────
  emoji: { fontSize: 56, marginBottom: 8 },
  title: { fontSize: 32, fontWeight: '800', color: Colors.forest.dark, marginBottom: 4 },
  subtitle: { fontSize: 14, color: Colors.ui.textLight, marginBottom: 24 },

  // ── Stats ─────────────────────────────────────────────────────────────────
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.forest.light + '15',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 24,
    marginBottom: 28,
    width: '100%',
  },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 22, fontWeight: '700', color: Colors.forest.dark },
  statLabel: { fontSize: 12, color: Colors.ui.textLight, marginTop: 2 },
  statDivider: { width: 1, height: 36, backgroundColor: Colors.ui.border, marginHorizontal: 8 },

  // ── Boutons ───────────────────────────────────────────────────────────────
  btnPrimary: {
    backgroundColor: Colors.forest.medium,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 32,
    width: '100%',
    alignItems: 'center',
    marginBottom: 10,
  },
  btnPrimaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  btnSecondary: { paddingVertical: 10 },
  btnSecondaryText: { color: Colors.ui.textLight, fontSize: 14 },

  badgeProgressWrapper: { width: '100%', marginBottom: 16 },

  // ── PERFECT x2 ────────────────────────────────────────────────────────────
  perfectOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 24,
    zIndex: 20,
  },
  perfectLabel: {
    fontSize: 36,
    fontWeight: '900',
    color: '#FFD700',
    textAlign: 'center',
    letterSpacing: 1.5,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  perfectSub: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF8E7',
    marginTop: 8,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },

  goalBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.badges.or + '18',
    borderWidth: 1.5,
    borderColor: Colors.badges.or,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 14,
    width: '100%',
    gap: 10,
  },
  goalBannerEmoji: { fontSize: 24 },
  goalBannerText: { flex: 1 },
  goalBannerTitle: { fontSize: 13, fontWeight: '800', color: Colors.badges.or },
  goalBannerSub: { fontSize: 12, color: Colors.forest.dark, marginTop: 1 },

  wrBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.badges.or + '20',
    borderWidth: 1.5,
    borderColor: Colors.badges.or,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginBottom: 16,
    width: '100%',
    gap: 10,
  },
  wrBannerEmoji: { fontSize: 28 },
  wrBannerText: { flex: 1 },
  wrBannerTitle: {
    fontSize: 13, fontWeight: '800', color: Colors.badges.or,
    textTransform: 'uppercase', letterSpacing: 0.4,
  },
  wrBannerTime: { fontSize: 20, fontWeight: '800', color: Colors.forest.dark },
  wrPreviousHolder: { fontSize: 11, color: Colors.badges.or, fontStyle: 'italic', marginTop: 2 },
  wrInfo: {
    backgroundColor: Colors.ui.background,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginBottom: 12,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  wrInfoLabel: { fontSize: 11, fontWeight: '700', color: Colors.ui.textLight, flex: 1 },
  wrInfoTime: { fontSize: 14, fontWeight: '800', color: Colors.forest.dark },
  wrInfoHolder: { fontSize: 11, color: Colors.ui.textLight, maxWidth: 100 },
});
