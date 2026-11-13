// ============================================================
// ECRAN DE JEU JOURNALIER — daily.tsx
// Variante de [challengeId].tsx pour le defi du jour
//
// Differences avec le mode normal :
// - Bonus desactives (bonusDisabled = true)
// - 1 seule validation (dailyValidationUsed)
// - Echec = "Rendez-vous demain" (pas de retry)
// - Victoire = submitDailyResult + badges journaliers
// - Pas de HintOverlay
// ============================================================

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Modal,
  Animated,
  BackHandler,
  useWindowDimensions,
} from 'react-native';
import { useAudioStore } from '../../src/store/audioStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { BoardRenderer } from '../../src/components/Board/BoardRenderer';
import { ElementPalette } from '../../src/components/Elements/ElementPalette';
import { VictoryModal } from '../../src/components/Game/VictoryModal';
import { useGame } from '../../src/hooks/useGame';
import { usePlayerStore, getChallengeElapsed } from '../../src/store/playerStore';
import { DailyAbandonConfirmModal } from '../../src/components/Game/DailyAbandonConfirmModal';
import { auth } from '../../src/services/firebase';
import {
  generateDailyChallenge,
  getDailyFixedPlacements,
  getDailyDateString,
  submitDailyResult as submitDailyResultFirestore,
  subscribeDailyLeaderboard,
  calculateDailyReward,
  DailyResult,
} from '../../src/services/dailyChallengeService';
import { DailyLeague, buildDailyChallengeKey, computeLeagueRank, getPlayerLeague } from '../../src/constants/dailyLeagues';
import { useFeatureAccess } from '../../src/hooks/useFeatureAccess';
import { awardBadgesFirestore } from '../../src/services/badgeService';

import { BoardRegistry } from '../../src/boards/BoardRegistry';
import { formatTime } from '../../src/utils/boardUtils';
import { useFrameLayout } from '../../src/constants/frameLayout';
import { Colors } from '../../src/constants/colors';
import { awardEarnedTrophies } from '../../src/services/trophyService';
import { FallingLeaves } from '../../src/components/Game/FallingLeaves';
import { useConfetti, Confetti } from '../../src/components/Game/Confetti';
import { ChallengeCountdown } from '../../src/components/Game/ChallengeCountdown';
import { DailyBriefingModal } from '../../src/components/LevelBriefing/DailyBriefingModal';
import { DailyStreakRecordModal } from '../../src/components/Game/DailyStreakRecordModal';
import { DailyRouletteModal } from '../../src/components/Game/DailyRouletteModal';
import { Challenge, FixedPlacement, TokenCount } from '../../src/core/models/Challenge';
import { notificationError } from '../../src/utils/haptics';
import { getRankForLevel } from '../../src/constants/progression';
import { recordVictory } from '../../src/services/metricsService';
import { useT } from '../../src/i18n';

const native = Platform.OS !== 'web';

// ── Modal d'echec journalier (pas de retry) ──────────────────────────────────

interface DailyFailModalProps {
  visible: boolean;
  onBackToMenu: () => void;
}

const DailyFailModal: React.FC<DailyFailModalProps> = ({ visible, onBackToMenu }) => {
  const t = useT();
  const scaleAnim   = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const shakeAnim   = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      scaleAnim.setValue(0);
      opacityAnim.setValue(0);
      shakeAnim.setValue(0);

      notificationError();

      Animated.sequence([
        Animated.parallel([
          Animated.spring(scaleAnim, {
            toValue: 1,
            damping: 10,
            stiffness: 180,
            useNativeDriver: native,
          }),
          Animated.timing(opacityAnim, {
            toValue: 1,
            duration: 180,
            useNativeDriver: native,
          }),
        ]),
        Animated.sequence([
          Animated.timing(shakeAnim, { toValue: 12,  duration: 60, useNativeDriver: native }),
          Animated.timing(shakeAnim, { toValue: -12, duration: 60, useNativeDriver: native }),
          Animated.timing(shakeAnim, { toValue: 8,   duration: 50, useNativeDriver: native }),
          Animated.timing(shakeAnim, { toValue: -8,  duration: 50, useNativeDriver: native }),
          Animated.timing(shakeAnim, { toValue: 0,   duration: 40, useNativeDriver: native }),
        ]),
      ]).start();
    } else {
      scaleAnim.setValue(0);
      opacityAnim.setValue(0);
    }
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
      <Animated.View style={[failStyles.backdrop, { opacity: opacityAnim }]}>
        <Animated.View
          style={[failStyles.card, { transform: [{ scale: scaleAnim }] }]}
        >
          <Animated.View
            style={[failStyles.crossContainer, { transform: [{ translateX: shakeAnim }] }]}
          >
            <Text style={failStyles.crossText}>{'\u2715'}</Text>
          </Animated.View>

          <Text style={failStyles.emoji}>{'\u274C'}</Text>
          <Text style={failStyles.title}>{t('daily_fail_title')}</Text>
          <Text style={failStyles.message}>
            {t('daily_fail_message')}
          </Text>

          <TouchableOpacity
            style={failStyles.btnBack}
            onPress={onBackToMenu}
            activeOpacity={0.8}
          >
            <Text style={failStyles.btnBackText}>{t('daily_fail_back')}</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

const failStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: Colors.ui.card,
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    width: '100%',
    maxWidth: 360,
    borderWidth: 3,
    borderColor: '#F44336',
    elevation: 16,
  },
  crossContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#F44336',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  crossText: {
    fontSize: 52,
    color: '#fff',
    fontWeight: '900',
    lineHeight: 60,
  },
  emoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#F44336',
    marginBottom: 8,
  },
  message: {
    fontSize: 16,
    color: Colors.ui.textLight,
    textAlign: 'center',
    marginBottom: 20,
  },
  btnBack: {
    backgroundColor: Colors.forest.medium,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 32,
    width: '100%',
    alignItems: 'center',
  },
  btnBackText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});

// ── Ecran principal ──────────────────────────────────────────────────────────

export default function DailyGameScreen() {
  const t = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  const game = useGame();
  const player = usePlayerStore();
  const audioIngameEnabled = useAudioStore(s => s.ingameEnabled);
  const setIngameEnabled   = useAudioStore(s => s.setIngameEnabled);
  const { borderW } = useFrameLayout();
  // Ligue du joueur : la plus haute ouverte (Pousse fin ch.3, Grand Chêne fin ch.4) ; compte de
  // développement : Grand Chêne. Même grille, mêmes cases fixées pour tous les joueurs de la ligue.
  const dailyAccess = useFeatureAccess('dev');
  const league: DailyLeague = getPlayerLeague(dailyAccess.dailyLeagues) ?? 'pousse';
  // -- Etat local --
  const [loading, setLoading] = useState(true);
  const [generationError, setGenerationError] = useState(false);
  const [dailyDate, setDailyDate] = useState('');
  const [dailyFailed, setDailyFailed] = useState(false);
  const [leaderboard, setLeaderboard] = useState<DailyResult[]>([]);
  const [badgeQueue, setBadgeQueue] = useState<string[]>([]);
  const [seedsEarned, setSeedsEarned] = useState(0);
  const [seedsBeforeGain, setSeedsBeforeGain] = useState(0);
  const [countdownDone, setCountdownDone] = useState(false);
  const [briefingDone, setBriefingDone] = useState(false);
  const [isNewDailyRecord, setIsNewDailyRecord] = useState(false);
  const [prevDailyRecordHolder, setPrevDailyRecordHolder] = useState<string | null>(null);

  const [rouletteVisible, setRouletteVisible]      = useState(false);
  const [streakRecordModal, setStreakRecordModal] = useState<{ newRecord: number; seeds: number } | null>(null);

  const badgesEvaluatedRef = useRef(false);
  // uid capturé à la victoire pour la détection record
  const victoryUidRef = useRef<string | null>(null);
  const confettiPieces = useConfetti(game.isVictory);

  // -- Generation du defi journalier --
  useEffect(() => {
    const now = new Date();
    const dateStr = getDailyDateString(now);
    setDailyDate(dateStr);

    // Verifier si le joueur a deja joue aujourd'hui
    const status = player.dailyChallengeStatus;
    const lastDate = player.lastDailyChallengeDate;
    // Rediriger uniquement si succes ou echec definitif (pas 'in_progress')
    if ((status === 'success' || status === 'failed') && lastDate === dateStr) {
      // Deja joue aujourd'hui — rediriger
      router.replace('/(tabs)');
      return;
    }

    // Cle unique pour le daily d'aujourd'hui, PAR LIGUE (deux grilles différentes le même jour)
    const dailyKey = buildDailyChallengeKey(dateStr, league);
    const isResuming = status === 'in_progress';

    // Generer le defi journalier de facon asynchrone pour ne pas bloquer le thread JS
    // (le solveur backtracking est synchrone et peut durer ~500ms-2s sur mobile)
    let leaderboardUnsub: (() => void) | null = null;

    const runGeneration = () => {
      if (!dailyAccess.isOpen('daily_pousse')) {
        router.replace('/(tabs)');
        return;
      }

      const dailyChallenge = generateDailyChallenge(now, league);
      if (!dailyChallenge) {
        setGenerationError(true);
        setLoading(false);
        return;
      }

      // Cases fixées de la LIGUE : identiques pour tous ses joueurs, indépendantes du niveau
      const { fixedPlacements, availableTokens } = getDailyFixedPlacements(league, dailyChallenge);

      // Construire le challenge adapte
      const adaptedChallenge: Challenge = {
        ...dailyChallenge,
        fixedPlacements,
        availableTokens,
      };

      // Calculer l'offset de temps accumule (reprise apres quit app)
      const pState = usePlayerStore.getState();
      const priorElapsed = isResuming
        ? (Date.now() - (pState.challengeStartedAt[dailyKey] ?? Date.now()))
        : 0;
      if (!isResuming && !pState.consumeChallengeQuota()) {
        router.replace('/(tabs)');
        return;
      }

      game.loadDailyChallenge(adaptedChallenge);
      badgesEvaluatedRef.current = false;

      // Marquer le daily comme en cours + enregistrer le timestamp de debut
      if (!isResuming) {
        usePlayerStore.setState({ dailyChallengeStatus: 'in_progress' });
        player.markChallengeStarted(dailyKey);
      }

      setLoading(false);
      // Si on reprend (briefing déjà vu), le countdown s'affiche directement
      // et le timer démarrera après lui (handleCountdownDone).
      if (isResuming) {
        setBriefingDone(true);
      }
    };

    // Laisser React Native rendre l'ecran de chargement avant de lancer le solveur
    const genTimeout = setTimeout(runGeneration, 16);

    // Ecouter le leaderboard
    // Classement de MA ligue uniquement
    leaderboardUnsub = subscribeDailyLeaderboard(dateStr, league, 50, (results) => {
      setLeaderboard(results);
    });

    return () => {
      clearTimeout(genTimeout);
      leaderboardUnsub?.();
    };
  }, []);

  const challenge = game.challenge;
  const boardDef = challenge ? BoardRegistry[challenge.boardId] : null;

  const fixedCells = useMemo(() => {
    if (!challenge) return new Set<number>();
    return new Set(challenge.fixedPlacements.map(fp => fp.cellIndex));
  }, [challenge]);

  // -- Fermeture du briefing : déclenche le countdown (le timer démarrera après) --
  const handleBriefingClose = useCallback(() => {
    setBriefingDone(true);
    // Le timer sera démarré dans handleCountdownDone
  }, []);

  const handleCountdownDone = useCallback(() => {
    setCountdownDone(true);
    setTimeout(() => game.startTimer(0), 50);
  }, [game]);

  // -- Abandon du defi journalier --
  const [showDailyAbandonModal, setShowDailyAbandonModal] = useState(false);

  const handleDailyBack = useCallback(() => {
    setShowDailyAbandonModal(true);
  }, []);

  const handleDailyAbandonConfirm = useCallback(() => {
    const dailyKey = buildDailyChallengeKey(dailyDate, league);
    player.submitDailyResult(dailyDate, false, undefined, league);
    player.markChallengeAbandoned(dailyKey);
    setShowDailyAbandonModal(false);
    game.resetGame();
    router.replace('/(tabs)');
  }, [dailyDate, league, player, game, router]);

  // -- BackHandler Android --
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      handleDailyBack();
      return true;
    });
    return () => sub.remove();
  }, [handleDailyBack]);

  // -- Tap sur une case --
  const handleCellPress = useCallback((cellIndex: number) => {
    if (game.selectedElement) {
      // placeAndDeselect fusionne les deux mutations en un seul set() Zustand
      // → un seul render → useEffect([elementId]) de Cell s'exécute une seule
      // fois → contentScale monte correctement de 0 à 1 (token visible).
      game.placeAndDeselect(cellIndex, game.selectedElement);
    } else if (game.playerBoard[cellIndex] && !fixedCells.has(cellIndex)) {
      game.removeElement(cellIndex);
    }
  }, [game, fixedCells]);

  // -- Validation --
  const handleValidate = useCallback(() => {
    if (game.dailyValidationUsed) return;
    setSeedsBeforeGain(usePlayerStore.getState().seeds);
    const result = game.validateChallenge();

    // Echec du daily = pas de retry
    if (result.status === 'failure') {
      setDailyFailed(true);
      player.submitDailyResult(dailyDate, false, undefined, league);
    }
  }, [game, dailyDate, player, league]);

  // -- Victoire --
  useEffect(() => {
    if (!game.isVictory || !challenge) return;
    if (badgesEvaluatedRef.current) return;
    badgesEvaluatedRef.current = true;

    // 1. Détecter si le joueur bat son record de série AVANT la mise à jour du store
    const stateBeforeSubmit = usePlayerStore.getState();
    const prevRecord    = stateBeforeSubmit.longestDailyChallengeStreak;
    const currentStreak = stateBeforeSubmit.dailyChallengeStreak;
    const lastDate      = stateBeforeSubmit.lastDailyChallengeDate;
    // Reproduire la logique isNextDay de playerStore : la date du dernier succès est-elle hier ?
    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const yesterdayStr  = yesterday.toISOString().split('T')[0];
    const isConsecutive = lastDate === yesterdayStr;
    const nextStreak    = isConsecutive ? currentStreak + 1 : 1;
    const willBreakRecord = nextStreak > prevRecord;

    // 1b. Mettre a jour le store local (calcule et enregistre le nouveau record en interne)
    player.submitDailyResult(dailyDate, true, game.elapsedTime, league);
    player.markChallengeAbandoned(buildDailyChallengeKey(dailyDate, league));

    // 2. Calculer les recompenses
    const uid = auth.currentUser?.uid;
    const username = auth.currentUser?.displayName ?? 'Joueur';

    // Capturer l'uid pour la detection record post-soumission
    victoryUidRef.current = uid ?? null;
    // Sauvegarder l'ancien leader avant soumission
    if (leaderboard.length > 0) {
      setPrevDailyRecordHolder(leaderboard[0].username);
    }
    const isAnonymous = auth.currentUser?.isAnonymous ?? true;

    // Rang du joueur dans SA ligue (le classement ci-dessus ne contient que sa ligue) : un temps de la
    // Pousse n'est jamais comparé à un temps du Grand Chêne.
    const { rank, total: leagueTotal } = computeLeagueRank(leaderboard, uid, game.elapsedTime);

    const storeState = usePlayerStore.getState();
    const reward = calculateDailyReward(rank, leagueTotal, storeState.dailyChallengeStreak);
    // seedsBeforeGain a été capturé dans handleValidate (state React) — déjà disponible
    // dans VictoryModal dès son premier rendu.
    setSeedsEarned(reward.total);
    player.addSeeds(reward.total);

    // Bonus record de série : Nb graines = nouveau record
    if (willBreakRecord && nextStreak > 1) {
      player.addSeeds(nextStreak);
      setStreakRecordModal({ newRecord: nextStreak, seeds: nextStreak });
    }

    // 3. Trophées (Progression v2, C8) : Rendez-vous, Série, Podium… — tout trophée atteint est décerné.
    // Podium : le rang est celui DANS LA LIGUE, enregistré maintenant (le « top 10 % » dépend du nombre de
    // participants du jour, on ne peut pas le recalculer ensuite). Une seule fois par victoire (1 partie / jour).
    player.recordDailyVictory(game.elapsedTime);
    player.recordDailyPodium(rank, leagueTotal);
    const newBadges = awardEarnedTrophies();
    if (newBadges.length > 0) setBadgeQueue(newBadges);

    // 4. Soumission Firestore en arriere-plan
    if (uid && !isAnonymous) {
      // ── Métriques de rétention ─────────────────────────────────────────────
      const stateForMetrics = usePlayerStore.getState();
      const rankForMetrics = { label: getRankForLevel(stateForMetrics.currentLevel).labelFr };
      recordVictory(
        uid,
        'daily',
        game.elapsedTime,
        0, // daily = 1 seule validation, pas d'erreurs comptées
        reward.total,
        stateForMetrics.currentLevel,
        stateForMetrics.seeds,
        stateForMetrics.earnedBadges.length,
        rankForMetrics.label,
      ).catch(() => {});

      submitDailyResultFirestore(
        dailyDate,
        league,
        uid,
        username,
        game.elapsedTime,
        player.currentLevel
      ).catch(() => {});

      if (newBadges.length > 0) {
        awardBadgesFirestore(uid, newBadges).catch(() => {});
      }
    }
  }, [game.isVictory]);

  // -- Détection record journalier après soumission Firestore --
  // Le leaderboard onSnapshot se met à jour quelques secondes après la soumission.
  // Quand leaderboard[0].userId === victoryUidRef.current, le joueur est #1.
  useEffect(() => {
    if (!game.isVictory) return;
    const uid = victoryUidRef.current;
    if (!uid) return;
    if (leaderboard.length === 0) return;
    if (leaderboard[0].userId === uid) {
      setIsNewDailyRecord(true);
    }
  }, [leaderboard, game.isVictory]);

  // -- Toutes les cases remplies ? --
  const allFilled = challenge
    ? game.playerBoard.every((el, i) =>
        el !== null || challenge.fixedPlacements.some(fp => fp.cellIndex === i)
      )
    : false;

  // -- Chargement --
  if (loading) {
    return (
      <GestureHandlerRootView style={styles.root}>
        <View style={[styles.loading, { paddingTop: insets.top }]}>
          <Text style={styles.loadingText}>{t('daily_loading')}</Text>
        </View>
      </GestureHandlerRootView>
    );
  }

  if (generationError) {
    return (
      <GestureHandlerRootView style={styles.root}>
        <View style={[styles.loading, { paddingTop: insets.top }]}>
          <Text style={styles.loadingText}>{t('daily_error')}</Text>
          <TouchableOpacity
            style={styles.errorBtn}
            onPress={() => router.replace('/(tabs)')}
            activeOpacity={0.8}
          >
            <Text style={styles.errorBtnText}>{t('daily_error_back')}</Text>
          </TouchableOpacity>
        </View>
      </GestureHandlerRootView>
    );
  }

  if (!challenge || !boardDef) {
    return (
      <GestureHandlerRootView style={styles.root}>
        <View style={[styles.loading, { paddingTop: insets.top }]}>
          <Text style={styles.loadingText}>{t('game_loading')}</Text>
        </View>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      {/* Feuilles qui tombent */}
      <FallingLeaves />

      <View style={[styles.root, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 8), paddingHorizontal: borderW }]}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity onPress={handleDailyBack} style={styles.backBtn}>
              <Text style={styles.backText}>{t('daily_abandon_btn')}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.headerCenter}>
            <Text style={styles.levelLabel}>{t('daily_title')}</Text>
            <Text style={styles.challengeLabel}>{t('daily_location')}</Text>
          </View>

          <View style={styles.headerRight}>
            <View style={styles.timer}>
              <Text style={styles.timerText}>{formatTime(game.elapsedTime)}</Text>
              {leaderboard.length > 0 && (
                <Text style={styles.wrBadge}>
                  {'\uD83C\uDFC6'} {leaderboard[0].username} {formatTime(leaderboard[0].timeMs)}
                </Text>
              )}
            </View>
            <TouchableOpacity
              style={styles.speakerBtn}
              onPress={() => setIngameEnabled(!audioIngameEnabled)}
              activeOpacity={0.7}
            >
              <Text style={styles.speakerIcon}>
                {audioIngameEnabled ? '\uD83D\uDD0A' : '\uD83D\uDD07'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Banniere validation unique + bouton Valider (bandeau unique) */}
        <View style={styles.dailyBanner}>
          <View style={styles.dailyBannerInfo}>
            <Text style={styles.dailyBannerText}>
              {game.dailyValidationUsed
                ? t('daily_validation_used')
                : t('daily_validation_single')}
            </Text>
            <Text style={styles.dailyBannerSub}>{t('daily_no_bonus')}</Text>
          </View>
          <TouchableOpacity
            style={[
              styles.validateBtn,
              (!allFilled || game.dailyValidationUsed) && styles.validateBtnDisabled,
            ]}
            onPress={handleValidate}
            activeOpacity={0.8}
            disabled={!allFilled || game.dailyValidationUsed}
          >
            <Text style={styles.validateBtnText}>
              {game.dailyValidationUsed ? t('daily_validate_used_btn') : t('daily_validate_btn')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Plateau — occupe tout l'espace flex restant */}
        <View style={styles.boardArea}>
          <BoardRenderer
            boardDef={boardDef}
            playerBoard={game.playerBoard}
            fixedCells={fixedCells}
            selectedElement={game.selectedElement}
            highlightActive={false}
            getCellColor={(idx) => game.getCellColor(idx)}
            onCellPress={handleCellPress}
            challengeKey={challenge?.id ?? dailyDate}
          />
        </View>

        {/* Palette */}
        <ElementPalette
          availableTokens={challenge.availableTokens}
          playerBoard={game.playerBoard}
          fixedCells={fixedCells}
          selectedElement={game.selectedElement}
          onSelectElement={game.selectElement}
          onClearAll={game.clearPlayerBoard}
        />

        {/* Modal victoire */}
        <VictoryModal
          visible={game.isVictory}
          elapsedTime={game.elapsedTime}
          seedsEarned={seedsEarned}
          seedsBeforeGain={seedsBeforeGain}
          difficulty={'niveau_15' as any}
          challengeNumber={0}
          confettiPieces={confettiPieces}
          badgeQueue={badgeQueue}
          onBadgeQueueEmpty={() => setBadgeQueue([])}
          isNewWorldRecord={isNewDailyRecord}
          previousRecordHolder={isNewDailyRecord ? prevDailyRecordHolder : null}
          nextChallengeLabel={t('daily_next')}
          onNextChallenge={() => {
            setRouletteVisible(true);
          }}
          onBackToMenu={() => {
            game.resetGame();
            router.replace('/(tabs)');
          }}
        />

        {/* Modal echec journalier */}
        <DailyFailModal
          visible={dailyFailed}
          onBackToMenu={() => {
            game.resetGame();
            router.replace('/(tabs)');
          }}
        />

        {/* Modal confirmation d'abandon journalier */}
        <DailyAbandonConfirmModal
          visible={showDailyAbandonModal}
          onContinue={() => setShowDailyAbandonModal(false)}
          onAbandon={handleDailyAbandonConfirm}
        />

        {/* Modal nouveau record de série */}
        <DailyStreakRecordModal
          visible={streakRecordModal !== null}
          newRecord={streakRecordModal?.newRecord ?? 0}
          seedsAwarded={streakRecordModal?.seeds ?? 0}
          onClose={() => setStreakRecordModal(null)}
        />


        {/* Roulette journalière */}
        <DailyRouletteModal
          visible={rouletteVisible}
          uid={auth.currentUser?.uid ?? ''}
          date={dailyDate}
          onClose={() => {
            setRouletteVisible(false);
            game.resetGame();
            router.replace('/(tabs)');
          }}
        />
      </View>

      {/* Briefing journalier (affiche avant le debut du jeu) */}
      {challenge && !briefingDone && (
        <DailyBriefingModal
          challenge={challenge}
          league={league}
          onClose={handleBriefingClose}
        />
      )}

      {/* ── Countdown pré-défi ──
           Affiché après le briefing (première ouverture) ou immédiatement en reprise. */}
      {!countdownDone && briefingDone && (
        <ChallengeCountdown onDone={handleCountdownDone} />
      )}

    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.ui.background,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.ui.background,
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: Colors.ui.textLight,
  },
  errorBtn: {
    backgroundColor: Colors.forest.medium,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  errorBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: Colors.ui.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.ui.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  backBtn: {
    padding: 4,
  },
  backText: {
    fontSize: 14,
    color: Colors.forest.medium,
    fontWeight: '600',
  },
  headerCenter: {
    alignItems: 'center',
  },
  levelLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#D4A017',
  },
  challengeLabel: {
    fontSize: 11,
    color: Colors.ui.textLight,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timer: {
    backgroundColor: Colors.forest.dark + '15',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    alignItems: 'center',
  },
  timerText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.forest.dark,
  },
  wrBadge: {
    fontSize: 10,
    color: '#D4A017',
    fontWeight: '600',
    marginTop: 1,
  },
  speakerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.forest.dark + '15',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.forest.dark + '30',
  },
  speakerIcon: {
    fontSize: 18,
  },
  dailyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF3E0',
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#FFE0B2',
  },
  dailyBannerInfo: {
    flex: 1,
    marginRight: 12,
  },
  dailyBannerText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#E65100',
  },
  dailyBannerSub: {
    fontSize: 11,
    color: '#BF360C',
    marginTop: 1,
  },
  validateBtn: {
    backgroundColor: '#D4A017',
    paddingHorizontal: 20,
    paddingVertical: 9,
    borderRadius: 12,
  },
  validateBtnDisabled: {
    backgroundColor: Colors.ui.border,
    opacity: 0.6,
  },
  validateBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  boardArea: {
    flex: 1,
    alignItems: 'stretch',
    justifyContent: 'flex-start',
    backgroundColor: Colors.ui.background,
    paddingHorizontal: 0,
    paddingVertical: 4,
  },
});
