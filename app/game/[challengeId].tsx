// ============================================================
// ÉCRAN DE JEU — [challengeId].tsx
// Assemble BoardRenderer + ElementPalette + HintOverlay
// Gère le drag & drop de bout en bout
// ============================================================

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { BoardRenderer } from '../../src/components/Board/BoardRenderer';
import { ElementPalette } from '../../src/components/Elements/ElementPalette';
import { HintOverlay } from '../../src/components/Bonus/HintOverlay';
import { VictoryModal } from '../../src/components/Game/VictoryModal';
import { FailModal } from '../../src/components/Game/FailModal';

import { useGame } from '../../src/hooks/useGame';
import { useDragDrop } from '../../src/hooks/useDragDrop';
import { usePlayerStore } from '../../src/store/playerStore';
import { auth } from '../../src/services/firebase';
import { getPlayer, markCompleted } from '../../src/services/playerService';

import { BoardRegistry } from '../../src/boards/BoardRegistry';
import { findNearestCell } from '../../src/utils/boardUtils';
import { formatTime } from '../../src/utils/boardUtils';
import { Colors } from '../../src/constants/colors';
import { CELL_SIZE } from '../../src/components/Board/Cell';
import { LEVEL_PARAMS } from '../../src/constants/difficulty';
import { calculateSeedReward } from '../../src/core/engine/hintEngine';

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
};

export default function GameScreen() {
  const { challengeId } = useLocalSearchParams<{ challengeId: string }>();
  const router = useRouter();


  const game = useGame();
  const player = usePlayerStore();

  // Dimensions et position du plateau
  const [boardSize, setBoardSize] = useState({ width: 0, height: 0 });
  const boardContainerRef = useRef<View>(null);
  // Position du plateau dans la page (web uniquement, pour convertir clientX/Y)
  const boardOffsetRef = useRef({ x: 0, y: 0 });
  // Zone disponible pour le plateau (pour calculer le carré)
  const [availableArea, setAvailableArea] = useState({ width: 0, height: 0 });

  // ── Chargement du défi ─────────────────────────────────────
  useEffect(() => {
    // Chercher le défi dans toutes les collections
    let found: Challenge | undefined;
    for (const challenges of Object.values(ALL_CHALLENGES)) {
      found = challenges.find(c => c.id === challengeId);
      if (found) break;
    }
    if (found) {
      game.loadChallenge(found);
      // Mémoriser le dernier défi joué pour l'écran d'accueil
      player.setLastPlayed(found.id);
    }
  }, [challengeId]);

  const challenge = game.challenge;
  const boardDef = challenge ? BoardRegistry[challenge.boardId] : null;

  // ── Ensemble des cases fixes ───────────────────────────────
  const fixedCells = React.useMemo(() => {
    if (!challenge) return new Set<number>();
    return new Set(challenge.fixedPlacements.map(fp => fp.cellIndex));
  }, [challenge]);

  // ── findNearestCell adapté aux dimensions du plateau ───────
  // Sur le web, x/y sont en coordonnées viewport (clientX/Y)
  // → on soustrait l'offset du boardContainer pour obtenir des coords relatives
  const findNearest = useCallback((x: number, y: number) => {
    if (!boardDef || boardSize.width === 0) return null;
    let relX = x;
    let relY = y;
    if (Platform.OS === 'web') {
      relX = x - boardOffsetRef.current.x;
      relY = y - boardOffsetRef.current.y;
    }
    // snapRadius plus grand sur le web (pas de précision tactile)
    const snapRadius = Platform.OS === 'web' ? 80 : 60;
    return findNearestCell(relX, relY, boardDef, boardSize.width, boardSize.height, CELL_SIZE, snapRadius);
  }, [boardDef, boardSize]);

  // ── Drag & Drop ────────────────────────────────────────────
  // ── Élément en cours de drag (pour le bonus highlight) ──────────────
  const [draggingElement, setDraggingElement] = useState<string | null>(null);

  // Élément à utiliser pour le highlight : drag en cours OU sélection tap
  const highlightElement = game.highlightValidCellsActive
    ? (draggingElement ?? game.selectedElement)
    : null;

  const { hoveredCell, handleDragStart, handleDragMove, handleDragEnd } = useDragDrop({
    onDrop: (cellIndex, elementId) => {
      game.tryPlaceElement(cellIndex, elementId);
      setDraggingElement(null);
    },
    findNearestCell: findNearest,
  });

  const wrappedDragStart = useCallback((elementId: string) => {
    setDraggingElement(elementId);
    handleDragStart(elementId);
  }, [handleDragStart]);

  const wrappedDragEnd = useCallback((x: number, y: number) => {
    setDraggingElement(null);
    handleDragEnd(x, y);
  }, [handleDragEnd]);

  // ── Tap sur une case ─────────────────────────────────────────
  const handleCellPress = useCallback((cellIndex: number) => {
    if (game.selectedElement) {
      game.tryPlaceElement(cellIndex, game.selectedElement);
    } else if (game.playerBoard[cellIndex] && !fixedCells.has(cellIndex)) {
      game.removeElement(cellIndex);
    }
  }, [game, fixedCells]);

  // ── Validation manuelle ─────────────────────────────────────
  const handleValidate = useCallback(() => {
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

  // ── Victoire : enregistrer la progression (local + Firestore) ────────
  useEffect(() => {
    if (!game.isVictory || !challenge) return;

    // 1. Mise à jour locale immédiate (store Zustand)
    player.markChallengeCompleted(challenge.id, game.elapsedTime);
    player.addSeeds(seedsEarned);

    // 2. Synchronisation Firestore en arrière-plan (si connecté, non anonyme)
    const uid = auth.currentUser?.uid;
    const isAnonymous = auth.currentUser?.isAnonymous ?? true;
    if (uid && !isAnonymous) {
      getPlayer(uid).then(profile => {
        if (profile) {
          markCompleted(uid, challenge.id, game.elapsedTime, profile);
        }
      }).catch(() => {
        // Silencieux : la progression locale est déjà sauvegardée
      });
    }
  }, [game.isVictory]);

  const bonusDisabled = challenge
    ? (LEVEL_PARAMS[challenge.level]?.bonusDisabled ?? false)
    : false;

  // Le bonus count_errors est-il débloqué pour cette partie ?
  const hasCountErrorsBonus = game.bonusUsed.includes('count_errors');

  // Toutes les cases non-fixes sont-elles remplies ? (pour activer le bouton Valider)
  const allFilled = challenge
    ? game.playerBoard.every((el, i) =>
        el !== null || challenge.fixedPlacements.some(fp => fp.cellIndex === i)
      )
    : false;

  if (!challenge || !boardDef) {
    return (
      <SafeAreaView style={styles.loading}>
        <Text style={styles.loadingText}>Chargement du défi…</Text>
      </SafeAreaView>
    );
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaView style={styles.root}>
        {/* ── Header ── */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>← Retour</Text>
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text style={styles.levelLabel}>
              {challenge.level.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
            </Text>
            <Text style={styles.challengeLabel}>Défi {challenge.challengeNumber}</Text>
          </View>

          <View style={styles.headerRight}>
            {/* Chronomètre */}
            <View style={styles.timer}>
              <Text style={styles.timerText}>{formatTime(game.elapsedTime)}</Text>
            </View>
            {/* Bouton Valider */}
            <TouchableOpacity
              style={[
                styles.validateBtn,
                !allFilled && styles.validateBtnDisabled,
              ]}
              onPress={handleValidate}
              activeOpacity={0.8}
            >
              <Text style={styles.validateBtnText}>Valider ✓</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Barre de bonus ── */}
        <HintOverlay
          seeds={player.seeds}
          bonusUsed={game.bonusUsed}
          selectedElement={game.selectedElement}
          isPremium={player.isPremium}
          bonusDisabled={bonusDisabled}
          onActivateBonus={game.activateBonus}
        />

        {/* ── Plateau ── */}
        {/* Zone flexible qui mesure l'espace disponible */}
        <View
          style={styles.boardArea}
          onLayout={e => {
            const { width, height } = e.nativeEvent.layout;
            setAvailableArea({ width, height });
          }}
        >
          {/* Conteneur carré centré — garantit l'alignement image/cases */}
          {availableArea.width > 0 && (() => {
            const side = Math.min(availableArea.width, availableArea.height) - 16; // -16 = padding 8x2
            return (
              <View
                ref={boardContainerRef}
                style={[
                  styles.boardContainer,
                  { width: side, height: side },
                ]}
                onLayout={e => {
                  const { width, height } = e.nativeEvent.layout;
                  setBoardSize({ width, height });
                  // Sur le web : récupérer la position absolue dans la page
                  if (Platform.OS === 'web' && boardContainerRef.current) {
                    const node = boardContainerRef.current as unknown as HTMLElement;
                    const rect = node.getBoundingClientRect();
                    boardOffsetRef.current = { x: rect.left, y: rect.top };
                  }
                }}
              >
                <BoardRenderer
                  boardDef={boardDef}
                  playerBoard={game.playerBoard}
                  fixedCells={fixedCells}
                  hintCells={game.hintCells}
                  hintType={null}
                  selectedElement={game.selectedElement}
                  hoveredCell={hoveredCell}
                  getCellColor={(idx) => game.getCellColor(idx, highlightElement)}
                  onCellPress={handleCellPress}
                  onDrop={(cellIndex, elementId) => game.tryPlaceElement(cellIndex, elementId)}
                />
              </View>
            );
          })()}
        </View>

        {/* ── Palette ── */}
        <ElementPalette
          availableTokens={challenge.availableTokens}
          playerBoard={game.playerBoard}
          fixedCells={fixedCells}
          selectedElement={game.selectedElement}
          onSelectElement={game.selectElement}
          onDragStart={wrappedDragStart}
          onDragMove={handleDragMove}
          onDragEnd={wrappedDragEnd}
        />

        {/* ── Modal victoire ── */}
        <VictoryModal
          visible={game.isVictory}
          elapsedTime={game.elapsedTime}
          seedsEarned={seedsEarned}
          difficulty={challenge.level}
          challengeNumber={challenge.challengeNumber}
          onNextChallenge={() => {
            // Format de l'ID : niveau_1_002, niveau_1_003, etc.
            const nextNum = String(challenge.challengeNumber + 1).padStart(3, '0');
            const nextId = `${challenge.level}_${nextNum}`;
            // Vérifier que le défi suivant existe
            const levelChallenges = ALL_CHALLENGES[challenge.level] ?? [];
            const nextExists = levelChallenges.some(c => c.id === nextId);
            game.resetGame();
            if (nextExists) {
              router.replace(`/game/${nextId}`);
            } else {
              // Dernier défi du niveau → retour à la sélection
              router.replace('/(tabs)/levels');
            }
          }}
          onBackToMenu={() => {
            game.resetGame();
            router.replace('/(tabs)/levels');
          }}
        />

        {/* ── Modal échec ── */}
        <FailModal
          visible={game.validationResult.status === 'failure'}
          errorCount={game.validationResult.errorCount}
          totalCells={challenge.solution.length}
          showErrorCount={hasCountErrorsBonus}
          onRetry={game.dismissValidation}
          onGiveUp={() => {
            game.resetGame();
            router.replace('/(tabs)/levels');
          }}
        />
      </SafeAreaView>
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
    paddingVertical: 10,
    backgroundColor: Colors.ui.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.ui.border,
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
  validateBtn: {
    backgroundColor: Colors.forest.medium,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  validateBtnDisabled: {
    backgroundColor: Colors.ui.border,
    opacity: 0.6,
  },
  validateBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  // Zone flexible qui occupe tout l'espace disponible entre header et palette
  boardArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.ui.background,
    padding: 8,
  },
  // Conteneur carré : taille calculée dynamiquement = min(width, height)
  boardContainer: {
    borderRadius: 16,
    overflow: 'hidden',
  },
});
