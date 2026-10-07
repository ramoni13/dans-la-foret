// ============================================================
// ABANDON CONFIRM MODAL — Confirmation d'abandon (mode Normal)
// Affiché quand le joueur veut quitter un défi en cours
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

interface AbandonConfirmModalProps {
  visible: boolean;
  onContinue: () => void;   // Ferme le modal, le joueur reprend
  onAbandon: () => void;    // Confirme l'abandon
}

export const AbandonConfirmModal: React.FC<AbandonConfirmModalProps> = ({
  visible,
  onContinue,
  onAbandon,
}) => {
  const scaleAnim   = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      scaleAnim.setValue(0);
      opacityAnim.setValue(0);

      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          damping: 12,
          stiffness: 200,
          useNativeDriver: native,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 180,
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
          style={[styles.card, { transform: [{ scale: scaleAnim }] }]}
        >
          {/* Icône warning ambre */}
          <Animated.View style={styles.iconContainer}>
            <Text style={styles.iconText}>{'\u26A0\uFE0F'}</Text>
          </Animated.View>

          <Text style={styles.title}>Abandonner ce defi ?</Text>
          <Text style={styles.message}>
            Le chrono ne s'arretera pas. Tu pourras retenter ce defi dans 30 minutes.
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
    borderColor: '#FF9800',
    elevation: 16,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFF3E0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#FFE0B2',
  },
  iconText: {
    fontSize: 40,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#E65100',
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
