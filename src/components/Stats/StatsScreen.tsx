// ============================================================
// STATS SCREEN — menu Statistiques refondu (Lot D)
//
// Quatre blocs (voir constants/playerStats.ts, `buildStatsView`) :
//   1. Progression : pommes de pin, défis aux 3 pommes de pin, chapitre, trophées, Herbier
//   2. Solo        : défis résolus, bien joués, temps moyen PAR CHAPITRE, plus rapide
//   3. Modes       : Journalier (par ligue), Forestier (par palier), Duel (V / D, série)
//   4. Régularité  : séries, jours joués, graines, pubs
//
// Toutes les valeurs sont calculées par une fonction pure testée : l'écran n'affiche que ce qu'on lui donne
// (aucune valeur absente, aucun NaN). Chaque carte garde l'explication « ? » de l'ancien écran.
// ============================================================

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Colors } from '../../constants/colors';
import { usePlayerStore } from '../../store/playerStore';
import { useT } from '../../i18n';
import { formatTime } from '../../utils/boardUtils';
import { BADGE_MAP } from '../../constants/badges';
import { TOTAL_TREE_CARDS } from '../../utils/onfCards';
import { getAllOnfChallenges } from '../../services/onfChallengeService';
import { DAILY_LEAGUE_ORDER } from '../../constants/dailyLeagues';
import { ONF_TIER_ORDER } from '../../constants/onfTiers';
import { STAR_TOTAL } from '../../constants/leaderboardRank';
import { buildStatsView, countOnfByTier } from '../../constants/playerStats';
import { PineconeIcon, PineconeText } from '../Game/PineconeIcon';
import { PINECONE_TOKEN } from '../../constants/pinecone';

const native = Platform.OS !== 'web';

/** UTC `YYYY-MM-DD` du jour (même référence que les grilles du Journalier). */
function todayUtc(): string {
  return new Date().toISOString().split('T')[0];
}

// ── Carte avec explication ───────────────────────────────────────────────────

/** Icône de carte : emoji, ou pomme de pin dorée si c'est le jeton [pp]. */
const CardIcon: React.FC<{ emoji: string; size: number }> = ({ emoji, size }) =>
  emoji === PINECONE_TOKEN
    ? <PineconeIcon size={size + 4} variant="gold" />
    : <Text style={{ fontSize: size }}>{emoji}</Text>;

interface CardProps {
  emoji: string;
  label: string;
  value: string;
  hint?: string;
  wide?: boolean;
}

const StatCard: React.FC<CardProps> = ({ emoji, label, value, hint, wide }) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <TouchableOpacity
        style={[styles.card, wide && styles.cardWide]}
        onPress={hint ? () => setOpen(true) : undefined}
        activeOpacity={hint ? 0.7 : 1}
        accessibilityRole={hint ? 'button' : undefined}
        accessibilityLabel={`${label} : ${value}`}
      >
        <CardIcon emoji={emoji} size={24} />
        <Text style={styles.cardValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
        <View style={styles.labelRow}>
          <Text style={styles.cardLabel}>{label}</Text>
          {hint ? <View style={styles.hintBadge}><Text style={styles.hintIcon}>?</Text></View> : null}
        </View>
      </TouchableOpacity>
      {hint ? <HintModal visible={open} emoji={emoji} label={label} hint={hint} onClose={() => setOpen(false)} /> : null}
    </>
  );
};

const HintModal: React.FC<{ visible: boolean; emoji: string; label: string; hint: string; onClose: () => void }> = ({
  visible, emoji, label, hint, onClose,
}) => {
  const t = useT();
  const scale = useRef(new Animated.Value(0.85)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!visible) { scale.setValue(0.85); opacity.setValue(0); return; }
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, damping: 14, stiffness: 220, useNativeDriver: native }),
      Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: native }),
    ]).start();
  }, [visible]);
  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <Animated.View style={[styles.modalBackdrop, { opacity }]}>
        <Animated.View style={[styles.modalCard, { transform: [{ scale }] }]}>
          <CardIcon emoji={emoji} size={40} />
          <Text style={styles.modalTitle}>{label}</Text>
          <PineconeText style={styles.modalBody} text={hint} />
          <TouchableOpacity style={styles.modalBtn} onPress={onClose} activeOpacity={0.8}>
            <Text style={styles.modalBtnText}>{t('profile_understood')}</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

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

  const view = useMemo(() => {
    const { solved, totals } = countOnfByTier(player.completedOnfChallengeIds, getAllOnfChallenges());
    return buildStatsView({
      stats: player.stats,
      challengeStars: player.challengeStars,
      levelsCompleted: player.levelsCompleted,
      currentLevel: player.currentLevel,
      earnedTrophies: player.earnedBadges.filter(id => !!BADGE_MAP[id]).length,
      trophyTotal: Object.keys(BADGE_MAP).length,
      herbierCount: player.collectedTreeCardIds.length,
      herbierTotal: TOTAL_TREE_CARDS,
      onfSolvedCount: player.onfSolvedCount,
      onfSolvedByTier: solved,
      onfTierTotals: totals,
      dailyChallengeStreak: player.dailyChallengeStreak,
      longestDailyChallengeStreak: player.longestDailyChallengeStreak,
      lastDailyChallengeDate: player.lastDailyChallengeDate,
      loyaltyStreak: player.loyaltyStreak,
      loyaltyBest: player.loyaltyBest,
      todayUtc: todayUtc(),
      starTotal: STAR_TOTAL,
    });
  }, [
    player.stats, player.challengeStars, player.levelsCompleted, player.currentLevel, player.earnedBadges,
    player.collectedTreeCardIds, player.onfSolvedCount, player.completedOnfChallengeIds,
    player.dailyChallengeStreak, player.longestDailyChallengeStreak, player.lastDailyChallengeDate,
    player.loyaltyStreak, player.loyaltyBest,
  ]);

  const dash = '—';
  const pct = (n: number | null) => (n === null ? dash : `${n}%`);
  const time = (ms: number | null) => (ms === null ? dash : formatTime(ms));
  const p = view.progression;
  const s = view.solo;
  const m = view.modes;
  const r = view.regularity;

  return (
    <View style={styles.root}>
      {/* 1. Progression */}
      <Section title={t('stats_block_progression')}>
        <StatCard emoji={PINECONE_TOKEN} label={t('stats_stars')} value={`${p.stars} / ${p.starTotal}`} hint={t('stats_stars_hint')} />
        <StatCard emoji={PINECONE_TOKEN} label={t('stats_three_stars')} value={String(p.threeStars)} hint={t('stats_three_stars_hint')} />
        <StatCard emoji="🌲" label={t('stats_chapter')} value={`${p.chapter} / 7`} hint={t('stats_chapter_hint', { levels: String(p.levelsCompleted) })} />
        <StatCard emoji="🏅" label={t('stats_trophies')} value={`${p.trophies} / ${p.trophyTotal}`} hint={t('stats_trophies_hint')} />
        <StatCard emoji="🌳" label={t('stats_herbier')} value={`${p.herbier} / ${p.herbierTotal}`} hint={t('stats_herbier_hint')} wide />
      </Section>

      {/* 2. Solo */}
      <Section title={t('stats_block_solo')}>
        <StatCard emoji="🧩" label={t('stats_solved')} value={String(s.solved)} hint={t('stats_solved_hint')} />
        <StatCard emoji="🎯" label={t('stats_first_try')} value={pct(s.firstTryRate)} hint={t('stats_first_try_hint')} />
        <StatCard emoji="⚡" label={t('stats_fastest')} value={time(s.fastestMs)} hint={t('stats_fastest_hint')} />
        <StatCard emoji="🚪" label={t('stats_abandons')} value={String(s.abandons)} hint={t('stats_abandons_hint')} />
        {s.byChapter.length > 0 && (
          <View style={styles.chapterBox}>
            <Text style={styles.chapterTitle}>{t('stats_avg_by_chapter')}</Text>
            {s.byChapter.map(c => (
              <View key={c.chapterId} style={styles.chapterRow}>
                <Text style={styles.chapterName}>{t('stats_chapter_n', { n: String(c.chapterId) })}</Text>
                <Text style={styles.chapterValue}>{formatTime(c.averageMs)}</Text>
                <Text style={styles.chapterCount}>{t('stats_n_challenges', { n: String(c.count) })}</Text>
              </View>
            ))}
          </View>
        )}
      </Section>

      {/* 3. Modes */}
      <Section title={t('stats_block_modes')}>
        <StatCard
          emoji="📅"
          label={t('stats_daily')}
          value={pct(m.daily.rate)}
          hint={t('stats_daily_hint', { won: String(m.daily.won), played: String(m.daily.played) })}
          wide
        />
        {DAILY_LEAGUE_ORDER.map(l => {
          const d = m.daily.byLeague[l];
          return (
            <StatCard
              key={l}
              emoji={l === 'pousse' ? '🌱' : '🌳'}
              label={t(`daily_league_${l}`)}
              value={d.played > 0 ? `${d.won} / ${d.played}` : dash}
              hint={t('stats_daily_league_hint', { league: t(`daily_league_${l}`), won: String(d.won), played: String(d.played), best: time(d.bestMs) })}
            />
          );
        })}
        <StatCard emoji="🌲" label={t('stats_onf')} value={String(m.onf.solved)} hint={t('stats_onf_hint', { perfect: String(m.onf.perfect), best: time(m.onf.bestMs) })} wide />
        {ONF_TIER_ORDER.map(tier => {
          const row = m.onf.byTier.find(x => x.tier === tier);
          return (
            <StatCard
              key={tier}
              emoji={tier === 'sentier' ? '🥾' : tier === 'clairiere' ? '🌤️' : '🌑'}
              label={t(`onf_tier_${tier}`)}
              value={row && row.total > 0 ? `${row.solved} / ${row.total}` : dash}
            />
          );
        })}
        <StatCard
          emoji="🤝"
          label={t('stats_duel')}
          value={pct(m.duel.rate)}
          hint={t('stats_duel_hint', { wins: String(m.duel.wins), losses: String(m.duel.losses), streak: String(m.duel.bestWinStreak) })}
          wide
        />
      </Section>

      {/* 4. Régularité */}
      <Section title={t('stats_block_regularity')}>
        <StatCard
          emoji="🔥"
          label={t('stats_daily_streak')}
          value={r.dailyStreakRecord > 0 ? t('profile_stat_streak_value', { current: String(r.dailyStreak), record: String(r.dailyStreakRecord) }) : String(r.dailyStreak)}
          hint={t('stats_daily_streak_hint', { current: String(r.dailyStreak), record: String(r.dailyStreakRecord) })}
        />
        <StatCard
          emoji="📆"
          label={t('stats_loyalty')}
          value={t('profile_stat_streak_value', { current: String(r.loyaltyStreak), record: String(r.loyaltyBest) })}
          hint={t('stats_loyalty_hint')}
        />
        <StatCard emoji="🗓️" label={t('stats_days_played')} value={String(r.daysPlayed)} hint={t('stats_days_played_hint')} />
        <StatCard emoji="🏆" label={t('stats_total_wins')} value={String(r.totalWins)} hint={t('stats_total_wins_hint')} />
        <StatCard emoji="🌱" label={t('stats_seeds_earned')} value={String(r.seedsEarned)} hint={t('stats_seeds_earned_hint', { spent: String(r.seedsSpent) })} />
        <StatCard emoji="🎬" label={t('stats_ads')} value={String(r.adsWatched)} hint={t('stats_ads_hint')} />
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
  cardWide: { minWidth: '100%' },
  cardEmoji: { fontSize: 24 },
  cardValue: { fontSize: 21, fontWeight: '800', color: Colors.forest.dark, maxWidth: '100%' },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardLabel: { fontSize: 11, color: Colors.ui.textLight, textAlign: 'center' },
  hintBadge: { width: 14, height: 14, borderRadius: 7, backgroundColor: Colors.ui.border, alignItems: 'center', justifyContent: 'center' },
  hintIcon: { fontSize: 9, fontWeight: '700', color: Colors.ui.textLight, lineHeight: 13 },
  chapterBox: {
    width: '100%', backgroundColor: Colors.ui.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.ui.border, gap: 6,
  },
  chapterTitle: { fontSize: 12, fontWeight: '700', color: Colors.forest.dark, marginBottom: 2 },
  chapterRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chapterName: { flex: 1, fontSize: 12, color: Colors.ui.text },
  chapterValue: { fontSize: 13, fontWeight: '800', color: Colors.forest.dark },
  chapterCount: { fontSize: 10, color: Colors.ui.textLight, minWidth: 70, textAlign: 'right' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.60)', alignItems: 'center', justifyContent: 'center', padding: 28 },
  modalCard: {
    backgroundColor: Colors.ui.card, borderRadius: 24, padding: 28, alignItems: 'center', width: '100%', maxWidth: 340,
    borderWidth: 2, borderColor: Colors.ui.border, elevation: 16, gap: 10,
  },
  modalEmoji: { fontSize: 40 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: Colors.forest.dark, textAlign: 'center' },
  modalBody: { fontSize: 14, color: Colors.ui.textLight, textAlign: 'center', lineHeight: 21 },
  modalBtn: { marginTop: 6, backgroundColor: Colors.forest.medium, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 36, alignItems: 'center', width: '100%' },
  modalBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
