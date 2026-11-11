// ============================================================
// LEADERBOARD SCREEN (Lot C)
// Classement mondial temps réel, 3 onglets :
//   1. ⭐ Étoiles   — étoiles → ⭐⭐⭐ → trophées → le premier arrivé (vitrine principale)
//   2. 🌅 Journalier — victoires du jour dans UNE ligue (sélecteur Pousse / Grand Chêne) → le premier arrivé
//   3. 🏆 Records   — records mondiaux détenus → le dernier record le plus ancien
//
// Chaque classement vient d'UNE requête serveur déjà triée (voir leaderboardService / constants/leaderboardRank) :
// aucun re-tri côté client. Le joueur hors du top affiché voit sa position réelle (comptage serveur).
// ============================================================

import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Colors } from '../../constants/colors';
import { useFrameLayout } from '../../constants/frameLayout';
import { getRankLabel } from '../../constants/progression';
import { usePlayerStore } from '../../store/playerStore';

import {
  getStarsPosition,
  subscribeDailyWinsLeaderboard,
  subscribeStarsLeaderboard,
} from '../../services/leaderboardService';
import { subscribeRecordHolders } from '../../services/worldRecordService';
import { DailyResult, subscribeDailyLeaderboard, getDailyDateString } from '../../services/dailyChallengeService';
import {
  DailyWinsEntry,
  LEADERBOARD_TOP,
  LeaderboardEntry,
  RecordHolderEntry,
  STAR_TOTAL,
  computeStarsRank,
  entryForestRank,
  positionOf,
} from '../../constants/leaderboardRank';
import { DAILY_LEAGUE_ORDER, DailyLeague, getPlayerLeague } from '../../constants/dailyLeagues';
import { useFeatureAccess } from '../../hooks/useFeatureAccess';
import { formatTime } from '../../utils/boardUtils';
import { auth } from '../../services/firebase';
import { useT } from '../../i18n';
import { PineconeText } from '../Game/PineconeIcon';
import { PINECONE_TOKEN } from '../../constants/pinecone';

// ── Onglets ──────────────────────────────────────────────────────────────────

type Tab = 'stars' | 'daily' | 'records';

const MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

// ── Ligne générique ──────────────────────────────────────────────────────────

interface RowProps {
  rank: number;
  isMe: boolean;
  username: string;
  /** Sous-titre (rang forestier, détail) */
  sub?: string;
  detail?: string;
  value: string;
}

const Row: React.FC<RowProps> = ({ rank, isMe, username, sub, detail, value }) => {
  const t = useT();
  const medal = MEDAL[rank];
  return (
    <View style={[styles.row, isMe && styles.rowMe]}>
      <View style={styles.rankCol}>
        {medal
          ? <Text style={styles.medal}>{medal}</Text>
          : <Text style={[styles.rankText, rank <= 10 && styles.rankTopTen]}>{rank}</Text>}
      </View>
      <View style={styles.playerCol}>
        <Text style={[styles.username, isMe && styles.usernameMe]} numberOfLines={1}>
          {username}{isMe ? t('leaderboard_me') : ''}
        </Text>
        {sub ? <Text style={styles.forestRank} numberOfLines={1}>{sub}</Text> : null}
        {detail ? <PineconeText style={styles.subinfo} numberOfLines={1} text={detail} /> : null}
      </View>
      <View style={styles.valueCol}>
        <PineconeText style={styles.valueText} text={value} />
      </View>
    </View>
  );
};

// ── Composant principal ──────────────────────────────────────────────────────

export const LeaderboardScreen: React.FC = () => {
  const t = useT();
  const { frameBottom, innerPadH } = useFrameLayout();
  const language = usePlayerStore(s => s.language);
  const [tab, setTab] = useState<Tab>('stars');

  const myUid = auth.currentUser?.uid ?? null;
  const todayStr = getDailyDateString(new Date());

  // Ligue du joueur (Pousse avant l'ouverture du Journalier) ; le sélecteur permet de consulter l'autre.
  const leagueAccess = useFeatureAccess('dev');
  const myLeague: DailyLeague = getPlayerLeague(leagueAccess.dailyLeagues) ?? 'pousse';
  const [league, setLeague] = useState<DailyLeague>(myLeague);
  useEffect(() => { setLeague(myLeague); }, [myLeague]);

  const [stars, setStars] = useState<LeaderboardEntry[] | null>(null);
  const [daily, setDaily] = useState<DailyWinsEntry[] | null>(null);
  const [records, setRecords] = useState<RecordHolderEntry[] | null>(null);
  const [todayLeader, setTodayLeader] = useState<DailyResult | null>(null);
  // Position réelle quand le joueur est hors du top affiché
  const [farStars, setFarStars] = useState<number | null>(null);

  // Mon score étoiles courant (pour situer un joueur hors du top).
  // Un sélecteur par champ : Zustand 5 compare par référence, un sélecteur qui renvoie un objet NEUF à chaque lecture
  // provoque une boucle de rendu infinie.
  const myChallengeStars = usePlayerStore(s => s.challengeStars);
  const myTrophyCount = usePlayerStore(s => s.earnedBadges.length);

  // Abonnements : seul l'onglet visible est écouté (une requête serveur par classement)
  useEffect(() => {
    if (tab === 'stars') {
      setStars(null);
      return subscribeStarsLeaderboard(setStars);
    }
    if (tab === 'records') {
      setRecords(null);
      return subscribeRecordHolders(setRecords);
    }
    setDaily(null);
    const unsubWins = subscribeDailyWinsLeaderboard(league, setDaily);
    const unsubToday = subscribeDailyLeaderboard(todayStr, league, 1, data => setTodayLeader(data.length > 0 ? data[0] : null));
    return () => { unsubWins(); unsubToday(); };
  }, [tab, league]);

  // Position hors du top 100 : comptage serveur du nombre de joueurs strictement devant
  const myStarsEntry = stars && myUid ? stars.find(e => e.userId === myUid) ?? null : null;
  useEffect(() => {
    setFarStars(null);
    if (tab !== 'stars' || !stars || !myUid || myStarsEntry || stars.length < LEADERBOARD_TOP) return;
    // Le joueur est hors du top : on compare son score local (sans « premier arrivé » : approximation à égalité)
    const rankNow = computeStarsRank(
      { stars: countStars(myChallengeStars), threeStars: countThree(myChallengeStars), trophies: myTrophyCount },
      Number.MAX_SAFE_INTEGER,
    );
    if (rankNow <= 0) return;
    getStarsPosition(rankNow).then(setFarStars);
  }, [tab, stars, myUid]);

  // Journalier : hors du top affiché on ne montre aucun rang (le score d'un joueur n'est connu que de Firestore ;
  // inventer un chiffre serait pire que rien). Le joueur du top voit sa ligne mise en évidence.
  const myDailyEntry = daily && myUid ? daily.find(e => e.userId === myUid) ?? null : null;

  const data = tab === 'stars' ? stars : tab === 'daily' ? daily : records;
  const loading = data === null;

  const myRank = useMemo(() => {
    if (tab === 'stars') return positionOf(stars ?? [], myUid) ?? farStars;
    if (tab === 'daily') return positionOf(daily ?? [], myUid);
    return positionOf(records ?? [], myUid);
  }, [tab, stars, daily, records, myUid, farStars]);

  const TABS: { key: Tab; label: string; emoji: string }[] = [
    { key: 'stars', label: t('leaderboard_tab_stars'), emoji: PINECONE_TOKEN },
    { key: 'daily', label: t('leaderboard_daily_tab'), emoji: '🌅' },
    { key: 'records', label: t('leaderboard_tab_records'), emoji: '🏆' },
  ];

  // ── Texte de « ma position » ──────────────────────────────────────────────
  const mySummary = (() => {
    if (tab === 'stars' && myStarsEntry) return `${PINECONE_TOKEN} ${myStarsEntry.stars}/${STAR_TOTAL}  ·  🏅 ${myStarsEntry.trophies}`;
    if (tab === 'daily' && myDailyEntry) return winsLabel(t, myDailyEntry.wins);
    if (tab === 'records') {
      const me = (records ?? []).find(e => e.userId === myUid);
      if (me) return t('leaderboard_records_world', { count: String(me.recordCount) });
    }
    return null;
  })();

  const rows = (data ?? []).slice(0, LEADERBOARD_TOP);

  return (
    <View style={styles.container}>
      {/* Onglets */}
      <View style={[styles.tabs, { paddingHorizontal: innerPadH }]}>
        {TABS.map(tb => (
          <TouchableOpacity
            key={tb.key}
            style={[styles.tab, tab === tb.key && styles.tabActive]}
            onPress={() => setTab(tb.key)}
            activeOpacity={0.7}
          >
            <PineconeText style={[styles.tabText, tab === tb.key && styles.tabTextActive]} text={`${tb.emoji} ${tb.label}`} />
          </TouchableOpacity>
        ))}
      </View>

      {/* Journalier : sélecteur de ligue + record du jour de la ligue affichée */}
      {tab === 'daily' && (
        <>
          <View style={styles.leagueRow}>
            {DAILY_LEAGUE_ORDER.map(l => (
              <TouchableOpacity
                key={l}
                style={[styles.leagueBtn, league === l && styles.leagueBtnActive]}
                onPress={() => setLeague(l)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityState={{ selected: league === l }}
              >
                <Text style={[styles.leagueText, league === l && styles.leagueTextActive]}>{t(`daily_league_${l}`)}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.todayBanner}>
            <Text style={styles.todayBannerLabel}>{t('daily_league_today_record', { league: t(`daily_league_${league}`) })}</Text>
            {todayLeader ? (
              <Text style={styles.todayBannerValue}>
                🏆 {todayLeader.username}{'  ·  '}{formatTime(todayLeader.timeMs)}
                {todayLeader.userId === myUid ? t('leaderboard_me_today') : ''}
              </Text>
            ) : (
              <Text style={styles.todayBannerEmpty}>{t('leaderboard_today_empty')}</Text>
            )}
          </View>
        </>
      )}

      {/* Règle de départage de l'onglet : le joueur sait comment il est classé */}
      <View style={styles.ruleBar}>
        <PineconeText style={styles.ruleText} text={t(`leaderboard_rule_${tab}`)} />
      </View>

      {/* Ma position */}
      {myRank != null && (mySummary != null || tab === 'stars') && (
        <View style={styles.myRankBar}>
          <PineconeText
            style={styles.myRankText}
            text={`${t('leaderboard_my_position', { rank: String(myRank) })}${mySummary ? `  ·  ${mySummary}` : ''}`}
          />
        </View>
      )}

      {/* Liste */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.forest.medium} />
          <Text style={styles.loadingText}>{t('leaderboard_loading')}</Text>
        </View>
      ) : rows.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyEmoji}>{tab === 'daily' ? '🌅' : '🌲'}</Text>
          <Text style={styles.emptyText}>{t('leaderboard_empty')}</Text>
          <Text style={styles.emptySubtext}>{t(tab === 'daily' ? 'leaderboard_daily_empty' : 'leaderboard_empty_sub')}</Text>
        </View>
      ) : (
        <FlatList
          data={rows as any[]}
          keyExtractor={(item: { userId: string }) => item.userId}
          renderItem={({ item, index }) => {
            if (tab === 'stars') {
              const e = item as LeaderboardEntry;
              const fr = entryForestRank(e);
              return (
                <Row
                  rank={index + 1}
                  isMe={e.userId === myUid}
                  username={e.username}
                  sub={`${fr.emoji} ${getRankLabel(fr, language)}`}
                  detail={t('leaderboard_stars_detail', { three: String(e.threeStars), trophies: String(e.trophies), herbier: String(e.herbier) })}
                  value={`${PINECONE_TOKEN} ${e.stars}`}
                />
              );
            }
            if (tab === 'daily') {
              const e = item as DailyWinsEntry;
              return <Row rank={index + 1} isMe={e.userId === myUid} username={e.username} detail={winsLabel(t, e.wins)} value={`🌅 ${e.wins}`} />;
            }
            const e = item as RecordHolderEntry;
            return (
              <Row
                rank={index + 1}
                isMe={e.userId === myUid}
                username={e.username}
                detail={t('leaderboard_records_world', { count: String(e.recordCount) })}
                value={`🏆 ${e.recordCount}`}
              />
            );
          }}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          contentContainerStyle={[styles.list, { paddingHorizontal: innerPadH, paddingBottom: frameBottom + 16 }]}
          getItemLayout={(_, index) => ({ length: ROW_HEIGHT, offset: (ROW_HEIGHT + 6) * index, index })}
        />
      )}
    </View>
  );
};

// ── Aides locales ────────────────────────────────────────────────────────────

function winsLabel(t: (k: string, v?: Record<string, string>) => string, wins: number): string {
  return t(wins > 1 ? 'leaderboard_daily_wins_other' : 'leaderboard_daily_wins_one', { count: String(wins) });
}

function countStars(cs: Record<string, number>): number {
  let n = 0;
  for (const v of Object.values(cs)) n += v === 1 || v === 2 || v === 3 ? v : 0;
  return n;
}
function countThree(cs: Record<string, number>): number {
  return Object.values(cs).filter(v => v === 3).length;
}

// ── Styles ────────────────────────────────────────────────────────────────────

const ROW_HEIGHT = 76;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.ui.background },
  tabs: {
    flexDirection: 'row',
    backgroundColor: Colors.ui.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.ui.border,
    paddingHorizontal: 12,
    paddingTop: 16,
    gap: 4,
  },
  tab: { flex: 1, paddingVertical: 9, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: Colors.forest.medium },
  tabText: { fontSize: 13, fontWeight: '600', color: Colors.ui.textLight },
  tabTextActive: { color: Colors.forest.dark, fontWeight: '700' },
  leagueRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: Colors.ui.card },
  leagueBtn: {
    flex: 1, paddingVertical: 7, alignItems: 'center', borderRadius: 10,
    borderWidth: 1, borderColor: Colors.ui.border, backgroundColor: Colors.ui.background,
  },
  leagueBtnActive: { backgroundColor: Colors.forest.dark, borderColor: Colors.forest.dark },
  leagueText: { fontSize: 12, fontWeight: '700', color: Colors.ui.textLight },
  leagueTextActive: { color: '#FFFFFF' },
  todayBanner: {
    backgroundColor: '#2C1A00', paddingVertical: 10, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: '#8B6914', alignItems: 'center', gap: 2,
  },
  todayBannerLabel: { fontSize: 10, fontWeight: '700', color: '#D4A017', textTransform: 'uppercase', letterSpacing: 0.8 },
  todayBannerValue: { fontSize: 15, fontWeight: '800', color: '#FFD54F' },
  todayBannerEmpty: { fontSize: 12, color: '#A07830', fontStyle: 'italic' },
  ruleBar: { paddingVertical: 6, paddingHorizontal: 16, backgroundColor: Colors.ui.card },
  ruleText: { fontSize: 11, color: Colors.ui.textLight, textAlign: 'center' },
  myRankBar: {
    backgroundColor: Colors.forest.dark + '12', paddingVertical: 8, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: Colors.ui.border,
  },
  myRankText: { fontSize: 12, color: Colors.forest.dark, fontWeight: '600', textAlign: 'center' },
  list: { paddingVertical: 8, paddingHorizontal: 12 },
  row: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.ui.card, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 10, minHeight: ROW_HEIGHT,
    shadowColor: Colors.ui.shadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 1,
  },
  rowMe: { borderWidth: 1.5, borderColor: Colors.forest.medium, backgroundColor: Colors.forest.dark + '08' },
  separator: { height: 6 },
  rankCol: { width: 36, alignItems: 'center' },
  medal: { fontSize: 22 },
  rankText: { fontSize: 15, fontWeight: '700', color: Colors.ui.textLight },
  rankTopTen: { color: Colors.forest.dark },
  playerCol: { flex: 1, paddingHorizontal: 10 },
  username: { fontSize: 14, fontWeight: '700', color: Colors.ui.text },
  usernameMe: { color: Colors.forest.medium },
  forestRank: { fontSize: 11, color: Colors.forest.medium, fontWeight: '600', marginTop: 1 },
  subinfo: { fontSize: 11, color: Colors.ui.textLight, marginTop: 1 },
  valueCol: { alignItems: 'flex-end', minWidth: 70 },
  valueText: { fontSize: 15, fontWeight: '800', color: Colors.forest.dark },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  loadingText: { marginTop: 12, color: Colors.ui.textLight, fontSize: 14 },
  emptyEmoji: { fontSize: 40 },
  emptyText: { fontSize: 16, fontWeight: '700', color: Colors.forest.dark },
  emptySubtext: { fontSize: 13, color: Colors.ui.textLight, textAlign: 'center', maxWidth: 240 },
});
