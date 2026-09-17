// ============================================================
// ÉCRAN DE JEU — MODE DÉFI ENTRE AMIS
//
// CAS A — Joueur A (créateur) :
//   joue le défi sans bonus → victoire → cherche un ami par pseudo → envoie
//
// CAS B — Joueur B (adversaire) :
//   reçoit le défi → joue sans bonus → résultat comparé affiché
// ============================================================

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Platform,
  Modal,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { BoardRenderer } from '../../src/components/Board/BoardRenderer';
import { ElementPalette } from '../../src/components/Elements/ElementPalette';
import { FailModal } from '../../src/components/Game/FailModal';

import { useGame } from '../../src/hooks/useGame';
import { useDragDrop } from '../../src/hooks/useDragDrop';
import { usePlayerStore } from '../../src/store/playerStore';

import { BoardRegistry } from '../../src/boards/BoardRegistry';
import { findNearestCell, formatTime } from '../../src/utils/boardUtils';
import { Colors } from '../../src/constants/colors';
import { CELL_SIZE } from '../../src/components/Board/Cell';
import { Challenge, FixedPlacement, TokenCount } from '../../src/core/models/Challenge';
import {
  FriendChallengeData,
  createFriendChallenge,
  answerFriendChallenge,
} from '../../src/services/challengeService';
import { searchPlayers, PlayerProfile } from '../../src/services/playerService';

// ── Modal résultat + recherche d'ami ──────────────────────────────────────────
function FriendResultModal({
  visible, isChallenger, myTime, challengerTime, myUid, myName, challengeData, onClose,
}: {
  visible: boolean;
  isChallenger: boolean;
  myTime: number;
  challengerTime: number;
  myUid: string;
  myName: string;
  challengeData: FriendChallengeData | null;
  onClose: () => void;
}) {
  const iWon = !isChallenger && myTime <= challengerTime;
  const diff = Math.abs(myTime - challengerTime);
  const [query, setQuery]         = useState('');
  const [results, setResults]     = useState<PlayerProfile[]>([]);
  const [searching, setSearching] = useState(false);
  const [sending, setSending]     = useState(false);
  const [sentTo, setSentTo]       = useState<string | null>(null);
  const debounce                  = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    if (query.length < 2) { setResults([]); setSearching(false); return; }
    setSearching(true);
    debounce.current = setTimeout(async () => {
      try { setResults(await searchPlayers(query, myUid)); }
      catch { setResults([]); }
      finally { setSearching(false); }
    }, 400);
  }, [query]);

  const handleSend = async (p: PlayerProfile) => {
    if (!challengeData || sending) return;
    setSending(true);
    try {
      await createFriendChallenge(challengeData, myUid, myName, myTime, p.userId, p.username);
      setSentTo(p.username);
    } catch {
      if (Platform.OS === 'web') window.alert("Erreur lors de l'envoi. Réessaie.");
    } finally { setSending(false); }
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={rs.overlay}>
        <View style={rs.card}>
          <Text style={rs.emoji}>{isChallenger ? '⏱️' : iWon ? '🏆' : '😤'}</Text>
          <Text style={rs.title}>
            {isChallenger ? 'Défi résolu !' : iWon ? 'Victoire !' : 'Défaite…'}
          </Text>
          <View style={rs.timesRow}>
            <View style={rs.timeBlock}>
              <Text style={rs.timeLabel}>Ton temps</Text>
              <Text style={[rs.timeValue, !isChallenger && iWon && { color: Colors.forest.medium }]}>
                {formatTime(myTime)}
              </Text>
            </View>
            {!isChallenger && (
              <View style={rs.timeBlock}>
                <Text style={rs.timeLabel}>Son temps</Text>
                <Text style={[rs.timeValue, !iWon && { color: Colors.forest.medium }]}>
                  {formatTime(challengerTime)}
                </Text>
              </View>
            )}
          </View>
          {!isChallenger && (
            <Text style={rs.diff}>
              {iWon
                ? `Gagné de ${formatTime(diff)} 🎉`
                : `Perdu de ${formatTime(diff)} — revanche ?`}
            </Text>
          )}

          {/* Sélecteur d'ami — Joueur A uniquement */}
          {isChallenger && (
            sentTo
              ? <View style={rs.sentBox}>
                  <Text style={rs.sentText}>✅ Défi envoyé à {sentTo} !</Text>
                </View>
              : <View style={rs.searchSection}>
                  <Text style={rs.searchLabel}>👥 Envoyer le défi à un ami</Text>
                  <TextInput
                    style={rs.searchInput}
                    placeholder="Chercher par pseudo…"
                    placeholderTextColor={Colors.ui.textLight}
                    value={query}
                    onChangeText={setQuery}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  {searching && (
                    <ActivityIndicator size="small" color={Colors.forest.medium} style={{ marginTop: 4 }} />
                  )}
                  {results.length > 0 && (
                    <View style={rs.resultsList}>
                      {results.map(p => (
                        <TouchableOpacity
                          key={p.userId}
                          style={rs.resultRow}
                          onPress={() => handleSend(p)}
                          disabled={sending}
                          activeOpacity={0.7}
                        >
                          <Text style={rs.resultName}>{p.username}</Text>
                          <Text style={rs.resultSend}>{sending ? '⏳' : 'Envoyer →'}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                  {query.length >= 2 && !searching && results.length === 0 && (
                    <Text style={rs.noResult}>Aucun joueur trouvé</Text>
                  )}
                </View>
          )}

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
    challengerUid?:     string;
    challengerName?:    string;
    friendChallengeId?: string;
    challengerTime?:    string;
    opponentUid?:       string;
    opponentName?:      string;
  }>();

  const isChallenger   = !!params.challengerUid && !params.friendChallengeId;
  const challengerTime = params.challengerTime ? parseInt(params.challengerTime, 10) : 0;

  const challengeData: FriendChallengeData | null = React.useMemo(() => {
    try { return JSON.parse(decodeURIComponent(params.data ?? '')); }
    catch { return null; }
  }, [params.data]);

  const challenge: Challenge | null = React.useMemo(() => {
    if (!challengeData) return null;
    return {
      id:               `friend_${Date.now()}`,
      boardId:          challengeData.boardId,
      level:            'niveau_7' as any,
      levelNumber:      7,
      challengeNumber:  1,
      fixedPlacements:  challengeData.fixedPlacements,
      availableTokens:  challengeData.availableTokens,
      solution:         challengeData.solution,
      solutionCount:    1,
      estimatedDuration: 300,
      createdAt:        new Date().toISOString(),
    };
  }, [challengeData]);

  const game     = useGame();
  const boardDef = challenge ? BoardRegistry[challenge.boardId] : null;

  useEffect(() => {
    if (challenge) game.loadChallenge(challenge);
  }, []);

  // ── Dimensions plateau ──────────────────────────────────────────────────────
  const [boardSize, setBoardSize]         = useState({ width: 0, height: 0 });
  const [availableArea, setAvailableArea] = useState({ width: 0, height: 0 });
  const boardContainerRef                 = useRef<View>(null);
  const boardOffsetRef                    = useRef({ x: 0, y: 0 });

  // ── Drag & Drop ─────────────────────────────────────────────────────────────
  const [draggingElement, setDraggingElement] = useState<string | null>(null);

  const findNearest = useCallback((x: number, y: number) => {
    if (!boardDef || boardSize.width === 0) return null;
    let relX = x, relY = y;
    if (Platform.OS === 'web') {
      relX = x - boardOffsetRef.current.x;
      relY = y - boardOffsetRef.current.y;
    }
    return findNearestCell(
      relX, relY, boardDef, boardSize.width, boardSize.height,
      CELL_SIZE, Platform.OS === 'web' ? 80 : 60,
    );
  }, [boardDef, boardSize]);

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

  // ── Modal résultat ──────────────────────────────────────────────────────────
  const [showResult, setShowResult] = useState(false);

  useEffect(() => {
    if (game.isVictory && challenge) setShowResult(true);
  }, [game.isVictory]);

  // ── Enregistrer le résultat (Joueur B) ─────────────────────────────────────
  useEffect(() => {
    if (!game.isVictory || isChallenger || !params.friendChallengeId) return;
    if (!params.opponentUid || !params.opponentName) return;
    answerFriendChallenge(
      params.friendChallengeId,
      params.opponentUid,
      params.opponentName,
      game.elapsedTime,
      challengerTime,
    ).catch(() => {});
  }, [game.isVictory]);

  const handleClose = () => {
    game.resetGame();
    router.replace('/(tabs)/challenge');
  };

  if (!challenge || !boardDef) {
    return (
      <SafeAreaView style={styles.loading}>
        <ActivityIndicator size="large" color={Colors.forest.medium} />
        <Text style={styles.loadingText}>Préparation du défi…</Text>
      </SafeAreaView>
    );
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaView style={styles.root}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.backBtn}>
            <Text style={styles.backText}>← Quitter</Text>
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>⚔️ Défi ami</Text>
            <Text style={styles.headerSub}>
              {isChallenger ? 'Résous puis envoie à un ami' : `Battre ${formatTime(challengerTime)}`}
            </Text>
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
        />

        {/* Modal résultat */}
        <FriendResultModal
          visible={showResult}
          isChallenger={isChallenger}
          myTime={game.elapsedTime}
          challengerTime={challengerTime}
          myUid={params.challengerUid ?? params.opponentUid ?? ''}
          myName={params.challengerName ?? params.opponentName ?? player.username}
          challengeData={challengeData}
          onClose={handleClose}
        />

        {/* Modal échec */}
        <FailModal
          visible={game.validationResult.status === 'failure'}
          errorCount={game.validationResult.errorCount}
          totalCells={challenge.solution.length}
          showErrorCount={false}
          onRetry={game.dismissValidation}
          onGiveUp={handleClose}
        />

      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

// ── Styles modal ───────────────────────────────────────────────────────────────
const rs = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  card: {
    backgroundColor: Colors.ui.card, borderRadius: 24, padding: 24,
    width: '100%', maxWidth: 400, alignItems: 'center', gap: 14,
  },
  emoji: { fontSize: 48 },
  title: { fontSize: 24, fontWeight: '800', color: Colors.forest.dark },
  timesRow: { flexDirection: 'row', gap: 24, justifyContent: 'center' },
  timeBlock: { alignItems: 'center', gap: 4 },
  timeLabel: {
    fontSize: 11, color: Colors.ui.textLight,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  timeValue: { fontSize: 26, fontWeight: '800', color: Colors.forest.dark },
  diff: { fontSize: 13, color: Colors.ui.textLight, textAlign: 'center' },
  searchSection: { width: '100%', gap: 8 },
  searchLabel: { fontSize: 13, fontWeight: '700', color: Colors.forest.dark, textAlign: 'center' },
  searchInput: {
    backgroundColor: Colors.ui.background, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.ui.border,
    paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 14, color: Colors.ui.text, width: '100%',
  },
  resultsList: {
    width: '100%', borderRadius: 10,
    borderWidth: 1, borderColor: Colors.ui.border, overflow: 'hidden',
  },
  resultRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 12, backgroundColor: Colors.ui.card,
    borderBottomWidth: 1, borderBottomColor: Colors.ui.border,
  },
  resultName: { fontSize: 14, fontWeight: '600', color: Colors.forest.dark },
  resultSend: { fontSize: 13, color: Colors.forest.medium, fontWeight: '700' },
  noResult: { fontSize: 12, color: Colors.ui.textLight, textAlign: 'center' },
  sentBox: {
    backgroundColor: Colors.forest.medium + '15', borderRadius: 10, padding: 14,
    width: '100%', alignItems: 'center',
    borderWidth: 1, borderColor: Colors.forest.medium + '40',
  },
  sentText: { fontSize: 14, fontWeight: '700', color: Colors.forest.medium },
  btnClose: { paddingVertical: 8 },
  btnCloseText: { fontSize: 14, color: Colors.ui.textLight, fontWeight: '600' },
});

// ── Styles écran ───────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.ui.background },
  loading: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    gap: 12, backgroundColor: Colors.ui.background,
  },
  loadingText: { fontSize: 15, color: Colors.ui.textLight },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: Colors.ui.card,
    borderBottomWidth: 1, borderBottomColor: Colors.ui.border,
  },
  backBtn: { padding: 4 },
  backText: { fontSize: 14, color: Colors.forest.medium, fontWeight: '600' },
  headerCenter: { alignItems: 'center', flex: 1 },
  headerTitle: { fontSize: 15, fontWeight: '800', color: Colors.forest.dark },
  headerSub: { fontSize: 11, color: Colors.ui.textLight, textAlign: 'center' },
  timer: {
    backgroundColor: Colors.forest.dark + '15',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
  },
  timerText: { fontSize: 15, fontWeight: '700', color: Colors.forest.dark },
  noBonusBanner: {
    backgroundColor: '#FFF3E0', paddingVertical: 6, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: '#FFE0B2',
  },
  noBonusText: { fontSize: 11, color: '#E65100', textAlign: 'center', fontWeight: '600' },
  validateRow: {
    paddingHorizontal: 16, paddingVertical: 8,
    backgroundColor: Colors.ui.card,
    borderBottomWidth: 1, borderBottomColor: Colors.ui.border,
  },
  validateBtn: {
    backgroundColor: Colors.forest.medium, borderRadius: 10,
    paddingVertical: 10, alignItems: 'center',
  },
  validateBtnDisabled: { backgroundColor: Colors.ui.border, opacity: 0.6 },
  validateBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  boardArea: {
    flex: 1, alignItems: 'center', justifyContent: 'center', padding: 8,
  },
  boardContainer: { borderRadius: 16, overflow: 'hidden' },
});
