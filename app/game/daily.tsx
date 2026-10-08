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
  getDailyChallengeId,
  submitDailyResult as submitDailyResultFirestore,
  subscribeDailyLeaderboard,
  calculateDailyReward,
  DailyResult,
} from '../../src/services/dailyChallengeService';
import { awardBadgesFirestore } from '../../src/services/badgeService';

import { BoardRegistry } from '../../src/boards/BoardRegistry';
import { formatTime } from '../../src/utils/boardUtils';
import { Colors } from '../../src/constants/colors';
import { evaluateDailyBadges, DailyGameContext } from '../../src/core/engine/badgeEngine';
import { FallingLeaves } from '../../src/components/Game/FallingLeaves';
import { useConfetti, Confetti } from '../../src/components/Game/Confetti';
import { DailyBriefingModal } from '../../src/components/LevelBriefing/DailyBriefingModal';
import { Challenge, FixedPlacement, TokenCount } from '../../src/core/models/Challenge';
import { notificationError } from '../../src/utils/haptics';

const native = Platform.OS !== 'web';

// ── Modal d'echec journalier (pas de retry) ──────────────────────────────────

interface DailyFailModalProps {
  visible: boolean;
  onBackToMenu: () => void;
}

const DailyFailModal: React.FC<DailyFailModalProps> = ({ visible, onBackToMenu }) => {
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
          <Text style={failStyles.title}>Dommage !</Text>
          <Text style={failStyles.message}>
            Rendez-vous demain pour un nouveau defi
          </Text>

          <TouchableOpacity
            style={failStyles.btnBack}
            onPress={onBackToMenu}
            activeOpacity={0.8}
          >
            <Text style={failStyles.btnBackText}>Retour</Text>
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
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const game = useGame();
  const player = usePlayerStore();
  const audioIngameEnabled = useAudioStore(s => s.ingameEnabled);
  const setIngameEnabled   = useAudioStore(s => s.setIngameEnabled);

  // -- Etat local --
  const [loading, setLoading] = useState(true);
  const [generationError, setGenerationError] = useState(false);
  const [dailyDate, setDailyDate] = useState('');
  const [dailyFailed, setDailyFailed] = useState(false);
  const [leaderboard, setLeaderboard] = useState<DailyResult[]>([]);
  const [badgeQueue, setBadgeQueue] = useState<string[]>([]);
  const [seedsEarned, setSeedsEarned] = useState(0);
  const [briefingDone, setBriefingDone] = useState(false);

  const badgesEvaluatedRef = useRef(false);
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

    // Cle unique pour le daily d'aujourd'hui
    const dailyKey = `daily_${dateStr}`;
    const isResuming = status === 'in_progress';

    // Generer le defi journalier
    const dailyChallenge = generateDailyChallenge(now);
    if (!dailyChallenge) {
      setGenerationError(true);
      setLoading(false);
      return;
    }

    // Adapter les cases fixes au niveau du joueur
    const playerLevel = player.currentLevel;
    const { fixedPlacements, availableTokens } = getDailyFixedPlacements(
      playerLevel,
      dailyChallenge,
      now
    );

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

    game.loadDailyChallenge(adaptedChallenge);
    badgesEvaluatedRef.current = false;

    // Marquer le daily comme en cours + enregistrer le timestamp de debut
    if (!isResuming) {
      usePlayerStore.setState({ dailyChallengeStatus: 'in_progress' });
      player.markChallengeStarted(dailyKey);
    }

    setLoading(false);
    // Le timer demarrera apres la fermeture du briefing (handleBriefingClose)
    // sauf si on reprend (briefing deja vu)
    if (isResuming) {
      setBriefingDone(true);
      setTimeout(() => game.startTimer(priorElapsed), 50);
    }

    // Ecouter le leaderboard
    const unsub = subscribeDailyLeaderboard(dateStr, 50, (results) => {
      setLeaderboard(results);
    });

    return () => unsub();
  }, []);

  const challenge = game.challenge;
  const boardDef = challenge ? BoardRegistry[challenge.boardId] : null;

  const fixedCells = useMemo(() => {
    if (!challenge) return new Set<number>();
    return new Set(challenge.fixedPlacements.map(fp => fp.cellIndex));
  }, [challenge]);

  // -- Fermeture du briefing : demarre le timer --
  const handleBriefingClose = useCallback(() => {
    setBriefingDone(true);
    // Pas de priorElapsed ici car le briefing n'est montre qu'a la premiere ouverture
    setTimeout(() => game.startTimer(0), 50);
  }, [game]);

  // -- Abandon du defi journalier --
  const [showDailyAbandonModal, setShowDailyAbandonModal] = useState(false);

  const handleDailyBack = useCallback(() => {
    setShowDailyAbandonModal(true);
  }, []);

  const handleDailyAbandonConfirm = useCallback(() => {
    const dailyKey = `daily_${dailyDate}`;
    player.submitDailyResult(dailyDate, false);
    player.clearChallengeTimestamps(dailyKey);
    setShowDailyAbandonModal(false);
    game.resetGame();
    router.replace('/(tabs)');
  }, [dailyDate, player, game, router]);

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
      game.tryPlaceElement(cellIndex, game.selectedElement);
      game.selectElement(null);
    } else if (game.playerBoard[cellIndex] && !fixedCells.has(cellIndex)) {
      game.removeElement(cellIndex);
    }
  }, [game, fixedCells]);

  // -- Validation --
  const handleValidate = useCallback(() => {
    if (game.dailyValidationUsed) return;
    const result = game.validateChallenge();

    // Echec du daily = pas de retry
    if (result.status === 'failure') {
      setDailyFailed(true);
      player.submitDailyResult(dailyDate, false);
    }
  }, [game, dailyDate, player]);

  // -- Victoire --
  useEffect(() => {
    if (!game.isVictory || !challenge) return;
    if (badgesEvaluatedRef.current) return;
    badgesEvaluatedRef.current = true;

    // 1. Mettre a jour le store local
    player.submitDailyResult(dailyDate, true);
    player.clearChallengeTimestamps(`daily_${dailyDate}`);

    // 2. Calculer les recompenses
    const uid = auth.currentUser?.uid;
    const username = auth.currentUser?.displayName ?? 'Joueur';
    const isAnonymous = auth.currentUser?.isAnonymous ?? true;

    // Trouver le rang du joueur dans le leaderboard
    let rank = leaderboard.length + 1; // Par defaut, dernier
    if (uid) {
      const existingIdx = leaderboard.findIndex(r => r.userId === uid);
      if (existingIdx >= 0) {
        rank = existingIdx + 1;
      }
    }

    const storeState = usePlayerStore.getState();
    const reward = calculateDailyReward(rank, leaderboard.length + 1, storeState.dailyChallengeStreak);
    setSeedsEarned(reward.total);
    player.addSeeds(reward.total);

    // 3. Evaluer les badges journaliers
    const dailyCtx: DailyGameContext = {
      dailyChallengeStreak: storeState.dailyChallengeStreak,
      rank,
      earnedBadges: storeState.earnedBadges,
    };
    const newBadges = evaluateDailyBadges(dailyCtx);
    if (newBadges.length > 0) {
      player.awardBadges(newBadges);
      setBadgeQueue(newBadges);
    }

    // 4. Soumission Firestore en arriere-plan
    if (uid && !isAnonymous) {
      submitDailyResultFirestore(
        dailyDate,
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

  // -- Toutes les cases remplies ? --
  const allFilled = challenge
    ? game.playerBoard.every((el, i) =>
        el !== null || challenge.fixedPlacements.some(fp => fp.cellIndex === i)
      )
    : false;

  // -- Chargement --
  if (loading) {
    return (
      <View style={[styles.loading, { paddingTop: insets.top }]}>
        <Text style={styles.loadingText}>Generation du defi du jour...</Text>
      </View>
    );
  }

  if (generationError) {
    return (
      <View style={[styles.loading, { paddingTop: insets.top }]}>
        <Text style={styles.loadingText}>Impossible de generer le defi du jour</Text>
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
        <Text style={styles.loadingText}>Chargement du defi...</Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      {/* Feuilles qui tombent */}
      <FallingLeaves />

      <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity onPress={handleDailyBack} style={styles.backBtn}>
              <Text style={styles.backText}>{'\u2190'} Abandonner</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.headerCenter}>
            <Text style={styles.levelLabel}>Defi du Jour</Text>
            <Text style={styles.challengeLabel}>Clairiere Secrete</Text>
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

        {/* Banniere validation unique */}
        <View style={styles.dailyBanner}>
          <Text style={styles.dailyBannerText}>
            {game.dailyValidationUsed
              ? '\u26A0\uFE0F Validation utilisee'
              : '\u26A1 Une seule validation !'}
          </Text>
          <Text style={styles.dailyBannerSub}>Aucun bonus disponible</Text>
        </View>

        {/* Bouton Valider */}
        <View style={styles.validateRow}>
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
              {game.dailyValidationUsed ? 'Validation utilisee' : 'Valider \u2713'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Plateau */}
        <View style={styles.boardArea}>
          <View style={styles.boardContainer}>
            <BoardRenderer
              boardDef={boardDef}
              playerBoard={game.playerBoard}
              fixedCells={fixedCells}
              selectedElement={game.selectedElement}
              highlightActive={false}
              getCellColor={(idx) => game.getCellColor(idx)}
              onCellPress={handleCellPress}
            />
          </View>
        </View>

        {/* Palette */}
        <ElementPalette
          availableTokens={challenge.availableTokens}
          playerBoard={game.playerBoard}
          fixedCells={fixedCells}
          selectedElement={game.selectedElement}
          onSelectElement={game.selectElement}
        />

        {/* Modal victoire */}
        <VictoryModal
          visible={game.isVictory}
          elapsedTime={game.elapsedTime}
          seedsEarned={seedsEarned}
          difficulty={'niveau_15' as any}
          challengeNumber={0}
          confettiPieces={confettiPieces}
          badgeQueue={badgeQueue}
          onBadgeQueueEmpty={() => setBadgeQueue([])}
          onNextChallenge={() => {
            game.resetGame();
            router.replace('/(tabs)');
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
      </View>

      {/* Briefing journalier (affiche avant le debut du jeu) */}
      {challenge && !briefingDone && (
        <DailyBriefingModal
          challenge={challenge}
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
    backgroundColor: '#FFF3E0',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#FFE0B2',
    alignItems: 'center',
  },
  dailyBannerText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#E65100',
  },
  dailyBannerSub: {
    fontSize: 11,
    color: '#BF360C',
    marginTop: 2,
  },
  validateRow: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: Colors.ui.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.ui.border,
    alignItems: 'flex-end',
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
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.ui.background,
    padding: 4,
  },
  boardContainer: {
    flex: 1,
    width: '100%',
    maxWidth: 500,
    aspectRatio: 1,
    borderRadius: 16,
  },
});
