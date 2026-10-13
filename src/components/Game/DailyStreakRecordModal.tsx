// ============================================================
// DAILY STREAK RECORD MODAL
// Affichee quand le joueur bat son record de serie journaliere.
// Montre le nouveau record + graines gagnees + feu d'artifice.
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

import { Colors } from '../../constants/colors';
import { useConfetti, Confetti } from './Confetti';

const native = Platform.OS !== 'web';

interface DailyStreakRecordModalProps {
  visible: boolean;
  newRecord: number;   // nouveau record (nb de jours)
  seedsAwarded: number; // graines offertes = newRecord
  onClose: () => void;
}

export const DailyStreakRecordModal: React.FC<DailyStreakRecordModalProps> = ({
  visible,
  newRecord,
  seedsAwarded,
  onClose,
}) => {
  const scaleAnim   = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const bounceAnim  = useRef(new Animated.Value(1)).current;
  const confettiPieces = useConfetti(visible);

  useEffect(() => {
    if (visible) {
      scaleAnim.setValue(0.7);
      opacityAnim.setValue(0);

      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          damping: 10,
          stiffness: 180,
          useNativeDriver: native,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: native,
        }),
      ]).start(() => {
        // Pulsation du nombre de graines
        Animated.loop(
          Animated.sequence([
            Animated.timing(bounceAnim, { toValue: 1.15, duration: 500, useNativeDriver: native }),
            Animated.timing(bounceAnim, { toValue: 1,    duration: 500, useNativeDriver: native }),
          ]),
          { iterations: 4 }
        ).start();
      });
    } else {
      scaleAnim.setValue(0.7);
      opacityAnim.setValue(0);
      bounceAnim.setValue(1);
    }
  }, [visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Animated.View style={[styles.backdrop, { opacity: opacityAnim }]}>

        {/* Feu d'artifice */}
        <Confetti pieces={confettiPieces} />

        <Animated.View style={[styles.card, { transform: [{ scale: scaleAnim }] }]}>

          {/* Icone */}
          <View style={styles.iconContainer}>
            <Text style={styles.iconText}>{'\uD83D\uDD25'}</Text>
          </View>

          <Text style={styles.title}>Nouveau record !</Text>

          {/* Série */}
          <View style={styles.recordBadge}>
            <Text style={styles.recordNumber}>{newRecord}</Text>
            <Text style={styles.recordLabel}>
              {newRecord > 1 ? 'jours de serie' : 'jour de serie'}
            </Text>
          </View>

          {/* Graines offertes */}
          <View style={styles.seedsRow}>
            <Text style={styles.seedsLabel}>Graines offertes</Text>
            <Animated.View style={[styles.seedsBadge, { transform: [{ scale: bounceAnim }] }]}>
              <Text style={styles.seedsIcon}>{'\uD83C\uDF31'}</Text>
              <Text style={styles.seedsValue}>+{seedsAwarded}</Text>
            </Animated.View>
          </View>

          <Text style={styles.message}>
            Continue ta serie pour battre ton propre record !
          </Text>

          <TouchableOpacity style={styles.btn} onPress={onClose} activeOpacity={0.8}>
            <Text style={styles.btnText}>Super !</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.70)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  card: {
    backgroundColor: Colors.ui.card,
    borderRadius: 28,
    padding: 32,
    alignItems: 'center',
    width: '100%',
    maxWidth: 360,
    borderWidth: 3,
    borderColor: '#FF9800',
    elevation: 20,
    gap: 14,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFF3E0',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFE0B2',
  },
  iconText: { fontSize: 40 },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: '#E65100',
    textAlign: 'center',
  },
  recordBadge: {
    backgroundColor: '#FFF3E0',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 28,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFE0B2',
    width: '100%',
  },
  recordNumber: {
    fontSize: 48,
    fontWeight: '900',
    color: '#E65100',
    lineHeight: 56,
  },
  recordLabel: {
    fontSize: 14,
    color: '#BF360C',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  seedsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    backgroundColor: Colors.ui.seed + '18',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: Colors.ui.seed + '44',
  },
  seedsLabel: {
    fontSize: 14,
    color: Colors.ui.textLight,
    fontWeight: '600',
  },
  seedsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.ui.seed + '22',
    borderRadius: 10,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  seedsIcon: { fontSize: 18 },
  seedsValue: {
    fontSize: 20,
    fontWeight: '900',
    color: Colors.forest.dark,
  },
  message: {
    fontSize: 13,
    color: Colors.ui.textLight,
    textAlign: 'center',
    lineHeight: 19,
  },
  btn: {
    backgroundColor: Colors.forest.medium,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 40,
    alignItems: 'center',
    width: '100%',
  },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
