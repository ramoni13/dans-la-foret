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
  /** Les badges objectifs actifs avec leur progression */
  closestBadges: BadgeProgress[];
  /** IDs des badges obtenus ce tour — affichés avec ✓ et barre pleine */
  obtainedBadgeIds?: string[];
  /** IDs des nouveaux objectifs injectés par l'auto-avance — affichés avec badge "Nouveau" */
  newGoalBadgeIds?: string[];
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
  obtainedBadgeIds = [],
  newGoalBadgeIds = [],
  onPress,
}) => {
  if (closestBadges.length === 0) return null;

  const obtainedSet  = new Set(obtainedBadgeIds);
  const newGoalSet   = new Set(newGoalBadgeIds);

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={onPress ? 0.75 : 1}
    >
      {closestBadges.map((item, index) => {
        const badge = BADGE_MAP[item.badgeId];
        if (!badge) return null;
        const isObtained  = obtainedSet.has(item.badgeId);
        const isNew       = newGoalSet.has(item.badgeId);
        const rarityColor = RARITY_COLORS[badge.rarity] ?? Colors.ui.textLight;
        // Progression directe depuis goalCounters (toujours depuis 0)
        const relCurrent   = isNew ? 0 : item.currentValue;
        const relTarget    = Math.max(1, item.targetValue);
        const pct          = isObtained ? 1 : isNew ? 0 : Math.min(relCurrent / relTarget, 1);

        return (
          <View key={item.badgeId} style={index > 0 ? styles.separator : undefined}>
            <View style={styles.header}>
              <Text style={styles.emoji}>{badge.emoji}</Text>
              <View style={styles.labelBlock}>
                <View style={styles.titleRow}>
                  <Text style={styles.title} numberOfLines={1}>{badge.label}</Text>
                  {isNew && (
                    <View style={styles.newBadge}>
                      <Text style={styles.newBadgeText}>Nouveau</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.desc} numberOfLines={1}>{badge.description}</Text>
              </View>
              {isObtained
                ? <Text style={styles.obtained}>✓</Text>
                : <Text style={styles.counter}>{relCurrent}/{relTarget}</Text>
              }
            </View>
            <View style={styles.bar}>
              <View
                style={[
                  styles.barFill,
                  { width: `${pct * 100}%`, backgroundColor: isObtained ? '#4CAF50' : rarityColor },
                ]}
              />
            </View>
          </View>
        );
      })}

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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.forest.dark,
    flexShrink: 1,
  },
  newBadge: {
    backgroundColor: '#2E7D32',
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  newBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.3,
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
  obtained: {
    fontSize: 16,
    fontWeight: '800',
    color: '#4CAF50',
  },
  separator: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.ui.border,
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
