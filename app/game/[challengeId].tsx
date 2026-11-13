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
  AppState,
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
import { useRewardedAd } from '../../src/hooks/useRewardedAd';
import type { BonusId } from '../../src/constants/bonus';
import { useGameStore } from '../../src/store/gameStore';
import { usePlayerStore, getChallengeElapsed } from '../../src/store/playerStore';
import { AbandonConfirmModal } from '../../src/components/Game/AbandonConfirmModal';
import { auth } from '../../src/services/firebase';
import { buildSoloProgressionPayload, getPlayer, markCompleted, updateSeeds, updateSoloProgression, upsertPlayer } from '../../src/services/playerService';
import { PROGRESSION_V2 } from '../../src/constants/featureFlags';
import {
  buildStarSequence,
  computeSoloSeeds,
  computeStars,
  getLevelGaugeResult,
  getNextAfterWin,
  getLevelFromChallengeId,
  getVictoryNavigation,
} from '../../src/constants/progression';
import type { VictoryStarResult } from '../../src/components/Game/VictoryModal';
import { awardBadgesFirestore } from '../../src/services/badgeService';
import {
  WorldRecord,
  subscribeWorldRecord,
  trySetWorldRecord,
} from '../../src/services/worldRecordService';
import { getRankForLevel } from '../../src/constants/progression';
import { recordVictory } from '../../src/services/metricsService';

import { BoardRegistry } from '../../src/boards/BoardRegistry';
import { formatTime } from '../../src/utils/boardUtils';
import { Colors } from '../../src/constants/colors';
import { LEVEL_PARAMS } from '../../src/constants/difficulty';
import { LEVEL_META } from '../../src/data/levelMeta';
import { calculateSeedReward } from '../../src/core/engine/hintEngine';
import { awardEarnedTrophies, computeNextTrophies, readTrophyState } from '../../src/services/trophyService';
import type { NextTrophyItem } from '../../src/components/Badges/BadgeProgressInline';

import { FallingLeaves } from '../../src/components/Game/FallingLeaves';
import { useConfetti, Confetti } from '../../src/components/Game/Confetti';
import { ChallengeCountdown } from '../../src/components/Game/ChallengeCountdown';
import { useT } from '../../src/i18n';
import { showAlert } from '../../src/store/dialogStore';

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
import niveau16 from '../../src/data/challenges/niveau_16.json';
import niveau17 from '../../src/data/challenges/niveau_17.json';
import niveau18 from '../../src/data/challenges/niveau_18.json';
import niveau19 from '../../src/data/challenges/niveau_19.json';
import niveau20 from '../../src/data/challenges/niveau_20.json';
import niveau21 from '../../src/data/challenges/niveau_21.json';
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
  niveau_16: niveau16.challenges as Challenge[],
  niveau_17: niveau17.challenges as Challenge[],
  niveau_18: niveau18.challenges as Challenge[],
  niveau_19: niveau19.challenges as Challenge[],
  niveau_20: niveau20.challenges as Challenge[],
  niveau_21: niveau21.challenges as Challenge[],
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
  const t = useT();
  const { challengeId } = useLocalSearchParams<{ challengeId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  const game = useGame();
  const player = usePlayerStore();
  const audioIngameEnabled = useAudioStore(s => s.ingameEnabled);
  const setIngameEnabled   = useAudioStore(s => s.setIngameEnabled);

  // ── Countdown pré-défi ────────────────────────────────────
  // Countdown pré-défi :
  // - niveau 1 (avec briefing) : démarre après fermeture du briefing
  // - niveaux 2+ (sans briefing) : démarre immédiatement au montage
  const [countdownDone, setCountdownDone] = useState(false);

  // ── Briefing de niveau ─────────────────────────────────────
  const [briefingDone, setBriefingDone] = useState(false);
  const [briefingForcedOpen, setBriefingForcedOpen] = useState(false);

  const handleBriefingClose = useCallback(() => {
    const wasFirstOpen = !briefingDone;
    setBriefingDone(true);
    setBriefingForcedOpen(false);
    // Le timer démarrera après le countdown (voir handleCountdownDone)
    // On ne le démarre plus ici pour les premières ouvertures
    if (!wasFirstOpen && challengeId) {
      // Réouverture du briefing via bouton "?" — le timer était déjà lancé, rien à faire
    }
  }, [game, briefingDone, challengeId]);

  const handleCountdownDone = useCallback(() => {
    setCountdownDone(true);
    // Démarre le timer après le countdown
    if (challengeId) {
      const pState = usePlayerStore.getState();
      const priorElapsed = getChallengeElapsed(pState.challengeStartedAt, challengeId);
      game.startTimer(priorElapsed);
    }
  }, [game, challengeId]);

  // ── Badges toast queue ────────────────────────────────────
  const [badgeQueue, setBadgeQueue] = useState<string[]>([]);
  // « Prochains trophées » (3 plus proches) avec leur progression, pour la VictoryModal (Lot 8)
  const [nextTrophies, setNextTrophies] = useState<NextTrophyItem[]>([]);
  const [obtainedBadgeIds, setObtainedBadgeIds] = useState<string[]>([]);
  // nouveaux objectifs injectés par l'auto-avance CE tour (pour badge "Nouveau")
  const [newGoalBadgeIds, setNewGoalBadgeIds] = useState<string[]>([]);
  // Ref pour éviter le double-appel du useEffect isVictory
  const badgesEvaluatedRef = useRef(false);
  const countedChallengeIdRef = useRef<string | null>(null);
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

  // ── Recharge d'UN bonus via pub (joueur gratuit) ──────────
  // Chaque bonus a sa propre pub et son propre plafond quotidien (3 recharges). Un bonus à 0 propose sa pub
  // tout de suite, sans attendre l'autre ; la pub ne recharge que ce bonus. Premium : bonus illimités, aucune pub.
  const revealAd  = useRewardedAd('bonus_reveal_cell');
  const instinctAd = useRewardedAd('bonus_instinct');
  const bonusAdRemaining = {
    reveal_cell: revealAd.available ? revealAd.remaining : 0,
    instinct: instinctAd.available ? instinctAd.remaining : 0,
  };

  const handleWatchAd = useCallback((bonusId: BonusId) => {
    if (bonusId === 'reveal_cell') revealAd.watch();
    else if (bonusId === 'instinct') instinctAd.watch();
  }, [revealAd.watch, instinctAd.watch]);

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

  // ── AppState : arrêter le chrono si l'app passe en arrière-plan ───────────
  // Équivalent d'un abandon silencieux : le chrono se fige, l'abandon est enregistré.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'background' || nextState === 'inactive') {
        // Ne rien faire si la partie est déjà terminée ou pas encore démarrée
        const gameState = useGameStore.getState();
        if (!gameState.startTime || gameState.isVictory) return;
        // Geler le chrono
        gameState.stopTimer();
        // Enregistrer l'abandon pour qu'il compte dans les stats (ne navigue pas)
        if (challengeId) {
          usePlayerStore.getState().markChallengeAbandoned(challengeId);
        }
      }
    });
    return () => sub.remove();
  }, [challengeId]);

  // ── Reset de la garde d'évaluation des badges quand la victoire est annulée ──
  // Permet à la prochaine victoire (rejouer le même défi) d'être réévaluée.
  useEffect(() => {
    if (!game.isVictory) {
      badgesEvaluatedRef.current = false;
    }
  }, [game.isVictory]);

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
      if (countedChallengeIdRef.current !== challengeId) {
        countedChallengeIdRef.current = challengeId;
        if (!usePlayerStore.getState().consumeChallengeQuota()) {
          showAlert({
            title: t('challenge_quota_reached_title'),
            message: t('challenge_quota_reached_msg'),
            icon: '⏰',
          });
          router.replace('/(tabs)');
          return;
        }
      }

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

  // Plateau d'affichage : playerBoard + élément révélé superposé sur sa case
  const displayBoard = React.useMemo(() => {
    if (game.revealCellIndex === null || game.revealElementId === null) {
      return game.playerBoard;
    }
    const board = [...game.playerBoard];
    board[game.revealCellIndex] = game.revealElementId;
    return board;
  }, [game.playerBoard, game.revealCellIndex, game.revealElementId]);

  // ── Tap sur une case du plateau ───────────────────────────
  const handleCellPress = useCallback((cellIndex: number) => {
    // Mode révélation actif → le prochain clic révèle la solution de la case
    if (game.revealActive) {
      game.handleRevealCellPress(cellIndex);
      return;
    }

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

  // Graines de CE défi. Calculé au passage en victoire, AVANT le useEffect qui met le store à jour.
  //   - PROGRESSION_V2 : 1re victoire = calculateSeedReward ; défi rejoué = 5 🌱 par NOUVELLE étoile (C2).
  //   - sinon : calculateSeedReward à chaque victoire (comportement historique).
  const soloOutcome = React.useMemo(() => {
    if (!challenge) return { seeds: 0, stars: 1 as 1 | 2 | 3, isFirstWin: true, previousStars: 0, starsBefore: {} as Record<string, number> };
    const baseSeeds = calculateSeedReward(
      game.elapsedTime,
      challenge.estimatedDuration * 1000,
      game.bonusUsed
    );
    const stars = computeStars({
      failCount: failCountForGameRef.current,
      bonusUsedCount: game.bonusUsed.length,
      elementChangeCount: game.elementChangeCount,
    });
    // Meilleures notes AVANT la partie : sert à la séquence d'étoiles et à la jauge du niveau.
    // Lu ici (useMemo déclenché au passage en victoire), donc avant que recordSoloStars ne les modifie.
    const st = usePlayerStore.getState();
    const starsBefore: Record<string, number> = st.challengeStars;
    const previousStars: number = starsBefore[challenge.id] ?? 0;
    if (!PROGRESSION_V2) return { seeds: baseSeeds, stars, isFirstWin: true, previousStars, starsBefore };
    const isFirstWin = !st.completedChallenges.includes(challenge.id) && previousStars === 0;
    return {
      seeds: computeSoloSeeds({ isFirstWin, baseSeeds, previousStars, newStars: stars }),
      stars,
      isFirstWin,
      previousStars,
      starsBefore,
    };
  }, [game.isVictory]);

  // ── Étoiles de la victoire (Progression v2, Lot 2) ─────────────────────────
  // Uniquement quand l'interface des étoiles est active : sinon la VictoryModal reste celle d'avant.
  // Calculé sans lire le store APRÈS mise à jour : starsBefore est figé dans le useMemo ci-dessus,
  // starsAfter = starsBefore + la meilleure note de cette partie.
  const starResult = React.useMemo<VictoryStarResult | null>(() => {
    if (!PROGRESSION_V2 || !game.isVictory || !challenge) return null;
    const level = getLevelFromChallengeId(challenge.id);
    if (level === null) return null;
    const best = Math.max(soloOutcome.previousStars, soloOutcome.stars);
    const starsAfter = { ...soloOutcome.starsBefore, [challenge.id]: best };
    return {
      sequence: buildStarSequence(soloOutcome.stars, soloOutcome.previousStars),
      gauge: getLevelGaugeResult(level, soloOutcome.starsBefore, starsAfter),
      isReplay: !soloOutcome.isFirstWin,
    };
  }, [game.isVictory, soloOutcome]);
  const seedsEarned = soloOutcome.seeds;

  // ── Boutons de la VictoryModal (Progression v2) ──────────────────────────────
  // Niveau validé → bouton principal vers le niveau suivant + secondaire « continuer le niveau » ;
  // cérémonie en file → le principal ramène à l'accueil, où elle se joue (jamais sur l'écran de jeu).
  // `player` est abonné au store entier : `pendingCeremonies` se met à jour après l'effet de victoire.
  const victoryNav = React.useMemo(() => {
    if (!PROGRESSION_V2 || !game.isVictory || !challenge || !starResult) return null;
    const level = getLevelFromChallengeId(challenge.id);
    if (level === null) return null;
    const best = Math.max(soloOutcome.previousStars, soloOutcome.stars);
    return getVictoryNavigation({
      level,
      playedChallengeId: challenge.id,
      challengeStars: { ...soloOutcome.starsBefore, [challenge.id]: best },
      unlockedLevel: starResult.gauge.unlockedLevel,
      ceremonyPending: player.pendingCeremonies.length > 0,
    });
  }, [game.isVictory, challenge, starResult, soloOutcome, player.pendingCeremonies]);

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
    // Compteurs de trophées AVANT la partie : sert à animer le « +N » des prochains trophées
    const trophyStateBefore = readTrophyState(stateBeforeUpdate);

    // 2. Mise à jour locale immédiate (store Zustand)
    // seedsBeforeGain a été capturé dans handleValidate (state React) — déjà disponible
    // dans VictoryModal dès son premier rendu.
    // Progression v2 : étoiles AVANT markChallengeCompleted (qui ajoute le défi à completedChallenges :
    // l'état d'avant sert à savoir si c'est la 1re victoire). Garde la meilleure note.
    // Toujours enregistrées (additif, sans effet visible) ; seul le NIVEAU dépend de PROGRESSION_V2.
    player.recordSoloStars({
      challengeId: challenge.id,
      failCount: failsDuringGame,
      bonusUsedCount: game.bonusUsed.length,
      elementChangeCount: game.elementChangeCount,
      elapsedMs: game.elapsedTime,
      estimatedDurationMs: challenge.estimatedDuration * 1000,
    });
    player.markChallengeCompleted(challenge.id, game.elapsedTime, failsDuringGame, game.elementChangeCount, game.bonusUsed.length);
    if (seedsEarned > 0) player.addSeeds(seedsEarned);

    // Progression v2 (C3) : graines de fin de chapitre. Idempotent (jamais versées deux fois).
    // Versées ICI pour que le total local synchronisé plus bas les inclue ; la cérémonie
    // de chapitre qui les met en scène arrive au Lot 4.
    const chapterGrant = player.grantChapterRewards();
    // Carte d'Herbier de fin de chapitre (C6) : offerte une fois par chapitre récompensé (idempotent).
    player.grantChapterCards();
    // Cérémonies de fin de chapitre : MISES EN FILE ici (état persisté), JOUÉES plus tard — au retour sur
    // l'accueil, jamais pendant une partie ni par-dessus la VictoryModal (C7).
    player.enqueueCeremonies();

    // Détection du run parfait (PERFECT ×2).
    //   - PROGRESSION_V2 : ⭐⭐⭐ à la 1re victoire seulement (pas de ×2 en rejeu, C2) ;
    //   - sinon : aucun déplacement, aucun échec, aucun abandon, aucun bonus.
    const abandonCountForChallenge = stateBeforeUpdate.stats.abandonCount?.[challenge.id] ?? 0;
    const isPerfect = PROGRESSION_V2
      ? soloOutcome.stars === 3 && soloOutcome.isFirstWin
      : game.elementChangeCount === 0 &&
        failsDuringGame === 0 &&
        abandonCountForChallenge === 0 &&
        game.bonusUsed.length === 0;
    if (isPerfect && seedsEarned > 0) setIsPerfectRun(true);

    // 3. Trophées (Progression v2, C8) : plus d'« objectif actif » — TOUT trophée dont la condition est
    //    remplie est décerné, en un seul lot. Les compteurs (étoiles, séries, Herbier…) sont lus sur le store
    //    déjà mis à jour par recordSoloStars / markChallengeCompleted ci-dessus.
    const storeState = usePlayerStore.getState();
    const newBadges = awardEarnedTrophies({
      playedAt: new Date(),
      dailyStreak: storeState.dailyStreak,
      failCount: failsDuringGame,
      sameChallengePlaysBefore: sameChallengePlaysBeforeUpdate[challenge.id] ?? 0,
      seasonalChallengesPlayed: storeState.stats.seasonalChallengesPlayed,
      isFirstRecord: false,   // décerné plus bas, une fois le record du monde connu (Firestore)
      isWorldRecord: false,
    });
    if (newBadges.length > 0) {
      setBadgeQueue(newBadges);
      setObtainedBadgeIds(newBadges);
    }
    // Les 3 trophées les plus proches, avec leur progression (VictoryModal)
    setNextTrophies(computeNextTrophies(usePlayerStore.getState(), trophyStateBefore, newBadges));

    // Le changement de rang n'est plus une modale : le rang est le chapitre en cours (Progression v2,
    // C3 / D4) et sa célébration est la cérémonie de chapitre (Lot 4).

    // Total réel gagné ce défi = store actuel − score capturé avant validation
    // Inclut : graines de jeu + graines de trophées
    // Les graines de fin de chapitre (chapterGrant) sont exclues : la VictoryModal anime le gain de la
    // PARTIE ; la cérémonie de chapitre met en scène celles du chapitre.
    setTotalSeedsGained(usePlayerStore.getState().seeds - seedsBeforeGain - chapterGrant.seeds);

    // 3. Synchronisation Firestore en arrière-plan (si connecté, non anonyme)
    const uid = auth.currentUser?.uid;
    const username = auth.currentUser?.displayName ?? 'Joueur';
    const isAnonymous = auth.currentUser?.isAnonymous ?? true;
    // Le Record du Monde ne peut être battu que lors du premier essai (défi jamais complété avant) ET sans
    // aucun bonus : sinon un joueur premium (bonus illimités) ou un joueur gratuit rechargeant ses bonus par
    // vidéo pourrait s'en servir pour battre un record.
    const isFirstAttempt = !completedChallengesBeforeUpdate.includes(challenge.id);
    const canSetRecord = isFirstAttempt && game.bonusUsed.length === 0;
    if (uid && !isAnonymous) {
      (canSetRecord
        ? trySetWorldRecord(challenge.id, uid, username, game.elapsedTime)
        : Promise.resolve({ isNewRecord: false, previousRecord: null, newRecord: null })
      ).then(wrResult => {
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

      // ── Métriques de rétention ─────────────────────────────────────────────
      const stateForMetrics = usePlayerStore.getState();
      const rankForMetrics = { label: getRankForLevel(stateForMetrics.currentLevel).labelFr };
      recordVictory(
        uid,
        'solo',
        game.elapsedTime,
        failsDuringGame,
        seedsEarned,
        stateForMetrics.currentLevel,
        stateForMetrics.seeds,
        stateForMetrics.earnedBadges.length,
        rankForMetrics.label,
      ).catch(() => {});

      // Capturer le total local final AVANT l'appel async (inclut jeu + badges + rang)
      const finalLocalSeeds = usePlayerStore.getState().seeds;
      getPlayer(uid).then(async profile => {
        if (profile) {
          await markCompleted(uid, challenge.id, game.elapsedTime, profile);
          {
            await updateSoloProgression(uid, buildSoloProgressionPayload(usePlayerStore.getState()));
          }
          // Utiliser le total local plutôt que profile.seeds + seedsEarned :
          // profile.seeds peut être en retard (pas de badges ni de rang comptabilisés)
          await updateSeeds(uid, finalLocalSeeds);
          if (newBadges.length > 0) {
            await awardBadgesFirestore(uid, newBadges);
          }
          // Classement : publié par `(tabs)/_layout.tsx` (point d'entrée unique, tous modes confondus, Lot C).
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
      <GestureHandlerRootView style={styles.root}>
        <View style={[styles.loading, { paddingTop: insets.top }]}>
          <Text style={styles.loadingText}>{t('game_loading')}</Text>
        </View>
      </GestureHandlerRootView>
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
              <Text style={styles.backText}>{'← '}{t('abandon_confirm')}</Text>
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
              {t('level_prefix')} {levelNumber}
            </Text>
            <Text style={styles.challengeLabel}>{t('victory_challenge_label', { number: String(challenge.challengeNumber) })}</Text>
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
          highlightDeadline={game.revealDeadline}
          instinctDeadline={game.instinctDeadline}
          highlightActive={game.revealActive}
          revealActive={game.revealActive}
          hasPlacedElements={hasPlacedElements}
          adRemaining={bonusAdRemaining}
          onWatchAd={handleWatchAd}
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
              <Text style={styles.validateBtnText}>{t('onf_validate')}</Text>
            </TouchableOpacity>
          }
        />

        {/* ── Plateau ── */}
        <View style={styles.boardArea}>
          <View style={[styles.boardContainer, { maxHeight: Math.min(screenWidth, screenHeight * 0.52) }]}>
            <BoardRenderer
              boardDef={boardDef}
              playerBoard={displayBoard}
              fixedCells={fixedCells}
              selectedElement={game.revealActive ? null : game.selectedElement}
              highlightActive={game.validHintCells.length > 0 || game.errorHintCells.length > 0 || game.revealCellIndex !== null}
              getCellColor={(idx) => game.getCellColor(idx)}
              onCellPress={handleCellPress}
              challengeKey={challenge?.id}
            />
          </View>
        </View>

        {/* ── Palette (non sélectionnable en mode révélation) ── */}
        <View style={{ position: 'relative' }}>
          <ElementPalette
            availableTokens={challenge.availableTokens}
            playerBoard={displayBoard}
            fixedCells={fixedCells}
            selectedElement={game.selectedElement}
            onSelectElement={game.selectElement}
            onClearAll={game.clearPlayerBoard}
          />
          {/* Overlay bloquant les interactions palette quand reveal actif */}
          {game.revealActive && (
            <View style={styles.paletteOverlay} pointerEvents="box-only" />
          )}
        </View>

        {/* ── Modal victoire ── */}
        <VictoryModal
          visible={game.isVictory}
          elapsedTime={game.elapsedTime}
          seedsEarned={totalSeedsGained || seedsEarned}
          seedsBeforeGain={seedsBeforeGain}
          difficulty={challenge.level}
          challengeNumber={challenge.challengeNumber}
          confettiPieces={confettiPieces}
          nextTrophies={nextTrophies}
          obtainedBadgeIds={obtainedBadgeIds}
          badgeQueue={badgeQueue}
          onBadgeQueueEmpty={() => setBadgeQueue([])}
          worldRecord={isNewWorldRecord ? null : worldRecord}
          isNewWorldRecord={isNewWorldRecord}
          previousRecordHolder={previousRecordHolder}
          starResult={starResult}
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
            if (PROGRESSION_V2) {
              // Progression v2 : accès libre aux 10 défis d'un niveau ouvert (D13). Destination calculée
              // par getVictoryNavigation : niveau suivant si le niveau vient d'être validé, accueil si une
              // cérémonie est en file (elle s'y joue), sinon prochain défi conseillé.
              if (victoryNav) {
                router.replace(
                  victoryNav.primary.kind === 'challenge'
                    ? `/game/${victoryNav.primary.challengeId}`
                    : '/(tabs)/',
                );
              } else {
                const after = usePlayerStore.getState().challengeStars;
                const level = getLevelFromChallengeId(challenge.id);
                const target = level !== null ? getNextAfterWin(level, challenge.id, after) : null;
                router.replace(target ? `/game/${target}` : '/(tabs)/');
              }
            } else if (nextExists) {
              // Défi suivant dans le même niveau
              router.replace(`/game/${nextId}`);
            } else {
              // Dernier défi du niveau → passer au niveau suivant si disponible
              const currentLevelNum = parseInt(challenge.level.replace('niveau_', ''), 10);
              const nextLevelKey = `niveau_${currentLevelNum + 1}`;
              const nextLevelChallenges = ALL_CHALLENGES[nextLevelKey];
              if (nextLevelChallenges && nextLevelChallenges.length > 0) {
                const firstNextChallenge = nextLevelChallenges[0];
                router.replace(`/game/${firstNextChallenge.id}`);
              } else {
                // Dernier niveau atteint → retour à l'accueil
                router.replace('/(tabs)/');
              }
            }
          }}
          nextChallengeLabel={
            victoryNav?.primaryLabel === 'next_level' && victoryNav.primaryLevel !== null
              ? t('victory_go_next_level', { level: String(victoryNav.primaryLevel) })
              : victoryNav?.primaryLabel === 'ceremony'
                ? t('victory_go_home_ceremony')
                : undefined
          }
          onSecondaryAction={
            victoryNav?.secondary
              ? () => {
                  const target = victoryNav.secondary;
                  game.resetGame();
                  if (target) router.replace(`/game/${target.challengeId}`);
                }
              : undefined
          }
          secondaryActionLabel={
            victoryNav?.secondary
              ? t('victory_continue_level', { level: String(victoryNav.secondary.level) })
              : undefined
          }
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

      {/* ── Countdown pré-défi ──
           Affiché après le briefing (niveau 1) ou immédiatement (niveaux 2+).
           Le briefing forcé (bouton "?") ne redéclenche PAS le countdown. */}
      {!countdownDone && challenge &&
       (challenge.challengeNumber !== 1 || briefingDone) && (
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
  paletteOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.12)',
    borderRadius: 8,
    zIndex: 10,
  },
  boardContainer: {
    width: '100%',
    maxWidth: 500,
    aspectRatio: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
});
