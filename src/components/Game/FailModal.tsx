// ============================================================
// FAILMODAL — Écran d'échec animé (grande croix rouge)
// Affiché quand le joueur valide un défi incorrect
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
import { Colors } from '../../constants/colors';
import { notificationError } from '../../utils/haptics';

interface FailModalProps {
  visible: boolean;
  errorCount: number;
  totalCells: number;
  showErrorCount: boolean; // bonus count_errors activé
  onRetry: () => void;     // Ferme le modal, le joueur continue
  onGiveUp: () => void;    // Retour au menu
}

export const FailModal: React.FC<FailModalProps> = ({
  visible,
  errorCount,
  totalCells,
  showErrorCount,
  onRetry,
  onGiveUp,
}) => {
  const scaleAnim   = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const shakeAnim   = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // Reset
      scaleAnim.setValue(0);
      opacityAnim.setValue(0);
      shakeAnim.setValue(0);

      // Retour haptique échec (mobile uniquement, no-op sur web)
      notificationError();

      // Apparition + shake
      Animated.sequence([
        Animated.parallel([
          Animated.spring(scaleAnim, {
            toValue: 1,
            damping: 10,
            stiffness: 180,
            useNativeDriver: native,
          }),
          Animated.timing(opacityAnim, {
            toValue: 1,
            duration: 180,
            useNativeDriver: native,
          }),
        ]),
        Animated.sequence([
          Animated.timing(shakeAnim, { toValue: 12,  duration: 60, useNativeDriver: native }),
          Animated.timing(shakeAnim, { toValue: -12, duration: 60, useNativeDriver: native }),
          Animated.timing(shakeAnim, { toValue: 8,   duration: 50, useNativeDriver: native }),
          Animated.timing(shakeAnim, { toValue: -8,  duration: 50, useNativeDriver: native }),
          Animated.timing(shakeAnim, { toValue: 0,   duration: 40, useNativeDriver: native }),
        ]),
      ]).start();
    } else {
      scaleAnim.setValue(0);
      opacityAnim.setValue(0);
    }
  }, [visible]);

  // Message selon le nombre d'erreurs
  const getMessage = () => {
    if (!showErrorCount) return 'Ce n\'est pas tout à fait ça…';
    if (errorCount === 1) return '1 case incorrecte !';
    return `${errorCount} cases incorrectes !`;
  };

  const getEmoji = () => {
    if (!showErrorCount) return '❌';
    if (errorCount <= 2) return '😅';
    if (errorCount <= 5) return '😬';
    return '😰';
  };

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
          {/* Grande croix animée */}
          <Animated.View
            style={[
              styles.crossContainer,
              { transform: [{ translateX: shakeAnim }] },
            ]}
          >
            <Text style={styles.crossText}>✕</Text>
          </Animated.View>

          <Text style={styles.emoji}>{getEmoji()}</Text>
          <Text style={styles.title}>Pas encore…</Text>
          <Text style={styles.message}>{getMessage()}</Text>

          {/* Barre de progression erreurs (si bonus actif) */}
          {showErrorCount && (
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${Math.round(((totalCells - errorCount) / totalCells) * 100)}%`,
                    },
                  ]}
                />
              </View>
              <Text style={styles.progressLabel}>
                {totalCells - errorCount}/{totalCells} cases correctes
              </Text>
            </View>
          )}

          {/* Actions */}
          <TouchableOpacity
            style={styles.btnRetry}
            onPress={onRetry}
            activeOpacity={0.8}
          >
            <Text style={styles.btnRetryText}>Continuer à jouer</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.btnGiveUp}
            onPress={onGiveUp}
            activeOpacity={0.8}
          >
            <Text style={styles.btnGiveUpText}>Abandonner</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
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
    borderWidth: 3,
    borderColor: '#F44336',
    boxShadow: '0px 8px 32px rgba(244,67,54,0.35)' as any,
    elevation: 16,
  },
  crossContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#F44336',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  crossText: {
    fontSize: 52,
    color: '#fff',
    fontWeight: '900',
    lineHeight: 60,
  },
  emoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#F44336',
    marginBottom: 8,
  },
  message: {
    fontSize: 16,
    color: Colors.ui.textLight,
    textAlign: 'center',
    marginBottom: 20,
  },
  progressContainer: {
    width: '100%',
    marginBottom: 20,
    alignItems: 'center',
    gap: 6,
  },
  progressBar: {
    width: '100%',
    height: 10,
    backgroundColor: '#F4433622',
    borderRadius: 5,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.forest.medium,
    borderRadius: 5,
  },
  progressLabel: {
    fontSize: 13,
    color: Colors.ui.textLight,
    fontWeight: '600',
  },
  btnRetry: {
    backgroundColor: Colors.forest.medium,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 32,
    width: '100%',
    alignItems: 'center',
    marginBottom: 10,
  },
  btnRetryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  btnGiveUp: {
    paddingVertical: 10,
  },
  btnGiveUpText: {
    color: '#F44336',
    fontSize: 14,
    fontWeight: '500',
  },
});
