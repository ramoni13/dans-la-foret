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

interface VictoryModalProps {
  visible: boolean;
  elapsedTime: number;
  seedsEarned: number;
  difficulty: DifficultyLevel;
  challengeNumber: number;
  onNextChallenge: () => void;
  onBackToMenu: () => void;
  confettiPieces: ConfettiPiece[];
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
});
