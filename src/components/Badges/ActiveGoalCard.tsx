// ============================================================
// ACTIVEGOALCARD — Carte d'objectif de badge actif
// Affiche : emoji, nom, description, barre de progression,
// current/target en texte.
// Utilisée dans la section Badges du profil.
// ============================================================

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BADGE_MAP, getBadgeTexts } from '../../constants/badges';
import { BadgeProgress } from '../../core/engine/badgeEngine';
import { Colors } from '../../constants/colors';
import { useT } from '../../i18n';
import { usePlayerStore } from '../../store/playerStore';

const RARITY_COLOR: Record<string, string> = {
  bois:    Colors.badges.bois,
  pierre:  Colors.badges.pierre,
  or:      Colors.badges.or,
  cristal: Colors.badges.cristal,
};

interface ActiveGoalCardProps {
  progress: BadgeProgress;
  obtained?: boolean; // true si le badge vient d'être obtenu
}

export const ActiveGoalCard: React.FC<ActiveGoalCardProps> = ({ progress, obtained }) => {
  const t = useT();
  const language = usePlayerStore(s => s.language);
  const badge = BADGE_MAP[progress.badgeId];
  if (!badge) return null;

  const texts = getBadgeTexts(badge, language);
  const rarityColor = RARITY_COLOR[badge.rarity] ?? Colors.forest.medium;

  // Progression directe depuis goalCounters (toujours depuis 0)
  const relCurrent = Math.max(0, progress.currentValue);
  const relTarget  = Math.max(1, progress.targetValue);
  const pct = Math.min(1, Math.max(0, relCurrent / relTarget));

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.emoji}>{badge.emoji}</Text>
        <View style={styles.textBlock}>
          <Text style={styles.label} numberOfLines={1}>{texts.label}</Text>
          <Text style={styles.description} numberOfLines={2}>{texts.description}</Text>
        </View>
        {obtained && (
          <Text style={styles.obtained}>✓</Text>
        )}
      </View>

      {/* Barre de progression */}
      <View style={styles.barTrack}>
        <View
          style={[styles.barFill, { width: `${pct * 100}%` as any, backgroundColor: rarityColor }]}
        />
      </View>

      <Text style={styles.progressText}>
        {obtained
          ? t('badge_goal_obtained')
          : `${relCurrent} / ${progress.targetValue}`}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.ui.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.ui.border,
    padding: 12,
    gap: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  emoji: {
    fontSize: 28,
    width: 36,
    textAlign: 'center',
  },
  textBlock: {
    flex: 1,
    gap: 2,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.forest.dark,
  },
  description: {
    fontSize: 11,
    color: Colors.ui.textLight,
    lineHeight: 15,
  },
  obtained: {
    fontSize: 20,
    color: '#4CAF50',
    fontWeight: '800',
  },
  barTrack: {
    height: 6,
    backgroundColor: Colors.ui.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 11,
    color: Colors.ui.textLight,
    textAlign: 'right',
  },

});
