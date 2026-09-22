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
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { BoardRenderer } from '../../src/components/Board/BoardRenderer';
import { ElementPalette } from '../../src/components/Elements/ElementPalette';
import { DragGhost } from '../../src/components/Elements/DragGhost';
import { HintOverlay } from '../../src/components/Bonus/HintOverlay';
import { VictoryModal } from '../../src/components/Game/VictoryModal';
import { FailModal } from '../../src/components/Game/FailModal';

import { useGame } from '../../src/hooks/useGame';
import { useDragDrop } from '../../src/hooks/useDragDrop';
import { usePlayerStore } from '../../src/store/playerStore';
import { auth } from '../../src/services/firebase';
import { getPlayer, markCompleted, updateSeeds } from '../../src/services/playerService';

import { BoardRegistry } from '../../src/boards/BoardRegistry';
import { findNearestCell } from '../../src/utils/boardUtils';
import { formatTime } from '../../src/utils/boardUtils';
import { Colors } from '../../src/constants/colors';
import { CELL_SIZE } from '../../src/components/Board/Cell';
import { LEVEL_PARAMS } from '../../src/constants/difficulty';
import { calculateSeedReward } from '../../src/core/engine/hintEngine';
import { MobileDragGhost } from '../../src/components/Elements/MobileDragGhost';
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
  const insets = useSafeAreaInsets();


  const game = useGame();
  const player = usePlayerStore();

  // Ref sur la GestureHandlerRootView pour mesurer son offset écran
  // GestureHandlerRootView est une View, on peut utiliser useRef<View>
  const gestureRootRef = useRef<React.ElementRef<typeof GestureHandlerRootView>>(null);
  const gestureRootOffsetRef = useRef({ x: 0, y: 0 });

  // Confettis — hook dans le composant racine, rendu hors du Modal
  const confettiPieces = useConfetti(game.isVictory);

  // Dimensions et position du plateau
  const [boardSize, setBoardSize] = useState({ width: 0, height: 0 });
  const boardContainerRef = useRef<View>(null);
  // Position du plateau dans la page (web ET mobile natif)
  const boardOffsetRef = useRef({ x: 0, y: 0 });
  // Zone disponible pour le plateau (pour calculer le carré)
  const [availableArea, setAvailableArea] = useState({ width: 0, height: 0 });

  // ── Ghost natif mobile ─────────────────────────────────────
  const [ghostState, setGhostState] = useState<{
    visible: boolean;
    elementId: string | null;
    x: number;
    y: number;
  }>({ visible: false, elementId: null, x: 0, y: 0 });

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
  // absoluteX/Y de reanimated sont relatives à GestureHandlerRootView
  // Il faut donc soustraire : offset(GestureRoot) + offset(board dans GestureRoot)
  // Sur web : clientX/Y sont en coords viewport, on soustrait juste l'offset du board
  const findNearest = useCallback((x: number, y: number) => {
    if (!boardDef || boardSize.width === 0) return null;
    let relX: number;
    let relY: number;
    if (Platform.OS === 'web') {
      relX = x - boardOffsetRef.current.x;
      relY = y - boardOffsetRef.current.y;
    } else {
      // absoluteX/Y sont relatives à GestureHandlerRootView
      // boardOffsetRef est en coords écran (measureInWindow)
      // gestureRootOffsetRef est en coords écran (measureInWindow)
      // donc : coords relatives au board = absoluteXY - (boardOffset - gestureRootOffset)
      const boardRelX = boardOffsetRef.current.x - gestureRootOffsetRef.current.x;
      const boardRelY = boardOffsetRef.current.y - gestureRootOffsetRef.current.y;
      relX = x - boardRelX;
      relY = y - boardRelY;
    }
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

  const { hoveredCell, handleDragStart, handleCellDragStart, handleDragMove, handleDragEnd } = useDragDrop({
    onDrop: (cellIndex, elementId) => {
      game.tryPlaceElement(cellIndex, elementId);
      setDraggingElement(null);
    },
    onMoveFromCell: (fromCell, toCell) => {
      game.moveElement(fromCell, toCell);
      setDraggingElement(null);
    },
    findNearestCell: findNearest,
  });

  // Callbacks ghost mobile — appelés depuis ElementToken
  const mobileDragCallbacks = React.useMemo(() => ({
    onGhostMove: (x: number, y: number) => {
      setGhostState(prev => ({ ...prev, visible: true, x, y }));
    },
    onGhostEnd: () => {
      setGhostState({ visible: false, elementId: null, x: 0, y: 0 });
    },
  }), []);

  // ── Ghost web pour les drags depuis la grille ──────────────
  const [boardDragGhostState, setBoardDragGhostState] = useState<{
    visible: boolean;
    elementId: string | null;
    x: number;
    y: number;
  }>({ visible: false, elementId: null, x: 0, y: 0 });

  // ── Drag depuis la palette ──────────────────────────────────
  const wrappedDragStart = useCallback((elementId: string) => {
    setDraggingElement(elementId);
    setGhostState({ visible: false, elementId, x: 0, y: 0 });
    // Re-mesurer la position du plateau au moment du drag
    // measureInWindow donne les coords écran réelles
    if (Platform.OS !== 'web' && boardContainerRef.current) {
      boardContainerRef.current.measureInWindow((x, y) => {
        boardOffsetRef.current = { x, y };
      });
    }
    handleDragStart(elementId);
  }, [handleDragStart]);

  const wrappedDragEnd = useCallback((x: number, y: number) => {
    setDraggingElement(null);
    setGhostState({ visible: false, elementId: null, x: 0, y: 0 });
    handleDragEnd(x, y);
  }, [handleDragEnd]);

  // ── Drag depuis une case de la grille ──────────────────────
  const wrappedCellDragStart = useCallback((cellIndex: number, elementId: string, x: number, y: number) => {
    setDraggingElement(elementId);
    // Web : afficher le ghost au niveau de l'écran
    if (Platform.OS === 'web') {
      setBoardDragGhostState({ visible: true, elementId, x, y });
    } else {
      // Mobile : réutiliser le ghost natif
      setGhostState({ visible: true, elementId, x, y });
      // Re-mesurer la position du plateau
      if (boardContainerRef.current) {
        boardContainerRef.current.measureInWindow((bx, by) => {
          boardOffsetRef.current = { x: bx, y: by };
        });
      }
    }
    handleCellDragStart(cellIndex, elementId);
  }, [handleCellDragStart]);

  const wrappedCellDragMove = useCallback((x: number, y: number) => {
    if (Platform.OS === 'web') {
      setBoardDragGhostState(prev => ({ ...prev, x, y }));
    } else {
      setGhostState(prev => ({ ...prev, x, y }));
    }
    handleDragMove(x, y);
  }, [handleDragMove]);

  const wrappedCellDragEnd = useCallback((x: number, y: number) => {
    setDraggingElement(null);
    if (Platform.OS === 'web') {
      setBoardDragGhostState({ visible: false, elementId: null, x: 0, y: 0 });
    } else {
      setGhostState({ visible: false, elementId: null, x: 0, y: 0 });
    }
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
      getPlayer(uid).then(async profile => {
        if (profile) {
          // Sauvegarde défi complété + meilleur temps
          await markCompleted(uid, challenge.id, game.elapsedTime, profile);
          // Sauvegarde des graines gagnées (total mis à jour)
          const newSeeds = profile.seeds + seedsEarned;
          await updateSeeds(uid, newSeeds);
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
      <View style={[styles.loading, { paddingTop: insets.top }]}>
        <Text style={styles.loadingText}>Chargement du défi…</Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView
      ref={gestureRootRef}
      style={styles.root}
      onLayout={() => {
        if (Platform.OS !== 'web') {
          gestureRootRef.current?.measureInWindow((x, y) => {
            gestureRootOffsetRef.current = { x, y };
          });
        }
      }}
    >
      {/* ── Feuilles qui tombent — au niveau root pour couvrir tout l'écran ── */}
      <FallingLeaves />

      <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
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
                  // Récupérer la position absolue dans la page (web ET mobile)
                  // On utilise requestAnimationFrame pour s'assurer que le layout
                  // est finalisé avant de mesurer la position écran
                  if (boardContainerRef.current) {
                    if (Platform.OS === 'web') {
                      const node = boardContainerRef.current as unknown as HTMLElement;
                      const rect = node.getBoundingClientRect();
                      boardOffsetRef.current = { x: rect.left, y: rect.top };
                    } else {
                      requestAnimationFrame(() => {
                        boardContainerRef.current?.measureInWindow((x, y) => {
                          boardOffsetRef.current = { x, y };
                        });
                      });
                    }
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
                  onCellDragStart={wrappedCellDragStart}
                  onCellDragMove={wrappedCellDragMove}
                  onCellDragEnd={wrappedCellDragEnd}
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
          mobileDragCallbacks={Platform.OS !== 'web' ? mobileDragCallbacks : undefined}
        />

        {/* ── Ghost natif mobile — rendu au niveau GestureHandlerRootView ── */}
        {Platform.OS !== 'web' && (
          <MobileDragGhost
            elementId={ghostState.elementId}
            x={ghostState.x}
            y={ghostState.y}
            visible={ghostState.visible}
          />
        )}

        {/* ── Ghost web pour les drags depuis la grille ── */}
        {Platform.OS === 'web' && (
          <DragGhost
            elementId={boardDragGhostState.elementId}
            x={boardDragGhostState.x}
            y={boardDragGhostState.y}
            visible={boardDragGhostState.visible}
          />
        )}

        {/* ── Modal victoire ── */}
        <VictoryModal
          visible={game.isVictory}
          elapsedTime={game.elapsedTime}
          seedsEarned={seedsEarned}
          difficulty={challenge.level}
          challengeNumber={challenge.challengeNumber}
          confettiPieces={confettiPieces}
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
      </View>
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
    padding: 4,
  },
  // Conteneur carré : taille calculée dynamiquement = min(width, height)
  // ⚠️ overflow: 'hidden' retiré — il crée un contexte de stacking sur Android
  // qui écrase l'elevation du jeton dragué (le met en arrière-plan)
  boardContainer: {
    borderRadius: 16,
  },
});
