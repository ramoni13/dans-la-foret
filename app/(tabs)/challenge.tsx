// ============================================================
// ÉCRAN MODE DÉFI ENTRE AMIS
//
// Nouveau flux :
//   1. Joueur A cherche un ami par pseudo (avec son niveau affiché)
//   2. Joueur A sélectionne un ami → défi généré au niveau min(A, B)
//   3. Joueur A joue sans bonus → au résultat : "Envoyer" ou "Quitter"
//   4. Joueur B reçoit le défi → peut "Refuser" ou "Relever le défi"
//   5. Le vainqueur gagne 15 graines
//
// Expiration : 1 semaine
// Chaque manche jouée consomme un défi du quota commun ; le vainqueur reçoit 15 graines.
// ============================================================

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  RefreshControl,
  Modal,
  TextInput,
  KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Timestamp } from 'firebase/firestore';

import { Colors } from '../../src/constants/colors';
import { useFrameLayout } from '../../src/constants/frameLayout';
import { useFeatureAccess } from '../../src/hooks/useFeatureAccess';
import { getFeatureLockHint } from '../../src/constants/unlocks';
import { isDemoAccount } from '../../src/constants/devAccess';
import { getDailyChallengesRemaining } from '../../src/constants/dailyLimits';
import { getAdViews } from '../../src/constants/adRewards';
import { BgImage } from '../../src/components/UI/BgImage';
import { usePlayerStore } from '../../src/store/playerStore';
import { awardEarnedTrophies } from '../../src/services/trophyService';
import { awardBadgesFirestore } from '../../src/services/badgeService';
import { auth } from '../../src/services/firebase';
import {
  FriendChallengeDoc,
  createFriendChallenge,
  claimFriendChallengeReward,
  getReceivedChallenges,
  getSentChallenges,
  getCompletedChallenges,
  refuseFriendChallenge,
  CHALLENGE_WINNER_SEEDS,
} from '../../src/services/challengeService';
import { searchPlayers, PlayerSearchResult } from '../../src/services/playerService';
import { generateChallenge } from '../../src/core/generators/challengeGenerator';
import { BoardRegistry } from '../../src/boards/BoardRegistry';
import { ElementRegistry } from '../../src/elements/ElementRegistry';
import { LEVEL_PARAMS } from '../../src/constants/difficulty';
import { formatTime } from '../../src/utils/boardUtils';
import { ConfirmModal } from '../../src/components/Game/ConfirmModal';
import { showAlert as showDialogAlert, showConfirm } from '../../src/store/dialogStore';
import { useT } from '../../src/i18n';

// Le quota de parties est partagé avec les autres modes de défi.

const IMG_HACHES = require('../../assets/elements/design_app/Haches.png');

// ── Correspondance niveau → difficulty + boardId ──────────
// On mappe directement le numéro de niveau sur les LEVEL_PARAMS existants.
function getLevelKey(level: number): string {
  const clamped = Math.min(21, Math.max(1, level));
  return `niveau_${clamped}`;
}

// ── Onglets ────────────────────────────────────────────────
type Tab = 'reçus' | 'envoyés' | 'terminés';

// ── Helpers ────────────────────────────────────────────────
type TFn = (key: string, vars?: Record<string, string>) => string;

function timeAgo(ts: Timestamp | undefined, t: TFn): string {
  if (!ts) return '';
  const diffMs  = Date.now() - ts.toMillis();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1)  return t('challenge_time_just_now');
  if (diffMin < 60) return t('challenge_time_minutes', { n: String(diffMin) });
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24)   return t('challenge_time_hours', { n: String(diffH) });
  return t('challenge_time_days', { n: String(Math.floor(diffH / 24)) });
}

function expiresIn(ts: Timestamp | undefined, t: TFn): string {
  if (!ts) return '';
  const diffMs = ts.toMillis() - Date.now();
  if (diffMs <= 0) return t('challenge_expires_past');
  const diffH = Math.floor(diffMs / 3600000);
  const diffD = Math.floor(diffH / 24);
  if (diffH < 1)  return t('challenge_expires_soon');
  if (diffD < 1)  return t('challenge_expires_hours', { n: String(diffH) });
  return t('challenge_expires_days', { n: String(diffD) });
}

/** Information au joueur : modale de l'app (DialogHost), plus d'Alert natif ni de window.alert. */
function showAlert(title: string, message: string) {
  showDialogAlert({ title, message });
}

// ── Modal recherche d'ami (avant de jouer) ─────────────────
function FriendSearchModal({
  visible,
  myUid,
  myLevel,
  onSelectFriend,
  onClose,
}: {
  visible: boolean;
  myUid: string;
  myLevel: number;
  onSelectFriend: (friend: PlayerSearchResult) => void;
  onClose: () => void;
}) {
  const t = useT();
  const [query, setQuery]         = useState('');
  const [results, setResults]     = useState<PlayerSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const debounce                  = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Réinitialiser à l'ouverture
  useEffect(() => {
    if (visible) {
      setQuery('');
      setResults([]);
    }
  }, [visible]);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    if (query.length < 2) { setResults([]); setSearching(false); return; }
    setSearching(true);
    debounce.current = setTimeout(async () => {
      try { setResults(await searchPlayers(query, myUid)); }
      catch { setResults([]); }
      finally { setSearching(false); }
    }, 400);
  }, [query, myUid]);

  return (
    <Modal visible={visible} transparent animationType="slide">
      <KeyboardAvoidingView
        style={ms.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={ms.card}>
          <Text style={ms.title}>{t('challenge_search_title')}</Text>
          <Text style={ms.subtitle}>
            {t('challenge_search_level')}<Text style={ms.levelBadge}>{t('challenge_search_level_badge', { level: String(myLevel) })}</Text>
          </Text>
          <Text style={ms.hint}>
            {t('challenge_search_hint')}
          </Text>

          <TextInput
            style={ms.input}
            placeholder={t('challenge_search_placeholder')}
            placeholderTextColor={Colors.ui.textLight}
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
          />

          {searching && (
            <ActivityIndicator size="small" color={Colors.forest.medium} style={{ marginTop: 8 }} />
          )}

          {results.length > 0 && (
            <View style={ms.list}>
              {results.map(p => {
                const isLocked = p.level < 3;
                const challengeLevel = Math.max(3, Math.min(myLevel, p.level));
                return (
                  <TouchableOpacity
                    key={p.userId}
                    style={[ms.row, isLocked && ms.rowLocked]}
                    onPress={() => {
                      if (isLocked) return;
                      onSelectFriend(p);
                    }}
                    activeOpacity={isLocked ? 1 : 0.7}
                    disabled={isLocked}
                  >
                    <View style={ms.rowLeft}>
                      <Text style={[ms.username, isLocked && ms.textLocked]}>{p.username}</Text>
                      <Text style={[ms.levelText, isLocked && ms.textLocked]}>
                        {t('challenge_search_level_row', { level: String(p.level) })}
                      </Text>
                      {isLocked && (
                        <Text style={ms.lockedBadge}>{t('challenge_search_locked_level')}</Text>
                      )}
                    </View>
                    <View style={ms.rowRight}>
                      {isLocked ? (
                        <Text style={ms.lockedIcon}>🔒</Text>
                      ) : (
                        <>
                          <Text style={ms.challengeLevelLabel}>{t('challenge_search_defi_label')}</Text>
                          <Text style={ms.challengeLevel}>{t('challenge_search_defi_level', { level: String(challengeLevel) })}</Text>
                        </>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {query.length >= 2 && !searching && results.length === 0 && (
            <Text style={ms.noResult}>{t('challenge_search_no_result', { query })}</Text>
          )}

          <TouchableOpacity style={ms.btnCancel} onPress={onClose} activeOpacity={0.8}>
            <Text style={ms.btnCancelText}>{t('challenge_search_cancel')}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Composant carte défi reçu ───────────────────────────────
function ReceivedCard({
  item,
  onAccept,
  onRefuse,
}: {
  item: FriendChallengeDoc;
  onAccept: (item: FriendChallengeDoc) => void;
  onRefuse: (item: FriendChallengeDoc) => void;
}) {
  const t = useT();
  const level = item.challengeData?.level ?? '?';
  return (
    <View style={cardStyles.card}>
      <View style={cardStyles.header}>
        <Text style={cardStyles.from}>{t('challenge_received_from', { name: item.challengerName })}</Text>
        <Text style={cardStyles.time}>{timeAgo(item.createdAt, t)}</Text>
      </View>
      <View style={cardStyles.row}>
        <View style={cardStyles.stat}>
          <Text style={cardStyles.statLabel}>{t('challenge_stat_their_time')}</Text>
          <Text style={cardStyles.statValue}>{formatTime(item.challengerTime)}</Text>
        </View>
        <View style={cardStyles.stat}>
          <Text style={cardStyles.statLabel}>{t('challenge_stat_level')}</Text>
          <Text style={cardStyles.statValue}>{t('challenge_stat_level_value', { level: String(level) })}</Text>
        </View>
        <View style={cardStyles.stat}>
          <Text style={cardStyles.statLabel}>{t('challenge_stat_expires')}</Text>
          <Text style={cardStyles.statExpire}>{expiresIn(item.expiresAt, t)}</Text>
        </View>
      </View>
      <View style={cardStyles.btnRow}>
        <TouchableOpacity
          style={cardStyles.btnRefuse}
          onPress={() => onRefuse(item)}
          activeOpacity={0.8}
        >
          <Text style={cardStyles.btnRefuseText}>{t('challenge_btn_refuse')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={cardStyles.btnAccept}
          onPress={() => onAccept(item)}
          activeOpacity={0.8}
        >
          <Text style={cardStyles.btnAcceptText}>{t('challenge_btn_accept')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Composant carte défi envoyé ─────────────────────────────
function SentCard({ item }: { item: FriendChallengeDoc }) {
  const t = useT();
  const isPending = item.status === 'pending';
  const isExpired = item.status === 'expired';
  const isRefused = item.status === 'refused';
  const level     = item.challengeData?.level ?? '?';

  return (
    <View style={cardStyles.card}>
      <View style={cardStyles.header}>
        <Text style={cardStyles.from}>{t('challenge_sent_to', { name: item.opponentName })}</Text>
        <Text style={cardStyles.time}>{timeAgo(item.createdAt, t)}</Text>
      </View>
      <View style={cardStyles.row}>
        <View style={cardStyles.stat}>
          <Text style={cardStyles.statLabel}>{t('challenge_stat_my_time')}</Text>
          <Text style={cardStyles.statValue}>{formatTime(item.challengerTime)}</Text>
        </View>
        <View style={cardStyles.stat}>
          <Text style={cardStyles.statLabel}>{t('challenge_stat_level_short')}</Text>
          <Text style={cardStyles.statValue}>{t('challenge_stat_level_value', { level: String(level) })}</Text>
        </View>
        <View style={cardStyles.stat}>
          <Text style={cardStyles.statLabel}>{t('challenge_stat_status')}</Text>
          <Text style={[
            cardStyles.statValue,
            (isExpired || isRefused) && { color: '#F44336', fontSize: 13 },
          ]}>
            {isPending ? t('challenge_status_pending') : isExpired ? t('challenge_status_expired') : isRefused ? t('challenge_status_refused') : t('challenge_status_answered')}
          </Text>
        </View>
      </View>
    </View>
  );
}

// ── Composant carte défi terminé ────────────────────────────
function CompletedCard({ item, myUid }: { item: FriendChallengeDoc; myUid: string }) {
  const t = useT();
  const iWon        = item.winnerId === myUid;
  const iChallenger = item.challengerUid === myUid;
  const myTime      = iChallenger ? item.challengerTime : (item.opponentTime ?? 0);
  const theirTime   = iChallenger ? (item.opponentTime ?? 0) : item.challengerTime;
  const theirName   = iChallenger ? item.opponentName : item.challengerName;
  const level       = item.challengeData?.level ?? '?';

  return (
    <View style={[cardStyles.card, iWon ? cardStyles.cardWon : cardStyles.cardLost]}>
      <View style={cardStyles.header}>
        <Text style={cardStyles.from}>
          {iWon ? t('challenge_won_label', { seeds: String(CHALLENGE_WINNER_SEEDS) }) : t('challenge_lost_label')}
        </Text>
        <Text style={cardStyles.time}>{timeAgo(item.updatedAt, t)}</Text>
      </View>
      <View style={cardStyles.row}>
        <View style={cardStyles.stat}>
          <Text style={cardStyles.statLabel}>{t('challenge_stat_my_time')}</Text>
          <Text style={[cardStyles.statValue, iWon && { color: Colors.forest.medium }]}>
            {formatTime(myTime)}
          </Text>
        </View>
        <View style={cardStyles.stat}>
          <Text style={cardStyles.statLabel}>{theirName}</Text>
          <Text style={[cardStyles.statValue, !iWon && { color: Colors.forest.medium }]}>
            {formatTime(theirTime)}
          </Text>
        </View>
        <View style={cardStyles.stat}>
          <Text style={cardStyles.statLabel}>{t('challenge_stat_level_short')}</Text>
          <Text style={cardStyles.statValue}>{t('challenge_stat_level_value', { level: String(level) })}</Text>
        </View>
      </View>
    </View>
  );
}

// ── Écran principal ─────────────────────────────────────────
export default function ChallengeScreen() {
  const t       = useT();
  const router  = useRouter();
  const player  = usePlayerStore();
  const duelAccess = useFeatureAccess('demo'); // compte démo exempté
  const insets  = useSafeAreaInsets();
  const { frameBottom, innerTop, innerPadH, topBarCenterY } = useFrameLayout();
  const uid     = auth.currentUser?.uid ?? null;
  const isAnon  = auth.currentUser?.isAnonymous ?? true;

  const [activeTab, setActiveTab]         = useState<Tab>('reçus');
  const [received, setReceived]           = useState<FriendChallengeDoc[]>([]);
  const [sent, setSent]                   = useState<FriendChallengeDoc[]>([]);
  const [completed, setCompleted]         = useState<FriendChallengeDoc[]>([]);
  const [loading, setLoading]             = useState(false);
  const [refreshing, setRefreshing]       = useState(false);
  const [generating, setGenerating]       = useState(false);
  const [showSearch, setShowSearch]       = useState(false);
  const canStartChallenge = () => {
    const state = usePlayerStore.getState();
    state.rolloverDailyLimits();
    const current = usePlayerStore.getState();
    return getDailyChallengesRemaining({
      challengeCountToday: current.challengeCountToday,
      exempt: current.isPremium || isDemoAccount(current.username),
      recharges: getAdViews(current.adViews, 'onf_recharge'),
    }) > 0;
  };

  const showQuotaReached = () => {
    showAlert(t('challenge_quota_reached_title'), t('challenge_quota_reached_msg'));
    router.replace('/(tabs)');
  };

  // ── Chargement des défis ──────────────────────────────────
  const loadChallenges = useCallback(async (silent = false) => {
    if (!uid || isAnon) return;
    if (!silent) setLoading(true);
    try {
      const [r, s, c] = await Promise.all([
        getReceivedChallenges(uid),
        getSentChallenges(uid),
        getCompletedChallenges(uid),
      ]);
      await Promise.all(c.map(async d => {
        const hasUnclaimedReward = d.rewardStatus === 'pending' ||
          (d.rewardStatus === undefined && d.winnerId === d.challengerUid);
        if (!d.id || d.winnerId !== uid || !hasUnclaimedReward) return;
        try {
          const claim = await claimFriendChallengeReward(d.id, uid);
          if (claim.claimed) usePlayerStore.getState().addSeeds(CHALLENGE_WINNER_SEEDS);
        } catch (error) {
          console.error(`[Défi] Impossible de réclamer le gain du duel ${d.id}.`, error);
        }
      }));
      setReceived(r);
      setSent(s.filter(x => x.status !== 'completed'));
      setCompleted(c);
      // Lot D : les défis dont l'adversaire a joué ont maintenant un résultat. Chacun est compté UNE fois (par
      // identifiant) dans les statistiques : victoire ou défaite, série. Du plus ancien au plus récent pour la série.
      const oldestFirst = [...c].sort((a, b) => ((a.updatedAt as any)?.toMillis?.() ?? 0) - ((b.updatedAt as any)?.toMillis?.() ?? 0));
      const tally = usePlayerStore.getState().recordDuelResults(uid, oldestFirst.map(d => ({
        id: d.id ?? '',
        challengerUid: d.challengerUid,
        opponentUid: d.opponentUid,
        winnerId: d.winnerId,
      })));
      if (tally.wins + tally.losses > 0) {
        const fresh = awardEarnedTrophies();
        if (fresh.length > 0) awardBadgesFirestore(uid, fresh).catch(() => {});
      }
    } catch {
      // Silencieux
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [uid, isAnon]);

  useFocusEffect(useCallback(() => {
    loadChallenges();
  }, [loadChallenges]));

  const onRefresh = () => {
    setRefreshing(true);
    loadChallenges(true);
  };

  // ── Vérifier le quota global avant d'ouvrir la recherche ───
  const handleOpenSearch = () => {
    if (!uid || isAnon) {
      showAlert(t('challenge_alert_login_title'), t('challenge_alert_login_required'));
      return;
    }

    if (!canStartChallenge()) {
      showQuotaReached();
      return;
    }

    // 1re utilisation du Duel : la pastille « Nouveau » disparaît
    player.clearNewFeatureBadge('duel');
    setShowSearch(true);
  };

  // ── Sélection d'un ami → génération + navigation ──────────
  const handleSelectFriend = async (friend: PlayerSearchResult) => {
    setShowSearch(false);

    const myLevel        = player.currentLevel;
    // Niveau minimum 3 pour les défis amis : niveaux 1-2 (6-7 cases)
    // ont trop peu de compositions valides après filtrage pédagogique.
    const CHALLENGE_MIN_LEVEL = 3;
    const baseLevel      = Math.max(CHALLENGE_MIN_LEVEL, Math.min(myLevel, friend.level));
    const elementDefs    = ElementRegistry;

    setGenerating(true);

    // Déléguer la génération (CPU-intensive) pour laisser le UI se rendre d'abord
    await new Promise<void>(resolve => setTimeout(resolve, 50));

    try {
      // Tenter la génération en partant du niveau cible, puis en montant
      // si le générateur échoue (certains niveaux ont peu de compositions valides).
      let challenge = null;
      let usedLevel = baseLevel;

      console.log('[Défi] Génération — monNiveau:', myLevel, 'amiNiveau:', friend.level, 'baseLevel:', baseLevel);

      // Boucle montante puis descendante : on tente d'abord baseLevel..15,
      // puis 3..baseLevel-1 si tout a échoué (niveaux inférieurs plus fiables).
      const levelRange = [
        ...Array.from({ length: 16 - baseLevel }, (_, i) => baseLevel + i),
        ...Array.from({ length: Math.max(0, baseLevel - CHALLENGE_MIN_LEVEL) }, (_, i) => baseLevel - 1 - i),
      ];
      for (const lvl of levelRange) {
        const levelKey = getLevelKey(lvl);
        const p        = LEVEL_PARAMS[levelKey as keyof typeof LEVEL_PARAMS];
        if (!p) { console.log('[Défi] Niveau', lvl, '→ params introuvables'); continue; }
        const bd = BoardRegistry[p.boardId];
        if (!bd) { console.log('[Défi] Niveau', lvl, '→ boardDef introuvable pour', p.boardId); continue; }
        console.log('[Défi] Tentative niveau', lvl, '— boardId:', p.boardId);
        try {
          challenge = generateChallenge({ boardId: p.boardId, boardDef: bd, elementDefs, difficulty: levelKey as any });
        } catch (genErr) {
          console.error('[Défi] Exception dans generateChallenge niveau', lvl, ':', genErr);
        }
        if (challenge) {
          usedLevel = lvl;
          console.log('[Défi] Succès au niveau', lvl);
          break;
        }
        console.log('[Défi] Échec au niveau', lvl, '→ essai niveau suivant');
      }

      const challengeLevel = usedLevel ?? baseLevel;

      // Fallback ultime : descendre vers les niveaux 3-7 (board_8_v2 / board_9_v1)
      // qui ont une topologie sans feuilles et génèrent de manière fiable.
      if (!challenge) {
        const fallbackLevels = [7, 6, 5, 4, 3];
        for (const fbLvl of fallbackLevels) {
          const fbKey = getLevelKey(fbLvl);
          const fbP   = LEVEL_PARAMS[fbKey as keyof typeof LEVEL_PARAMS];
          if (!fbP) continue;
          const fbBd  = BoardRegistry[fbP.boardId];
          if (!fbBd)  continue;
          console.warn('[Défi] Fallback niveau', fbLvl, '/', fbP.boardId);
          try {
            challenge = generateChallenge({ boardId: fbP.boardId, boardDef: fbBd, elementDefs, difficulty: fbKey as any });
            if (challenge) { usedLevel = fbLvl; break; }
          } catch (fbErr) {
            console.error('[Défi] Fallback niveau', fbLvl, 'échoué:', fbErr);
          }
        }
      }

      if (!challenge) {
        console.error('[Défi] Impossible de générer un défi — tous les niveaux ont échoué');
        showAlert(t('challenge_alert_error'), t('challenge_alert_gen_failed'));
        return;
      }

      console.log('[Défi] Défi généré :', { challengeLevel, boardId: challenge.boardId, fixedCount: challenge.fixedPlacements.length });
      if (!usePlayerStore.getState().consumeChallengeQuota()) {
        showQuotaReached();
        return;
      }

      // Encoder les données du défi + infos ami pour la navigation
      const challengeDataStr = encodeURIComponent(JSON.stringify({
        boardId:         challenge.boardId,
        fixedPlacements: challenge.fixedPlacements,
        availableTokens: challenge.availableTokens,
        solution:        challenge.solution,
        level:           challengeLevel,
      }));

      const friendStr = encodeURIComponent(JSON.stringify({
        userId:   friend.userId,
        username: friend.username,
        level:    friend.level,
      }));

      router.push(
        `/game/friend-challenge?data=${challengeDataStr}&challengerUid=${uid}&challengerName=${encodeURIComponent(player.username)}&challengerLevel=${myLevel}&friendData=${friendStr}`,
      );
    } catch (err) {
      console.error('[Défi] Exception inattendue:', err);
      showAlert(t('challenge_alert_error'), err instanceof Error ? err.message : String(err));
    } finally {
      setGenerating(false);
    }
  };

  // ── Accepter un défi (Joueur B) ───────────────────────────
  const handleAcceptChallenge = (item: FriendChallengeDoc) => {
    if (!uid) return;
    if (!usePlayerStore.getState().consumeChallengeQuota()) {
      showQuotaReached();
      return;
    }
    player.clearNewFeatureBadge('duel');
    const challengeDataStr = encodeURIComponent(JSON.stringify(item.challengeData));
    router.push(
      `/game/friend-challenge?data=${challengeDataStr}&friendChallengeId=${item.id}&challengerUid=${item.challengerUid}&challengerTime=${item.challengerTime}&opponentUid=${uid}&opponentName=${encodeURIComponent(player.username)}&opponentLevel=${player.currentLevel}`,
    );
  };

  // ── Refuser un défi (Joueur B) ────────────────────────────
  const handleRefuseChallenge = (item: FriendChallengeDoc) => {
    const doRefuse = async () => {
      try {
        await refuseFriendChallenge(item.id!);
        setReceived(prev => prev.filter(d => d.id !== item.id));
      } catch {
        showAlert(t('challenge_alert_error'), t('challenge_alert_refuse_failed'));
      }
    };

    showConfirm({
      icon: '🚫',
      title: t('challenge_confirm_refuse_title'),
      message: t('challenge_confirm_refuse_msg', { name: item.challengerName }),
      confirmLabel: t('challenge_alert_refuse'),
      cancelLabel: t('challenge_alert_cancel'),
      destructive: true,
      onConfirm: doRefuse,
    });
  };

  // ── Rendu : non connecté ──────────────────────────────────
  if (!uid || isAnon) {
    return (
      <View style={StyleSheet.absoluteFill}>
        <BgImage overlay={0.52} />
        <View style={[styles.centered, { paddingTop: Math.max(insets.top + 8, innerTop + 8) }]}>
          <Text style={styles.emptyEmoji}>🔒</Text>
          <Text style={[styles.emptyTitle, { color: '#fff' }]}>{t('challenge_not_connected_title')}</Text>
          <Text style={[styles.emptyDesc, { color: 'rgba(255,255,255,0.75)' }]}>
            {t('challenge_not_connected_desc')}
          </Text>
          <TouchableOpacity
            style={styles.btnPrimary}
            onPress={() => router.push('/(tabs)/profile')}
            activeOpacity={0.8}
          >
            <Text style={styles.btnPrimaryText}>{t('challenge_not_connected_btn')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Rendu : mode verrouillé (fin du chapitre 1, ou niveau 3 sans PROGRESSION_V2) ──
  if (!duelAccess.isOpen('duel')) {
    const lock = getFeatureLockHint('duel', duelAccess.useChapters);
    return (
      <View style={StyleSheet.absoluteFill}>
        <BgImage overlay={0.52} />
        <View style={[styles.centered, { paddingTop: Math.max(insets.top + 8, innerTop + 8) }]}>
          <Text style={styles.emptyEmoji}>🔒</Text>
          <Text style={[styles.emptyTitle, { color: '#fff' }]}>
            {lock.kind === 'chapter'
              ? t('unlock_challenge_locked_title', { chapter: String(lock.chapterId) })
              : t('challenge_locked_title', { level: String(lock.level) })}
          </Text>
          <Text style={[styles.emptyDesc, { color: 'rgba(255,255,255,0.75)' }]}>
            {lock.kind === 'chapter'
              ? t('unlock_challenge_locked_desc', { chapter: String(lock.chapterId) })
              : t('challenge_locked_desc')}
          </Text>
        </View>
      </View>
    );
  }

  // ── Rendu principal ───────────────────────────────────────
  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'reçus',    label: t('challenge_tab_received'), count: received.length  },
    { key: 'envoyés',  label: t('challenge_tab_sent'),     count: sent.length      },
    { key: 'terminés', label: t('challenge_tab_completed'), count: completed.length },
  ];

  return (
    <View style={StyleSheet.absoluteFill}>
      <BgImage overlay={0.52} />
      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top + 8, innerTop + 28), paddingLeft: innerPadH + 4, paddingRight: Math.max(72, innerPadH + 4) }]}>
        <View style={styles.headerLeft}>
          <Image source={IMG_HACHES} style={styles.headerIcon} resizeMode="contain" />
          <View>
            <Text style={styles.headerTitle}>{t('challenge_header_title')}</Text>
            <Text style={styles.headerLevel}>{t('challenge_header_level', { level: String(player.currentLevel) })}</Text>
          </View>
        </View>
      </View>

      {/* ── Bouton Défier un ami ── */}
      <View style={[styles.launchSection, { paddingHorizontal: innerPadH + 4 }]}>
        <TouchableOpacity
          style={[styles.btnLaunch, generating && styles.btnDisabled]}
          onPress={handleOpenSearch}
          disabled={generating}
          activeOpacity={0.85}
        >
          {generating
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnLaunchText}>{t('challenge_btn_challenge')}</Text>
          }
        </TouchableOpacity>
        <Text style={styles.launchHint}>
          {t('challenge_duel_reward_hint', { seeds: String(CHALLENGE_WINNER_SEEDS) })}
        </Text>
      </View>

      {/* ── Onglets ── */}
      <View style={styles.tabBar}>
        {tabs.map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
              {tab.label}
              {(tab.count ?? 0) > 0 ? ` (${tab.count})` : ''}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Contenu ── */}
      {loading
        ? <View style={styles.centered}>
            <ActivityIndicator size="large" color={Colors.forest.medium} />
          </View>
        : <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={[styles.list, { paddingHorizontal: innerPadH, paddingBottom: frameBottom + 16 }]}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={Colors.forest.medium}
              />
            }
          >
            {/* ── Onglet Reçus ── */}
            {activeTab === 'reçus' && (
              received.length === 0
                ? <EmptyState
                    emoji="📭"
                    title={t('challenge_empty_received_title')}
                    desc={t('challenge_empty_received_desc')}
                  />
                : received.map(item => (
                    <ReceivedCard
                      key={item.id}
                      item={item}
                      onAccept={handleAcceptChallenge}
                      onRefuse={handleRefuseChallenge}
                    />
                  ))
            )}

            {/* ── Onglet Envoyés ── */}
            {activeTab === 'envoyés' && (
              sent.length === 0
                ? <EmptyState
                    emoji="📤"
                    title={t('challenge_empty_sent_title')}
                    desc={t('challenge_empty_sent_desc')}
                  />
                : sent.map(item => (
                    <SentCard key={item.id} item={item} />
                  ))
            )}

            {/* ── Onglet Terminés ── */}
            {activeTab === 'terminés' && (
              completed.length === 0
                ? <EmptyState
                    emoji="🏁"
                    title={t('challenge_empty_completed_title')}
                    desc={t('challenge_empty_completed_desc')}
                  />
                : completed.map(item => (
                    <CompletedCard key={item.id} item={item} myUid={uid} />
                  ))
            )}
          </ScrollView>
      }

      {/* ── Modal recherche d'ami ── */}
      <FriendSearchModal
        visible={showSearch}
        myUid={uid}
        myLevel={player.currentLevel}
        onSelectFriend={handleSelectFriend}
        onClose={() => {
          setShowSearch(false);
        }}
      />

    </View>
  );
}

// ── Composant état vide ─────────────────────────────────────
function EmptyState({ emoji, title, desc }: { emoji: string; title: string; desc: string }) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyEmoji}>{emoji}</Text>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyDesc}>{desc}</Text>
    </View>
  );
}

// ── Styles modal recherche ──────────────────────────────────
const ms = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-start',
  },
  card: {
    backgroundColor: Colors.ui.card,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    padding: 24,
    paddingTop: 52,
    gap: 14,
    maxHeight: '75%',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.forest.dark,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: Colors.ui.textLight,
    textAlign: 'center',
  },
  levelBadge: {
    color: Colors.forest.medium,
    fontWeight: '700',
  },
  hint: {
    fontSize: 12,
    color: Colors.ui.textLight,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  input: {
    backgroundColor: Colors.ui.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.ui.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.ui.text,
  },
  list: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.ui.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: Colors.ui.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.ui.border,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  username: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.forest.dark,
  },
  levelText: {
    fontSize: 12,
    color: Colors.ui.textLight,
  },
  rowRight: {
    alignItems: 'center',
    minWidth: 60,
  },
  challengeLevelLabel: {
    fontSize: 10,
    color: Colors.ui.textLight,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  challengeLevel: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.forest.medium,
  },
  rowLocked: {
    backgroundColor: Colors.ui.background,
    opacity: 0.6,
  },
  textLocked: {
    color: Colors.ui.textLight,
  },
  lockedBadge: {
    fontSize: 10,
    color: '#999',
    fontStyle: 'italic',
    marginLeft: 4,
  },
  lockedIcon: {
    fontSize: 16,
    color: '#999',
  },
  noResult: {
    fontSize: 13,
    color: Colors.ui.textLight,
    textAlign: 'center',
    paddingVertical: 8,
  },
  btnCancel: {
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  btnCancelText: {
    fontSize: 14,
    color: Colors.ui.textLight,
    fontWeight: '600',
  },
});

// ── Styles cartes ───────────────────────────────────────────
const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.ui.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.ui.border,
    gap: 12,
  },
  cardWon: {
    borderColor: Colors.forest.medium + '80',
    backgroundColor: Colors.forest.medium + '08',
  },
  cardLost: {
    borderColor: Colors.ui.border,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  from: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.forest.dark,
    flex: 1,
  },
  time: {
    fontSize: 11,
    color: Colors.ui.textLight,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  stat: {
    flex: 1,
    gap: 2,
  },
  statLabel: {
    fontSize: 10,
    color: Colors.ui.textLight,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.forest.dark,
  },
  statExpire: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.ui.textLight,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  btnAccept: {
    flex: 2,
    backgroundColor: Colors.forest.medium,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  btnAcceptText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  btnRefuse: {
    flex: 1,
    backgroundColor: Colors.ui.background,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F44336' + '60',
  },
  btnRefuseText: {
    color: '#F44336',
    fontSize: 14,
    fontWeight: '600',
  },
});

// ── Styles écran ────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 20,
    paddingRight: 72,
    paddingBottom: 14,
    backgroundColor: 'rgba(10,30,10,0.75)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.12)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  headerIcon: {
    width: 28,
    height: 28,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
  },
  headerLevel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.65)',
    marginTop: 2,
  },
  launchSection: {
    padding: 16,
    gap: 8,
    backgroundColor: 'rgba(10,30,10,0.82)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.12)',
  },
  btnLaunch: {
    backgroundColor: Colors.forest.dark,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  btnDisabled: {
    opacity: 0.5,
  },
  btnLaunchText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  launchHint: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.75)',
    textAlign: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderBottomWidth: 1,
    borderBottomColor: Colors.ui.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
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
    color: Colors.forest.medium,
  },
  scrollArea: {
    flex: 1,
    backgroundColor: 'rgba(240,245,240,0.92)',
  },
  list: {
    padding: 16,
    gap: 12,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 10,
    backgroundColor: 'rgba(10,30,10,0.72)',
    borderRadius: 18,
    paddingHorizontal: 24,
  },
  emptyEmoji: {
    fontSize: 48,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  emptyDesc: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    lineHeight: 18,
  },
  btnPrimary: {
    backgroundColor: Colors.forest.medium,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  btnPrimaryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
