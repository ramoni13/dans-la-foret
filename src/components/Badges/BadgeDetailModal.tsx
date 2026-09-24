// ============================================================
// BADGEDETAILMODAL — Fiche de détail d'un badge (bottom sheet)
// S'affiche au tap sur une BadgeCard dans BadgeCollection.
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
  ScrollView,
} from 'react-native';

import { BadgeDefinition, BadgeRarity, getBadgeTexts } from '../../constants/badges';
import { Colors } from '../../constants/colors';
import { useT } from '../../i18n';
import { usePlayerStore } from '../../store/playerStore';

const native = Platform.OS !== 'web';

interface BadgeDetailModalProps {
  badge: BadgeDefinition | null;
  earned: boolean;
  earnedAt?: string;
  progress?: number;   // 0–1
  progressLabel?: string;
  onClose: () => void;
}

const RARITY_COLORS: Record<BadgeRarity, string> = {
  bois:    Colors.badges.bois,
  pierre:  Colors.badges.pierre,
  or:      Colors.badges.or,
  cristal: Colors.badges.cristal,
};

const RARITY_BG: Record<BadgeRarity, string> = {
  bois:    Colors.badges.boisBg,
  pierre:  Colors.badges.pierreBg,
  or:      Colors.badges.orBg,
  cristal: Colors.badges.cristalBg,
};

// Clés i18n pour la rareté
const RARITY_KEYS: Record<BadgeRarity, string> = {
  bois:    'rarity_bois',
  pierre:  'rarity_pierre',
  or:      'rarity_or',
  cristal: 'rarity_cristal',
};

// Clés i18n pour les catégories
const CATEGORY_KEYS: Record<string, string> = {
  vitesse:      'cat_vitesse',
  precision:    'cat_precision',
  regularite:   'cat_regularite',
  social:       'cat_social',
  amelioration: 'cat_amelioration',
  exploration:  'cat_exploration',
  secret:       'cat_secret',
  saisonnier:   'cat_saisonnier',
};

export const BadgeDetailModal: React.FC<BadgeDetailModalProps> = ({
  badge,
  earned,
  earnedAt,
  progress = 0,
  progressLabel,
  onClose,
}) => {
  const t = useT();
  const language = usePlayerStore(state => state.language);
  const slideAnim = useRef(new Animated.Value(400)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  const visible = badge !== null;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: native,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          damping: 18,
          stiffness: 220,
          useNativeDriver: native,
        }),
      ]).start();
    } else {
      slideAnim.setValue(400);
      opacityAnim.setValue(0);
    }
  }, [visible]);

  if (!badge) return null;

  const isSecret    = badge.isSecret && !earned;
  const rarityColor = RARITY_COLORS[badge.rarity];
  const bgColor     = earned ? RARITY_BG[badge.rarity] : Colors.badges.pierreBg;
  const texts       = getBadgeTexts(badge, language);

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: native,
      }),
      Animated.timing(slideAnim, {
        toValue: 400,
        duration: 200,
        useNativeDriver: native,
      }),
    ]).start(() => onClose());
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      {/* Backdrop */}
      <Animated.View style={[styles.backdrop, { opacity: opacityAnim }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill as any} onPress={handleClose} activeOpacity={1} />
      </Animated.View>

      {/* Sheet */}
      <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
        {/* Handle */}
        <View style={styles.handle} />

        <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
          {/* Emoji + rareté */}
          <View style={[styles.emojiContainer, { backgroundColor: bgColor }]}>
            <Text style={[styles.emoji, { opacity: earned ? 1 : 0.4 }]}>
              {isSecret ? '❓' : badge.emoji}
            </Text>
            <View style={[styles.rarityBadge, { backgroundColor: rarityColor + '25', borderColor: rarityColor }]}>
              <Text style={[styles.rarityText, { color: rarityColor }]}>
                {t(RARITY_KEYS[badge.rarity])}
              </Text>
            </View>
          </View>

          {/* Nom */}
          <Text style={styles.label}>
            {isSecret ? t('badge_secret_label') : texts.label}
          </Text>

          {/* Catégorie */}
          <Text style={styles.category}>
            {t(CATEGORY_KEYS[badge.category] ?? badge.category)}
            {badge.isSeasonal && ' ' + t('badge_seasonal_flag')}
          </Text>

          {/* Description */}
          <View style={styles.descriptionBox}>
            <Text style={styles.descriptionTitle}>{t('badge_condition')}</Text>
            <Text style={styles.descriptionText}>
              {isSecret ? t('badge_secret_desc') : texts.description}
            </Text>
          </View>

          {/* Statut : obtenu ou progression */}
          {earned ? (
            <View style={[styles.statusBox, { backgroundColor: rarityColor + '15', borderColor: rarityColor + '40' }]}>
              <Text style={[styles.statusEmoji]}>✅</Text>
              <View style={styles.statusText}>
                <Text style={[styles.statusTitle, { color: rarityColor }]}>{t('badge_earned')}</Text>
                {earnedAt && (
                  <Text style={styles.statusDate}>
                    Le {new Date(earnedAt).toLocaleDateString('fr-FR', {
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </Text>
                )}
              </View>
            </View>
          ) : !isSecret && (
            <View style={styles.progressBox}>
              <View style={styles.progressHeader}>
                <Text style={styles.progressTitle}>{t('badge_progress')}</Text>
                {progressLabel && (
                  <Text style={[styles.progressValue, { color: rarityColor }]}>{progressLabel}</Text>
                )}
              </View>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${Math.min(Math.round(progress * 100), 100)}%`,
                      backgroundColor: rarityColor,
                    },
                  ]}
                />
              </View>
              <Text style={styles.progressPercent}>{Math.round(progress * 100)} %</Text>
            </View>
          )}
        </ScrollView>

        {/* Bouton fermer */}
        <TouchableOpacity style={styles.closeBtn} onPress={handleClose} activeOpacity={0.8}>
          <Text style={styles.closeBtnText}>{t('badge_close')}</Text>
        </TouchableOpacity>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.ui.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 32,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 20,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: Colors.ui.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  emojiContainer: {
    alignItems: 'center',
    borderRadius: 20,
    paddingVertical: 24,
    marginBottom: 16,
    gap: 10,
  },
  emoji: {
    fontSize: 64,
    lineHeight: 72,
  },
  rarityBadge: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  rarityText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  label: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.forest.dark,
    textAlign: 'center',
    marginBottom: 4,
  },
  category: {
    fontSize: 12,
    color: Colors.ui.textLight,
    textAlign: 'center',
    marginBottom: 20,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  descriptionBox: {
    backgroundColor: Colors.forest.light + '12',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: Colors.forest.medium,
  },
  descriptionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.forest.medium,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  descriptionText: {
    fontSize: 15,
    color: Colors.forest.dark,
    lineHeight: 22,
  },
  statusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    gap: 12,
    marginBottom: 8,
  },
  statusEmoji: {
    fontSize: 28,
  },
  statusText: {
    flex: 1,
  },
  statusTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  statusDate: {
    fontSize: 12,
    color: Colors.ui.textLight,
    marginTop: 2,
  },
  progressBox: {
    backgroundColor: Colors.ui.background,
    borderRadius: 14,
    padding: 16,
    marginBottom: 8,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.forest.dark,
  },
  progressValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  progressBar: {
    height: 8,
    backgroundColor: Colors.ui.border,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressPercent: {
    fontSize: 11,
    color: Colors.ui.textLight,
    textAlign: 'right',
  },
  closeBtn: {
    marginTop: 16,
    backgroundColor: Colors.forest.medium,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  closeBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
