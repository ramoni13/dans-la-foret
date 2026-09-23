// ============================================================
// ÉCRAN DE JEU — MODE DÉFI ENTRE AMIS
//
// CAS A — Joueur A (créateur) :
//   params : data, challengerUid, challengerName, challengerLevel, friendData
//   → joue sans bonus → victoire → modal "Envoyer" ou "Quitter"
//   → "Envoyer" : createFriendChallenge() puis retour onglet Défis
//
// CAS B — Joueur B (adversaire) :
//   params : data, friendChallengeId, challengerUid, challengerTime, opponentUid, opponentName, opponentLevel
//   → joue → victoire → answerFriendChallenge() → résultat + 15 🌱 si vainqueur
// ============================================================

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { BoardRenderer } from '../../src/components/Board/BoardRenderer';
import { ElementPalette } from '../../src/components/Elements/ElementPalette';
import { MobileDragGhost } from '../../src/components/Elements/MobileDragGhost';
import { FallingLeaves } from '../../src/components/Game/FallingLeaves';
import { useConfetti, Confetti } from '../../src/components/Game/Confetti';
import { FailModal } from '../../src/components/Game/FailModal';

import { useGame } from '../../src/hooks/useGame';
import { useDragDrop } from '../../src/hooks/useDragDrop';
import { usePlayerStore } from '../../src/store/playerStore';

import { BoardRegistry } from '../../src/boards/BoardRegistry';
import { findNearestCell, formatTime } from '../../src/utils/boardUtils';
import { Colors } from '../../src/constants/colors';
import { CELL_SIZE } from '../../src/components/Board/Cell';
import { Challenge } from '../../src/core/models/Challenge';
import {
  FriendChallengeData,
  createFriendChallenge,
  answerFriendChallenge,
  CHALLENGE_WINNER_SEEDS,
} from '../../src/services/challengeService';
import { updateSeeds } from '../../src/services/playerService';
import { auth } from '../../src/services/firebase';

// ── Modal résultat Joueur A (après sa partie, avant envoi) ────────────────────
function ChallengerResultModal({
  visible,
  myTime,
  friendName,
  friendLevel,
  challengeLevel,
  sending,
  sent,
  onSend,
  onQuit,
}: {
  visible: boolean;
  myTime: number;
  friendName: string;
  friendLevel: number;
  challengeLevel: number;
  sending: boolean;
  sent: boolean;
  onSend: () => void;
  onQuit: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={rs.overlay}>
        <View style={rs.card}>
          <Text style={rs.emoji}>⏱️</Text>
          <Text style={rs.title}>Défi résolu !</Text>

          <View style={rs.timeBlock}>
            <Text style={rs.timeLabel}>Ton temps</Text>
            <Text style={rs.timeValue}>{formatTime(myTime)}</Text>
          </View>

          <View style={rs.infoBox}>
            <Text style={rs.infoText}>
              Niveau du défi : <Text style={rs.infoStrong}>Niv. {challengeLevel}</Text>
            </Text>
            <Text style={rs.infoText}>
              Ami ciblé : <Text style={rs.infoStrong}>{friendName}</Text>{' '}
              <Text style={rs.infoLight}>(Niveau {friendLevel})</Text>
            </Text>
          </View>

          {sent ? (
            <View style={rs.sentBox}>
              <Text style={rs.sentText}>✅ Défi envoyé à {friendName} !</Text>
              <Text style={rs.sentSub}>Il a 1 semaine pour relever le défi.</Text>
            </View>
          ) : (
            <View style={rs.btnGroup}>
              <TouchableOpacity
                style={[rs.btnSend, sending && rs.btnDisabled]}
                onPress={onSend}
                disabled={sending}
                activeOpacity={0.8}
              >
                {sending
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={rs.btnSendText}>📤 Envoyer le défi</Text>
                }
              </TouchableOpacity>
              <TouchableOpacity
                style={rs.btnQuit}
                onPress={onQuit}
                activeOpacity={0.8}
                disabled={sending}
              >
                <Text style={rs.btnQuitText}>Quitter sans envoyer</Text>
              </TouchableOpacity>
            </View>
          )}

          {sent && (
            <TouchableOpacity style={rs.btnClose} onPress={onQuit} activeOpacity={0.8}>
              <Text style={rs.btnCloseText}>Retour aux défis</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ── Modal résultat Joueur B (résultat de la confrontation) ────────────────────
function OpponentResultModal({
  visible,
  myTime,
  challengerTime,
  iWon,
  onClose,
  confettiPieces: _confetti,
}: {
  visible: boolean;
  myTime: number;
  challengerTime: number;
  iWon: boolean;
  onClose: () => void;
  confettiPieces: any[];
}) {
  const diff = Math.abs(myTime - challengerTime);
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={rs.overlay}>
        <View style={rs.card}>
          <Text style={rs.emoji}>{iWon ? '🏆' : '😤'}</Text>
          <Text style={rs.title}>{iWon ? 'Victoire !' : 'Défaite…'}</Text>

          {iWon && (
            <View style={rs.rewardBox}>
              <Text style={rs.rewardText}>+{CHALLENGE_WINNER_SEEDS} 🌱 graines gagnées !</Text>
            </View>
          )}

          <View style={rs.timesRow}>
            <View style={rs.timeBlock}>
              <Text style={rs.timeLabel}>Ton temps</Text>
              <Text style={[rs.timeValue, iWon && { color: Colors.forest.medium }]}>
                {formatTime(myTime)}
              </Text>
            </View>
            <View style={rs.timeBlock}>
              <Text style={rs.timeLabel}>Son temps</Text>
              <Text style={[rs.timeValue, !iWon && { color: Colors.forest.medium }]}>
                {formatTime(challengerTime)}
              </Text>
            </View>
          </View>

          <Text style={rs.diff}>
            {iWon
              ? `Gagné de ${formatTime(diff)} 🎉`
              : `Perdu de ${formatTime(diff)} — revanche ?`}
          </Text>

          <TouchableOpacity style={rs.btnClose} onPress={onClose} activeOpacity={0.8}>
            <Text style={rs.btnCloseText}>Retour aux défis</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ── Écran principal ────────────────────────────────────────────────────────────
export default function FriendChallengeScreen() {
  const router = useRouter();
  const player = usePlayerStore();
  const params = useLocalSearchParams<{
    data:               string;
    // Joueur A
    challengerUid?:     string;
    challengerName?:    string;
    challengerLevel?:   string;
    friendData?:        string;   // JSON { userId, username, level }
    // Joueur B
    friendChallengeId?: string;
    challengerTime?:    string;
    opponentUid?:       string;
    opponentName?:      string;
    opponentLevel?:     string;
  }>();

  const isChallenger   = !!params.challengerUid && !params.friendChallengeId;
  const challengerTime = params.challengerTime ? parseInt(params.challengerTime, 10) : 0;

  // Données ami (Joueur A uniquement)
  const friendData = React.useMemo(() => {
    if (!params.friendData) return null;
    try { return JSON.parse(decodeURIComponent(params.friendData)); }
    catch { return null; }
  }, [params.friendData]);

  const challengeData: FriendChallengeData | null = React.useMemo(() => {
    try { return JSON.parse(decodeURIComponent(params.data ?? '')); }
    catch { return null; }
  }, [params.data]);

  const challengeLevel = challengeData?.level ?? 7;

  const challenge: Challenge | null = React.useMemo(() => {
    if (!challengeData) return null;
    return {
      id:               `friend_${Date.now()}`,
      boardId:          challengeData.boardId,
      level:            `niveau_${challengeLevel}` as any,
      levelNumber:      challengeLevel,
      challengeNumber:  1,
      fixedPlacements:  challengeData.fixedPlacements,
      availableTokens:  challengeData.availableTokens,
      solution:         challengeData.solution,
      solutionCount:    1,
      estimatedDuration: 300,
      createdAt:        new Date().toISOString(),
    };
  }, [challengeData]);

  const insets   = useSafeAreaInsets();
  const game     = useGame();
  const boardDef = challenge ? BoardRegistry[challenge.boardId] : null;

  useEffect(() => {
    if (challenge) {
      console.log('[FriendChallenge] Chargement défi:', {
        boardId: challenge.boardId,
        solutionLength: challenge.solution?.length,
        solution: challenge.solution,
        fixedCount: challenge.fixedPlacements?.length,
        availableCount: challenge.availableTokens?.length,
      });
      game.loadChallenge(challenge);
      // Démarrer le timer immédiatement (pas de modal briefing en mode défi ami)
      setTimeout(() => game.startTimer(), 100);
    }
  }, []);

  // ── Dimensions plateau ──────────────────────────────────────────────────────
  const [boardSize, setBoardSize]         = useState({ width: 0, height: 0 });
  const [availableArea, setAvailableArea] = useState({ width: 0, height: 0 });
  const boardContainerRef                 = useRef<View>(null);
  const boardOffsetRef                    = useRef({ x: 0, y: 0 });

  // Ghost natif mobile
  const [ghostState, setGhostState] = useState<{
    visible: boolean; elementId: string | null; x: number; y: number;
  }>({ visible: false, elementId: null, x: 0, y: 0 });

  const mobileDragCallbacks = React.useMemo(() => ({
    onGhostMove: (x: number, y: number) => {
      setGhostState(prev => ({ ...prev, visible: true, x, y }));
    },
    onGhostEnd: () => {
      setGhostState({ visible: false, elementId: null, x: 0, y: 0 });
    },
  }), []);

  // ── Drag & Drop ─────────────────────────────────────────────────────────────
  const findNearest = useCallback((x: number, y: number) => {
    if (!boardDef || boardSize.width === 0) return null;
    const relX = x - boardOffsetRef.current.x;
    const relY = y - boardOffsetRef.current.y;
    return findNearestCell(
      relX, relY, boardDef, boardSize.width, boardSize.height,
      CELL_SIZE, Platform.OS === 'web' ? 80 : 60,
    );
  }, [boardDef, boardSize]);

  const { hoveredCell, handleDragStart, handleDragMove, handleDragEnd } = useDragDrop({
    onDrop: (cellIndex, elementId) => {
      game.tryPlaceElement(cellIndex, elementId);
    },
    findNearestCell: findNearest,
  });

  const wrappedDragStart = useCallback((elementId: string) => {
    setGhostState({ visible: false, elementId, x: 0, y: 0 });
    if (Platform.OS !== 'web' && boardContainerRef.current) {
      boardContainerRef.current.measureInWindow((x, y) => {
        boardOffsetRef.current = { x, y };
      });
    }
    handleDragStart(elementId);
  }, [handleDragStart]);

  const wrappedDragEnd = useCallback((x: number, y: number) => {
    setGhostState({ visible: false, elementId: null, x: 0, y: 0 });
    handleDragEnd(x, y);
  }, [handleDragEnd]);

  // ── Cases fixes ─────────────────────────────────────────────────────────────
  const fixedCells = React.useMemo(() => {
    if (!challenge) return new Set<number>();
    return new Set(challenge.fixedPlacements.map(fp => fp.cellIndex));
  }, [challenge]);

  const handleCellPress = useCallback((cellIndex: number) => {
    if (game.selectedElement) {
      game.tryPlaceElement(cellIndex, game.selectedElement);
    } else if (game.playerBoard[cellIndex] && !fixedCells.has(cellIndex)) {
      game.removeElement(cellIndex);
    }
  }, [game, fixedCells]);

  const allFilled = challenge
    ? game.playerBoard.every((el, i) =>
        el !== null || challenge.fixedPlacements.some(fp => fp.cellIndex === i)
      )
    : false;

  // ── État modal résultat ─────────────────────────────────────────────────────
  const [showResult, setShowResult] = useState(false);
  const [sending, setSending]       = useState(false);
  const [sent, setSent]             = useState(false);
  const [opponentWon, setOpponentWon] = useState<boolean | null>(null);
  const confettiPieces = useConfetti(showResult);

  useEffect(() => {
    if (game.isVictory && challenge) setShowResult(true);
  }, [game.isVictory]);

  // ── Enregistrer le résultat (Joueur B) ─────────────────────────────────────
  useEffect(() => {
    if (!game.isVictory || isChallenger || !params.friendChallengeId) return;
    if (!params.opponentUid || !params.challengerUid) return;

    const record = async () => {
      try {
        const { winnerId } = await answerFriendChallenge(
          params.friendChallengeId!,
          params.opponentUid!,
          game.elapsedTime,
          params.challengerUid!,
          challengerTime,
        );
        const iWon = winnerId === params.opponentUid;
        setOpponentWon(iWon);

        // Récompense : 15 graines au vainqueur
        if (iWon) {
          player.addSeeds(CHALLENGE_WINNER_SEEDS);
          // Sync Firestore (non-anonyme)
          const currentUser = auth.currentUser;
          if (currentUser && !currentUser.isAnonymous) {
            updateSeeds(params.opponentUid!, player.seeds + CHALLENGE_WINNER_SEEDS).catch(() => {});
          }
        }
      } catch {
        // Silencieux — le résultat est affiché quand même
      }
    };

    record();
  }, [game.isVictory]);

  // ── Envoyer le défi (Joueur A, depuis le modal) ─────────────────────────────
  const handleSendChallenge = async () => {
    if (!challengeData || !friendData || !params.challengerUid || !params.challengerName || sending) return;
    setSending(true);
    try {
      await createFriendChallenge(
        challengeData,
        params.challengerUid,
        params.challengerName,
        game.elapsedTime,
        parseInt(params.challengerLevel ?? '1', 10),
        friendData.userId,
        friendData.username,
        friendData.level,
      );
      setSent(true);
    } catch {
      if (Platform.OS === 'web') window.alert("Erreur lors de l'envoi. Réessaie.");
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => {
    game.resetGame();
    router.replace('/(tabs)/challenge');
  };

  if (!challenge || !boardDef) {
    return (
      <View style={[styles.loading, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={Colors.forest.medium} />
        <Text style={styles.loadingText}>Préparation du défi…</Text>
      </View>
    );
  }

  const headerSub = isChallenger
    ? `Défi Niv. ${challengeLevel} · Résous puis envoie à ${friendData?.username ?? '?'}`
    : `Défi Niv. ${challengeLevel} · Battre ${formatTime(challengerTime)}`;

  return (
    <GestureHandlerRootView style={styles.root}>
      <FallingLeaves />

      <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.backBtn}>
            <Text style={styles.backText}>← Quitter</Text>
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>⚔️ Défi ami</Text>
            <Text style={styles.headerSub}>{headerSub}</Text>
          </View>
          <View style={styles.timer}>
            <Text style={styles.timerText}>{formatTime(game.elapsedTime)}</Text>
          </View>
        </View>

        {/* Bandeau sans bonus */}
        <View style={styles.noBonusBanner}>
          <Text style={styles.noBonusText}>
            🚫 Bonus désactivés — conditions identiques pour les deux joueurs
          </Text>
        </View>

        {/* Bouton Valider */}
        <View style={styles.validateRow}>
          <TouchableOpacity
            style={[styles.validateBtn, !allFilled && styles.validateBtnDisabled]}
            onPress={() => game.validateChallenge()}
            disabled={!allFilled}
            activeOpacity={0.8}
          >
            <Text style={styles.validateBtnText}>Valider ✓</Text>
          </TouchableOpacity>
        </View>

        {/* Plateau */}
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
                style={[styles.boardContainer, { width: side, height: side }]}
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
                  hintCells={[]}
                  hintType={null}
                  selectedElement={game.selectedElement}
                  hoveredCell={hoveredCell}
                  getCellColor={(idx) => game.getCellColor(idx, null)}
                  onCellPress={handleCellPress}
                  onDrop={(cellIndex, elementId) => game.tryPlaceElement(cellIndex, elementId)}
                />
              </View>
            );
          })()}
        </View>

        {/* Palette */}
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

        {Platform.OS !== 'web' && (
          <MobileDragGhost
            elementId={ghostState.elementId}
            x={ghostState.x}
            y={ghostState.y}
            visible={ghostState.visible}
          />
        )}

        {/* Modal résultat Joueur A */}
        {isChallenger && (
          <ChallengerResultModal
            visible={showResult}
            myTime={game.elapsedTime}
            friendName={friendData?.username ?? '?'}
            friendLevel={friendData?.level ?? 1}
            challengeLevel={challengeLevel}
            sending={sending}
            sent={sent}
            onSend={handleSendChallenge}
            onQuit={handleClose}
          />
        )}

        {/* Confettis */}
        <Confetti pieces={confettiPieces} />

        {/* Modal résultat Joueur B */}
        {!isChallenger && opponentWon !== null && (
          <OpponentResultModal
            visible={showResult}
            myTime={game.elapsedTime}
            challengerTime={challengerTime}
            iWon={opponentWon}
            onClose={handleClose}
            confettiPieces={confettiPieces}
          />
        )}

        {/* Modal résultat Joueur B (chargement) */}
        {!isChallenger && opponentWon === null && showResult && (
          <Modal visible transparent animationType="fade">
            <View style={rs.overlay}>
              <View style={rs.card}>
                <ActivityIndicator size="large" color={Colors.forest.medium} />
                <Text style={{ color: Colors.ui.textLight, marginTop: 12 }}>Enregistrement…</Text>
              </View>
            </View>
          </Modal>
        )}

        {/* Modal échec */}
        <FailModal
          visible={game.validationResult.status === 'failure'}
          errorCount={game.validationResult.errorCount}
          totalCells={challenge.solution.length}
          showErrorCount={false}
          onRetry={game.dismissValidation}
          onGiveUp={handleClose}
        />

      </View>
    </GestureHandlerRootView>
  );
}

// ── Styles modal ───────────────────────────────────────────────────────────────
const rs = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: Colors.ui.card,
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    gap: 14,
  },
  emoji: { fontSize: 48 },
  title: { fontSize: 24, fontWeight: '800', color: Colors.forest.dark },
  timesRow: { flexDirection: 'row', gap: 32, justifyContent: 'center' },
  timeBlock: { alignItems: 'center', gap: 4 },
  timeLabel: {
    fontSize: 11,
    color: Colors.ui.textLight,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  timeValue: { fontSize: 26, fontWeight: '800', color: Colors.forest.dark },
  diff: { fontSize: 13, color: Colors.ui.textLight, textAlign: 'center' },
  infoBox: {
    width: '100%',
    backgroundColor: Colors.ui.background,
    borderRadius: 12,
    padding: 14,
    gap: 4,
    borderWidth: 1,
    borderColor: Colors.ui.border,
  },
  infoText: { fontSize: 13, color: Colors.ui.text, textAlign: 'center' },
  infoStrong: { fontWeight: '700', color: Colors.forest.dark },
  infoLight: { color: Colors.ui.textLight },
  rewardBox: {
    backgroundColor: Colors.forest.medium + '15',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: Colors.forest.medium + '40',
  },
  rewardText: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.forest.medium,
    textAlign: 'center',
  },
  sentBox: {
    width: '100%',
    backgroundColor: Colors.forest.medium + '15',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: Colors.forest.medium + '40',
  },
  sentText: { fontSize: 15, fontWeight: '700', color: Colors.forest.medium },
  sentSub: { fontSize: 12, color: Colors.ui.textLight },
  btnGroup: { width: '100%', gap: 10 },
  btnSend: {
    backgroundColor: Colors.forest.medium,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    width: '100%',
  },
  btnSendText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  btnDisabled: { opacity: 0.5 },
  btnQuit: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  btnQuitText: { fontSize: 14, color: Colors.ui.textLight, fontWeight: '600' },
  btnClose: { paddingVertical: 8 },
  btnCloseText: { fontSize: 14, color: Colors.ui.textLight, fontWeight: '600' },
});

// ── Styles écran ───────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.ui.background },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: Colors.ui.background,
  },
  loadingText: { fontSize: 15, color: Colors.ui.textLight },
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
  backBtn: { padding: 4 },
  backText: { fontSize: 14, color: Colors.forest.medium, fontWeight: '600' },
  headerCenter: { alignItems: 'center', flex: 1 },
  headerTitle: { fontSize: 15, fontWeight: '800', color: Colors.forest.dark },
  headerSub: { fontSize: 11, color: Colors.ui.textLight, textAlign: 'center' },
  timer: {
    backgroundColor: Colors.forest.dark + '15',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  timerText: { fontSize: 15, fontWeight: '700', color: Colors.forest.dark },
  noBonusBanner: {
    backgroundColor: '#FFF3E0',
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#FFE0B2',
  },
  noBonusText: { fontSize: 11, color: '#E65100', textAlign: 'center', fontWeight: '600' },
  validateRow: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: Colors.ui.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.ui.border,
  },
  validateBtn: {
    backgroundColor: Colors.forest.medium,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  validateBtnDisabled: { backgroundColor: Colors.ui.border, opacity: 0.6 },
  validateBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  boardArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  boardContainer: { borderRadius: 16 },
});
