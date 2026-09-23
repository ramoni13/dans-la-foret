// ============================================================
// VICTORYMODAL — Écran de victoire animé
// ============================================================

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
  Platform,
} from 'react-native';

const native = Platform.OS !== 'web';

import { formatTime } from '../../utils/boardUtils';
import { Colors } from '../../constants/colors';
import { DifficultyLevel } from '../../core/models/Challenge';
import { notificationSuccess } from '../../utils/haptics';
import { useConfetti, Confetti, ConfettiPiece } from './Confetti';
import { BadgeProgressInline } from '../Badges/BadgeProgressInline';
import { BadgeToast } from '../Badges/BadgeToast';
import { BadgeProgress } from '../../core/engine/badgeEngine';
import { WorldRecord } from '../../services/worldRecordService';

interface VictoryModalProps {
  visible: boolean;
  elapsedTime: number;
  seedsEarned: number;
  difficulty: DifficultyLevel;
  challengeNumber: number;
  onNextChallenge: () => void;
  onBackToMenu: () => void;
  confettiPieces: ConfettiPiece[];
  /** Badges les plus proches d'être débloqués (fournis par badgeEngine) */
  closestBadges?: BadgeProgress[];
  /** File de badges à notifier via toast (rendu dans le Modal pour passer au-dessus) */
  badgeQueue?: string[];
  onBadgeQueueEmpty?: () => void;
  /** Record mondial actuel au moment de la victoire (null = aucun record existant) */
  worldRecord?: WorldRecord | null;
  /** true = le joueur vient de battre (ou créer) le record mondial */
  isNewWorldRecord?: boolean;
}

// Libelles pour chaque niveau
const DIFFICULTY_LABELS: Partial<Record<DifficultyLevel, string>> = {
  niveau_1:  '🌱 Niveau 1',
  niveau_2:  '🌿 Niveau 2',
  niveau_3:  '🌳 Niveau 3',
  niveau_4:  '🦊 Niveau 4',
  niveau_5:  '🏕️ Niveau 5',
  niveau_6:  '🌲 Niveau 6',
  niveau_7:  '🐺 Niveau 7',
  niveau_8:  '🏔️ Niveau 8',
  niveau_9:  '🏹 Niveau 9',
  niveau_10: '🐽 Niveau 10',
  niveau_11: '🏔️ Niveau 11',
  niveau_12: '⚡ Niveau 12',
  niveau_13: '💀 Niveau 13',
};

export const VictoryModal: React.FC<VictoryModalProps> = ({
  visible,
  elapsedTime,
  seedsEarned,
  difficulty,
  challengeNumber,
  onNextChallenge,
  onBackToMenu,
  confettiPieces,
  closestBadges = [],
  badgeQueue = [],
  onBadgeQueueEmpty,
  worldRecord = null,
  isNewWorldRecord = false,
}) => {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // Retour haptique victoire (mobile uniquement, no-op sur web)
      notificationSuccess();
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          damping: 12,
          stiffness: 150,
          useNativeDriver: native,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: native,
        }),
      ]).start();
    } else {
      scaleAnim.setValue(0);
      opacityAnim.setValue(0);
    }
  }, [visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
    >
      <Animated.View style={[styles.backdrop, { opacity: opacityAnim }]}>
        <Animated.View
          style={[
            styles.card,
            { transform: [{ scale: scaleAnim }] },
          ]}
        >
          {/* Titre */}
          <Text style={styles.emoji}>🎉</Text>
          <Text style={styles.title}>Bravo !</Text>
          <Text style={styles.subtitle}>
            {DIFFICULTY_LABELS[difficulty] ?? difficulty} — Défi {challengeNumber}
          </Text>

          {/* Stats */}
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{formatTime(elapsedTime)}</Text>
              <Text style={styles.statLabel}>Temps</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statValue}>+{seedsEarned} 🌱</Text>
              <Text style={styles.statLabel}>Graines</Text>
            </View>
          </View>

          {/* Record mondial */}
          {isNewWorldRecord ? (
            <View style={styles.wrBanner}>
              <Text style={styles.wrBannerEmoji}>🌍🏆</Text>
              <View style={styles.wrBannerText}>
                <Text style={styles.wrBannerTitle}>Nouveau record mondial !</Text>
                <Text style={styles.wrBannerTime}>{formatTime(elapsedTime)}</Text>
              </View>
            </View>
          ) : worldRecord ? (
            <View style={styles.wrInfo}>
              <Text style={styles.wrInfoLabel}>🌍 Record mondial</Text>
              <Text style={styles.wrInfoTime}>{formatTime(worldRecord.timeMs)}</Text>
              <Text style={styles.wrInfoHolder}>par {worldRecord.username}</Text>
            </View>
          ) : null}

          {/* Progression badge la plus proche */}
          {closestBadges.length > 0 && (
            <View style={styles.badgeProgressWrapper}>
              <BadgeProgressInline closestBadges={closestBadges} />
            </View>
          )}

          {/* Actions */}
          <TouchableOpacity
            style={styles.btnPrimary}
            onPress={onNextChallenge}
            activeOpacity={0.8}
          >
            <Text style={styles.btnPrimaryText}>Défi suivant →</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.btnSecondary}
            onPress={onBackToMenu}
            activeOpacity={0.8}
          >
            <Text style={styles.btnSecondaryText}>Retour au menu</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>

      {/* Confettis dans le Modal — après la carte pour être au-dessus */}
      <Confetti pieces={confettiPieces} />

      {/* Toasts de badge — dans le Modal pour passer au-dessus du backdrop */}
      {badgeQueue.length > 0 && onBadgeQueueEmpty && (
        <BadgeToast
          queue={badgeQueue}
          onQueueEmpty={onBadgeQueueEmpty}
        />
      )}
    </Modal>
  );
};

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
  },
  emoji: {
    fontSize: 56,
    marginBottom: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: Colors.forest.dark,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.ui.textLight,
    marginBottom: 24,
  },
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
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.forest.dark,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.ui.textLight,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 36,
    backgroundColor: Colors.ui.border,
    marginHorizontal: 8,
  },
  btnPrimary: {
    backgroundColor: Colors.forest.medium,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 32,
    width: '100%',
    alignItems: 'center',
    marginBottom: 10,
  },
  btnPrimaryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  btnSecondary: {
    paddingVertical: 10,
  },
  btnSecondaryText: {
    color: Colors.ui.textLight,
    fontSize: 14,
  },
  badgeProgressWrapper: {
    width: '100%',
    marginBottom: 16,
  },
  // ── Record mondial ──────────────────────────────────────────
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
  wrBannerEmoji: {
    fontSize: 28,
  },
  wrBannerText: {
    flex: 1,
  },
  wrBannerTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.badges.or,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  wrBannerTime: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.forest.dark,
  },
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
  wrInfoLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.ui.textLight,
    flex: 1,
  },
  wrInfoTime: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.forest.dark,
  },
  wrInfoHolder: {
    fontSize: 11,
    color: Colors.ui.textLight,
    maxWidth: 100,
  },
});
