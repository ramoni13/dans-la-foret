// ============================================================
// STATS SCREEN — statistiques du joueur, version simplifiée
//
// Trois blocs (voir constants/playerStats.ts, `buildStatsView`) :
//   1. Défis solo     : défis résolus, défis parfaits, défi le plus rapide
//   2. Autres modes   : Défi du jour (gagnés, record de série), Forestier, défis entre amis
//   3. Régularité     : jours joués, record de jours d'affilée
//
// Uniquement des valeurs qui se comprennent sans explication et qui ne sont pas déjà affichées ailleurs (graines,
// pommes de pin totales, chapitre, trophées, Herbier et série en cours sont sur l'accueil et le profil).
// ============================================================

import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ForestColors } from '../../theme/forestTheme';
import { usePlayerStore } from '../../store/playerStore';
import { useT } from '../../i18n';
import { formatTime } from '../../utils/boardUtils';
import { buildStatsView } from '../../constants/playerStats';

interface CardProps {
  label: string;
  value: string;
}

const StatRow: React.FC<CardProps> = ({ label, value }) => (
  <View style={styles.row} accessible accessibilityLabel={`${label} : ${value}`}>
    <Text style={styles.label}>{label}</Text>
    <Text style={styles.value}>{value}</Text>
  </View>
);

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>{title}</Text>
    <View>{children}</View>
  </View>
);

// ── Écran ────────────────────────────────────────────────────────────────────

export const StatsScreen: React.FC = () => {
  const t = useT();
  const player = usePlayerStore();

  const view = useMemo(() => buildStatsView({
    stats: player.stats,
    challengeStars: player.challengeStars,
    onfSolvedCount: player.onfSolvedCount,
    longestDailyChallengeStreak: player.longestDailyChallengeStreak,
    loyaltyBest: player.loyaltyBest,
  }), [player.stats, player.challengeStars, player.onfSolvedCount, player.longestDailyChallengeStreak, player.loyaltyBest]);

  const { solo, modes, regularity } = view;

  return (
    <View style={styles.root}>
      <Text style={styles.title}>{t('profile_section_stats')}</Text>
      <Section title={t('stats_block_solo')}>
        <StatRow label={t('stats_solved')} value={String(solo.solved)} />
        <StatRow label={t('stats_three_stars')} value={String(solo.perfect)} />
        {solo.fastestMs !== null && (
          <StatRow label={t('stats_fastest')} value={formatTime(solo.fastestMs)} />
        )}
      </Section>

      <Section title={t('stats_block_modes')}>
        <StatRow label={t('stats_daily')} value={`${modes.dailyWon} / ${modes.dailyPlayed}`} />
        <StatRow label={t('stats_daily_record')} value={String(modes.dailyStreakRecord)} />
        <StatRow label={t('stats_onf')} value={String(modes.onfSolved)} />
        <StatRow label={t('stats_duel')} value={`${modes.duelWins} / ${modes.duelPlayed}`} />
      </Section>

      <Section title={t('stats_block_regularity')}>
        <StatRow label={t('stats_days_played')} value={String(regularity.daysPlayed)} />
        <StatRow label={t('stats_loyalty')} value={String(regularity.loyaltyBest)} />
      </Section>
    </View>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { gap: 12, marginTop: 8, paddingHorizontal: 8 },
  title: { color: ForestColors.textOnDark, fontSize: 16, fontWeight: '700' },
  section: { gap: 3 },
  sectionTitle: { color: ForestColors.parchmentDark, fontSize: 13, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, paddingVertical: 3 },
  label: { flex: 1, color: ForestColors.textOnDark, fontSize: 13 },
  value: { color: ForestColors.textOnDark, fontSize: 13, fontWeight: '700' },
});