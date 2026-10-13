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

interface VictoryModalProps {
  visible: boolean;
  elapsedTime: number;
  seedsEarned: number;
  difficulty: DifficultyLevel;
  challengeNumber: number;
  onNextChallenge: () => void;
  onBackToMenu: () => void;
  confettiPieces: ConfettiPiece[];
  closestBadges?: BadgeProgress[];
  badgeQueue?: string[];
  onBadgeQueueEmpty?: () => void;
  worldRecord?: WorldRecord | null;
  isNewWorldRecord?: boolean;
  previousRecordHolder?: string | null;
  goalJustCompleted?: boolean;
  onChooseGoal?: () => void;
}

const DIFFICULTY_LABELS: Partial<Record<DifficultyLevel, string>> = {
  niveau_1: '🌱 Niveau 1', niveau_2: '🌿 Niveau 2', niveau_3: '🌳 Niveau 3',
  niveau_4: '🦊 Niveau 4', niveau_5: '🏕️ Niveau 5', niveau_6: '🌲 Niveau 6',
  niveau_7: '🐺 Niveau 7', niveau_8: '🏔️ Niveau 8', niveau_9: '🏹 Niveau 9',
  niveau_10: '🐽 Niveau 10', niveau_11: '🏔️ Niveau 11',
  niveau_12: '⚡ Niveau 12', niveau_13: '💀 Niveau 13',
};

export const VictoryModal: React.FC<VictoryModalProps> = ({
  visible, elapsedTime, seedsEarned, difficulty, challengeNumber,
  onNextChallenge, onBackToMenu, confettiPieces,
  closestBadges = [], badgeQueue = [], onBadgeQueueEmpty,
  worldRecord = null, isNewWorldRecord = false, previousRecordHolder = null,
  goalJustCompleted = false, onChooseGoal,
}) => {

  // ── Compteur affiché ─────────────────────────────────────────────────────
  // totalSeeds = vrai total incluant le gain (addSeeds déjà appelé)
  // displayedSeeds part de (totalSeeds - seedsEarned) et monte à totalSeeds
  // une unité à la fois, synchronisé avec chaque graine qui arrive
  const totalSeeds = usePlayerStore(s => s.seeds);
  const [displayedSeeds, setDisplayedSeeds] = useState(totalSeeds);
  const [displayedGain, setDisplayedGain]   = useState(seedsEarned);
  const [animDone, setAnimDone]             = useState(false);
  const arrivedCount = useRef(0);

  useEffect(() => {
    if (visible) {
      setDisplayedSeeds(totalSeeds - seedsEarned); // part d'avant le gain → monte vers totalSeeds
      setDisplayedGain(seedsEarned);
      setAnimDone(false);
      arrivedCount.current = 0;
    }
  }, [visible]);

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
    if (arrivedCount.current >= Math.max(1, seedsEarned)) {
      setAnimDone(true);
    }
  }, [seedsEarned, pulse]);

  // ── Déclenchement : 600ms après l'ouverture ──────────────────────────────
  const [flyKey, setFlyKey] = useState(0);
  const [flyActive, setFlyActive] = useState(false);

  useEffect(() => {
    if (!visible) { setFlyActive(false); return; }
    if (seedsEarned <= 0) return;
    const t = setTimeout(() => {
      setFlyKey(k => k + 1);
      setFlyActive(true);
    }, 600);
    return () => clearTimeout(t);
  }, [visible, seedsEarned]);

  // Une particule par graine gagnée
  const particleCount = Math.max(1, seedsEarned);

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
          <Text style={styles.title}>Bravo !</Text>
          {challengeNumber > 0 && (
            <Text style={styles.subtitle}>
              {DIFFICULTY_LABELS[difficulty] ?? difficulty} — Défi {challengeNumber}
            </Text>
          )}

          {/* ── Stats — SOURCE ────────────────────────────────────────────── */}
          <View style={styles.statsRow} onLayout={onStatsLayout}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{formatTime(elapsedTime)}</Text>
              <Text style={styles.statLabel}>Temps</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statValue}>+{displayedGain} 🌱</Text>
              <Text style={styles.statLabel}>Graines</Text>
            </View>
          </View>

          {/* ── Record mondial ───────────────────────────────────────────── */}
          {isNewWorldRecord ? (
            <View style={styles.wrBanner}>
              <Text style={styles.wrBannerEmoji}>🌍🏆</Text>
              <View style={styles.wrBannerText}>
                <Text style={styles.wrBannerTitle}>Nouveau record mondial !</Text>
                <Text style={styles.wrBannerTime}>{formatTime(elapsedTime)}</Text>
                {previousRecordHolder && (
                  <Text style={styles.wrPreviousHolder}>Record battu de {previousRecordHolder}</Text>
                )}
              </View>
            </View>
          ) : worldRecord ? (
            <View style={styles.wrInfo}>
              <Text style={styles.wrInfoLabel}>🌍 Record mondial</Text>
              <Text style={styles.wrInfoTime}>{formatTime(worldRecord.timeMs)}</Text>
              <Text style={styles.wrInfoHolder}>par {worldRecord.username}</Text>
            </View>
          ) : null}

          {closestBadges.length > 0 && (
            <View style={styles.badgeProgressWrapper}>
              <BadgeProgressInline closestBadges={closestBadges} />
            </View>
          )}

          {goalJustCompleted && onChooseGoal && (
            <TouchableOpacity style={styles.goalBanner} onPress={onChooseGoal} activeOpacity={0.85}>
              <Text style={styles.goalBannerEmoji}>🎯</Text>
              <View style={styles.goalBannerText}>
                <Text style={styles.goalBannerTitle}>Objectif atteint !</Text>
                <Text style={styles.goalBannerSub}>Choisir un nouvel objectif →</Text>
              </View>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.btnPrimary} onPress={onNextChallenge} activeOpacity={0.8}>
            <Text style={styles.btnPrimaryText}>Défi suivant →</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnSecondary} onPress={onBackToMenu} activeOpacity={0.8}>
            <Text style={styles.btnSecondaryText}>Retour au menu</Text>
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

        </Animated.View>
      </Animated.View>

      <Confetti pieces={confettiPieces} />

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
