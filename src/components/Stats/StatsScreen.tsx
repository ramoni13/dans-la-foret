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

import { Colors } from '../../constants/colors';
import { usePlayerStore } from '../../store/playerStore';
import { useT } from '../../i18n';
import { formatTime } from '../../utils/boardUtils';
import { buildStatsView } from '../../constants/playerStats';
import { PineconeIcon } from '../Game/PineconeIcon';
import { PINECONE_TOKEN } from '../../constants/pinecone';

/** Icône de carte : emoji, ou pomme de pin dorée si c'est le jeton [pp]. */
const CardIcon: React.FC<{ emoji: string; size: number }> = ({ emoji, size }) =>
  emoji === PINECONE_TOKEN
    ? <PineconeIcon size={size + 4} variant="gold" />
    : <Text style={{ fontSize: size }}>{emoji}</Text>;

interface CardProps {
  emoji: string;
  label: string;
  value: string;
}

const StatCard: React.FC<CardProps> = ({ emoji, label, value }) => (
  <View style={styles.card} accessible accessibilityLabel={`${label} : ${value}`}>
    <CardIcon emoji={emoji} size={24} />
    <Text style={styles.cardValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
    <Text style={styles.cardLabel}>{label}</Text>
  </View>
);

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>{title}</Text>
    <View style={styles.grid}>{children}</View>
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
      <Section title={t('stats_block_solo')}>
        <StatCard emoji="🧩" label={t('stats_solved')} value={String(solo.solved)} />
        <StatCard emoji={PINECONE_TOKEN} label={t('stats_three_stars')} value={String(solo.perfect)} />
        {solo.fastestMs !== null && (
          <StatCard emoji="⚡" label={t('stats_fastest')} value={formatTime(solo.fastestMs)} />
        )}
      </Section>

      <Section title={t('stats_block_modes')}>
        <StatCard emoji="📅" label={t('stats_daily')} value={`${modes.dailyWon} / ${modes.dailyPlayed}`} />
        <StatCard emoji="🔥" label={t('stats_daily_record')} value={String(modes.dailyStreakRecord)} />
        <StatCard emoji="🌲" label={t('stats_onf')} value={String(modes.onfSolved)} />
        <StatCard emoji="🤝" label={t('stats_duel')} value={`${modes.duelWins} / ${modes.duelPlayed}`} />
      </Section>

      <Section title={t('stats_block_regularity')}>
        <StatCard emoji="🗓️" label={t('stats_days_played')} value={String(regularity.daysPlayed)} />
        <StatCard emoji="📆" label={t('stats_loyalty')} value={String(regularity.loyaltyBest)} />
      </Section>
    </View>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { gap: 22 },
  section: { gap: 10 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#FFF8E7', letterSpacing: 0.3 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: {
    flex: 1, minWidth: '45%', backgroundColor: Colors.ui.card, borderRadius: 14, padding: 14, alignItems: 'center',
    borderWidth: 1, borderColor: Colors.ui.border, gap: 4,
  },
  cardValue: { fontSize: 21, fontWeight: '800', color: Colors.forest.dark, maxWidth: '100%' },
  cardLabel: { fontSize: 11, color: Colors.ui.textLight, textAlign: 'center' },
});