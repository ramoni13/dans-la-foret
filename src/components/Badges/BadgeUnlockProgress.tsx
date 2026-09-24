// ============================================================
// BADGEUNLOCKPROGRESS — Barres de progression par rareté
// Affiche les paliers de déblocage de contenu
// ============================================================

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';

import {
  BadgeRarity,
  RARITY_UNLOCKS,
  BADGE_DEFINITIONS,
  BADGE_MAP,
} from '../../constants/badges';
import { Colors } from '../../constants/colors';

interface BadgeUnlockProgressProps {
  earnedBadges: string[];
  unlockedBonuses: string[];
  unlockedThemes: string[];
}

const RARITY_ORDER: BadgeRarity[] = ['bois', 'pierre', 'or', 'cristal'];

const RARITY_LABELS: Record<BadgeRarity, string> = {
  bois:    '🟤 Bois',
  pierre:  '⚪ Pierre',
  or:      '🟡 Or',
  cristal: '💎 Cristal',
};

const RARITY_COLORS: Record<BadgeRarity, string> = {
  bois:    Colors.badges.bois,
  pierre:  Colors.badges.pierre,
  or:      Colors.badges.or,
  cristal: Colors.badges.cristal,
};

const UNLOCK_ICONS: Record<string, string> = {
  seeds_10:           '🌱',
  seeds_50:           '🌱',
  bonus_instinct:     '🔴',
  bonus_flash:        '⚡',
  theme_automne:      '🍂',
  theme_hiver:        '❄️',
  theme_foret_mystique: '🌙',
  mode_zen:           '🧘',
  defi_journalier:    '📅',
  niveau_14:          '🔓',
  avatar_esprit:      '🌿',
};

export const BadgeUnlockProgress: React.FC<BadgeUnlockProgressProps> = ({
  earnedBadges,
  unlockedBonuses,
  unlockedThemes,
}) => {
  // Compter les badges par rareté
  const earnedSet = new Set(earnedBadges);
  const rarityCount: Record<BadgeRarity, number> = { bois: 0, pierre: 0, or: 0, cristal: 0 };
  const totalByRarity: Record<BadgeRarity, number> = { bois: 0, pierre: 0, or: 0, cristal: 0 };

  for (const badge of BADGE_DEFINITIONS) {
    totalByRarity[badge.rarity]++;
    if (earnedSet.has(badge.id)) rarityCount[badge.rarity]++;
  }

  // Vérifie si un unlock est déjà débloqué
  function isUnlocked(unlockId: string): boolean {
    if (unlockId === 'bonus_instinct') return unlockedBonuses.includes('instinct');
    if (unlockId === 'bonus_flash')    return unlockedBonuses.includes('flash');
    if (unlockId === 'theme_automne')  return unlockedThemes.includes('automne');
    if (unlockId === 'theme_hiver')    return unlockedThemes.includes('hiver');
    if (unlockId === 'theme_foret_mystique') return unlockedThemes.includes('foret_mystique');
    // Les autres (seeds, modes) sont considérés débloqués si le seuil est atteint
    const unlock = RARITY_UNLOCKS.find(u => u.unlock === unlockId);
    if (!unlock) return false;
    return rarityCount[unlock.rarity] >= unlock.count;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Déblocages par rareté</Text>

      {RARITY_ORDER.map(rarity => {
        const count = rarityCount[rarity];
        const total = totalByRarity[rarity];
        const unlocks = RARITY_UNLOCKS.filter(u => u.rarity === rarity);
        const color = RARITY_COLORS[rarity];
        const pct   = total > 0 ? count / total : 0;
        const maxUnlock = unlocks.reduce((m, u) => Math.max(m, u.count), 0);

        if (unlocks.length === 0) return null;

        return (
          <View key={rarity} style={styles.raritySection}>
            {/* Header rareté */}
            <View style={styles.rarityHeader}>
              <Text style={[styles.rarityLabel, { color }]}>{RARITY_LABELS[rarity]}</Text>
              <Text style={styles.rarityCount}>{count}/{total}</Text>
            </View>

            {/* Barre de progression */}
            <View style={styles.bar}>
              <View style={[styles.barFill, { width: `${pct * 100}%`, backgroundColor: color }]} />
              {/* Marqueurs de paliers */}
              {unlocks.map(u => (
                <View
                  key={u.unlock}
                  style={[
                    styles.marker,
                    {
                      left: `${(u.count / Math.max(maxUnlock, total)) * 100}%`,
                      backgroundColor: isUnlocked(u.unlock) ? color : Colors.ui.border,
                    },
                  ]}
                />
              ))}
            </View>

            {/* Paliers */}
            {unlocks.map(u => {
              const unlocked = isUnlocked(u.unlock);
              const remaining = Math.max(0, u.count - count);
              return (
                <View key={u.unlock} style={styles.unlockRow}>
                  <Text style={styles.unlockIcon}>{UNLOCK_ICONS[u.unlock] ?? '🎁'}</Text>
                  <View style={styles.unlockInfo}>
                    <Text style={[styles.unlockLabel, unlocked && styles.unlockLabelDone]}>
                      {u.count} badges → {u.label}
                    </Text>
                    {!unlocked && (
                      <Text style={styles.unlockRemaining}>
                        encore {remaining} badge{remaining > 1 ? 's' : ''}
                      </Text>
                    )}
                  </View>
                  <Text style={styles.unlockStatus}>{unlocked ? '✅' : '🔒'}</Text>
                </View>
              );
            })}
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 20,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.forest.dark,
  },
  raritySection: {
    backgroundColor: Colors.ui.card,
    borderRadius: 16,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.ui.border,
  },
  rarityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rarityLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  rarityCount: {
    fontSize: 12,
    color: Colors.ui.textLight,
    fontWeight: '600',
  },
  bar: {
    height: 8,
    backgroundColor: Colors.ui.border,
    borderRadius: 4,
    overflow: 'visible',
    position: 'relative',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
    position: 'absolute',
    left: 0,
    top: 0,
  },
  marker: {
    position: 'absolute',
    top: -2,
    width: 3,
    height: 12,
    borderRadius: 2,
    marginLeft: -1.5,
  },
  unlockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  unlockIcon: {
    fontSize: 16,
    width: 22,
    textAlign: 'center',
  },
  unlockInfo: {
    flex: 1,
    gap: 1,
  },
  unlockLabel: {
    fontSize: 12,
    color: Colors.ui.text,
    fontWeight: '500',
  },
  unlockLabelDone: {
    color: Colors.forest.medium,
    fontWeight: '700',
  },
  unlockRemaining: {
    fontSize: 11,
    color: Colors.ui.textLight,
  },
  unlockStatus: {
    fontSize: 14,
  },
});
