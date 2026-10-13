// ============================================================
// ÉCRAN DE JEU ONF — Mode Grille Forestière (Sudoku Forestier)
//
// Route : /game/onf?size=3  ou  /game/onf?size=4
//
// Différences avec le mode normal :
// - Contrainte supplémentaire : max 1 élément par ligne ET par colonne
// - Validation combinée : validateBoard() + validateRowColUnique()
// - Victoire via checkVictory() seul (solution pré-calculée par solveOnf)
// - Pas de markChallengeCompleted (ONF ne fait pas progresser le niveau)
// - incrementOnf3x3Solved() ou incrementOnf4x4Solved() après victoire
// - Bouton "Nouveau défi" pour rejouer sans quitter l'écran
// - Surlignage ligne/colonne de la case sélectionnée (Option A)
// ============================================================

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  BackHandler,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useAudioStore } from '../../src/store/audioStore';

import { BoardRenderer } from '../../src/components/Board/BoardRenderer';
import { ElementPalette } from '../../src/components/Elements/ElementPalette';
import { VictoryModal } from '../../src/components/Game/VictoryModal';
import { useGame } from '../../src/hooks/useGame';
import { usePlayerStore } from '../../src/store/playerStore';
import { BoardRegistry } from '../../src/boards/BoardRegistry';
import { formatTime } from '../../src/utils/boardUtils';
import { useFrameLayout } from '../../src/constants/frameLayout';
import { Colors } from '../../src/constants/colors';
import { FallingLeaves } from '../../src/components/Game/FallingLeaves';
import { useConfetti, Confetti } from '../../src/components/Game/Confetti';

import {
  generateOnfChallenge,
  calculateOnfReward,
  compositionKey,
} from '../../src/services/onfChallengeService';
import {
  validateBoard,
  validateRowColUnique,
  checkVictory,
} from '../../src/core/engine/validator';
import { ElementRegistry } from '../../src/elements/ElementRegistry';
import { updateSeeds, upsertPlayer } from '../../src/services/playerService';

const native = Platform.OS !== 'web';

// ── Constantes visuelles ─────────────────────────────────────────────────────

/** Couleur pour les violations ligne/colonne */
const ROW_COL_VIOLATION_COLOR = Colors.cell.wrong;

// ── Composant principal ──────────────────────────────────────────────────────

export default function ONFGameScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const game = useGame();
  const player = usePlayerStore();
  const audioIngameEnabled = useAudioStore(s => s.ingameEnabled);
  const setIngameEnabled   = useAudioStore(s => s.setIngameEnabled);
  const { borderW } = useFrameLayout();

  // ── État local ────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [generationError, setGenerationError] = useState(false);
  const [seedsEarned, setSeedsEarned] = useState(0);
  const seedsBeforeGainRef = useRef(0);
  const [badgeQueue, setBadgeQueue] = useState<string[]>([]);
  /** Violations ligne/colonne calculées après la validation */
  const [rowColViolationCells, setRowColViolationCells] = useState<number[]>([]);

  const badgesEvaluatedRef = useRef(false);
  const confettiPieces = useConfetti(game.isVictory);

  // ── Génération du défi ────────────────────────────────────
  const generateAndLoad = useCallback(() => {
    setLoading(true);
    setGenerationError(false);
    setRowColViolationCells([]);
    badgesEvaluatedRef.current = false;

    // setTimeout de 16ms pour laisser React rendre l'écran de chargement
    // avant que le solveur backtracking (synchrone) ne s'exécute.
    const timeout = setTimeout(() => {
      const state       = usePlayerStore.getState();
      const solvedCount = state.onfSolvedCount;
      const lastKey     = state.lastOnfCompoKey;

      const challenge = generateOnfChallenge(solvedCount, lastKey);
      if (!challenge) {
        setGenerationError(true);
        setLoading(false);
        return;
      }

      // Mémoriser la composition jouée pour l'anti-répétition
      const onfChallenge = challenge as typeof challenge & { _onfCompoKey?: string };
      if (onfChallenge._onfCompoKey) {
        state.setLastOnfCompoKey(onfChallenge._onfCompoKey);
      }

      game.loadChallenge(challenge);
      // Mode ONF : aucun bonus disponible
      game.setBonusDisabled(true);
      game.startTimer(0);
      setLoading(false);
    }, 16);

    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    generateAndLoad();
  }, []);

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
  // Pas de surlignage aide en mode ONF — le joueur doit déduire seul.
  const getCellColorOnf = useCallback((cellIndex: number): string => {
    // 1. Violations après validation (rouge) — priorité maximale
    if (rowColViolationCells.includes(cellIndex)) {
      return ROW_COL_VIOLATION_COLOR;
    }
    // 2. Case fixe
    if (fixedCells.has(cellIndex)) {
      return Colors.cell.fixed;
    }
    // 3. Vide
    return Colors.cell.empty;
  }, [rowColViolationCells, fixedCells]);

  // ── Tap sur une case ──────────────────────────────────────
  const handleCellPress = useCallback((cellIndex: number) => {
    if (game.selectedElement) {
      game.tryPlaceElement(cellIndex, game.selectedElement);
      game.selectElement(null);
    } else if (game.playerBoard[cellIndex] && !fixedCells.has(cellIndex)) {
      game.removeElement(cellIndex);
    }
  }, [game, fixedCells]);

  // ── Validation ────────────────────────────────────────────
  const handleValidate = useCallback(() => {
    if (!challenge || !boardDef) return;

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
      // Afficher les violations
      setRowColViolationCells(rowColCells);
      game.validateChallenge(); // met à jour game.validationResult pour les violations standard
      return;
    }

    // 4. Victoire (solution correcte)
    setRowColViolationCells([]);
    game.validateChallenge();
  }, [challenge, boardDef, game]);

  // ── Effet victoire ─────────────────────────────────────────
  useEffect(() => {
    if (!game.isVictory || !challenge) return;
    if (badgesEvaluatedRef.current) return;
    badgesEvaluatedRef.current = true;

    const earned = calculateOnfReward(game.elapsedTime);
    seedsBeforeGainRef.current = usePlayerStore.getState().seeds;
    setSeedsEarned(earned);
    player.addSeeds(earned);
    player.incrementOnfSolved();

    // Sync Firestore en arrière-plan — lecture du store après les mises à jour
    // pour avoir les valeurs incrémentées correctes.
    const uid = player.userId;
    if (uid) {
      const updatedState = usePlayerStore.getState();
      // 1. Sync des graines
      updateSeeds(uid, updatedState.seeds).catch(() => {});
      // 2. Sync du compteur ONF et du profil complet
      upsertPlayer({
        userId: uid,
        username: updatedState.username,
        seeds: updatedState.seeds,
        completedChallenges: updatedState.completedChallenges,
        stats: updatedState.stats,
        isPremium: updatedState.isPremium,
        earnedBadges: updatedState.earnedBadges,
        badgeShowcase: updatedState.badgeShowcase.filter((b): b is string => !!b),
        unlockedBonuses: updatedState.unlockedBonuses,
        unlockedThemes: updatedState.unlockedThemes,
        dailyStreak: updatedState.dailyStreak,
        lastPlayedDate: updatedState.lastPlayedDate,
        onfSolvedCount: updatedState.onfSolvedCount,
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

  // ── Effacement des violations au prochain placement ───────
  useEffect(() => {
    if (rowColViolationCells.length > 0) {
      setRowColViolationCells([]);
    }
  }, [game.playerBoard]);

  // ── Chargement ────────────────────────────────────────────
  if (loading) {
    return (
      <View style={[styles.loading, { paddingTop: insets.top }]}>
        <Text style={styles.loadingText}>
          Génération de la grille en cours...
        </Text>
      </View>
    );
  }

  if (generationError) {
    return (
      <View style={[styles.loading, { paddingTop: insets.top }]}>
        <Text style={styles.loadingText}>Impossible de générer la grille</Text>
        <TouchableOpacity
          style={styles.errorBtn}
          onPress={() => router.replace('/(tabs)')}
          activeOpacity={0.8}
        >
          <Text style={styles.errorBtnText}>Retour</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!challenge || !boardDef) {
    return (
      <View style={[styles.loading, { paddingTop: insets.top }]}>
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

  const gridLabel = 'Grille 4x4';

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
              <Text style={styles.backText}>← Quitter</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.headerCenter}>
            <Text style={styles.levelLabel}>Défi ONF</Text>
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
            📊 1 élément max par ligne et par colonne
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
            <Text style={styles.validateBtnText}>Valider ✓</Text>
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
          />
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
          seedsEarned={seedsEarned}
          difficulty={'niveau_1' as any}
          challengeNumber={0}
          confettiPieces={confettiPieces}
          badgeQueue={badgeQueue}
          onBadgeQueueEmpty={() => setBadgeQueue([])}
          isNewWorldRecord={false}
          previousRecordHolder={null}
          onNextChallenge={() => {
            game.resetGame();
            generateAndLoad();
          }}
          onBackToMenu={() => {
            game.resetGame();
            router.replace('/(tabs)');
          }}
        />
      </View>
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
