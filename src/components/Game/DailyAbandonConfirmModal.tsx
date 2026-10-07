// ============================================================
// DAILY ABANDON CONFIRM MODAL — Confirmation d'abandon (mode Journalier)
// Plus severe que le mode Normal : abandon = echec definitif
// ============================================================

import React, { useEffect, useRef } from 'react';
import {
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
  Platform,
} from 'react-native';

const native = Platform.OS !== 'web';
import { Colors } from '../../constants/colors';

interface DailyAbandonConfirmModalProps {
  visible: boolean;
  onContinue: () => void;   // Ferme le modal, le joueur reprend
  onAbandon: () => void;    // Confirme l'abandon (= echec)
}

export const DailyAbandonConfirmModal: React.FC<DailyAbandonConfirmModalProps> = ({
  visible,
  onContinue,
  onAbandon,
}) => {
  const scaleAnim   = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const shakeAnim   = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      scaleAnim.setValue(0);
      opacityAnim.setValue(0);
      shakeAnim.setValue(0);

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
          Animated.timing(shakeAnim, { toValue: 8,  duration: 50, useNativeDriver: native }),
          Animated.timing(shakeAnim, { toValue: -8, duration: 50, useNativeDriver: native }),
          Animated.timing(shakeAnim, { toValue: 4,  duration: 40, useNativeDriver: native }),
          Animated.timing(shakeAnim, { toValue: -4, duration: 40, useNativeDriver: native }),
          Animated.timing(shakeAnim, { toValue: 0,  duration: 30, useNativeDriver: native }),
        ]),
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
          style={[styles.card, { transform: [{ scale: scaleAnim }] }]}
        >
          {/* Icone warning rouge */}
          <Animated.View
            style={[styles.iconContainer, { transform: [{ translateX: shakeAnim }] }]}
          >
            <Text style={styles.iconText}>{'\u26D4'}</Text>
          </Animated.View>

          <Text style={styles.title}>Quitter le Defi du Jour ?</Text>
          <Text style={styles.message}>
            Tu ne pourras plus retenter ce defi. Il sera compte comme un echec.
          </Text>

          {/* Actions */}
          <TouchableOpacity
            style={styles.btnContinue}
            onPress={onContinue}
            activeOpacity={0.8}
          >
            <Text style={styles.btnContinueText}>Continuer a jouer</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.btnAbandon}
            onPress={onAbandon}
            activeOpacity={0.8}
          >
            <Text style={styles.btnAbandonText}>Abandonner</Text>
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
    elevation: 16,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFEBEE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#FFCDD2',
  },
  iconText: {
    fontSize: 40,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#C62828',
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: 15,
    color: Colors.ui.textLight,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  btnContinue: {
    backgroundColor: Colors.forest.medium,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 32,
    width: '100%',
    alignItems: 'center',
    marginBottom: 10,
  },
  btnContinueText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  btnAbandon: {
    paddingVertical: 10,
  },
  btnAbandonText: {
    color: '#F44336',
    fontSize: 14,
    fontWeight: '500',
  },
});
