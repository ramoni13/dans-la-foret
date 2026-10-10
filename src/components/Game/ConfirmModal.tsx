// ============================================================
// CONFIRM MODAL — Popup de confirmation générique
// Même style qu'AbandonConfirmModal, props configurables
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
import { Colors } from '../../constants/colors';

const native = Platform.OS !== 'web';

interface ConfirmModalProps {
  visible: boolean;
  icon?: string;                // emoji Unicode, ex: '\uD83C\uDF31'
  iconBg?: string;              // couleur fond cercle icône
  iconBorder?: string;          // couleur bordure cercle icône
  borderColor?: string;         // couleur bordure card
  title: string;
  message: string;
  confirmLabel: string;         // bouton principal (action)
  confirmDestructive?: boolean; // rouge si vrai
  cancelLabel?: string;         // bouton annuler (optionnel)
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  visible,
  icon = '\u26A0\uFE0F',
  iconBg = '#FFF3E0',
  iconBorder = '#FFE0B2',
  borderColor = '#FF9800',
  title,
  message,
  confirmLabel,
  confirmDestructive = false,
  cancelLabel = 'Annuler',
  onConfirm,
  onCancel,
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
          style={[styles.card, { borderColor, transform: [{ scale: scaleAnim }] }]}
        >
          {/* Icône */}
          <Animated.View style={[styles.iconContainer, { backgroundColor: iconBg, borderColor: iconBorder }]}>
            <Text style={styles.iconText}>{icon}</Text>
          </Animated.View>

          <Text style={[styles.title, { color: borderColor === '#FF9800' ? '#E65100' : borderColor }]}>
            {title}
          </Text>
          <Text style={styles.message}>{message}</Text>

          {/* Bouton principal */}
          <TouchableOpacity
            style={[
              styles.btnConfirm,
              confirmDestructive ? styles.btnDestructive : styles.btnPrimary,
            ]}
            onPress={onConfirm}
            activeOpacity={0.8}
          >
            <Text style={styles.btnConfirmText}>{confirmLabel}</Text>
          </TouchableOpacity>

          {/* Bouton annuler */}
          <TouchableOpacity
            style={styles.btnCancel}
            onPress={onCancel}
            activeOpacity={0.8}
          >
            <Text style={styles.btnCancelText}>{cancelLabel}</Text>
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
    elevation: 16,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 2,
  },
  iconText: {
    fontSize: 40,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
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
  btnConfirm: {
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 32,
    width: '100%',
    alignItems: 'center',
    marginBottom: 10,
  },
  btnPrimary: {
    backgroundColor: Colors.forest.medium,
  },
  btnDestructive: {
    backgroundColor: '#C62828',
  },
  btnConfirmText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  btnCancel: {
    paddingVertical: 10,
  },
  btnCancelText: {
    color: Colors.ui.textLight,
    fontSize: 14,
    fontWeight: '500',
  },
});
