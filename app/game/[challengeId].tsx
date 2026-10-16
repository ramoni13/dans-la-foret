// ============================================================
// ÉCRAN DE JEU — [challengeId].tsx
// Assemble BoardRenderer + ElementPalette + HintOverlay
// Interaction tap-tap : sélectionner un jeton, taper une case
// ============================================================

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  BackHandler,
  useWindowDimensions,
} from 'react-native';
import { useAudioStore } from '../../src/store/audioStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { BoardRenderer } from '../../src/components/Board/BoardRenderer';
import { ElementPalette } from '../../src/components/Elements/ElementPalette';
import { HintOverlay } from '../../src/components/Bonus/HintOverlay';
import { VictoryModal } from '../../src/components/Game/VictoryModal';
import { FailModal } from '../../src/components/Game/FailModal';
import { LevelBriefingModal } from '../../src/components/LevelBriefing/LevelBriefingModal';
import { useGame } from '../../src/hooks/useGame';
import { usePlayerStore, getChallengeElapsed } from '../../src/store/playerStore';
import { AbandonConfirmModal } from '../../src/components/Game/AbandonConfirmModal';
import { auth } from '../../src/services/firebase';
import { getPlayer, markCompleted, updateSeeds, upsertPlayer } from '../../src/services/playerService';
import { awardBadgesFirestore } from '../../src/services/badgeService';
import {
  WorldRecord,
  subscribeWorldRecord,
  trySetWorldRecord,
} from '../../src/services/worldRecordService';
import { upsertLeaderboardEntry } from '../../src/services/leaderboardService';
import { getBadgeScore, getPlayerScore, getRank, RANK_DEFINITIONS, PlayerActivityStats } from '../../src/constants/badges';
import { RankUpModal, RANK_SEED_REWARDS } from '../../src/components/Game/RankUpModal';

import { BoardRegistry } from '../../src/boards/BoardRegistry';
import { formatTime } from '../../src/utils/boardUtils';
import { Colors } from '../../src/constants/colors';
import { LEVEL_PARAMS } from '../../src/constants/difficulty';
import { LEVEL_META } from '../../src/data/levelMeta';
import { calculateSeedReward } from '../../src/core/engine/hintEngine';
import { evaluateBadges, getClosestBadges, getBadgeProgress, GameContext } from '../../src/core/engine/badgeEngine';

import { FallingLeaves } from '../../src/components/Game/FallingLeaves';
import { useConfetti, Confetti } from '../../src/components/Game/Confetti';

// Donnees de defis embarquees (offline) — 10 niveaux
import niveau1  from '../../src/data/challenges/niveau_1.json';
import niveau2  from '../../src/data/challenges/niveau_2.json';
import niveau3  from '../../src/data/challenges/niveau_3.json';
import niveau4  from '../../src/data/challenges/niveau_4.json';
import niveau5  from '../../src/data/challenges/niveau_5.json';
import niveau6  from '../../src/data/challenges/niveau_6.json';
import niveau7  from '../../src/data/challenges/niveau_7.json';
import niveau8  from '../../src/data/challenges/niveau_8.json';
import niveau9  from '../../src/data/challenges/niveau_9.json';
import niveau10 from '../../src/data/challenges/niveau_10.json';
import niveau11 from '../../src/data/challenges/niveau_11.json';
import niveau12 from '../../src/data/challenges/niveau_12.json';
import niveau13 from '../../src/data/challenges/niveau_13.json';
import niveau14 from '../../src/data/challenges/niveau_14.json';
import niveau15 from '../../src/data/challenges/niveau_15.json';
import { Challenge } from '../../src/core/models/Challenge';

const ALL_CHALLENGES: Record<string, Challenge[]> = {
  niveau_1:  niveau1.challenges  as Challenge[],
  niveau_2:  niveau2.challenges  as Challenge[],
  niveau_3:  niveau3.challenges  as Challenge[],
  niveau_4:  niveau4.challenges  as Challenge[],
  niveau_5:  niveau5.challenges  as Challenge[],
  niveau_6:  niveau6.challenges  as Challenge[],
  niveau_7:  niveau7.challenges  as Challenge[],
  niveau_8:  niveau8.challenges  as Challenge[],
  niveau_9:  niveau9.challenges  as Challenge[],
  niveau_10: niveau10.challenges as Challenge[],
  niveau_11: niveau11.challenges as Challenge[],
  niveau_12: niveau12.challenges as Challenge[],
  niveau_13: niveau13.challenges as Challenge[],
  niveau_14: niveau14.challenges as Challenge[],
  niveau_15: niveau15.challenges as Challenge[],
};

/** Calcule les niveaux entièrement complétés (tous les 10 défis présents). */
function computeCompletedLevels(completed: string[]): string[] {
  const completedSet = new Set(completed);
  return Object.keys(ALL_CHALLENGES).filter(levelId => {
    const challenges = ALL_CHALLENGES[levelId];
    return challenges?.every(c => completedSet.has(c.id));
  });
}

export default function GameScreen() {
  const { challengeId } = useLocalSearchParams<{ challengeId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  const game = useGame();
  const player = usePlayerStore();
  const audioIngameEnabled = useAudioStore(s => s.ingameEnabled);
  const setIngameEnabled   = useAudioStore(s => s.setIngameEnabled);

  // ── Briefing de niveau ─────────────────────────────────────
  const [briefingDone, setBriefingDone] = useState(false);
  const [briefingForcedOpen, setBriefingForcedOpen] = useState(false);

  const handleBriefingClose = useCallback(() => {
    const wasFirstOpen = !briefingDone;
    setBriefingDone(true);
    setBriefingForcedOpen(false);
    if (wasFirstOpen && challengeId) {
      const pState = usePlayerStore.getState();
      const priorElapsed = getChallengeElapsed(pState.challengeStartedAt, challengeId);
      game.startTimer(priorElapsed);
    }
  }, [game, briefingDone, challengeId]);

  // ── Badges toast queue ────────────────────────────────────
  const [badgeQueue, setBadgeQueue] = useState<string[]>([]);
  // closest badges pour la VictoryModal
  const [closestBadges, setClosestBadges] = useState<ReturnType<typeof getClosestBadges>>([]);
  // badges obtenus CE tour (pour affichage ✓ dans VictoryModal)
  const [obtainedBadgeIds, setObtainedBadgeIds] = useState<string[]>([]);
  // nouveaux objectifs injectés par l'auto-avance CE tour (pour badge "Nouveau")
  const [newGoalBadgeIds, setNewGoalBadgeIds] = useState<string[]>([]);
  // Ref pour éviter le double-appel du useEffect isVictory
  const badgesEvaluatedRef = useRef(false);
  // Compteur d'échecs de validation pendant la partie en cours
  const failCountForGameRef = useRef(0);
  // Total de graines AVANT le gain — capturé au moment de la validation (state pour être
  // disponible dès le premier rendu de VictoryModal, avant que le useEffect isVictory ne tourne)
  const [seedsBeforeGain, setSeedsBeforeGain] = useState(0);
  // Total de graines gagnées CE défi (jeu + badges + rang) — mis à jour dans le useEffect isVictory
  // après toutes les additions. Utilisé par VictoryModal pour afficher le bon gain animé.
  const [totalSeedsGained, setTotalSeedsGained] = useState(0);
  // true si un objectif actif vient d'être atteint → bannière dans VictoryModal


  // ── Run parfait (PERFECT x2) ─────────────────────────────────────────────────
  const [isPerfectRun, setIsPerfectRun] = useState(false);

  // ── Changement de rang ───────────────────────────────────────────────────────
  const [rankUpVisible, setRankUpVisible]       = useState(false);
  const [rankUpNewRank, setRankUpNewRank]        = useState(RANK_DEFINITIONS[0]);
  const [rankUpPrevLabel, setRankUpPrevLabel]    = useState('');
  const [rankUpSeeds, setRankUpSeeds]            = useState(0);
  const [rankUpSeedsBefore, setRankUpSeedsBefore] = useState(0);

  // ── Abandon ───────────────────────────────────────────────
  const [showAbandonModal, setShowAbandonModal] = useState(false);

  const handleAbandon = useCallback(() => {
    setShowAbandonModal(true);
  }, []);

  const handleAbandonConfirm = useCallback(() => {
    if (challengeId) {
      player.markChallengeAbandoned(challengeId);
    }
    setShowAbandonModal(false);
    game.resetGame();
    router.replace('/(tabs)/');
  }, [challengeId, player, game, router]);

  // ── BackHandler Android ────────────────────────────────────
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      handleAbandon();
      return true; // empêche la navigation par défaut
    });
    return () => sub.remove();
  }, [handleAbandon]);

  // ── Record mondial ────────────────────────────────────────
  const [worldRecord, setWorldRecord] = useState<WorldRecord | null>(null);
  const [isNewWorldRecord, setIsNewWorldRecord] = useState(false);
  const [previousRecordHolder, setPreviousRecordHolder] = useState<string | null>(null);

  // Confettis
  const confettiPieces = useConfetti(game.isVictory);

  // ── Chargement du défi ─────────────────────────────────────
  useEffect(() => {
    if (!challengeId) return;

    const pState = usePlayerStore.getState();
    let found: Challenge | undefined;
    for (const challenges of Object.values(ALL_CHALLENGES)) {
      found = challenges.find(c => c.id === challengeId);
      if (found) break;
    }
    if (found) {
      const priorElapsed = getChallengeElapsed(pState.challengeStartedAt, challengeId);

      game.loadChallenge(found);
      player.setLastPlayed(found.id);
      player.markChallengeStarted(found.id);
      badgesEvaluatedRef.current = false;
      failCountForGameRef.current = 0;
      setIsPerfectRun(false);
      setIsNewWorldRecord(false);
      setPreviousRecordHolder(null);
      if (found.challengeNumber !== 1) {
        setTimeout(() => game.startTimer(priorElapsed), 50);
        setBriefingDone(true);
      } else {
        setBriefingDone(false);
      }
    }
  }, [challengeId]);

  // ── Abonnement temps-réel au record mondial du défi courant ───────────────
  useEffect(() => {
    if (!challengeId) return;
    const unsub = subscribeWorldRecord(challengeId, wr => setWorldRecord(wr));
    return () => unsub();
  }, [challengeId]);

  const challenge = game.challenge;
  const boardDef = challenge ? BoardRegistry[challenge.boardId] : null;

  const levelNumber = challenge
    ? parseInt(challenge.level.replace('niveau_', ''), 10)
    : null;
  const levelMeta = levelNumber != null ? LEVEL_META[levelNumber] : null;

  const fixedCells = React.useMemo(() => {
    if (!challenge) return new Set<number>();
    return new Set(challenge.fixedPlacements.map(fp => fp.cellIndex));
  }, [challenge]);

  // ── Tap sur une case du plateau ───────────────────────────
  const handleCellPress = useCallback((cellIndex: number) => {
    if (game.selectedElement) {
      // placeAndDeselect fusionne placement + désélection en un seul set() Zustand
      // → un seul render → token visible immédiatement (pas de contentScale bloqué à 0).
      game.placeAndDeselect(cellIndex, game.selectedElement);
    } else if (game.playerBoard[cellIndex] && !fixedCells.has(cellIndex)) {
      // Case occupée par un jeton joueur → retirer
      game.removeElement(cellIndex);
    }
  }, [game, fixedCells]);

  const handleValidate = useCallback(() => {
    // Capturer le score avant toute modification — sera passé à VictoryModal
    // comme point de départ de l'animation (disponible dès le premier rendu)
    setSeedsBeforeGain(usePlayerStore.getState().seeds);
    game.validateChallenge();
  }, [game]);

  const seedsEarned = React.useMemo(() => {
    if (!challenge) return 0;
    return calculateSeedReward(
      game.elapsedTime,
      challenge.estimatedDuration * 1000,
      game.bonusUsed
    );
  }, [game.isVictory]);

  // ── Victoire : enregistrer la progression (local + Firestore) + évaluer badges ──
  useEffect(() => {
    if (!game.isVictory || !challenge) return;
    if (badgesEvaluatedRef.current) return;
    badgesEvaluatedRef.current = true;

    const failsDuringGame = failCountForGameRef.current;

    // 1. Capturer bestTimes et sameChallengePlays AVANT markChallengeCompleted
    //    — nécessaire pour que isPersonalBest() et playsOnThisChallenge soient corrects.
    const stateBeforeUpdate = usePlayerStore.getState();
    const bestTimesBeforeUpdate          = stateBeforeUpdate.stats.bestTimes;
    const sameChallengePlaysBeforeUpdate = stateBeforeUpdate.stats.sameChallengePlays;
    const completedChallengesBeforeUpdate = stateBeforeUpdate.completedChallenges;
    // Objectifs actifs AVANT : pour détecter lesquels viennent d'être atteints
    const activeGoalsBeforeUpdate = stateBeforeUpdate.activeBadgeGoals;

    // 2. Mise à jour locale immédiate (store Zustand)
    // seedsBeforeGain a été capturé dans handleValidate (state React) — déjà disponible
    // dans VictoryModal dès son premier rendu.
    player.markChallengeCompleted(challenge.id, game.elapsedTime, failsDuringGame, game.elementChangeCount, game.bonusUsed.length);
    player.addSeeds(seedsEarned);

    // Détection du run parfait : aucun déplacement, aucun échec, aucun abandon, aucun bonus
    const abandonCountForChallenge = stateBeforeUpdate.stats.abandonCount?.[challenge.id] ?? 0;
    const isPerfect =
      game.elementChangeCount === 0 &&
      failsDuringGame === 0 &&
      abandonCountForChallenge === 0 &&
      game.bonusUsed.length === 0;
    if (isPerfect && seedsEarned > 0) setIsPerfectRun(true);

    // 3. Évaluation des badges — storeState post-update pour noErrorStreak/dailyStreak,
    //    mais bestTimes/sameChallengePlays/completedChallenges pris AVANT la mise à jour.
    const storeState = usePlayerStore.getState();
    const completedLevels = computeCompletedLevels(storeState.completedChallenges);

    const ctx: GameContext = {
      challengeId: challenge.id,
      levelId: challenge.level,
      levelNumber: parseInt(challenge.level.replace('niveau_', ''), 10),
      challengeNumber: challenge.challengeNumber,
      elapsedMs: game.elapsedTime,
      estimatedDurationMs: challenge.estimatedDuration * 1000,
      bonusUsed: game.bonusUsed,
      failCount: failsDuringGame,
      noErrorStreak:     storeState.stats.noErrorStreak,     // post-update : intentionnel
      dailyStreak:       storeState.dailyStreak,
      earnedBadges:      storeState.earnedBadges,
      completedChallenges: completedChallengesBeforeUpdate,  // AVANT : pour off-by-one correct
      completedLevels,
      friendWins:        storeState.stats.friendWins,
      bestTimes:         bestTimesBeforeUpdate,              // AVANT : pour isPersonalBest()
      totalFriendsInvited: storeState.stats.totalFriendsInvited,
      topDEJCount:       storeState.stats.topDEJCount,
      playedAt:          new Date(),
      sameChallengePlays: sameChallengePlaysBeforeUpdate,    // AVANT : pour playsOnThisChallenge
      seasonalChallengesPlayed: storeState.stats.seasonalChallengesPlayed,
      improvedChallengesCount: storeState.stats.improvedChallengesCount, // post-update : pour amelioration_fusee
      activeBadgeGoals:  activeGoalsBeforeUpdate,             // objectifs actifs : contrôle quels badges sont décernables
      goalCounters:      storeState.goalCounters,            // post-update : compteurs dédiés par badge objectif
      speedBadgeHits:    storeState.stats.speedBadgeHits,   // conservé pour compatibilité
      elementChangeCount: game.elementChangeCount,           // pour badge precision_parfaite
      abandonCountForChallenge: storeState.stats.abandonCount?.[challenge.id] ?? 0,
      isWorldRecord: false,
      isFirstRecord: false,
    };

    // Capture du score AVANT l'attribution des badges
    // storeState est post-markChallengeCompleted : completedChallenges inclut déjà ce défi solo
    const activityStatsBefore: PlayerActivityStats = {
      soloCompleted:   storeState.completedChallenges.length,
      friendCompleted: storeState.stats.friendPlayed,
      onfCompleted:    storeState.onfSolvedCount,
      dailyCompleted:  storeState.stats.dailyWon,
    };
    const scoreBeforeBadges = getPlayerScore(storeState.earnedBadges, activityStatsBefore);
    const rankBefore = getRank(scoreBeforeBadges);

    const newBadges = evaluateBadges(ctx);
    player.awardBadges(newBadges);

    if (newBadges.length > 0) {
      setBadgeQueue(newBadges);
      setObtainedBadgeIds(newBadges);
    }

    // ── Détection changement de rang ──────────────────────────────────────────
    const stateAfterBadges = usePlayerStore.getState();
    const allEarnedAfterBadges = stateAfterBadges.earnedBadges;
    const activityStatsAfter: PlayerActivityStats = {
      soloCompleted:   stateAfterBadges.completedChallenges.length,
      friendCompleted: stateAfterBadges.stats.friendPlayed,
      onfCompleted:    stateAfterBadges.onfSolvedCount,
      dailyCompleted:  stateAfterBadges.stats.dailyWon,
    };
    const scoreAfterBadges = getPlayerScore(allEarnedAfterBadges, activityStatsAfter);
    const rankAfter = getRank(scoreAfterBadges);
    if (rankAfter.id !== rankBefore.id) {
      const rankSeeds = RANK_SEED_REWARDS[rankAfter.id] ?? 0;
      if (rankSeeds > 0) {
        setRankUpSeedsBefore(usePlayerStore.getState().seeds);
        player.addSeeds(rankSeeds);
      }
      const lang = usePlayerStore.getState().language;
      setRankUpPrevLabel(lang === 'en' ? rankBefore.labelEn : rankBefore.label);
      setRankUpNewRank(rankAfter);
      setRankUpSeeds(rankSeeds);
      // Déclencher le modal après un délai (laisse la VictoryModal s'installer)
      setTimeout(() => setRankUpVisible(true), 1800);
    }

    // Total réel gagné ce défi = store actuel − score capturé avant validation
    // Inclut : graines de jeu + graines de badges + graines de rang
    setTotalSeedsGained(usePlayerStore.getState().seeds - seedsBeforeGain);

    // Détecter les objectifs actifs qui sont désormais obtenus
    // (soit nouvellement décernés ce tour, soit déjà obtenus mais restés dans activeBadgeGoals)
    const allEarnedNow = usePlayerStore.getState().earnedBadges;
    const completedGoalIds = activeGoalsBeforeUpdate.filter(id => allEarnedNow.includes(id));

    if (completedGoalIds.length > 0) {
      // Auto-avance : remplacer chaque slot libéré par le prochain badge éligible
      player.advanceGoalAuto(completedGoalIds, allEarnedNow);
      // Détecter les nouveaux objectifs injectés (= ceux dans l'état post-avance
      // qui n'étaient pas dans activeGoalsBeforeUpdate)
      const goalsAfterAdvance = usePlayerStore.getState().activeBadgeGoals;
      const injected = goalsAfterAdvance.filter(id => !activeGoalsBeforeUpdate.includes(id));
      if (injected.length > 0) setNewGoalBadgeIds(injected);
      // Persister activeBadgeGoals + goalCounters dans Firestore pour que restoreFromCloud
      // ne réécrase pas le résultat de l'auto-avance au prochain chargement
      const uidAdv = auth.currentUser?.uid;
      const isAnonAdv = auth.currentUser?.isAnonymous ?? true;
      if (uidAdv && !isAnonAdv) {
        const stateAfterAdvance = usePlayerStore.getState();
        getPlayer(uidAdv).then(currentProfile => {
          if (currentProfile) {
            upsertPlayer({
              ...currentProfile,
              activeBadgeGoals: stateAfterAdvance.activeBadgeGoals,
              goalCounters:     stateAfterAdvance.goalCounters,
            }).catch(() => {});
          }
        }).catch(() => {});
      }
    }

    const updatedState = usePlayerStore.getState();
    // Calculer la progression pour :
    // 1. Les objectifs actifs AVANT la partie (y compris ceux obtenus ce tour)
    // 2. Les nouveaux objectifs injectés par l'auto-avance
    // Pour les badges obtenus ce tour, on exclut temporairement leur ID de earnedBadges
    // afin que getBadgeProgress calcule leur progression finale (sinon il retourne null).
    const goalsAfterAdvanceFinal = updatedState.activeBadgeGoals;
    const injectedFinal = goalsAfterAdvanceFinal.filter(id => !activeGoalsBeforeUpdate.includes(id));
    const allGoalsToShow = [...activeGoalsBeforeUpdate, ...injectedFinal];
    const earnedWithoutNewBadges = updatedState.earnedBadges.filter(
      id => !newBadges.includes(id)
    );
    // goalCounters après advanceGoalAuto (nouveaux objectifs ont goalCounters[id]=0)
    const ctxForProgress = {
      ...ctx,
      earnedBadges: earnedWithoutNewBadges,
      goalCounters: updatedState.goalCounters,
    };
    const activeProgress = allGoalsToShow
      .map(badgeId => getBadgeProgress(badgeId, ctxForProgress))
      .filter((p): p is NonNullable<typeof p> => p !== null);
    setClosestBadges(activeProgress);

    // 3. Synchronisation Firestore en arrière-plan (si connecté, non anonyme)
    const uid = auth.currentUser?.uid;
    const username = auth.currentUser?.displayName ?? 'Joueur';
    const isAnonymous = auth.currentUser?.isAnonymous ?? true;
    if (uid && !isAnonymous) {
      trySetWorldRecord(challenge.id, uid, username, game.elapsedTime).then(wrResult => {
        if (wrResult.isNewRecord) {
          setIsNewWorldRecord(true);
          setPreviousRecordHolder(wrResult.previousRecord?.username ?? null);
          const wrNewBadges: string[] = [];
          const currentEarned = usePlayerStore.getState().earnedBadges;
          if (wrResult.previousRecord === null && !currentEarned.includes('record_first')) {
            wrNewBadges.push('record_first');
          }
          if (wrResult.previousRecord !== null && !currentEarned.includes('record_mondial')) {
            wrNewBadges.push('record_mondial');
          }
          player.awardBadges(wrNewBadges);
          if (wrNewBadges.length > 0) {
            setBadgeQueue(prev => [...prev, ...wrNewBadges]);
            awardBadgesFirestore(uid, wrNewBadges).catch(() => {});
          }
        }
      }).catch(() => {});

      // Capturer le total local final AVANT l'appel async (inclut jeu + badges + rang)
      const finalLocalSeeds = usePlayerStore.getState().seeds;
      getPlayer(uid).then(async profile => {
        if (profile) {
          await markCompleted(uid, challenge.id, game.elapsedTime, profile);
          // Utiliser le total local plutôt que profile.seeds + seedsEarned :
          // profile.seeds peut être en retard (pas de badges ni de rang comptabilisés)
          await updateSeeds(uid, finalLocalSeeds);
          if (newBadges.length > 0) {
            await awardBadgesFirestore(uid, newBadges);
          }
          const updatedCompleted = profile.completedChallenges.includes(challenge.id)
            ? profile.completedChallenges.length
            : profile.completedChallenges.length + 1;
          const allEarnedBadges = [...profile.earnedBadges, ...newBadges];
          const updatedBadges   = allEarnedBadges.length;
          const leaderboardActivityStats: PlayerActivityStats = {
            soloCompleted:   updatedCompleted,
            friendCompleted: (profile.stats as any).friendPlayed ?? 0,
            onfCompleted:    profile.onfSolvedCount ?? 0,
            dailyCompleted:  (profile.stats as any).dailyWon ?? 0,
          };
          const updatedScore = getPlayerScore(allEarnedBadges, leaderboardActivityStats);
          await upsertLeaderboardEntry(
            uid,
            username,
            updatedCompleted,
            updatedBadges,
            finalLocalSeeds,
            updatedScore,
          );
        }
      }).catch(() => {});
    }
  }, [game.isVictory]);

  // ── Enregistrer les échecs de validation ──
  useEffect(() => {
    if (game.validationResult.status === 'failure' && challenge) {
      failCountForGameRef.current += 1;
      player.recordChallengeFailure(challenge.id);
    }
  }, [game.validationResult.status]);

  const bonusDisabled = challenge
    ? (LEVEL_PARAMS[challenge.level]?.bonusDisabled ?? false)
    : false;

  const allFilled = challenge
    ? game.playerBoard.every((el, i) =>
        el !== null || challenge.fixedPlacements.some(fp => fp.cellIndex === i)
      )
    : false;

  // Au moins un élément posé par le joueur (hors fixedPlacements)
  const fixedIndices = challenge
    ? new Set(challenge.fixedPlacements.map(fp => fp.cellIndex))
    : new Set<number>();
  const hasPlacedElements = game.playerBoard.some(
    (el, i) => el !== null && !fixedIndices.has(i)
  );


  if (!challenge || !boardDef) {
    return (
      <View style={[styles.loading, { paddingTop: insets.top }]}>
        <Text style={styles.loadingText}>Chargement du défi…</Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      {/* ── Feuilles qui tombent ── */}
      <FallingLeaves />

      <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity onPress={handleAbandon} style={styles.backBtn}>
              <Text style={styles.backText}>{'\u2190'} Abandonner</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setBriefingForcedOpen(true)}
              style={styles.helpBtn}
            >
              <Text style={styles.helpText}>?</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.headerCenter}>
            <Text style={styles.levelLabel}>
              {challenge.level.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
            </Text>
            <Text style={styles.challengeLabel}>Défi {challenge.challengeNumber}</Text>
          </View>

          <View style={styles.headerRight}>
            <View style={styles.timer}>
              <Text style={styles.timerText}>{formatTime(game.elapsedTime)}</Text>
              {worldRecord && !isNewWorldRecord && (
                <Text style={styles.wrBadge}>
                  🌍 {formatTime(worldRecord.timeMs)}
                </Text>
              )}
            </View>
            <TouchableOpacity
              style={styles.speakerBtn}
              onPress={() => setIngameEnabled(!audioIngameEnabled)}
              activeOpacity={0.7}
            >
              <Text style={styles.speakerIcon}>
                {audioIngameEnabled ? '🔊' : '🔇'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Barre de bonus + bouton Valider (bandeau unique) ── */}
        <HintOverlay
          seeds={player.seeds}
          bonusUsed={game.bonusUsed}
          selectedElement={game.selectedElement}
          isPremium={player.isPremium}
          bonusDisabled={bonusDisabled}
          onActivateBonus={game.activateBonus}
          dailyBonusUses={player.dailyBonusUses}
          highlightDeadline={game.highlightDeadline}
          instinctDeadline={game.instinctDeadline}
          highlightActive={game.highlightActive}
          hasPlacedElements={hasPlacedElements}
          rightSlot={
            <TouchableOpacity
              style={[
                styles.validateBtn,
                !allFilled && styles.validateBtnDisabled,
              ]}
              onPress={handleValidate}
              activeOpacity={0.8}
              disabled={!allFilled}
            >
              <Text style={styles.validateBtnText}>Valider ✓</Text>
            </TouchableOpacity>
          }
        />

        {/* ── Plateau ── */}
        <View style={styles.boardArea}>
          <View style={[styles.boardContainer, { maxHeight: Math.min(screenWidth, screenHeight * 0.52) }]}>
            <BoardRenderer
              boardDef={boardDef}
              playerBoard={game.playerBoard}
              fixedCells={fixedCells}
              selectedElement={game.selectedElement}
              highlightActive={game.validHintCells.length > 0 || game.errorHintCells.length > 0}
              getCellColor={(idx) => game.getCellColor(idx)}
              onCellPress={handleCellPress}
              challengeKey={challenge?.id}
            />
          </View>
        </View>

        {/* ── Palette ── */}
        <ElementPalette
          availableTokens={challenge.availableTokens}
          playerBoard={game.playerBoard}
          fixedCells={fixedCells}
          selectedElement={game.selectedElement}
          onSelectElement={game.selectElement}
        />

        {/* ── Modal victoire ── */}
        <VictoryModal
          visible={game.isVictory}
          elapsedTime={game.elapsedTime}
          seedsEarned={totalSeedsGained || seedsEarned}
          seedsBeforeGain={seedsBeforeGain}
          difficulty={challenge.level}
          challengeNumber={challenge.challengeNumber}
          confettiPieces={confettiPieces}
          closestBadges={closestBadges}
          obtainedBadgeIds={obtainedBadgeIds}
          newGoalBadgeIds={newGoalBadgeIds}
          badgeQueue={badgeQueue}
          onBadgeQueueEmpty={() => setBadgeQueue([])}
          worldRecord={isNewWorldRecord ? null : worldRecord}
          isNewWorldRecord={isNewWorldRecord}
          previousRecordHolder={previousRecordHolder}
          isPerfectRun={isPerfectRun}
          perfectSeedsBonus={seedsEarned}
          onPerfectBonusCollected={() => {
            // Ajouter les graines du bonus PERFECT au store (le x2 effectif)
            player.addSeeds(seedsEarned);
            // NE PAS modifier totalSeedsGained ici — seedsEarned passé à VictoryModal
            // ne doit pas changer pour éviter de re-déclencher la 1re animation
          }}

          onNextChallenge={() => {
            const nextNum = String(challenge.challengeNumber + 1).padStart(3, '0');
            const nextId = `${challenge.level}_${nextNum}`;
            const levelChallenges = ALL_CHALLENGES[challenge.level] ?? [];
            const nextExists = levelChallenges.some(c => c.id === nextId);
            game.resetGame();
            if (nextExists) {
              router.replace(`/game/${nextId}`);
            } else {
              router.replace('/(tabs)/');
            }
          }}
          onBackToMenu={() => {
            game.resetGame();
            router.replace('/(tabs)/');
          }}
        />

        {/* ── Modal échec ── */}
        <FailModal
          visible={game.validationResult.status === 'failure'}
          onRetry={game.dismissValidation}
          onGiveUp={() => {
            game.resetGame();
            router.replace('/(tabs)/');
          }}
        />

        {/* ── Modal confirmation d'abandon ── */}
        <AbandonConfirmModal
          visible={showAbandonModal}
          onContinue={() => setShowAbandonModal(false)}
          onAbandon={handleAbandonConfirm}
        />

        {/* ── Modal changement de rang ── */}
        <RankUpModal
          visible={rankUpVisible}
          newRank={rankUpNewRank}
          previousRankLabel={rankUpPrevLabel}
          seedsAwarded={rankUpSeeds}
          seedsBeforeGain={rankUpSeedsBefore}
          onClose={() => setRankUpVisible(false)}
        />
      </View>

      {/* ── Briefing de niveau ── */}
      {challenge && levelMeta &&
       (briefingForcedOpen || (!briefingDone && challenge.challengeNumber === 1)) && (
        <LevelBriefingModal
          challenge={challenge}
          levelMeta={levelMeta}
          onClose={handleBriefingClose}
        />
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
  },
  loadingText: {
    fontSize: 16,
    color: Colors.ui.textLight,
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
  helpBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.forest.dark + '15',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.forest.dark + '30',
  },
  helpText: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.forest.dark,
  },
  headerCenter: {
    alignItems: 'center',
  },
  levelLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.forest.dark,
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
  },
  timerText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.forest.dark,
  },
  wrBadge: {
    fontSize: 9,
    color: Colors.ui.textLight,
    textAlign: 'center',
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
  validateBtn: {
    backgroundColor: Colors.forest.medium,
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
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.ui.background,
    padding: 4,
  },
  boardContainer: {
    width: '100%',
    maxWidth: 500,
    aspectRatio: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
});
