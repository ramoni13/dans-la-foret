// ============================================================
// PLANT CARD MODAL — confirmation puis révélation d'une carte de l'Herbier
//
// Ouverte par un tap sur une silhouette de l'onglet « Planter » de `TreeCardGallery`.
//   1. « confirm » : rappel du coût et des graines du joueur, « Planter » / « Annuler ».
//      Aucune dépense tant que le joueur n'a pas confirmé.
//   2. « reveal »  : la plantation a réussi → feu d'artifice (`PineconeBurst`), la carte apparaît
//      en grand (`TreeCardView`, retournable d'un tap pour lire le verso), bouton « OK ».
//
// La plantation elle-même est faite par l'appelant (`onConfirm`) : ce composant n'écrit rien dans le store.
// Modale native IMBRIQUÉE dans la `Modal` de la galerie (rendue dans son arbre) : elle s'affiche par-dessus.
// « Réduire les animations » : pas de confettis, la carte apparaît en fondu.
// ============================================================

import React, { useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  LayoutChangeEvent,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { TreeCard } from '../../data/treesData';
import { TreeCardView } from './TreeCardView';
import { BurstShot, PineconeBurst } from '../Game/PineconeBurst';
import { notificationSuccess } from '../../utils/haptics';
import { useT } from '../../i18n';

export type PlantConfirmResult = { ok: true } | { ok: false; message: string };

interface PlantCardModalProps {
  /** Carte choisie (silhouette touchée). `null` = modale fermée. */
  card: TreeCard | null;
  cost: number;
  seeds: number;
  /** Plante la carte (store + synchronisation). Appelée une seule fois, au tap sur « Planter ». */
  onConfirm: (card: TreeCard) => PlantConfirmResult;
  onClose: () => void;
}

type Phase = 'confirm' | 'reveal';

export function PlantCardModal({ card, cost, seeds, onConfirm, onClose }: PlantCardModalProps) {
  const t = useT();
  const reduceMotion = useReducedMotion();
  const { width: screenW, height: screenH } = useWindowDimensions();

  const [phase, setPhase] = useState<Phase>('confirm');
  const [error, setError] = useState<string | null>(null);
  const [shots, setShots] = useState<BurstShot[]>([]);
  const [area, setArea] = useState({ w: screenW, h: screenH });

  const cardScale = useSharedValue(0.6);
  const cardOpacity = useSharedValue(0);

  // Chaque nouvelle carte repart de l'étape de confirmation.
  useEffect(() => {
    if (!card) return;
    setPhase('confirm');
    setError(null);
    setShots([]);
    cardScale.value = 0.6;
    cardOpacity.value = 0;
  }, [card?.id]);

  const canAfford = seeds >= cost;

  const handleConfirm = () => {
    if (!card || phase !== 'confirm') return;
    const result = onConfirm(card);
    if (!result.ok) {
      setError(result.message);
      AccessibilityInfo.announceForAccessibility(result.message);
      return;
    }
    setPhase('reveal');
    notificationSuccess();
    // Trois gerbes autour de la carte, échelonnées.
    const cx = area.w / 2;
    const cy = area.h * 0.42;
    const base = Date.now();
    setShots([
      { key: base, x: cx, y: cy - area.h * 0.18, radius: 130, count: 28 },
      { key: base + 1, x: cx - area.w * 0.3, y: cy, radius: 110, count: 24, delay: 180 },
      { key: base + 2, x: cx + area.w * 0.3, y: cy, radius: 110, count: 24, delay: 320 },
      { key: base + 3, x: cx, y: cy + area.h * 0.12, radius: 120, count: 22, delay: 480 },
    ]);
    if (reduceMotion) {
      cardScale.value = 1;
      cardOpacity.value = withTiming(1, { duration: 250 });
    } else {
      cardOpacity.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.quad) });
      cardScale.value = withSpring(1, { damping: 11, stiffness: 140 });
    }
    AccessibilityInfo.announceForAccessibility(t('herbier_reveal_title'));
  };

  const cardAnim = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [{ scale: cardScale.value }],
  }));

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setArea({ w: width, h: height });
  };

  // Carte en grand : ratio 300 × 480, bornée par la largeur et la hauteur disponibles.
  const cardH = Math.min(480, screenH * 0.58, (screenW - 48) * (480 / 300));
  const cardW = Math.round(cardH * (300 / 480));

  // Bouton retour Android : « Annuler » à la confirmation, « OK » à la révélation (la carte est déjà plantée).
  return (
    <Modal visible={card !== null} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop} onLayout={onLayout}>
        {card && phase === 'confirm' && (
          <View style={styles.dialog} accessibilityViewIsModal>
            <View style={styles.silhouette} accessible={false} importantForAccessibility="no">
              <Text style={styles.silhouetteEmoji}>🌳</Text>
              <Text style={styles.silhouetteMark}>?</Text>
            </View>
            <Text style={styles.title} accessibilityRole="header">{t('herbier_confirm_title')}</Text>
            <Text style={styles.body}>{t('herbier_confirm_body', { cost: String(cost) })}</Text>
            <Text style={[styles.balance, !canAfford && styles.balanceLow]}>
              {t('herbier_confirm_balance', { seeds: String(seeds) })}
            </Text>
            {(error || !canAfford) && (
              <Text style={styles.error} accessibilityLiveRegion="polite">
                {error ?? t('herbier_err_seeds', { cost: String(cost) })}
              </Text>
            )}
            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.btn, styles.btnSecondary]}
                onPress={onClose}
                accessibilityRole="button"
              >
                <Text style={styles.btnSecondaryText}>{t('herbier_confirm_cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, styles.btnPrimary, !canAfford && styles.btnDisabled]}
                onPress={handleConfirm}
                disabled={!canAfford}
                accessibilityRole="button"
                accessibilityState={{ disabled: !canAfford }}
                accessibilityLabel={t('herbier_confirm_plant_a11y', { cost: String(cost) })}
              >
                <Text style={styles.btnPrimaryText}>{t('herbier_confirm_plant', { cost: String(cost) })}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {card && phase === 'reveal' && (
          <View style={styles.reveal} accessibilityViewIsModal>
            <Text style={styles.revealTitle} accessibilityRole="header">{t('herbier_reveal_title')}</Text>
            <Animated.View style={[{ width: cardW, height: cardH }, cardAnim]}>
              <TreeCardView key={card.id} tree={card} size="normal" cardWidth={cardW} cardHeight={cardH} />
            </Animated.View>
            <Text style={styles.flipHint}>{t('gallery_flip_hint')}</Text>
            <TouchableOpacity
              style={[styles.btn, styles.btnPrimary, styles.okBtn]}
              onPress={onClose}
              accessibilityRole="button"
            >
              <Text style={styles.btnPrimaryText}>{t('herbier_reveal_ok')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Feu d'artifice par-dessus la carte, sans intercepter les taps */}
        {phase === 'reveal' && <PineconeBurst shots={shots} />}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(8,20,8,0.82)',
    alignItems: 'center', justifyContent: 'center', padding: 24,
  },

  dialog: {
    width: '100%', maxWidth: 360, backgroundColor: '#F5F0E8', borderRadius: 20,
    borderWidth: 2, borderColor: '#C9A84C', padding: 22, alignItems: 'center', gap: 10,
  },
  silhouette: {
    width: 92, height: 120, borderRadius: 14, backgroundColor: '#1A3A1A', borderWidth: 2, borderColor: '#C9A84C',
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  silhouetteEmoji: { fontSize: 44, opacity: 0.35 },
  silhouetteMark: { position: 'absolute', fontSize: 34, fontWeight: '900', color: '#C9A84C' },
  title: { fontSize: 20, fontWeight: '800', color: '#1A3C1A', textAlign: 'center' },
  body: { fontSize: 16, color: '#3A4B3A', textAlign: 'center', lineHeight: 22 },
  balance: { fontSize: 16, fontWeight: '700', color: '#2D6A2D' },
  balanceLow: { color: '#B23A2E' },
  error: { fontSize: 15, fontWeight: '700', color: '#B23A2E', textAlign: 'center' },

  actions: { flexDirection: 'row', gap: 10, marginTop: 8, alignSelf: 'stretch' },
  btn: { flex: 1, minHeight: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  btnPrimary: { backgroundColor: '#2D6A2D' },
  btnPrimaryText: { color: '#fff', fontSize: 16, fontWeight: '800', textAlign: 'center' },
  btnSecondary: { backgroundColor: 'rgba(0,0,0,0.07)' },
  btnSecondaryText: { color: '#3A4B3A', fontSize: 16, fontWeight: '700' },
  btnDisabled: { opacity: 0.45 },

  reveal: { alignItems: 'center', gap: 14 },
  revealTitle: { fontSize: 22, fontWeight: '800', color: '#F5EDD0', textAlign: 'center' },
  flipHint: { fontSize: 14, color: 'rgba(245,237,208,0.8)', textAlign: 'center' },
  okBtn: { flex: 0, minWidth: 160, paddingHorizontal: 32 },
});
