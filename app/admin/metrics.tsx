// ============================================================
// PAGE ADMIN — Métriques globales (Ramoni only)
// Agrège les données Firestore de tous les joueurs et affiche
// des statistiques utiles : rétention, engagement, progression.
// ============================================================

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { usePlayerStore } from '../../src/store/playerStore';
import { getMetrics, GlobalMetrics, PlayerMetrics } from '../../src/services/adminService';
import { Colors } from '../../src/constants/colors';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtMs(ms: number): string {
  if (!ms || ms <= 0) return '—';
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return rem > 0 ? `${m}m ${rem}s` : `${m}m`;
}

function fmtDate(ts: any): string {
  if (!ts) return '—';
  try {
    const d: Date = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' });
  } catch {
    return '—';
  }
}

// ── Composants de carte ───────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}

function StatCard({ label, value, sub, color = Colors.forest.medium }: StatCardProps) {
  return (
    <View style={[styles.statCard, { borderLeftColor: color }]}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      {sub ? <Text style={styles.statSub}>{sub}</Text> : null}
    </View>
  );
}

interface SectionHeaderProps { title: string }
function SectionHeader({ title }: SectionHeaderProps) {
  return <Text style={styles.sectionHeader}>{title}</Text>;
}

// ── Table joueurs ─────────────────────────────────────────────────────────────

interface PlayerRowProps { p: PlayerMetrics; index: number }
function PlayerRow({ p, index }: PlayerRowProps) {
  const [expanded, setExpanded] = useState(false);
  const bg = index % 2 === 0 ? '#1C3820' : '#162E1A';

  return (
    <TouchableOpacity onPress={() => setExpanded(v => !v)} activeOpacity={0.85}>
      <View style={[styles.playerRow, { backgroundColor: bg }]}>
        <Text style={styles.playerRank}>#{index + 1}</Text>
        <View style={styles.playerMain}>
          <Text style={styles.playerName}>{p.username}</Text>
          <Text style={styles.playerSub}>
            {p.completedChallenges} défis · {p.earnedBadges} badges · {p.seeds} graines
          </Text>
        </View>
        <Text style={styles.playerArrow}>{expanded ? '▲' : '▼'}</Text>
      </View>
      {expanded && (
        <View style={[styles.playerDetail, { backgroundColor: bg }]}>
          <View style={styles.detailGrid}>
            <DetailItem label="Inscrit" value={fmtDate(p.createdAt)} />
            <DetailItem label="Streak daily" value={`${p.dailyChallengeStreak}j`} />
            <DetailItem label="Meilleur streak" value={`${p.longestDailyChallengeStreak}j`} />
            <DetailItem label="ONF résolus" value={p.onfSolvedCount} />
            <DetailItem label="Défis amis joués" value={p.stats.friendPlayed} />
            <DetailItem label="Victoires amis" value={p.stats.friendWins} />
            <DetailItem label="Daily joués" value={p.stats.dailyPlayed} />
            <DetailItem label="Daily gagnés" value={p.stats.dailyWon} />
            <DetailItem label="Daily parfaits" value={p.stats.dailyPerfectCount} />
            <DetailItem label="ONF parfaits" value={p.stats.onfPerfectCount} />
            <DetailItem label="Temps moy." value={fmtMs(p.stats.avgResolutionMs)} />
            <DetailItem label="Sans erreur (streak)" value={p.stats.noErrorStreak} />
            <DetailItem label="Améliorations" value={p.stats.improvedChallengesCount} />
            <DetailItem label="Top DEJ" value={p.stats.topDEJCount} />
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
}

interface DetailItemProps { label: string; value: string | number }
function DetailItem({ label, value }: DetailItemProps) {
  return (
    <View style={styles.detailItem}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

// ── Ecran principal ───────────────────────────────────────────────────────────

export default function MetricsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const username = usePlayerStore(s => s.username);

  const [metrics, setMetrics] = useState<GlobalMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [sortKey, setSortKey] = useState<'completed' | 'badges' | 'seeds' | 'onf' | 'daily'>('completed');

  // Garde admin
  if (username !== 'Ramoni') {
    return (
      <View style={styles.center}>
        <Text style={styles.forbidden}>Accès réservé à Ramoni.</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Retour</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const data = await getMetrics();
      setMetrics(data);
    } catch (e: any) {
      setError(e?.message ?? 'Erreur inconnue');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const sortedPlayers = metrics ? [...metrics.players].sort((a, b) => {
    switch (sortKey) {
      case 'badges':   return b.earnedBadges - a.earnedBadges;
      case 'seeds':    return b.seeds - a.seeds;
      case 'onf':      return b.onfSolvedCount - a.onfSolvedCount;
      case 'daily':    return b.stats.dailyWon - a.stats.dailyWon;
      default:         return b.completedChallenges - a.completedChallenges;
    }
  }) : [];

  const retentionRate7 = metrics
    ? Math.round((metrics.activeLast7Days / (metrics.totalPlayers || 1)) * 100)
    : 0;
  const retentionRate30 = metrics
    ? Math.round((metrics.activeLast30Days / (metrics.totalPlayers || 1)) * 100)
    : 0;
  const dailySuccessRate = metrics && metrics.totalDailyPlayed > 0
    ? Math.round((metrics.totalDailyWon / metrics.totalDailyPlayed) * 100)
    : 0;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* ── En-tête ─────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.backBtnText}>← Retour</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Métriques</Text>
        <TouchableOpacity onPress={() => load()} style={styles.refreshBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.refreshBtnText}>↺</Text>
        </TouchableOpacity>
      </View>

      {/* ── Contenu ─────────────────────────────────────────────────────── */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.forest.accent} />
          <Text style={styles.loadingText}>Chargement des données...</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>Erreur : {error}</Text>
          <TouchableOpacity onPress={() => load()} style={styles.retryBtn}>
            <Text style={styles.retryBtnText}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      ) : metrics ? (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(true)}
              tintColor={Colors.forest.accent}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {/* ── Vue d'ensemble ────────────────────────────────────────── */}
          <SectionHeader title="Vue d'ensemble" />
          <View style={styles.cardGrid}>
            <StatCard label="Joueurs" value={metrics.totalPlayers} color="#4CAF50" />
            <StatCard label="Actifs 7j" value={metrics.activeLast7Days} sub={`${retentionRate7}%`} color="#8BC34A" />
            <StatCard label="Actifs 30j" value={metrics.activeLast30Days} sub={`${retentionRate30}%`} color="#CDDC39" />
            <StatCard label="Défis complétés" value={metrics.totalCompletedChallenges} sub={`moy. ${metrics.avgChallengesPerPlayer}/joueur`} color={Colors.forest.light} />
            <StatCard label="Badges obtenus" value={metrics.totalBadgesEarned} sub={`moy. ${metrics.avgBadgesPerPlayer}/joueur`} color={Colors.ui.seed} />
            <StatCard label="Graines en jeu" value={metrics.totalSeedsInCirculation} color="#FF9800" />
          </View>

          {/* ── Engagement ────────────────────────────────────────────── */}
          <SectionHeader title="Engagement" />
          <View style={styles.cardGrid}>
            <StatCard label="ONF résolus" value={metrics.totalOnfSolved} color="#2196F3" />
            <StatCard label="Daily joués" value={metrics.totalDailyPlayed} color="#9C27B0" />
            <StatCard label="Daily gagnés" value={metrics.totalDailyWon} sub={`${dailySuccessRate}% de réussite`} color="#E91E63" />
            <StatCard label="Temps moy. de résolution" value={fmtMs(metrics.avgResolutionMs)} color="#FF5722" />
          </View>

          {/* ── Tableau des joueurs ───────────────────────────────────── */}
          <SectionHeader title={`Joueurs (${metrics.totalPlayers})`} />

          {/* Tri */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sortBar} contentContainerStyle={styles.sortBarContent}>
            {(
              [
                { key: 'completed', label: 'Défis' },
                { key: 'badges',    label: 'Badges' },
                { key: 'seeds',     label: 'Graines' },
                { key: 'onf',       label: 'ONF' },
                { key: 'daily',     label: 'Daily' },
              ] as const
            ).map(opt => (
              <TouchableOpacity
                key={opt.key}
                style={[styles.sortBtn, sortKey === opt.key && styles.sortBtnActive]}
                onPress={() => setSortKey(opt.key)}
              >
                <Text style={[styles.sortBtnText, sortKey === opt.key && styles.sortBtnTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Lignes joueurs */}
          {sortedPlayers.map((p, i) => (
            <PlayerRow key={p.userId} p={p} index={i} />
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0F2211',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    backgroundColor: '#0F2211',
  },
  forbidden: {
    color: '#EF9A9A',
    fontSize: 18,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2D5A27',
    backgroundColor: '#142718',
  },
  title: {
    flex: 1,
    textAlign: 'center',
    color: '#E8F5E9',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  backBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(139,195,74,0.15)',
  },
  backBtnText: {
    color: Colors.forest.accent,
    fontSize: 14,
    fontWeight: '600',
  },
  refreshBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(139,195,74,0.15)',
  },
  refreshBtnText: {
    color: Colors.forest.accent,
    fontSize: 18,
    fontWeight: '700',
  },
  scroll: { flex: 1 },
  loadingText: {
    color: '#A5D6A7',
    marginTop: 12,
    fontSize: 14,
  },
  errorText: {
    color: '#EF9A9A',
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  retryBtn: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 8,
    backgroundColor: Colors.forest.medium,
  },
  retryBtnText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 14,
  },

  // ── Section ──────────────────────────────────────────────────
  sectionHeader: {
    color: Colors.forest.accent,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 8,
  },

  // ── Grille de stats ───────────────────────────────────────────
  cardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    gap: 8,
  },
  statCard: {
    backgroundColor: '#1C3820',
    borderRadius: 10,
    padding: 12,
    borderLeftWidth: 3,
    minWidth: '30%',
    flex: 1,
  },
  statValue: {
    color: '#E8F5E9',
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 26,
  },
  statLabel: {
    color: '#81C784',
    fontSize: 11,
    marginTop: 2,
    lineHeight: 14,
  },
  statSub: {
    color: '#A5D6A7',
    fontSize: 10,
    marginTop: 1,
    opacity: 0.8,
  },

  // ── Tri ───────────────────────────────────────────────────────
  sortBar: {
    marginHorizontal: 12,
    marginBottom: 8,
  },
  sortBarContent: {
    gap: 6,
    paddingRight: 4,
  },
  sortBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: '#1C3820',
    borderWidth: 1,
    borderColor: '#2D5A27',
  },
  sortBtnActive: {
    backgroundColor: Colors.forest.medium,
    borderColor: Colors.forest.accent,
  },
  sortBtnText: {
    color: '#81C784',
    fontSize: 13,
    fontWeight: '500',
  },
  sortBtnTextActive: {
    color: '#E8F5E9',
    fontWeight: '700',
  },

  // ── Lignes joueurs ────────────────────────────────────────────
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#2D5A27',
  },
  playerRank: {
    color: '#4CAF50',
    fontSize: 12,
    fontWeight: '700',
    width: 28,
  },
  playerMain: { flex: 1 },
  playerName: {
    color: '#E8F5E9',
    fontSize: 14,
    fontWeight: '600',
  },
  playerSub: {
    color: '#81C784',
    fontSize: 11,
    marginTop: 2,
  },
  playerArrow: {
    color: '#4CAF50',
    fontSize: 10,
    marginLeft: 8,
  },

  // ── Détail joueur ─────────────────────────────────────────────
  playerDetail: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#2D5A27',
  },
  detailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingTop: 8,
  },
  detailItem: {
    backgroundColor: '#0F2211',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    minWidth: '28%',
    flex: 1,
  },
  detailLabel: {
    color: '#81C784',
    fontSize: 10,
    marginBottom: 2,
  },
  detailValue: {
    color: '#E8F5E9',
    fontSize: 13,
    fontWeight: '600',
  },
});
