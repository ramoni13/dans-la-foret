// ============================================================
// ACTIVEGOALCARD — Carte d'objectif de badge actif
// Affiche : emoji, nom, description, barre de progression,
// current/target en texte.
// Utilisée dans la section Badges du profil.
// ============================================================

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
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
  /** challengeId verrouillé pour amelioration_cycle / amelioration_fusee (ex: "niveau_3_007") */
  targetChallengeId?: string | null;
  /** Callback déclenché par le bouton Replay — navigation gérée par l'appelant */
  onReplay?: () => void;
}

/**
 * Décompose un challengeId du type "niveau_3_007" en "Niveau 3 · Défi 7"
 * Retourne null si le format n'est pas reconnu.
 */
function formatChallengeTarget(challengeId: string | null | undefined): string | null {
  if (!challengeId) return null;
  const match = challengeId.match(/^niveau_(\d+)_(\d+)$/);
  if (!match) return null;
  const level = match[1];
  const defi  = String(parseInt(match[2], 10)); // enlève les zéros devant
  return `Niveau ${level} · Défi ${defi}`;
}

export const ActiveGoalCard: React.FC<ActiveGoalCardProps> = ({ progress, obtained, targetChallengeId, onReplay }) => {
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

  const challengeLabel = formatChallengeTarget(targetChallengeId);
  // Si l'objectif nécessite un défi verrouillé mais qu'aucun n'est encore défini,
  // on indique au joueur qu'il doit jouer un défi solo pour activer le compteur.
  const isRetryBadge = progress.badgeId === 'amelioration_cycle' || progress.badgeId === 'amelioration_fusee';
  const pendingLockLabel = (isRetryBadge && !challengeLabel) ? t('badge_goal_any_solo') : null;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.emoji}>{badge.emoji}</Text>
        <View style={styles.textBlock}>
          <Text style={styles.label} numberOfLines={1}>{texts.label}</Text>
          <Text style={styles.description} numberOfLines={2}>{texts.description}</Text>
          {challengeLabel ? (
            <Text style={styles.challengeTarget}>{challengeLabel}</Text>
          ) : pendingLockLabel ? (
            <Text style={[styles.challengeTarget, styles.challengeTargetPending]}>{pendingLockLabel}</Text>
          ) : null}
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

      <View style={styles.footer}>
        <Text style={styles.progressText}>
          {obtained
            ? t('badge_goal_obtained')
            : `${relCurrent} / ${progress.targetValue}`}
        </Text>

        {/* Bouton Replay — visible uniquement si un défi est verrouillé et badge pas encore obtenu */}
        {onReplay && challengeLabel && !obtained && (
          <TouchableOpacity
            onPress={onReplay}
            style={styles.replayBtn}
            accessibilityLabel={t('badge_goal_replay')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.replayIcon}>↺</Text>
            <Text style={[styles.replayText, { color: rarityColor }]}>{t('badge_goal_replay')}</Text>
          </TouchableOpacity>
        )}
      </View>
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
  challengeTarget: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.forest.medium,
    marginTop: 2,
  },
  challengeTargetPending: {
    fontStyle: 'italic',
    color: Colors.ui.textLight,
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
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressText: {
    fontSize: 11,
    color: Colors.ui.textLight,
  },
  replayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: Colors.ui.border,
  },
  replayIcon: {
    fontSize: 14,
    color: Colors.forest.medium,
    lineHeight: 16,
  },
  replayText: {
    fontSize: 11,
    fontWeight: '700',
  },

});
