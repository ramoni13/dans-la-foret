// ============================================================
// MUSICUNLOCKMODAL — Popup de déblocage d'un titre musical
// Animée avec feu d'artifice (confettis) comme VictoryModal
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
import { useConfetti, Confetti } from '../Game/Confetti';
import { MUSIC_CATALOG } from '../../constants/music';

const native = Platform.OS !== 'web';

interface MusicUnlockModalProps {
  visible: boolean;
  trackId: string | null;
  onClose: () => void;
}

export const MusicUnlockModal: React.FC<MusicUnlockModalProps> = ({
  visible,
  trackId,
  onClose,
}) => {
  const scaleAnim   = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const confettiPieces = useConfetti(visible);

  const track = trackId ? MUSIC_CATALOG.find(t => t.id === trackId) : null;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          damping: 10,
          stiffness: 130,
          useNativeDriver: native,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: native,
        }),
      ]).start();
    } else {
      scaleAnim.setValue(0);
      opacityAnim.setValue(0);
    }
  }, [visible]);

  if (!track) return null;

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
          <Text style={styles.emoji}>🎵</Text>
          <Text style={styles.title}>Nouveau titre débloqué !</Text>
          <View style={styles.trackBadge}>
            <Text style={styles.trackTypeLabel}>
              {track.type === 'ingame' ? '🎮 Ambiance Défi' : '🌲 Ambiance Forêt'}
            </Text>
            <Text style={styles.trackTitle}>"{track.title}"</Text>
          </View>
          {track.description && (
            <Text style={styles.trackDesc}>{track.description}</Text>
          )}
          <Text style={styles.hint}>
            Tu peux le sélectionner dans ton profil → Musique
          </Text>
          <TouchableOpacity
            style={styles.btn}
            onPress={onClose}
            activeOpacity={0.8}
          >
            <Text style={styles.btnText}>Super ! 🎶</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>

      {/* Feu d'artifice */}
      <Confetti pieces={confettiPieces} />
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  card: {
    backgroundColor: Colors.ui.card,
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    width: '100%',
    maxWidth: 340,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 16,
    gap: 12,
  },
  emoji: {
    fontSize: 56,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.forest.dark,
    textAlign: 'center',
  },
  trackBadge: {
    backgroundColor: Colors.forest.light + '15',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    width: '100%',
    borderWidth: 1.5,
    borderColor: Colors.forest.light + '50',
    gap: 4,
  },
  trackTypeLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.ui.textLight,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  trackTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.forest.dark,
  },
  trackDesc: {
    fontSize: 13,
    color: Colors.ui.textLight,
    textAlign: 'center',
    lineHeight: 18,
  },
  hint: {
    fontSize: 12,
    color: Colors.ui.textLight,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  btn: {
    backgroundColor: Colors.forest.medium,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 32,
    width: '100%',
    alignItems: 'center',
    marginTop: 4,
  },
  btnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
