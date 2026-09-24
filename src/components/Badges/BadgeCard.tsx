// ============================================================
// BADGECARD — Carte badge individuelle
// États : obtenu / en cours (avec barre de progression) / secret
// ============================================================

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
} from 'react-native';

import { BadgeDefinition, BadgeRarity } from '../../constants/badges';
import { Colors } from '../../constants/colors';

const native = Platform.OS !== 'web';

interface BadgeCardProps {
  badge: BadgeDefinition;
  earned: boolean;
  earnedAt?: string;       // ISO date string optionnel
  progress?: number;       // 0–1, pour la barre (si non obtenu)
  progressLabel?: string;  // ex: "8/10"
  label?: string;          // label traduit (override badge.label)
  onPress?: () => void;
  animateOnMount?: boolean; // true = animation de débloquage
  size?: 'small' | 'normal';
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

const RARITY_LABELS: Record<BadgeRarity, string> = {
  bois:    '🟤 Bois',
  pierre:  '⚪ Pierre',
  or:      '🟡 Or',
  cristal: '💎 Cristal',
};

export const BadgeCard: React.FC<BadgeCardProps> = ({
  badge,
  earned,
  earnedAt,
  progress = 0,
  progressLabel,
  label,
  onPress,
  animateOnMount = false,
  size = 'normal',
}) => {
  const displayLabel = label ?? badge.label;
  const scaleAnim = useRef(new Animated.Value(animateOnMount ? 0 : 1)).current;
  const glowAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!animateOnMount) return;
    // Scale 0 → 1.2 → 1 (spring bounce)
    Animated.sequence([
      Animated.spring(scaleAnim, {
        toValue: 1.2,
        damping: 8,
        stiffness: 200,
        useNativeDriver: native,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        damping: 12,
        stiffness: 150,
        useNativeDriver: native,
      }),
    ]).start();

    // Glow pulsé pour les cristal
    if (badge.rarity === 'cristal') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, { toValue: 1, duration: 800, useNativeDriver: false }),
          Animated.timing(glowAnim, { toValue: 0, duration: 800, useNativeDriver: false }),
        ])
      ).start();
    }
  }, [animateOnMount]);

  const isSecret  = badge.isSecret && !earned;
  const cardSize  = size === 'small' ? 72 : 88;
  const emojiFontSize = size === 'small' ? 26 : 32;

  const rarityColor  = RARITY_COLORS[badge.rarity];
  const bgColor      = earned ? RARITY_BG[badge.rarity] : Colors.badges.pierreBg;
  const borderColor  = earned ? rarityColor : Colors.ui.border;
  const emojiOpacity = earned ? 1 : 0.35;

  const glowColor = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(33,150,243,0)', 'rgba(33,150,243,0.4)'],
  });

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={onPress ? 0.75 : 1}>
      <Animated.View
        style={[
          styles.card,
          { width: cardSize, borderColor, backgroundColor: bgColor },
          { transform: [{ scale: scaleAnim }] },
          badge.rarity === 'cristal' && earned && !native && { shadowColor: glowColor as any },
        ]}
      >
        {/* Emoji */}
        <Text style={[styles.emoji, { fontSize: emojiFontSize, opacity: emojiOpacity }]}>
          {isSecret ? '❓' : badge.emoji}
        </Text>

        {/* Barre de progression (si pas encore obtenu) */}
        {!earned && !isSecret && progress > 0 && (
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${Math.min(progress * 100, 100)}%`, backgroundColor: rarityColor }]} />
          </View>
        )}

        {/* Rareté */}
        <Text style={[styles.rarity, { color: rarityColor }]}>
          {isSecret ? '???'
            : size === 'small'
              ? badge.rarity
              : RARITY_LABELS[badge.rarity]}
        </Text>

        {/* Libellé de progression */}
        {!earned && progressLabel && (
          <Text style={styles.progressLabel}>{progressLabel}</Text>
        )}

        {/* Date d'obtention */}
        {earned && earnedAt && size !== 'small' && (
          <Text style={styles.earnedAt}>
            {new Date(earnedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
          </Text>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
    gap: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  emoji: {
    lineHeight: undefined,
  },
  progressBar: {
    width: '80%',
    height: 4,
    backgroundColor: Colors.ui.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  rarity: {
    fontSize: 8,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  progressLabel: {
    fontSize: 8,
    color: Colors.ui.textLight,
  },
  earnedAt: {
    fontSize: 8,
    color: Colors.ui.textLight,
  },
});
