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
import { HintOverlay } from '../../src/components/Bonus/HintOverlay';
import { VictoryModal } from '../../src/components/Game/VictoryModal';
import { FailModal } from '../../src/components/Game/FailModal';
import { LevelBriefingModal } from '../../src/components/LevelBriefing/LevelBriefingModal';
import { useGame } from '../../src/hooks/useGame';
import { useDragDrop } from '../../src/hooks/useDragDrop';
import { usePlayerStore } from '../../src/store/playerStore';
import { auth } from '../../src/services/firebase';
import { getPlayer, markCompleted, updateSeeds } from '../../src/services/playerService';
import { awardBadgesFirestore } from '../../src/services/badgeService';
import {
  WorldRecord,
  subscribeWorldRecord,
  trySetWorldRecord,
} from '../../src/services/worldRecordService';
import { upsertLeaderboardEntry } from '../../src/services/leaderboardService';

import { BoardRegistry } from '../../src/boards/BoardRegistry';
import { findNearestCell } from '../../src/utils/boardUtils';
import { formatTime } from '../../src/utils/boardUtils';
import { Colors } from '../../src/constants/colors';
import { CELL_SIZE } from '../../src/components/Board/Cell';
import { LEVEL_PARAMS } from '../../src/constants/difficulty';
import { LEVEL_META } from '../../src/data/levelMeta';
import { calculateSeedReward } from '../../src/core/engine/hintEngine';
import { evaluateBadges, getClosestBadges, GameContext } from '../../src/core/engine/badgeEngine';
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


  const game = useGame();
  const player = usePlayerStore();

  // ── Briefing de niveau ─────────────────────────────────────
  const [briefingDone, setBriefingDone] = useState(false);
  const [briefingForcedOpen, setBriefingForcedOpen] = useState(false);

  const handleBriefingClose = useCallback(() => {
    const wasFirstOpen = !briefingDone;
    setBriefingDone(true);
    setBriefingForcedOpen(false);
    if (wasFirstOpen) {
      game.startTimer();
    }
  }, [game, briefingDone]);

  // ── Badges toast queue ────────────────────────────────────
  const [badgeQueue, setBadgeQueue] = useState<string[]>([]);
  // closest badges pour la VictoryModal
  const [closestBadges, setClosestBadges] = useState<ReturnType<typeof getClosestBadges>>([]);
  // Ref pour éviter le double-appel du useEffect isVictory
  const badgesEvaluatedRef = useRef(false);
  // Compteur d'échecs de validation pendant la partie en cours (reset au chargement d'un défi)
  // Distinct de game.validationResult.errorCount (qui est 0 à la victoire par définition)
  const failCountForGameRef = useRef(0);

  // ── Record mondial ────────────────────────────────────────
  const [worldRecord, setWorldRecord] = useState<WorldRecord | null>(null);
  const [isNewWorldRecord, setIsNewWorldRecord] = useState(false);

  // Confettis — hook dans le composant racine, rendu hors du Modal
  const confettiPieces = useConfetti(game.isVictory);

  // Dimensions et position du plateau
  const [boardSize, setBoardSize] = useState({ width: 0, height: 0 });
  const boardContainerRef = useRef<View>(null);
  const boardOffsetRef = useRef({ x: 0, y: 0 });
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
    let found: Challenge | undefined;
    for (const challenges of Object.values(ALL_CHALLENGES)) {
      found = challenges.find(c => c.id === challengeId);
      if (found) break;
    }
    if (found) {
      game.loadChallenge(found);
      player.setLastPlayed(found.id);
      badgesEvaluatedRef.current = false;  // Reset pour la nouvelle partie
      failCountForGameRef.current = 0;     // Reset du compteur d'échecs
      setIsNewWorldRecord(false);
      if (found.challengeNumber !== 1) {
        setTimeout(() => game.startTimer(), 50);
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

  const findNearest = useCallback((x: number, y: number) => {
    if (!boardDef || boardSize.width === 0) return null;
    const relX = x - boardOffsetRef.current.x;
    const relY = y - boardOffsetRef.current.y;
    const snapRadius = Platform.OS === 'web' ? 80 : 60;
    return findNearestCell(relX, relY, boardDef, boardSize.width, boardSize.height, CELL_SIZE, snapRadius);
  }, [boardDef, boardSize]);

  const [draggingElement, setDraggingElement] = useState<string | null>(null);

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

  const mobileDragCallbacks = React.useMemo(() => ({
    onGhostMove: (x: number, y: number) => {
      setGhostState(prev => ({ ...prev, visible: true, x, y }));
    },
    onGhostEnd: () => {
      setGhostState({ visible: false, elementId: null, x: 0, y: 0 });
    },
  }), []);

  const wrappedDragStart = useCallback((elementId: string) => {
    setDraggingElement(elementId);
    setGhostState({ visible: false, elementId, x: 0, y: 0 });
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

  const handleCellPress = useCallback((cellIndex: number) => {
    if (game.selectedElement) {
      game.tryPlaceElement(cellIndex, game.selectedElement);
    } else if (game.playerBoard[cellIndex] && !fixedCells.has(cellIndex)) {
      game.removeElement(cellIndex);
    }
  }, [game, fixedCells]);

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

  // ── Victoire : enregistrer la progression (local + Firestore) + évaluer badges ──
  useEffect(() => {
    if (!game.isVictory || !challenge) return;
    if (badgesEvaluatedRef.current) return; // Idempotence : exécuté une seule fois
    badgesEvaluatedRef.current = true;

    // failCountForGameRef = nb de fois où "Valider" a échoué pendant cette partie
    // (distinct de validationResult.errorCount qui est toujours 0 à la victoire)
    const failsDuringGame = failCountForGameRef.current;

    // 1. Mise à jour locale immédiate (store Zustand)
    // On passe failsDuringGame comme errorCount pour que noErrorStreak soit
    // incrémenté uniquement si la partie s'est terminée sans aucun échec.
    player.markChallengeCompleted(challenge.id, game.elapsedTime, failsDuringGame);
    player.addSeeds(seedsEarned);

    // 2. Évaluation des badges — APRÈS markChallengeCompleted (stats déjà mises à jour)
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
      noErrorStreak:     storeState.stats.noErrorStreak,
      dailyStreak:       storeState.dailyStreak,
      earnedBadges:      storeState.earnedBadges,
      completedChallenges: storeState.completedChallenges,
      completedLevels,
      friendWins:        storeState.stats.friendWins,
      bestTimes:         storeState.stats.bestTimes,
      totalFriendsInvited: storeState.stats.totalFriendsInvited,
      topDEJCount:       storeState.stats.topDEJCount,
      playedAt:          new Date(),
      sameChallengePlays: storeState.stats.sameChallengePlays,
      seasonalChallengesPlayed: storeState.stats.seasonalChallengesPlayed,
      // Les badges WR sont évalués après la transaction Firestore (callback ci-dessous)
      isWorldRecord: false,
      isFirstRecord: false,
    };

    const newBadges = evaluateBadges(ctx);

    // Attribuer TOUS les badges en UN SEUL set() Zustand — zéro re-render intermédiaire
    player.awardBadges(newBadges);

    // Déclencher la file de toasts
    if (newBadges.length > 0) {
      setBadgeQueue(newBadges);
    }

    // Calculer les badges proches pour la VictoryModal
    const updatedState = usePlayerStore.getState();
    setClosestBadges(getClosestBadges({
      ...ctx,
      earnedBadges: updatedState.earnedBadges,
    }));

    // 3. Synchronisation Firestore en arrière-plan (si connecté, non anonyme)
    const uid = auth.currentUser?.uid;
    const username = auth.currentUser?.displayName ?? 'Joueur';
    const isAnonymous = auth.currentUser?.isAnonymous ?? true;
    if (uid && !isAnonymous) {
      // 3a. Record mondial (transaction atomique)
      trySetWorldRecord(challenge.id, uid, username, game.elapsedTime).then(wrResult => {
        if (wrResult.isNewRecord) {
          setIsNewWorldRecord(true);
          // Réévaluer les badges WR après confirmation Firestore
          const wrNewBadges: string[] = [];
          const currentEarned = usePlayerStore.getState().earnedBadges;
          if (wrResult.previousRecord === null && !currentEarned.includes('record_first')) {
            wrNewBadges.push('record_first');
          }
          if (wrResult.previousRecord !== null && !currentEarned.includes('record_mondial')) {
            wrNewBadges.push('record_mondial');
          }
          // Un seul set() pour les badges WR
          player.awardBadges(wrNewBadges);
          if (wrNewBadges.length > 0) {
            setBadgeQueue(prev => [...prev, ...wrNewBadges]);
            awardBadgesFirestore(uid, wrNewBadges).catch(() => {});
          }
        }
      }).catch(() => {});

      // 3b. Progression + graines + badges classiques + leaderboard
      getPlayer(uid).then(async profile => {
        if (profile) {
          await markCompleted(uid, challenge.id, game.elapsedTime, profile);
          const newSeeds = profile.seeds + seedsEarned;
          await updateSeeds(uid, newSeeds);
          // Synchronisation badges (atomique)
          if (newBadges.length > 0) {
            await awardBadgesFirestore(uid, newBadges);
          }
          // Mise à jour du classement mondial
          const updatedCompleted = profile.completedChallenges.includes(challenge.id)
            ? profile.completedChallenges.length
            : profile.completedChallenges.length + 1;
          const updatedBadges = profile.earnedBadges.length + newBadges.length;
          await upsertLeaderboardEntry(
            uid,
            username,
            updatedCompleted,
            updatedBadges,
            newSeeds,
          );
        }
      }).catch(() => {
        // Silencieux : la progression locale est déjà sauvegardée
      });
    }
  }, [game.isVictory]);

  // ── Enregistrer les échecs de validation (pour noErrorStreak + badge "Acharnement") ──
  useEffect(() => {
    if (game.validationResult.status === 'failure' && challenge) {
      failCountForGameRef.current += 1;        // compteur local pour cette partie
      player.recordChallengeFailure(challenge.id); // pour le store (badge acharnement)
    }
  }, [game.validationResult.status]);

  const bonusDisabled = challenge
    ? (LEVEL_PARAMS[challenge.level]?.bonusDisabled ?? false)
    : false;

  const hasCountErrorsBonus = game.bonusUsed.includes('count_errors');

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
      style={styles.root}
    >
      {/* ── Feuilles qui tombent — au niveau root pour couvrir tout l'écran ── */}
      <FallingLeaves />

      <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Text style={styles.backText}>← Retour</Text>
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
          unlockedBonuses={player.unlockedBonuses}
        />

        {/* ── Plateau ── */}
        <View
          style={styles.boardArea}
          onLayout={e => {
            const { width, height } = e.nativeEvent.layout;
            setAvailableArea({ width, height });
          }}
        >
          {availableArea.width > 0 && (() => {
            const side = Math.min(availableArea.width, availableArea.height) - 16;
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

        {/* ── Ghost natif mobile ── */}
        {Platform.OS !== 'web' && (
          <MobileDragGhost
            elementId={ghostState.elementId}
            x={ghostState.x}
            y={ghostState.y}
            visible={ghostState.visible}
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
          closestBadges={closestBadges}
          badgeQueue={badgeQueue}
          onBadgeQueueEmpty={() => setBadgeQueue([])}
          worldRecord={isNewWorldRecord ? null : worldRecord}
          isNewWorldRecord={isNewWorldRecord}
          onNextChallenge={() => {
            const nextNum = String(challenge.challengeNumber + 1).padStart(3, '0');
            const nextId = `${challenge.level}_${nextNum}`;
            const levelChallenges = ALL_CHALLENGES[challenge.level] ?? [];
            const nextExists = levelChallenges.some(c => c.id === nextId);
            game.resetGame();
            if (nextExists) {
              router.replace(`/game/${nextId}`);
            } else {
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
  boardArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.ui.background,
    padding: 4,
  },
  boardContainer: {
    borderRadius: 16,
  },
});
