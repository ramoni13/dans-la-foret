// ============================================================
// ÉCRAN DE JEU ONF — Mode Grille Forestière (Sudoku Forestier)
//
// Route : /game/onf
//
// Différences avec le mode normal :
// - Défis pré-générés (src/data/onf_challenges.json)
// - Sélection aléatoire d'un défi non encore complété
// - Contrainte supplémentaire : max 1 élément par ligne ET par colonne
// - Validation combinée : validateBoard() + validateRowColUnique()
// - Victoire → défi marqué complété en local + Firestore
// - Message "Vous avez réussi tous les défis" si tous terminés
// - Bouton "Nouveau défi" pour rejouer sans quitter l'écran
// ============================================================

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  BackHandler,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useAudioStore } from '../../src/store/audioStore';

import { BoardRenderer } from '../../src/components/Board/BoardRenderer';
import { ElementPalette } from '../../src/components/Elements/ElementPalette';
import { VictoryModal } from '../../src/components/Game/VictoryModal';
import { FailModal } from '../../src/components/Game/FailModal';
import { OnfBriefingModal } from '../../src/components/LevelBriefing/OnfBriefingModal';
import { useGame } from '../../src/hooks/useGame';
import { usePlayerStore } from '../../src/store/playerStore';
import { BoardRegistry } from '../../src/boards/BoardRegistry';
import { formatTime } from '../../src/utils/boardUtils';
import { useFrameLayout } from '../../src/constants/frameLayout';
import { Colors } from '../../src/constants/colors';
import { FallingLeaves } from '../../src/components/Game/FallingLeaves';
import { PremiumCard } from '../../src/components/Premium/PremiumCard';
import { getPlayerScore, getRank, RANK_DEFINITIONS, PlayerActivityStats } from '../../src/constants/badges';
import { recordVictory } from '../../src/services/metricsService';
import { RankUpModal, RANK_SEED_REWARDS } from '../../src/components/Game/RankUpModal';
import { evaluateOnfBadges, OnfGameContext } from '../../src/core/engine/badgeEngine';
import { awardBadgesFirestore } from '../../src/services/badgeService';

import {
  pickOnfChallenge,
  calculateOnfReward,
  getTotalOnfChallenges,
} from '../../src/services/onfChallengeService';
import {
  validateBoard,
  validateRowColUnique,
  checkVictory,
} from '../../src/core/engine/validator';
import { ElementRegistry } from '../../src/elements/ElementRegistry';
import {
  updateSeeds,
  upsertPlayer,
  markOnfChallengeCompleted,
} from '../../src/services/playerService';
import { getJustUnlockedCard } from '../../src/utils/onfCards';
import { TreeCard } from '../../src/data/treesData';
import { ONFCardUnlockBanner } from '../../src/components/ONF/ONFCardUnlockBanner';
import { TreeCardGallery } from '../../src/components/ONF/TreeCardGallery';
import { useT } from '../../src/i18n';

const native = Platform.OS !== 'web';

// ── Constantes visuelles ─────────────────────────────────────────────────────

// AIDE DÉSACTIVÉE : couleur rouge pour les violations ligne/colonne.
// Réactiver si les joueurs demandent ce retour visuel.
// const ROW_COL_VIOLATION_COLOR = Colors.cell.wrong;

// ── Composant principal ──────────────────────────────────────────────────────

export default function ONFGameScreen() {
  const t = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const game = useGame();
  const player = usePlayerStore();
  const audioIngameEnabled = useAudioStore(s => s.ingameEnabled);
  const setIngameEnabled   = useAudioStore(s => s.setIngameEnabled);
  const { borderW } = useFrameLayout();
  // ── État local ────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [allCompleted, setAllCompleted] = useState(false);
  const [seedsEarned, setSeedsEarned] = useState(0);
  const [seedsBeforeGain, setSeedsBeforeGain] = useState(0);
  const [badgeQueue, setBadgeQueue] = useState<string[]>([]);
  // AIDE DÉSACTIVÉE : violations ligne/colonne calculées après la validation.
  // Réactiver si les joueurs demandent ce retour visuel.
  // const [rowColViolationCells, setRowColViolationCells] = useState<number[]>([]);
  /** Briefing affiché avant la première partie ONF */
  const [briefingDone, setBriefingDone] = useState(player.hasSeenOnfBriefing);
  const [showPremium, setShowPremium] = useState(false);
  /** Limite quotidienne ONF atteinte (free uniquement) */
  const ONF_DAILY_LIMIT = 3;
  const dailyLimitReached = !player.isPremium && player.onfDailyCount >= ONF_DAILY_LIMIT;

  const [showFailModal, setShowFailModal] = useState(false);
  const badgesEvaluatedRef = useRef(false);
  /** Nombre de validations incorrectes pendant cette partie ONF */
  const onfFailCountRef = useRef(0);
  /** Carte nouvellement débloquée — déclenche ONFCardUnlockBanner */
  const [justUnlockedCard, setJustUnlockedCard] = useState<TreeCard | null>(null);
  const [galleryVisible, setGalleryVisible] = useState(false);
  const [rankUpVisible, setRankUpVisible]         = useState(false);
  const [rankUpNewRank, setRankUpNewRank]          = useState(RANK_DEFINITIONS[0]);
  const [rankUpPrevLabel, setRankUpPrevLabel]      = useState('');
  const [rankUpSeeds, setRankUpSeeds]              = useState(0);
  const [rankUpSeedsBefore, setRankUpSeedsBefore]  = useState(0);

  // ── Sélection et chargement d'un défi ────────────────────
  //
  // Deux chemins selon le contexte :
  // • Premier chargement (initialLoad=true) : écran de loading affiché
  //   pour laisser React rendre avant le calcul synchrone du solveur.
  // • Rechargement suivant (initialLoad=false, ex: "Nouveau défi") :
  //   le JSX principal reste monté — on évite de démonter/remonter
  //   GestureHandlerRootView et toutes les Cell (source du bug d'opacité
  //   sur le thread natif Android avec useNativeDriver:true).
  const pickAndLoad = useCallback((initialLoad = false) => {
    setAllCompleted(false);
    // setRowColViolationCells([]); // AIDE DÉSACTIVÉE
    setShowFailModal(false);
    badgesEvaluatedRef.current = false;
    onfFailCountRef.current = 0;

    const run = () => {
      const state = usePlayerStore.getState();
      const completedIds = state.completedOnfChallengeIds;

      const result = pickOnfChallenge(completedIds);

      if (result.allCompleted || !result.challenge) {
        setAllCompleted(true);
        setLoading(false);
        return;
      }

      game.loadChallenge(result.challenge);
      // Mode ONF : aucun bonus disponible
      game.setBonusDisabled(true);
      // Le timer démarre après la fermeture du briefing (ou immédiatement si déjà vu)
      if (usePlayerStore.getState().hasSeenOnfBriefing) {
        game.startTimer(0);
      }
      setLoading(false);
    };

    if (initialLoad) {
      // Premier chargement : afficher l'écran de chargement d'abord,
      // puis exécuter le solveur après un tick (évite le freeze UI).
      setLoading(true);
      const timeout = setTimeout(run, 16);
      return () => clearTimeout(timeout);
    } else {
      // Rechargement : exécuter directement sans passer par loading=true,
      // le JSX principal reste monté et les Cell ne sont pas recréées.
      run();
    }
  }, []);

  useEffect(() => {
    pickAndLoad(true);
  }, []);

  // ── Fermeture du briefing ─────────────────────────────────
  const handleBriefingClose = useCallback(() => {
    player.markOnfBriefingSeen();
    setBriefingDone(true);
    setTimeout(() => game.startTimer(0), 50);
  }, [player, game]);

  // ── Données dérivées ──────────────────────────────────────
  const challenge = game.challenge;
  const boardDef = challenge ? BoardRegistry[challenge.boardId] : null;

  const fixedCells = useMemo(() => {
    if (!challenge) return new Set<number>();
    return new Set(challenge.fixedPlacements.map(fp => fp.cellIndex));
  }, [challenge]);

  // Toutes les cases remplies ?
  const allFilled = challenge
    ? game.playerBoard.every((el, i) =>
        el !== null || challenge.fixedPlacements.some(fp => fp.cellIndex === i)
      )
    : false;

  // ── Couleur des cases ─────────────────────────────────────
  const getCellColorOnf = useCallback((cellIndex: number): string => {
    // AIDE DÉSACTIVÉE : coloration rouge des cases en erreur après validation.
    // Réactiver si les joueurs demandent ce retour visuel.
    // if (rowColViolationCells.includes(cellIndex)) {
    //   return ROW_COL_VIOLATION_COLOR;
    // }

    // Case fixe
    if (fixedCells.has(cellIndex)) {
      return Colors.cell.fixed;
    }
    // Vide
    return Colors.cell.empty;
  }, [fixedCells]);

  // ── Tap sur une case ──────────────────────────────────────
  const handleCellPress = useCallback((cellIndex: number) => {
    if (game.selectedElement) {
      game.placeAndDeselect(cellIndex, game.selectedElement);
    } else if (game.playerBoard[cellIndex] && !fixedCells.has(cellIndex)) {
      game.removeElement(cellIndex);
    }
  }, [game, fixedCells]);

  // ── Validation ────────────────────────────────────────────
  const handleValidate = useCallback(() => {
    if (!challenge || !boardDef) return;
    setSeedsBeforeGain(usePlayerStore.getState().seeds);

    // 1. Construire le plateau complet (cases fixes + joueur)
    const fullBoard = game.playerBoard.map((el, i) => {
      if (el) return el;
      const fixed = challenge.fixedPlacements.find(fp => fp.cellIndex === i);
      return fixed ? fixed.elementId : null;
    });

    // 2. Vérification standard
    const standardResult = validateBoard(fullBoard, boardDef, ElementRegistry);

    // 3. Vérification ligne/colonne ONF
    const rowColViolations = boardDef.gridMeta
      ? validateRowColUnique(fullBoard, boardDef.gridMeta)
      : [];

    const allViolations = [...standardResult.violations, ...rowColViolations];
    const rowColCells = rowColViolations.map(v => v.cellIndex);

    if (allViolations.length > 0) {
      // AIDE DÉSACTIVÉE : affichage des cases en erreur (rouge) après validation échouée.
      // Réactiver si les joueurs demandent ce retour visuel.
      // setRowColViolationCells(rowColCells);
      // game.validateChallenge(); // met à jour game.validationResult pour les violations standard
      onfFailCountRef.current += 1;
      setShowFailModal(true);
      return;
    }

    // 4. Victoire (solution correcte)
    // setRowColViolationCells([]); // AIDE DÉSACTIVÉE
    game.validateChallenge();
  }, [challenge, boardDef, game]);

  // ── Effet victoire ─────────────────────────────────────────
  useEffect(() => {
    if (!game.isVictory || !challenge) return;
    if (badgesEvaluatedRef.current) return;
    badgesEvaluatedRef.current = true;

    const earned = calculateOnfReward(game.elapsedTime);
    // seedsBeforeGain a été capturé dans handleValidate (state React) — déjà disponible
    // dans VictoryModal dès son premier rendu.
    setSeedsEarned(earned);

    // Capture du score AVANT recordOnfVictory (qui incrémente onfSolvedCount)
    const stateBeforeOnf = usePlayerStore.getState();
    const activityStatsBefore: PlayerActivityStats = {
      soloCompleted:   stateBeforeOnf.completedChallenges.length,
      friendCompleted: stateBeforeOnf.stats.friendPlayed,
      onfCompleted:    stateBeforeOnf.onfSolvedCount,
      dailyCompleted:  stateBeforeOnf.stats.dailyWon,
    };
    const scoreBeforeOnf = getPlayerScore(stateBeforeOnf.earnedBadges, activityStatsBefore);
    const rankBeforeOnf  = getRank(scoreBeforeOnf);

    player.addSeeds(earned);

    // Marquer le défi comme complété + incrémenter les compteurs badges ONF
    player.recordOnfVictory(challenge.id, onfFailCountRef.current, game.elapsedTime);
    // Incrémenter le compteur quotidien (limite free = 3/jour)
    player.incrementOnfDaily();

    // ── Cartes à collectionner (Herbier de la Forêt) ─────────────
    const countBefore = stateBeforeOnf.onfSolvedCount;
    const stateAfterCards = usePlayerStore.getState();
    const countAfter = stateAfterCards.onfSolvedCount;
    const justUnlocked = getJustUnlockedCard(countBefore, countAfter);
    if (justUnlocked) {
      player.collectTreeCard(justUnlocked.id);
      setJustUnlockedCard(justUnlocked);
    }

    // Évaluer les badges ONF
    const stateAfterOnfRecord = usePlayerStore.getState();
    const activeGoalsBeforeOnf = stateBeforeOnf.activeBadgeGoals;
    const onfCtx: OnfGameContext = {
      onfSolvedCount:  stateAfterOnfRecord.onfSolvedCount,
      onfPerfectCount: stateAfterOnfRecord.stats.onfPerfectCount,
      onfSpeedCount:   stateAfterOnfRecord.stats.onfSpeedCount,
      earnedBadges:    stateBeforeOnf.earnedBadges,
      activeBadgeGoals: stateBeforeOnf.activeBadgeGoals,
      goalCounters:    stateBeforeOnf.goalCounters,
    };
    const newOnfBadges = evaluateOnfBadges(onfCtx);
    if (newOnfBadges.length > 0) {
      player.awardBadges(newOnfBadges);
      setBadgeQueue(newOnfBadges);
    }
    // Auto-avance des objectifs
    const allEarnedNowOnf = usePlayerStore.getState().earnedBadges;
    const completedGoalIdsOnf = activeGoalsBeforeOnf.filter(id => allEarnedNowOnf.includes(id));
    if (completedGoalIdsOnf.length > 0) {
      player.advanceGoalAuto(completedGoalIdsOnf, allEarnedNowOnf);
    }

    // ── Détection changement de rang ─────────────────────────
    const stateAfterOnf = usePlayerStore.getState();
    const activityStatsAfter: PlayerActivityStats = {
      soloCompleted:   stateAfterOnf.completedChallenges.length,
      friendCompleted: stateAfterOnf.stats.friendPlayed,
      onfCompleted:    stateAfterOnf.onfSolvedCount,
      dailyCompleted:  stateAfterOnf.stats.dailyWon,
    };
    const scoreAfterOnf = getPlayerScore(stateAfterOnf.earnedBadges, activityStatsAfter);
    const rankAfterOnf  = getRank(scoreAfterOnf);
    if (rankAfterOnf.id !== rankBeforeOnf.id) {
      const rankSeeds = RANK_SEED_REWARDS[rankAfterOnf.id] ?? 0;
      if (rankSeeds > 0) {
        setRankUpSeedsBefore(usePlayerStore.getState().seeds);
        player.addSeeds(rankSeeds);
      }
      const lang = usePlayerStore.getState().language;
      setRankUpPrevLabel(lang === 'en' ? rankBeforeOnf.labelEn : rankBeforeOnf.label);
      setRankUpNewRank(rankAfterOnf);
      setRankUpSeeds(rankSeeds);
      setTimeout(() => setRankUpVisible(true), 1800);
    }

    // Sync Firestore en arrière-plan
    const uid = player.userId;
    if (uid) {
      // ── Métriques de rétention ─────────────────────────────────────────────
      const stateForMetrics = usePlayerStore.getState();
      const rankForMetrics = getRank(getPlayerScore(stateForMetrics.earnedBadges, {
        soloCompleted:   stateForMetrics.completedChallenges.length,
        friendCompleted: stateForMetrics.stats.friendPlayed,
        onfCompleted:    stateForMetrics.onfSolvedCount,
        dailyCompleted:  stateForMetrics.stats.dailyWon,
      }));
      recordVictory(
        uid,
        'onf',
        game.elapsedTime,
        onfFailCountRef.current,
        earned,
        stateForMetrics.currentLevel,
        stateForMetrics.seeds,
        stateForMetrics.earnedBadges.length,
        rankForMetrics.label,
      ).catch(() => {});
      const finalState = usePlayerStore.getState();
      // 1. Sync des graines
      updateSeeds(uid, finalState.seeds).catch(() => {});
      // 2. Marquer le défi complété + compteur ONF dans Firestore
      markOnfChallengeCompleted(uid, challenge.id, finalState.onfSolvedCount).catch(() => {});
      // 3. Sync badges ONF
      if (newOnfBadges.length > 0) {
        awardBadgesFirestore(uid, newOnfBadges).catch(() => {});
      }
      // 4. Sync profil complet (seeds, earnedBadges, etc.)
      upsertPlayer({
        userId: uid,
        username: finalState.username,
        seeds: finalState.seeds,
        completedChallenges: finalState.completedChallenges,
        stats: finalState.stats,
        isPremium: finalState.isPremium,
        earnedBadges: finalState.earnedBadges,
        badgeShowcase: finalState.badgeShowcase.filter((b): b is string => !!b),
        dailyStreak: finalState.dailyStreak,
        lastPlayedDate: finalState.lastPlayedDate,
        onfSolvedCount: finalState.onfSolvedCount,
        completedOnfChallengeIds: finalState.completedOnfChallengeIds,
        collectedTreeCardIds: finalState.collectedTreeCardIds,
      }).catch(() => {});
    }
  }, [game.isVictory]);

  // ── BackHandler Android ───────────────────────────────────
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      game.resetGame();
      router.replace('/(tabs)');
      return true;
    });
    return () => sub.remove();
  }, []);

  // AIDE DÉSACTIVÉE : effacement des violations rouge au prochain placement.
  // Réactiver si les joueurs demandent ce retour visuel.
  // useEffect(() => {
  //   if (rowColViolationCells.length > 0) {
  //     setRowColViolationCells([]);
  //   }
  // }, [game.playerBoard]);

  // ── Limite quotidienne atteinte (free) ───────────────────
  if (dailyLimitReached) {
    return (
      <View style={[styles.loading, { paddingTop: insets.top }]}>
        <Text style={styles.allCompletedEmoji}>🌲</Text>
        <Text style={styles.allCompletedTitle}>
          {t('onf_daily_limit_title')}
        </Text>
        <Text style={styles.allCompletedText}>
          {t('onf_daily_limit_msg', { count: String(ONF_DAILY_LIMIT) })}
        </Text>
        <TouchableOpacity
          style={styles.errorBtn}
          onPress={() => router.replace('/(tabs)')}
          activeOpacity={0.8}
        >
          <Text style={styles.errorBtnText}>{t('onf_daily_limit_back')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.premiumBtn}
          onPress={() => setShowPremium(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.premiumBtnText}>{t('onf_daily_limit_premium')}</Text>
        </TouchableOpacity>
        <PremiumCard
          visible={showPremium}
          onClose={() => setShowPremium(false)}
          onPurchase={() => {
            player.unlockPremium();
            setShowPremium(false);
          }}
        />
      </View>
    );
  }

  // ── Chargement ────────────────────────────────────────────
  if (loading) {
    return (
      <View style={[styles.loading, { paddingTop: insets.top }]}>
        <Text style={styles.loadingText}>
          Chargement du défi...
        </Text>
      </View>
    );
  }

  // ── Tous les défis terminés ───────────────────────────────
  if (allCompleted) {
    const total = getTotalOnfChallenges();
    return (
      <View style={[styles.loading, { paddingTop: insets.top }]}>
        <Text style={styles.allCompletedEmoji}>🏆</Text>
        <Text style={styles.allCompletedTitle}>
          {t('onf_all_completed_title')}
        </Text>
        <Text style={styles.allCompletedText}>
          {t('onf_all_completed_msg', { count: String(total), total: String(total) })}
        </Text>
        <TouchableOpacity
          style={styles.errorBtn}
          onPress={() => router.replace('/(tabs)')}
          activeOpacity={0.8}
        >
          <Text style={styles.errorBtnText}>{t('onf_back_home')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!challenge || !boardDef) {
    return (
      <View style={[styles.loading, { paddingTop: insets.top }]}>
        <Text style={styles.loadingText}>{t('onf_loading')}</Text>
      </View>
    );
  }

  // Progression : numéro du défi en cours = défis réussis + 1
  // On utilise onfSolvedCount (compteur unifié) plutôt que completedOnfChallengeIds.length
  // car completedOnfChallengeIds ne contient que les IDs uniques (peut être < onfSolvedCount
  // si des défis ont été rejoués après reset ou si les IDs ne correspondent pas 1-pour-1).
  const completedCount = player.onfSolvedCount;
  const totalCount = getTotalOnfChallenges();
  const gridLabel = t('onf_header_progress', { current: String(completedCount + 1), total: String(totalCount) });

  return (
    <GestureHandlerRootView style={styles.root}>
      <FallingLeaves />

      <View
        style={[
          styles.root,
          {
            paddingTop: insets.top,
            paddingBottom: Math.max(insets.bottom, 8),
            paddingHorizontal: borderW,
          },
        ]}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity
              onPress={() => { game.resetGame(); router.replace('/(tabs)'); }}
              style={styles.backBtn}
            >
              <Text style={styles.backText}>{t('onf_quit')}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.headerCenter}>
            <Text style={styles.levelLabel}>{t('onf_header_mode')}</Text>
            <Text style={styles.challengeLabel}>{gridLabel}</Text>
          </View>

          <View style={styles.headerRight}>
            <View style={styles.timer}>
              <Text style={styles.timerText}>{formatTime(game.elapsedTime)}</Text>
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

        {/* ── Bannière contrainte sudoku ── */}
        <View style={styles.onfBanner}>
          <Text style={styles.onfBannerText}>
            {t('onf_sudoku_banner')}
          </Text>
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
        </View>

        {/* ── Plateau ── */}
        <View style={styles.boardArea}>
          <BoardRenderer
            boardDef={boardDef}
            playerBoard={game.playerBoard}
            fixedCells={fixedCells}
            selectedElement={game.selectedElement}
            highlightActive={false}
            getCellColor={getCellColorOnf}
            onCellPress={handleCellPress}
            challengeKey={challenge?.id}
          />
        </View>

        {/* ── Palette ── */}
        <ElementPalette
          availableTokens={challenge.availableTokens}
          playerBoard={game.playerBoard}
          fixedCells={fixedCells}
          selectedElement={game.selectedElement}
          onSelectElement={game.selectElement}
          onClearAll={game.clearPlayerBoard}
        />

        {/* ── Modal échec ── */}
        <FailModal
          visible={showFailModal}
          onRetry={() => setShowFailModal(false)}
          onGiveUp={() => {
            setShowFailModal(false);
            game.resetGame();
            router.replace('/(tabs)');
          }}
        />

        {/* ── Modal victoire ── */}
        <VictoryModal
          visible={game.isVictory}
          elapsedTime={game.elapsedTime}
          seedsEarned={seedsEarned}
          seedsBeforeGain={seedsBeforeGain}
          difficulty={'niveau_1' as any}
          challengeNumber={0}
          badgeQueue={badgeQueue}
          onBadgeQueueEmpty={() => setBadgeQueue([])}
          isNewWorldRecord={false}
          previousRecordHolder={null}
          onNextChallenge={() => {
            setJustUnlockedCard(null);
            game.resetGame();
            pickAndLoad();
          }}
          onBackToMenu={() => {
            setJustUnlockedCard(null);
            game.resetGame();
            router.replace('/(tabs)');
          }}
        />
      </View>

      {/* ── Briefing ONF (première partie uniquement) ── */}
      {challenge && !briefingDone && (
        <OnfBriefingModal
          challenge={challenge}
          onClose={handleBriefingClose}
        />
      )}

      {/* ── Modal changement de rang ── */}
      <RankUpModal
        visible={rankUpVisible}
        newRank={rankUpNewRank}
        previousRankLabel={rankUpPrevLabel}
        seedsAwarded={rankUpSeeds}
        seedsBeforeGain={rankUpSeedsBefore}
        onClose={() => setRankUpVisible(false)}
      />

      {/* ── Banner carte débloquée (Herbier de la Forêt) ── */}
      {justUnlockedCard && game.isVictory && (
        <ONFCardUnlockBanner
          card={justUnlockedCard}
          onDiscover={() => {
            setGalleryVisible(true);
          }}
          onClose={() => setJustUnlockedCard(null)}
        />
      )}

      {/* ── Galerie herbier ── */}
      <TreeCardGallery
        visible={galleryVisible}
        onClose={() => setGalleryVisible(false)}
        onfSolvedCount={player.onfSolvedCount}
        initialCardId={justUnlockedCard?.id}
      />

    </GestureHandlerRootView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

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
    textAlign: 'center',
    paddingHorizontal: 32,
  },

  // Écran "tous complétés"
  allCompletedEmoji: {
    fontSize: 64,
    marginBottom: 8,
  },
  allCompletedTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.forest.dark,
    textAlign: 'center',
  },
  allCompletedText: {
    fontSize: 16,
    color: Colors.ui.textLight,
    textAlign: 'center',
    paddingHorizontal: 32,
    lineHeight: 22,
  },

  errorBtn: {
    backgroundColor: Colors.forest.medium,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginTop: 8,
  },
  errorBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  premiumBtn: {
    marginTop: 12,
    backgroundColor: 'rgba(139,195,74,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(139,195,74,0.6)',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  premiumBtnText: {
    color: Colors.forest.accent,
    fontSize: 14,
    fontWeight: '700',
  },

  // Header
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
  },
  backBtn: { padding: 4 },
  backText: {
    fontSize: 14,
    color: Colors.forest.medium,
    fontWeight: '600',
  },
  headerCenter: { alignItems: 'center' },
  levelLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4A7C59',
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
  speakerIcon: { fontSize: 18 },

  // Bannière ONF
  onfBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#E8F5E9',
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#C8E6C9',
  },
  onfBannerText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2E7D32',
    flex: 1,
    marginRight: 12,
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

  // Plateau
  boardArea: {
    flex: 1,
    alignItems: 'stretch',
    justifyContent: 'flex-start',
    backgroundColor: Colors.ui.background,
    paddingVertical: 4,
  },
});

