// ============================================================
// PremiumCard — Modale de présentation de l'offre premium
//
// Affiche le pitch "Soutenir la forêt + avantages" et le bouton
// d'achat. Pour l'instant l'achat appelle directement unlockPremium()
// dans le store. TODO : brancher RevenueCat IAP ici.
// ============================================================

import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../constants/colors';
import { useT } from '../../i18n';
import { subscribeForetCommune } from '../../services/foretCommuneService';

const IMG_1_1 = require('../../../assets/elements/design_app/1-1.jpg');

export interface PremiumCardProps {
  visible: boolean;
  onClose: () => void;
  /** Appelé au tap sur "Débloquer". TODO : brancher RevenueCat IAP. */
  onPurchase: () => void;
}

const PERKS = [
  { emoji: '🎁', label: 'premium_perk1', free: 'premium_bonus_limit', premium: '∞' },
  { emoji: '🔴', label: 'premium_perk2', free: 'premium_bonus_limit', premium: '∞' },
  { emoji: '🏅', label: 'premium_perk3', free: null, premium: '✓' },
] as const;

export function PremiumCard({ visible, onClose, onPurchase }: PremiumCardProps) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const [totalTrees, setTotalTrees] = useState(0);

  useEffect(() => {
    if (!visible) return;
    const unsub = subscribeForetCommune(({ totalTrees: trees }) => setTotalTrees(trees));
    return () => unsub();
  }, [visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent={Platform.OS === 'android'}
    >
      {/* Overlay — tap pour fermer */}
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        {/* Carte centrale — stoppe la propagation du tap */}
        <TouchableOpacity
          style={[styles.card, { marginBottom: Math.max(insets.bottom, 16) }]}
          activeOpacity={1}
          onPress={() => {}}
        >
          {/* Bouton fermer */}
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.closeBtnText}>×</Text>
          </TouchableOpacity>

          <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
            {/* Titre */}
            <Text style={styles.mainEmoji}>🌲</Text>
            <Text style={styles.title}>{t('premium_title')}</Text>

            {/* Image 1-1 */}
            <Image source={IMG_1_1} style={styles.img11} resizeMode="cover" />

            {/* Bloc ONF */}
            <View style={styles.onfBlock}>
              <Text style={styles.onfText}>{t('premium_onf_line1')}</Text>
              <Text style={styles.onfText}>{t('premium_onf_line2')}</Text>
              <View style={styles.treesCounterRow}>
                <Text style={styles.treesCounterEmoji}>🌳</Text>
                <Text style={styles.treesCounterNumber}>{totalTrees.toLocaleString()}</Text>
                <Text style={styles.treesCounterLabel}>{t('premium_trees_planted')}</Text>
              </View>
            </View>

            <View style={styles.challengeQuota}>
              <Text style={styles.challengeQuotaTitle}>{t('premium_challenge_quota_title')}</Text>
              <Text style={styles.challengeQuotaLine}>{t('premium_challenge_quota_free')}</Text>
              <Text style={styles.challengeQuotaLine}>{t('premium_challenge_quota_video')}</Text>
              <Text style={[styles.challengeQuotaLine, styles.challengeQuotaPremium]}>
                {t('premium_challenge_quota_premium')}
              </Text>
              <Text style={styles.challengeQuotaNote}>{t('premium_challenge_quota_note')}</Text>
            </View>

            {/* Séparateur */}
            <View style={styles.separator} />

            {/* Tableau comparatif Free / Premium */}
            <Text style={styles.avantagesTitle}>{t('premium_intro')}</Text>
            <View style={styles.table}>
              {/* En-tête */}
              <View style={[styles.tableRow, styles.tableHeader]}>
                <View style={styles.colLabel} />
                <View style={styles.colFree}>
                  <Text style={styles.headerFree}>{t('premium_free_header')}</Text>
                </View>
                <View style={styles.colPremium}>
                  <Text style={styles.headerPremium}>{t('premium_header')}</Text>
                </View>
              </View>
              {/* Lignes */}
              {PERKS.map((perk, i) => (
                <View key={i} style={[styles.tableRow, i % 2 === 1 && styles.tableRowAlt]}>
                  <View style={styles.colLabel}>
                    <Text style={styles.perkEmoji}>{perk.emoji}</Text>
                    <Text style={styles.perkLabel}>{t(perk.label)}</Text>
                  </View>
                  <View style={styles.colFree}>
                    <Text style={styles.cellFree}>{perk.free ? t(perk.free) : '—'}</Text>
                  </View>
                  <View style={styles.colPremium}>
                    <Text style={styles.cellPremium}>{perk.premium}</Text>
                  </View>
                </View>
              ))}
            </View>

            {/* Bouton achat */}
            {/* TODO : remplacer onPurchase par l'appel RevenueCat IAP */}
            <TouchableOpacity
              style={styles.purchaseBtn}
              onPress={onPurchase}
              activeOpacity={0.85}
            >
              <Text style={styles.purchaseBtnText}>{t('premium_buy')}</Text>
            </TouchableOpacity>

            {/* Mention légale */}
            <Text style={styles.legalText}>{t('premium_mention')}</Text>
          </ScrollView>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: Colors.forest.dark,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 380,
    borderWidth: 1.5,
    borderColor: 'rgba(139,195,74,0.4)',
    // Ombre portée
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 12,
  },
  closeBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  closeBtnText: {
    color: '#fff',
    fontSize: 20,
    lineHeight: 22,
    fontWeight: '700',
  },
  mainEmoji: {
    fontSize: 44,
    textAlign: 'center',
    marginTop: 8,
  },
  title: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 8,
  },
  img11: {
    width: 149,
    height: 50,
    borderRadius: 10,
    marginTop: 16,
    alignSelf: 'center',
  },
  onfBlock: {
    backgroundColor: 'rgba(139,195,74,0.15)',
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
  },
  challengeQuota: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(139,195,74,0.45)',
    padding: 14,
    marginTop: 14,
    gap: 8,
  },
  challengeQuotaTitle: {
    color: Colors.forest.accent,
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 2,
  },
  challengeQuotaLine: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 19,
  },
  challengeQuotaPremium: {
    color: Colors.forest.accent,
  },
  challengeQuotaNote: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 2,
  },
  onfText: {
    color: Colors.forest.accent,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 20,
  },
  treesCounterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 10,
  },
  treesCounterEmoji: {
    fontSize: 18,
  },
  treesCounterNumber: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
  },
  treesCounterLabel: {
    color: 'rgba(255,255,255,0.70)',
    fontSize: 13,
    fontWeight: '500',
  },
  separator: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.12)',
    marginVertical: 18,
  },
  avantagesTitle: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 10,
  },

  // Tableau comparatif
  table: {
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 8,
  },
  tableHeader: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingVertical: 7,
  },
  tableRowAlt: {
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  colLabel: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  colFree: {
    width: 46,
    alignItems: 'center',
  },
  colPremium: {
    width: 56,
    alignItems: 'center',
  },
  headerFree: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 11,
    fontWeight: '600',
  },
  headerPremium: {
    color: '#8BC34A',
    fontSize: 11,
    fontWeight: '700',
  },
  perkEmoji: {
    fontSize: 16,
    width: 22,
    textAlign: 'center',
  },
  perkLabel: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
  },
  cellFree: {
    color: 'rgba(255,255,255,0.40)',
    fontSize: 12,
    fontWeight: '600',
  },
  cellPremium: {
    color: '#8BC34A',
    fontSize: 14,
    fontWeight: '800',
  },
  purchaseBtn: {
    marginTop: 22,
    backgroundColor: Colors.forest.accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  purchaseBtnText: {
    color: Colors.forest.dark,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  legalText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
});
