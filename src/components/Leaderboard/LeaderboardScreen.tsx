// ============================================================
// LEADERBOARD SCREEN
// Classement mondial temps-réel avec 3 onglets :
//   1. Global  (score composite : niveau > badges > graines)
//   2. Badges  (trié par badgeCount desc)
//   3. Graines (trié par seeds desc)
// ============================================================

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Colors } from '../../constants/colors';
import { LeaderboardEntry, subscribeLeaderboard } from '../../services/leaderboardService';
import { RecordHolderEntry, subscribeRecordHolders } from '../../services/worldRecordService';
import { computePlayerLevel } from '../../services/playerService';
import { auth } from '../../services/firebase';

// ── Onglets ──────────────────────────────────────────────────────────────────

type Tab = 'global' | 'badges' | 'seeds' | 'records';

const TABS: { key: Tab; label: string; emoji: string }[] = [
  { key: 'global',  label: 'Niveau',   emoji: '🌲' },
  { key: 'badges',  label: 'Badges',   emoji: '🏅' },
  { key: 'seeds',   label: 'Graines',  emoji: '🌱' },
  { key: 'records', label: 'Records',  emoji: '🏆' },
];

// ── Médailles podium ─────────────────────────────────────────────────────────
const MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

// ── Composant ligne de classement ────────────────────────────────────────────

interface RowProps {
  entry: LeaderboardEntry;
  rank: number;
  tab: Tab;
  isMe: boolean;
}

const LeaderboardRow: React.FC<RowProps> = ({ entry, rank, tab, isMe }) => {
  const medal = MEDAL[rank];
  return (
    <View style={[styles.row, isMe && styles.rowMe]}>
      {/* Rang */}
      <View style={styles.rankCol}>
        {medal ? (
          <Text style={styles.medal}>{medal}</Text>
        ) : (
          <Text style={[styles.rankText, rank <= 10 && styles.rankTopTen]}>
            {rank}
          </Text>
        )}
      </View>

      {/* Info joueur */}
      <View style={styles.playerCol}>
        <Text style={[styles.username, isMe && styles.usernameMe]} numberOfLines={1}>
          {entry.username}{isMe ? ' (toi)' : ''}
        </Text>
        <Text style={styles.subinfo}>
          {tab === 'records'
            ? `🏆 ${(entry as any).recordCount ?? 0} records mondiaux`
            : `Niv. ${entry.level} · ${entry.completedCount} défis`}
        </Text>
      </View>

      {/* Valeur mise en avant selon l'onglet */}
      <View style={styles.valueCol}>
        {tab === 'global' && (
          <View style={styles.globalBadge}>
            <Text style={styles.levelValue}>Niv. {entry.level}</Text>
          </View>
        )}
        {tab === 'badges' && (
          <Text style={styles.valueText}>🏅 {entry.badgeCount}</Text>
        )}
        {tab === 'seeds' && (
          <Text style={styles.valueText}>🌱 {entry.seeds}</Text>
        )}
        {tab === 'records' && (
          <Text style={styles.valueText}>🏆 {(entry as any).recordCount ?? 0}</Text>
        )}
      </View>
    </View>
  );
};

// ── Composant principal ──────────────────────────────────────────────────────

export const LeaderboardScreen: React.FC = () => {
  const [tab, setTab]             = useState<Tab>('global');
  const [entries, setEntries]     = useState<LeaderboardEntry[]>([]);
  const [recordHolders, setRecordHolders] = useState<RecordHolderEntry[]>([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const myUid = auth.currentUser?.uid ?? null;

  // Tri selon l'onglet actif
  // Le niveau est recalculé côté client → on retrie systématiquement
  const sorted = useMemo((): LeaderboardEntry[] => {
    if (tab === 'records') return []; // géré séparément via recordHolders
    const copy = [...entries];
    if (tab === 'global') {
      // Retrier par niveau (recalculé) > badges > graines
      copy.sort((a, b) => b.level - a.level || b.badgeCount - a.badgeCount || b.seeds - a.seeds);
    } else if (tab === 'badges') {
      copy.sort((a, b) => b.badgeCount - a.badgeCount || b.seeds - a.seeds || b.level - a.level);
    } else if (tab === 'seeds') {
      copy.sort((a, b) => b.seeds - a.seeds || b.badgeCount - a.badgeCount || b.level - a.level);
    }
    return copy;
  }, [entries, tab]);

  // Ma position dans le classement courant
  const myRank = useMemo(() => {
    if (!myUid) return null;
    if (tab === 'records') {
      const idx = recordHolders.findIndex(e => e.userId === myUid);
      return idx === -1 ? null : idx + 1;
    }
    const idx = sorted.findIndex(e => e.userId === myUid);
    return idx === -1 ? null : idx + 1;
  }, [sorted, recordHolders, tab, myUid]);

  // Abonnement Firestore temps-réel (leaderboard + records)
  useEffect(() => {
    setLoading(true);
    const unsubLeaderboard = subscribeLeaderboard(100, data => {
      // Recalculer le niveau côté client pour corriger les entrées Firestore obsolètes
      const normalized = data.map(e => ({
        ...e,
        level: computePlayerLevel(e.completedCount),
      }));
      setEntries(normalized);
      setLoading(false);
      setRefreshing(false);
    });
    const unsubRecords = subscribeRecordHolders(data => {
      setRecordHolders(data);
    });
    return () => { unsubLeaderboard(); unsubRecords(); };
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    // L'abonnement onSnapshot se met à jour automatiquement ; on reset juste l'UX
    setTimeout(() => setRefreshing(false), 1500);
  };

  // Données affichées dans la FlatList (leaderboard ou records convertis)
  const displayData = useMemo((): LeaderboardEntry[] => {
    if (tab !== 'records') return sorted;
    // Convertir RecordHolderEntry → LeaderboardEntry pour réutiliser LeaderboardRow
    return recordHolders.map(rh => ({
      userId: rh.userId,
      username: rh.username,
      level: 0,
      badgeCount: 0,
      seeds: 0,
      completedCount: 0,
      score: 0,
      recordCount: rh.recordCount,
    } as LeaderboardEntry & { recordCount: number }));
  }, [tab, sorted, recordHolders]);

  // ── Rendu header fixe (ma position) ──────────────────────────────────────
  const myEntry = myUid ? entries.find(e => e.userId === myUid) : null;
  const myRecordEntry = myUid ? recordHolders.find(e => e.userId === myUid) : null;

  return (
    <View style={styles.container}>
      {/* Onglets */}
      <View style={styles.tabs}>
        {TABS.map(t => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, tab === t.key && styles.tabActive]}
            onPress={() => setTab(t.key)}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>
              {t.emoji} {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Ma position */}
      {myRank != null && (tab === 'records' ? myRecordEntry : myEntry) && (
        <View style={styles.myRankBar}>
          <Text style={styles.myRankText}>
            Ta position : <Text style={styles.myRankValue}>#{myRank}</Text>
            {'  '}·{'  '}
            {tab === 'records' ? (
              `🏆 ${myRecordEntry?.recordCount ?? 0} records`
            ) : (
              `Niv. ${myEntry!.level}  🏅 ${myEntry!.badgeCount}  🌱 ${myEntry!.seeds}`
            )}
          </Text>
        </View>
      )}

      {/* Liste */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.forest.medium} />
          <Text style={styles.loadingText}>Chargement du classement…</Text>
        </View>
      ) : displayData.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyEmoji}>🌲</Text>
          <Text style={styles.emptyText}>Aucun joueur pour l'instant.</Text>
          <Text style={styles.emptySubtext}>Complète un défi pour apparaître ici !</Text>
        </View>
      ) : (
        <FlatList
          data={displayData}
          keyExtractor={item => item.userId}
          renderItem={({ item, index }) => (
            <LeaderboardRow
              entry={item}
              rank={index + 1}
              tab={tab}
              isMe={item.userId === myUid}
            />
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={Colors.forest.medium}
            />
          }
          // Met en évidence la ligne "moi" si hors du viewport
          getItemLayout={(_, index) => ({
            length: ROW_HEIGHT,
            offset: ROW_HEIGHT * index,
            index,
          })}
        />
      )}
    </View>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────

const ROW_HEIGHT = 68;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.ui.background,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: Colors.ui.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.ui.border,
    paddingHorizontal: 12,
    paddingTop: 8,
    gap: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: Colors.forest.medium,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.ui.textLight,
  },
  tabTextActive: {
    color: Colors.forest.dark,
    fontWeight: '700',
  },
  myRankBar: {
    backgroundColor: Colors.forest.dark + '12',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.ui.border,
  },
  myRankText: {
    fontSize: 12,
    color: Colors.forest.dark,
    fontWeight: '600',
    textAlign: 'center',
  },
  myRankValue: {
    fontWeight: '800',
    color: Colors.forest.medium,
  },
  list: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.ui.card,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    height: ROW_HEIGHT,
    shadowColor: Colors.ui.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 1,
  },
  rowMe: {
    borderWidth: 1.5,
    borderColor: Colors.forest.medium,
    backgroundColor: Colors.forest.dark + '08',
  },
  separator: {
    height: 6,
  },
  rankCol: {
    width: 36,
    alignItems: 'center',
  },
  medal: {
    fontSize: 22,
  },
  rankText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.ui.textLight,
  },
  rankTopTen: {
    color: Colors.forest.dark,
  },
  playerCol: {
    flex: 1,
    paddingHorizontal: 10,
  },
  username: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.ui.text,
  },
  usernameMe: {
    color: Colors.forest.medium,
  },
  subinfo: {
    fontSize: 11,
    color: Colors.ui.textLight,
    marginTop: 2,
  },
  valueCol: {
    alignItems: 'flex-end',
    minWidth: 70,
  },
  globalBadge: {
    backgroundColor: Colors.forest.dark + '15',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  levelValue: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.forest.dark,
  },
  valueText: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.forest.dark,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loadingText: {
    marginTop: 12,
    color: Colors.ui.textLight,
    fontSize: 14,
  },
  emptyEmoji: {
    fontSize: 40,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.forest.dark,
  },
  emptySubtext: {
    fontSize: 13,
    color: Colors.ui.textLight,
    textAlign: 'center',
    maxWidth: 240,
  },
});
