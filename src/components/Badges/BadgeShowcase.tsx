// ============================================================
// BADGESHOWCASE — Vitrine 3 badges (mode défi amis)
// Affiche les 3 badges choisis par le joueur pour sa carte identité
// ============================================================

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';

import { BADGE_MAP, BadgeRarity } from '../../constants/badges';
import { Colors } from '../../constants/colors';

interface BadgeShowcaseProps {
  /** Tableau de max 3 badge IDs. Les slots vides affichent un placeholder. */
  badgeIds: (string | undefined)[];
  /** Nom du joueur (affiché au-dessus si fourni) */
  playerName?: string;
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

export const BadgeShowcase: React.FC<BadgeShowcaseProps> = ({
  badgeIds,
  playerName,
  size = 'normal',
}) => {
  // Garantit exactement 3 slots
  const slots = [badgeIds[0], badgeIds[1], badgeIds[2]];
  const cardSize = size === 'small' ? 56 : 72;
  const emojiFontSize = size === 'small' ? 22 : 28;

  return (
    <View style={styles.container}>
      {playerName && (
        <Text style={styles.playerName}>{playerName}</Text>
      )}
      <View style={styles.row}>
        {slots.map((badgeId, idx) => {
          const badge = badgeId ? BADGE_MAP[badgeId] : null;
          const bgColor     = badge ? RARITY_BG[badge.rarity]    : Colors.ui.background;
          const borderColor = badge ? RARITY_COLORS[badge.rarity] : Colors.ui.border;

          return (
            <View
              key={idx}
              style={[
                styles.slot,
                { width: cardSize, height: cardSize, backgroundColor: bgColor, borderColor },
              ]}
            >
              {badge ? (
                <>
                  <Text style={{ fontSize: emojiFontSize }}>{badge.emoji}</Text>
                  <Text style={[styles.rarityDot, { color: borderColor }]}>•</Text>
                </>
              ) : (
                <Text style={styles.empty}>＋</Text>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 6,
  },
  playerName: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.ui.textLight,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  slot: {
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  rarityDot: {
    fontSize: 10,
    fontWeight: '900',
  },
  empty: {
    fontSize: 22,
    color: Colors.ui.border,
    fontWeight: '300',
  },
});
