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
import { auth } from '../../services/firebase';

// ── Onglets ──────────────────────────────────────────────────────────────────

type Tab = 'global' | 'badges' | 'seeds';

const TABS: { key: Tab; label: string; emoji: string }[] = [
  { key: 'global',  label: 'Niveau',   emoji: '🌲' },
  { key: 'badges',  label: 'Badges',   emoji: '🏅' },
  { key: 'seeds',   label: 'Graines',  emoji: '🌱' },
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
          Niv. {entry.level} · {entry.completedCount} défis
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
      </View>
    </View>
  );
};

// ── Composant principal ──────────────────────────────────────────────────────

export const LeaderboardScreen: React.FC = () => {
  const [tab, setTab]             = useState<Tab>('global');
  const [entries, setEntries]     = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const myUid = auth.currentUser?.uid ?? null;

  // Tri selon l'onglet actif (les données brutes arrivent déjà triées par score,
  // mais on les retrie côté client pour les sous-onglets Badges et Graines)
  const sorted = useMemo((): LeaderboardEntry[] => {
    const copy = [...entries];
    if (tab === 'badges') {
      copy.sort((a, b) => b.badgeCount - a.badgeCount || b.seeds - a.seeds || b.level - a.level);
    } else if (tab === 'seeds') {
      copy.sort((a, b) => b.seeds - a.seeds || b.badgeCount - a.badgeCount || b.level - a.level);
    }
    // tab === 'global' : déjà trié par score desc depuis Firestore
    return copy;
  }, [entries, tab]);

  // Ma position dans le classement courant
  const myRank = useMemo(() => {
    if (!myUid) return null;
    const idx = sorted.findIndex(e => e.userId === myUid);
    return idx === -1 ? null : idx + 1;
  }, [sorted, myUid]);

  // Abonnement Firestore temps-réel
  useEffect(() => {
    setLoading(true);
    const unsub = subscribeLeaderboard(100, data => {
      setEntries(data);
      setLoading(false);
      setRefreshing(false);
    });
    return () => unsub();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    // L'abonnement onSnapshot se met à jour automatiquement ; on reset juste l'UX
    setTimeout(() => setRefreshing(false), 1500);
  };

  // ── Rendu header fixe (ma position) ──────────────────────────────────────
  const myEntry = myUid ? entries.find(e => e.userId === myUid) : null;

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
      {myRank && myEntry && (
        <View style={styles.myRankBar}>
          <Text style={styles.myRankText}>
            Ta position : <Text style={styles.myRankValue}>#{myRank}</Text>
            {'  '}·{'  '}
            Niv. {myEntry.level}{'  '}
            🏅 {myEntry.badgeCount}{'  '}
            🌱 {myEntry.seeds}
          </Text>
        </View>
      )}

      {/* Liste */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.forest.medium} />
          <Text style={styles.loadingText}>Chargement du classement…</Text>
        </View>
      ) : sorted.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyEmoji}>🌲</Text>
          <Text style={styles.emptyText}>Aucun joueur pour l'instant.</Text>
          <Text style={styles.emptySubtext}>Complète un défi pour apparaître ici !</Text>
        </View>
      ) : (
        <FlatList
          data={sorted}
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
