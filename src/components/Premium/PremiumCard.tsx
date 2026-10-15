// ============================================================
// PremiumCard — Modale de présentation de l'offre premium
//
// Affiche le pitch "Soutenir la forêt + avantages" et le bouton
// d'achat. Pour l'instant l'achat appelle directement unlockPremium()
// dans le store. TODO : brancher RevenueCat IAP ici.
// ============================================================

import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../constants/colors';

export interface PremiumCardProps {
  visible: boolean;
  onClose: () => void;
  /** Appelé au tap sur "Débloquer". TODO : brancher RevenueCat IAP. */
  onPurchase: () => void;
}

const AVANTAGES: { emoji: string; text: string }[] = [
  { emoji: '🤝', text: 'Défi entre amis : 3/jour -> illimité' },
  { emoji: '🌲', text: 'Mode ONF : 3/jour -> illimité' },
  { emoji: '💡', text: 'Bonus Cases Valides : 3/jour -> illimité' },
  { emoji: '🔴', text: 'Bonus Instinct : 3/jour -> illimité' },
  { emoji: '🏅', text: 'Badge exclusif "Ami de la Forêt"' },
];

export function PremiumCard({ visible, onClose, onPurchase }: PremiumCardProps) {
  const insets = useSafeAreaInsets();

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
            <Text style={styles.title}>Soutenir la forêt</Text>

            {/* Bloc ONF */}
            <View style={styles.onfBlock}>
              <Text style={styles.onfText}>
                1 € de ton achat est reversé à l'ONF
              </Text>
              <Text style={styles.onfText}>
                pour planter de vrais arbres en France 🇫🇷
              </Text>
            </View>

            {/* Séparateur */}
            <View style={styles.separator} />

            {/* Avantages */}
            <Text style={styles.avantagesTitle}>
              En passant en premium, tu débloques :
            </Text>
            {AVANTAGES.map((a, i) => (
              <View key={i} style={styles.avantageRow}>
                <Text style={styles.avantageEmoji}>{a.emoji}</Text>
                <Text style={styles.avantageText}>{a.text}</Text>
              </View>
            ))}

            {/* Bouton achat */}
            {/* TODO : remplacer onPurchase par l'appel RevenueCat IAP */}
            <TouchableOpacity
              style={styles.purchaseBtn}
              onPress={onPurchase}
              activeOpacity={0.85}
            >
              <Text style={styles.purchaseBtnText}>Débloquer — 2,99 €</Text>
            </TouchableOpacity>

            {/* Mention légale */}
            <Text style={styles.legalText}>
              Paiement unique · Sans abonnement
            </Text>
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
  onfBlock: {
    backgroundColor: 'rgba(139,195,74,0.15)',
    borderRadius: 12,
    padding: 12,
    marginTop: 16,
  },
  onfText: {
    color: Colors.forest.accent,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 20,
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
    marginBottom: 12,
  },
  avantageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  avantageEmoji: {
    fontSize: 20,
    width: 28,
    textAlign: 'center',
  },
  avantageText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
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
