// ============================================================
// BADGEPROGRESS INLINE — Mini-barre de progression badge
// Affichée dans la VictoryModal : badge le plus proche d'être obtenu
// ============================================================

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';

import { BADGE_MAP, BadgeRarity } from '../../constants/badges';
import { BadgeProgress } from '../../core/engine/badgeEngine';
import { Colors } from '../../constants/colors';

interface BadgeProgressInlineProps {
  /** Les badges les plus proches (de getClosestBadges) */
  closestBadges: BadgeProgress[];
  onPress?: () => void; // Tap → ouvre la collection complète
}

const RARITY_COLORS: Record<BadgeRarity, string> = {
  bois:    Colors.badges.bois,
  pierre:  Colors.badges.pierre,
  or:      Colors.badges.or,
  cristal: Colors.badges.cristal,
};

export const BadgeProgressInline: React.FC<BadgeProgressInlineProps> = ({
  closestBadges,
  onPress,
}) => {
  if (closestBadges.length === 0) return null;

  // Afficher uniquement le premier (le plus proche)
  const top = closestBadges[0];
  const badge = BADGE_MAP[top.badgeId];
  if (!badge) return null;

  const rarityColor = RARITY_COLORS[badge.rarity] ?? Colors.ui.textLight;
  const pct = Math.min(top.percentage, 1);

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={onPress ? 0.75 : 1}
    >
      <View style={styles.header}>
        <Text style={styles.emoji}>{badge.emoji}</Text>
        <View style={styles.labelBlock}>
          <Text style={styles.title} numberOfLines={1}>{badge.label}</Text>
          <Text style={styles.desc} numberOfLines={1}>{badge.description}</Text>
        </View>
        <Text style={styles.counter}>{top.currentValue}/{top.targetValue}</Text>
      </View>

      {/* Barre de progression */}
      <View style={styles.bar}>
        <View
          style={[
            styles.barFill,
            { width: `${pct * 100}%`, backgroundColor: rarityColor },
          ]}
        />
      </View>

      {onPress && (
        <Text style={styles.cta}>Voir tous mes badges →</Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.ui.background,
    borderRadius: 14,
    padding: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.ui.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  emoji: {
    fontSize: 22,
  },
  labelBlock: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.forest.dark,
  },
  desc: {
    fontSize: 11,
    color: Colors.ui.textLight,
  },
  counter: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.ui.textLight,
  },
  bar: {
    height: 6,
    backgroundColor: Colors.ui.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
  },
  cta: {
    fontSize: 11,
    color: Colors.forest.medium,
    fontWeight: '600',
    textAlign: 'right',
  },
});
