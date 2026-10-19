// ============================================================
// ONF CARD UNLOCK BANNER — Pavé "carte débloquée" affiché par-dessus
// la VictoryModal dans onf.tsx via un second Modal RN.
// ============================================================

import React, { useEffect } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
} from 'react-native-reanimated';
import { Confetti, useConfetti } from '../Game/Confetti';
import { TreeCard } from '../../data/treesData';
import { TreeCardView } from './TreeCardView';
import { useT } from '../../i18n';

// ── Props ─────────────────────────────────────────────────────────────────────
interface ONFCardUnlockBannerProps {
  card: TreeCard;
  onDiscover: () => void;
  onClose: () => void;
}

// ── Composant ─────────────────────────────────────────────────────────────────
export function ONFCardUnlockBanner({ card, onDiscover, onClose }: ONFCardUnlockBannerProps) {
  const t = useT();
  const scale = useSharedValue(0);
  const confettiPieces = useConfetti(true);

  useEffect(() => {
    // Apparition avec ressort : 0 → 1.08 → 1.0 avec délai 400ms
    scale.value = withDelay(
      400,
      withSequence(
        withSpring(1.08, { damping: 10, stiffness: 200 }),
        withSpring(1.0,  { damping: 14, stiffness: 300 }),
      ),
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      {/* Confettis par-dessus le fond semi-transparent */}
      <Confetti pieces={confettiPieces} />

      <View style={styles.overlay}>
        <Animated.View style={[styles.banner, animatedStyle]}>
          {/* Titre */}
          <Text style={styles.title}>{t('onf_card_unlocked')}</Text>

          {/* Carte mini centrée */}
          <View style={styles.cardWrapper}>
            <TreeCardView tree={card} size="mini" startFlipped={false} />
          </View>

          {/* Bouton Découvrir */}
          <TouchableOpacity
            style={styles.discoverBtn}
            onPress={onDiscover}
            activeOpacity={0.85}
          >
            <Text style={styles.discoverBtnText}>{t('onf_card_discover')}</Text>
          </TouchableOpacity>

          {/* Bouton continuer (ferme le banner sans ouvrir la galerie) */}
          <TouchableOpacity
            style={styles.continueBtn}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <Text style={styles.continueBtnText}>{t('onf_card_continue')}</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  overlay: {
    flex:            1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems:      'center',
    justifyContent:  'center',
    padding:         24,
  },
  banner: {
    backgroundColor: '#1A3C1A',
    borderRadius:    16,
    borderWidth:     2,
    borderColor:     '#C9A84C',
    padding:         24,
    alignItems:      'center',
    width:           '100%',
    maxWidth:        340,
    gap:             16,
  },
  title: {
    fontSize:   20,
    fontWeight: '800',
    color:      '#FFFFFF',
    textAlign:  'center',
  },
  cardWrapper: {
    width:  150,
    height: 240,
  },
  discoverBtn: {
    backgroundColor: '#4CAF50',
    borderRadius:    12,
    paddingVertical: 12,
    paddingHorizontal: 32,
    width:           '100%',
    alignItems:      'center',
  },
  discoverBtnText: {
    fontSize:   16,
    fontWeight: '700',
    color:      '#FFFFFF',
  },
  continueBtn: {
    paddingVertical: 6,
  },
  continueBtnText: {
    fontSize: 13,
    color:    'rgba(255,255,255,0.55)',
  },
});
