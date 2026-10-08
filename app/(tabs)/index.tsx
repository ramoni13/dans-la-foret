// ============================================================
// ÉCRAN JOUER
// Fond illustré + Défi du Jour + Continuer + bouton vers les défis
// ============================================================

import React, { useMemo, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  ActivityIndicator,
  Animated,
  Image,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors } from '../../src/constants/colors';
import { usePlayerStore } from '../../src/store/playerStore';
import { getDailyDateString, subscribeDailyLeaderboard, DailyResult } from '../../src/services/dailyChallengeService';
import { formatTime } from '../../src/utils/boardUtils';
import { DifficultyLevel } from '../../src/core/models/Challenge';
import { WorldRecord, subscribeAllWorldRecords } from '../../src/services/worldRecordService';


// ── Tous les défis (15 niveaux) ────────────────────────────────────────────────
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

const LEVELS: Array<{
  id: DifficultyLevel;
  label: string;
  emoji: string;
  description: string;
  isPremium: boolean;
  color: string;
}> = [
  { id: 'niveau_1',  label: 'Niveau 1',  emoji: '🌱', description: '6 cases · 3 vides · Bucheron/Ours/Mouton',  isPremium: false, color: '#A5D6A7' },
  { id: 'niveau_2',  label: 'Niveau 2',  emoji: '🌿', description: '7 cases · 4 vides · Bucheron/Ours/Mouton',  isPremium: false, color: '#81C784' },
  { id: 'niveau_3',  label: 'Niveau 3',  emoji: '🌳', description: '8 cases · 4 vides · + Chien',               isPremium: false, color: '#66BB6A' },
  { id: 'niveau_4',  label: 'Niveau 4',  emoji: '🦊', description: '8 cases · 5 vides · Chien',                 isPremium: false, color: '#4CAF50' },
  { id: 'niveau_5',  label: 'Niveau 5',  emoji: '🏕️', description: '9 cases · 5 vides · + Loup',               isPremium: true,  color: '#43A047' },
  { id: 'niveau_6',  label: 'Niveau 6',  emoji: '🦌', description: '9 cases · 6 vides · Loup',                  isPremium: true,  color: '#388E3C' },
  { id: 'niveau_7',  label: 'Niveau 7',  emoji: '🌲', description: '10 cases · 6 vides · + Ruche',              isPremium: true,  color: '#2E7D32' },
  { id: 'niveau_8',  label: 'Niveau 8',  emoji: '🐺', description: '10 cases · 7 vides · Ruche',                isPremium: true,  color: '#1B5E20' },
  { id: 'niveau_9',  label: 'Niveau 9',  emoji: '🏔️', description: '11 cases · 7 vides · + Cerf/Biche',        isPremium: true,  color: '#33691E' },
  { id: 'niveau_10', label: 'Niveau 10', emoji: '🐾', description: '11 cases · 7 vides · Cerf/Biche',           isPremium: true,  color: '#558B2F' },
  { id: 'niveau_11', label: 'Niveau 11', emoji: '🏹', description: '11 cases · 7 vides · + Bûches',             isPremium: true,  color: '#827717' },
  { id: 'niveau_12', label: 'Niveau 12', emoji: '🪵', description: '12 cases · 7 vides · + Chalet',             isPremium: true,  color: '#6D4C41' },
  { id: 'niveau_13', label: 'Niveau 13', emoji: '🏠', description: '12 cases · 7 vides · Chalet',               isPremium: true,  color: '#4E342E' },
  { id: 'niveau_14', label: 'Niveau 14', emoji: '⚡',  description: '12 cases · 8 vides · Expert',              isPremium: true,  color: '#E65100' },
  { id: 'niveau_15', label: 'Niveau 15', emoji: '💀', description: '12 cases · 8 vides · Sans bonus',           isPremium: true,  color: '#3E2723' },
];

const ALL_CHALLENGES_BY_LEVEL: Record<string, any[]> = {
  niveau_1:  niveau1.challenges,
  niveau_2:  niveau2.challenges,
  niveau_3:  niveau3.challenges,
  niveau_4:  niveau4.challenges,
  niveau_5:  niveau5.challenges,
  niveau_6:  niveau6.challenges,
  niveau_7:  niveau7.challenges,
  niveau_8:  niveau8.challenges,
  niveau_9:  niveau9.challenges,
  niveau_10: niveau10.challenges,
  niveau_11: niveau11.challenges,
  niveau_12: niveau12.challenges,
  niveau_13: niveau13.challenges,
  niveau_14: niveau14.challenges,
  niveau_15: niveau15.challenges,
};

const ALL_CHALLENGES_FLAT = LEVELS.flatMap(l => ALL_CHALLENGES_BY_LEVEL[l.id] ?? []);

// ── Assets ─────────────────────────────────────────────────────────────────────
const BG_IMAGE = require('../../assets/sprites/Gemini_Generated_Image_mhh6w8mhh6w8mhh6.jpg');

// ── Fond plein écran (dimensions dynamiques obligatoires pour Image RN) ────────
function BgImage() {
  const { width, height } = useWindowDimensions();
  return (
    <>
      <Image
        source={BG_IMAGE}
        style={{ position: 'absolute', top: 0, left: 0, width, height }}
        resizeMode="cover"
      />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.48)' }]} pointerEvents="none" />
    </>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Sous-écran : navigateur de niveaux (carrousel + liste de défis)
// ══════════════════════════════════════════════════════════════════════════════
function LevelsScreen({
  onBack,
  router,
  worldRecords,
  initialLevelIndex,
}: {
  onBack: () => void;
  router: ReturnType<typeof useRouter>;
  worldRecords: Map<string, WorldRecord>;
  initialLevelIndex: number;
}) {
  const insets  = useSafeAreaInsets();
  const player  = usePlayerStore();
  const [levelIndex, setLevelIndex] = useState(initialLevelIndex);

  const selectedLevelDef = LEVELS[levelIndex];
  const selectedLevel    = selectedLevelDef.id;
  const challenges       = ALL_CHALLENGES_BY_LEVEL[selectedLevel] ?? [];
  const completedCount   = challenges.filter((c: any) =>
    player.completedChallenges.includes(c.id)
  ).length;
  const progressPct = challenges.length > 0
    ? Math.round((completedCount / challenges.length) * 100)
    : 0;

  const isLevelUnlocked = (idx: number): boolean => {
    if (idx === 0) return true;
    const prev = LEVELS[idx - 1];
    return (ALL_CHALLENGES_BY_LEVEL[prev.id] ?? []).every(
      (c: any) => player.completedChallenges.includes(c.id)
    );
  };

  const isChallengeUnlocked = (challengeIdx: number): boolean => {
    if (challengeIdx === 0) return true;
    return player.completedChallenges.includes(challenges[challengeIdx - 1].id);
  };

  const currentUnlocked = isLevelUnlocked(levelIndex);
  const canGoPrev = levelIndex > 0;
  const canGoNext = levelIndex < LEVELS.length - 1;

  return (
    <View style={StyleSheet.absoluteFill}>
      <BgImage />

      {/* Header avec bouton retour */}
      <View style={[styles.levelsHeader, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
          <Text style={styles.backBtnText}>← Retour</Text>
        </TouchableOpacity>
        <Text style={styles.levelsHeaderTitle}>Tous les défis</Text>
        <View style={{ width: 80 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.levelsContainer, { paddingBottom: insets.bottom + 90 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Navigateur de niveau ‹/› */}
        <View style={styles.levelNavigator}>
          <TouchableOpacity
            style={[styles.arrowBtn, !canGoPrev && styles.arrowBtnDisabled]}
            onPress={() => canGoPrev && setLevelIndex(levelIndex - 1)}
            activeOpacity={canGoPrev ? 0.7 : 1}
            disabled={!canGoPrev}
          >
            <Text style={[styles.arrowText, !canGoPrev && styles.arrowTextDisabled]}>‹</Text>
          </TouchableOpacity>

          <View style={[
            styles.levelCard,
            { borderColor: currentUnlocked ? selectedLevelDef.color : 'rgba(255,255,255,0.2)' },
          ]}>
            <View style={[
              styles.levelCardBg,
              { backgroundColor: currentUnlocked ? selectedLevelDef.color + '22' : 'rgba(0,0,0,0.2)' },
            ]} />
            <Text style={styles.levelCardEmoji}>
              {currentUnlocked ? selectedLevelDef.emoji : '🔒'}
            </Text>
            <Text style={[
              styles.levelCardLabel,
              { color: currentUnlocked ? selectedLevelDef.color : 'rgba(255,255,255,0.4)' },
            ]}>
              {selectedLevelDef.label}
            </Text>
            <Text style={styles.levelCardDesc}>{selectedLevelDef.description}</Text>

            <View style={styles.progressRow}>
              <View style={styles.progressBarBg}>
                <View style={[
                  styles.progressBarFill,
                  { width: `${progressPct}%`, backgroundColor: currentUnlocked ? selectedLevelDef.color : Colors.ui.border },
                ]} />
              </View>
              <Text style={styles.progressLabel}>{completedCount}/{challenges.length}</Text>
            </View>

            <View style={styles.dotsRow}>
              {LEVELS.map((_, i) => (
                <TouchableOpacity
                  key={i}
                  onPress={() => setLevelIndex(i)}
                  hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                >
                  <View style={[
                    styles.dot,
                    i === levelIndex
                      ? [styles.dotActive, { backgroundColor: selectedLevelDef.color }]
                      : { backgroundColor: isLevelUnlocked(i) ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.15)' },
                  ]} />
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <TouchableOpacity
            style={[styles.arrowBtn, !canGoNext && styles.arrowBtnDisabled]}
            onPress={() => canGoNext && setLevelIndex(levelIndex + 1)}
            activeOpacity={canGoNext ? 0.7 : 1}
            disabled={!canGoNext}
          >
            <Text style={[styles.arrowText, !canGoNext && styles.arrowTextDisabled]}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Liste des défis ou niveau verrouillé */}
        {!currentUnlocked ? (
          <View style={styles.lockedContainer}>
            <Text style={styles.lockedEmoji}>🔒</Text>
            <Text style={styles.lockedTitle}>Niveau verrouillé</Text>
            <Text style={styles.lockedSubtitle}>
              Terminez tous les défis du{' '}
              {LEVELS[levelIndex - 1]?.label ?? 'niveau précédent'}{' '}
              pour débloquer ce niveau.
            </Text>
          </View>
        ) : (
          <View style={styles.challengeList}>
            {challenges.map((challenge: any, idx: number) => {
              const isCompleted = player.completedChallenges.includes(challenge.id);
              const unlocked    = isChallengeUnlocked(idx);
              const bestTime    = player.stats.bestTimes[challenge.id];
              const wr          = worldRecords.get(challenge.id);
              return (
                <TouchableOpacity
                  key={challenge.id}
                  style={[
                    styles.challengeCard,
                    isCompleted && styles.challengeCardDone,
                    !unlocked && styles.challengeCardLocked,
                  ]}
                  onPress={() => unlocked && router.push(`/game/${challenge.id}`)}
                  activeOpacity={unlocked ? 0.8 : 1}
                >
                  <View style={[
                    styles.challengeAccent,
                    { backgroundColor: unlocked ? selectedLevelDef.color : 'rgba(255,255,255,0.1)' },
                  ]} />
                  <View style={styles.challengeLeft}>
                    <Text style={styles.challengeNumber}>#{idx + 1}</Text>
                  </View>
                  <View style={styles.challengeCenter}>
                    <Text style={[styles.challengeTitle, !unlocked && styles.challengeTitleLocked]}>
                      {unlocked ? `Défi ${challenge.challengeNumber}` : '🔒 Verrouillé'}
                    </Text>
                    {unlocked && (
                      <View style={styles.challengeTimes}>
                        {bestTime
                          ? <Text style={styles.challengeBestTime}>⏱ {formatTime(bestTime)}</Text>
                          : <Text style={styles.challengeNew}>Nouveau</Text>
                        }
                        {wr && (
                          <Text style={styles.challengeWr} numberOfLines={1}>
                            🌍 {formatTime(wr.timeMs)} · {wr.username}
                          </Text>
                        )}
                      </View>
                    )}
                  </View>
                  {isCompleted
                    ? <Text style={styles.checkmark}>✓</Text>
                    : unlocked
                      ? <Text style={styles.challengeArrow}>→</Text>
                      : <Text style={styles.challengeArrow}>🔒</Text>
                  }
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Écran principal
// ══════════════════════════════════════════════════════════════════════════════
export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const player = usePlayerStore();
  const { authReady, isAuthenticated } = player;

  const [showLevels, setShowLevels] = useState(false);

  // ── Records mondiaux ───────────────────────────────────────────────────────
  const [worldRecords, setWorldRecords] = useState<Map<string, WorldRecord>>(new Map());
  useEffect(() => {
    const unsub = subscribeAllWorldRecords(setWorldRecords);
    return () => unsub();
  }, []);

  // ── Prochain défi non complété ─────────────────────────────────────────────
  const nextChallenge = useMemo(() => {
    for (const level of LEVELS) {
      const list = ALL_CHALLENGES_BY_LEVEL[level.id] ?? [];
      const next = list.find((c: any) => !player.completedChallenges.includes(c.id));
      if (next) return { challenge: next, level };
    }
    const first = (ALL_CHALLENGES_BY_LEVEL[LEVELS[0].id] ?? [])[0];
    return first ? { challenge: first, level: LEVELS[0] } : null;
  }, [player.completedChallenges]);

  const totalCompleted  = player.completedChallenges.length;
  const totalChallenges = ALL_CHALLENGES_FLAT.length;
  const allCompleted    = totalCompleted >= totalChallenges;

  // Index initial du niveau (niveau courant du joueur)
  const initialLevelIndex = Math.min(Math.max(0, player.currentLevel - 1), LEVELS.length - 1);

  // ── Défi du Jour ───────────────────────────────────────────────────────────
  const todayStr      = useMemo(() => getDailyDateString(new Date()), []);
  const dailyStatus   = player.dailyChallengeStatus;
  const dailyLastDate = player.lastDailyChallengeDate;
  const isDailyToday  = dailyLastDate === todayStr;
  const dailyStreak   = player.dailyChallengeStreak;

  // Record du jour : top 1 du leaderboard journalier
  const [dailyLeader, setDailyLeader] = useState<DailyResult | null>(null);
  useEffect(() => {
    const unsub = subscribeDailyLeaderboard(todayStr, 1, (results) => {
      setDailyLeader(results.length > 0 ? results[0] : null);
    });
    return () => unsub();
  }, [todayStr]);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (isDailyToday && dailyStatus) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.03, duration: 1200, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 1200, useNativeDriver: Platform.OS !== 'web' }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [isDailyToday, dailyStatus]);

  // ── Gardes ────────────────────────────────────────────────────────────────
  if (!authReady) {
    return (
      <View style={[styles.guardRoot, { paddingTop: insets.top }]}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.forest.medium} />
        </View>
      </View>
    );
  }

  if (!isAuthenticated) {
    return (
      <View style={[styles.guardRoot, { paddingTop: insets.top }]}>
        <View style={styles.centered}>
          <Text style={styles.lockEmoji}>🔒</Text>
          <Text style={styles.lockTitle}>Connexion requise</Text>
          <Text style={styles.lockDesc}>
            Connecte-toi pour accéder à l'accueil et voir ta progression.
          </Text>
          <TouchableOpacity
            style={styles.btnLogin}
            onPress={() => router.push('/(tabs)/profile')}
            activeOpacity={0.8}
          >
            <Text style={styles.btnLoginText}>Se connecter</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Sous-écran niveaux ────────────────────────────────────────────────────
  if (showLevels) {
    return (
      <LevelsScreen
        onBack={() => setShowLevels(false)}
        router={router}
        worldRecords={worldRecords}
        initialLevelIndex={initialLevelIndex}
      />
    );
  }

  // ── Écran principal ───────────────────────────────────────────────────────
  return (
    <View style={StyleSheet.absoluteFill}>
      <BgImage />

      <ScrollView
        style={StyleSheet.absoluteFill}
        contentContainerStyle={[
          styles.container,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 90 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero ── */}
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>Dans la Forêt</Text>
          <View style={styles.seedsHeroBadge}>
            <Text style={styles.seedsHeroText}>🌱 {player.seeds} graines</Text>
          </View>
        </View>

        {/* ── Défi du Jour ── */}
        {(() => {
          const DAILY_UNLOCK_LEVEL = 12;
          const dailyUnlocked = player.currentLevel >= DAILY_UNLOCK_LEVEL;

          // Bandeau record du jour — visible dans TOUS les états
          const dailyRecordBadge = dailyLeader ? (
            <View style={styles.dailyRecordBadge}>
              <Text style={styles.dailyRecordText}>
                {'\uD83C\uDFC6'} {dailyLeader.username} · {formatTime(dailyLeader.timeMs)}
              </Text>
            </View>
          ) : null;

          if (!dailyUnlocked) {
            return (
              <View style={styles.dailyCardLocked}>
                <View style={styles.dailyLeft}>
                  <Text style={[styles.dailyIcon, { opacity: 0.4 }]}>🔒</Text>
                </View>
                <View style={styles.dailyCenter}>
                  <Text style={styles.dailyTitleLocked}>Défi du Jour</Text>
                  <Text style={styles.dailySubLocked}>Disponible au niveau {DAILY_UNLOCK_LEVEL}</Text>
                  {dailyRecordBadge}
                </View>
              </View>
            );
          }

          if (!isDailyToday || !dailyStatus) {
            return (
              <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                <TouchableOpacity
                  style={styles.dailyCard}
                  onPress={() => router.push('/game/daily')}
                  activeOpacity={0.85}
                >
                  <View style={styles.dailyLeft}>
                    <Text style={styles.dailyIcon}>{'\uD83C\uDF05'}</Text>
                  </View>
                  <View style={styles.dailyCenter}>
                    <Text style={styles.dailyAction}>NOUVEAU</Text>
                    <Text style={styles.dailyTitle}>Défi du Jour</Text>
                    <Text style={styles.dailySub}>Clairière Secrète · 15 cases</Text>
                    {dailyRecordBadge}
                  </View>
                  <Text style={styles.dailyArrow}>→</Text>
                </TouchableOpacity>
              </Animated.View>
            );
          }

          if (dailyStatus === 'success') {
            return (
              <View style={styles.dailyDoneRow}>
                <View style={[styles.dailyCardSuccess, { flex: 1 }]}>
                  <View style={styles.dailyLeft}>
                    <Text style={styles.dailyIcon}>{'\u2705'}</Text>
                  </View>
                  <View style={styles.dailyCenter}>
                    <Text style={styles.dailyActionDone}>RÉUSSI</Text>
                    <Text style={styles.dailyTitleDone}>Défi du Jour</Text>
                    {dailyStreak > 1 && <Text style={styles.dailySub}>Série : {dailyStreak} jours</Text>}
                    {dailyRecordBadge}
                  </View>
                </View>
                {player.username === 'Ramoni' && (
                  <TouchableOpacity
                    style={styles.dailyReplayBtn}
                    onPress={() => { player.resetDailyStatus(); router.push('/game/daily'); }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.dailyReplayText}>Rejouer</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          }

          return (
            <View style={styles.dailyDoneRow}>
              <View style={[styles.dailyCardFailed, { flex: 1 }]}>
                <View style={styles.dailyLeft}>
                  <Text style={styles.dailyIcon}>{'\uD83D\uDCA4'}</Text>
                </View>
                <View style={styles.dailyCenter}>
                  <Text style={styles.dailyActionFailed}>ÉCHOUÉ</Text>
                  <Text style={styles.dailyTitleFailed}>Rendez-vous demain</Text>
                  {dailyRecordBadge}
                </View>
              </View>
              {player.username === 'Ramoni' && (
                <TouchableOpacity
                  style={styles.dailyReplayBtn}
                  onPress={() => { player.resetDailyStatus(); router.push('/game/daily'); }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.dailyReplayText}>Rejouer</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })()}

        {/* ── Continuer ── */}
        {nextChallenge && (
          <TouchableOpacity
            style={styles.resumeCard}
            onPress={() => router.push(`/game/${nextChallenge.challenge.id}`)}
            activeOpacity={0.85}
          >
            <View style={styles.resumeLeft}>
              <Text style={styles.resumeIcon}>
                {allCompleted ? '🏆' : totalCompleted === 0 ? '🌱' : '▶️'}
              </Text>
            </View>
            <View style={styles.resumeCenter}>
              <Text style={styles.resumeAction}>
                {allCompleted ? 'Tout terminé ! Recommencer' : totalCompleted === 0 ? 'Commencer' : 'Continuer'}
              </Text>
              <Text style={styles.resumeLevel}>
                {nextChallenge.level.emoji} {nextChallenge.level.label}
              </Text>
              <Text style={styles.resumeChallenge}>
                Défi n°{nextChallenge.challenge.challengeNumber}
              </Text>
            </View>
            <Text style={styles.resumeArrow}>→</Text>
          </TouchableOpacity>
        )}

        {/* ── Bouton Tous les défis ── */}
        <TouchableOpacity
          style={styles.allChallengesBtn}
          onPress={() => setShowLevels(true)}
          activeOpacity={0.85}
        >
          <Text style={styles.allChallengesBtnEmoji}>🗺️</Text>
          <View style={styles.allChallengesBtnCenter}>
            <Text style={styles.allChallengesBtnTitle}>Tous les défis</Text>
            <Text style={styles.allChallengesBtnSub}>
              {totalCompleted}/{totalChallenges} complétés
            </Text>
          </View>
          <Text style={styles.allChallengesBtnArrow}>→</Text>
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  // ── Gardes ─────────────────────────────────────────────────────────────────
  guardRoot: {
    flex: 1,
    backgroundColor: Colors.ui.background,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 16,
  },
  lockEmoji: { fontSize: 48 },
  lockTitle: { fontSize: 20, fontWeight: '700', color: Colors.forest.dark, textAlign: 'center' },
  lockDesc:  { fontSize: 14, color: Colors.ui.textLight, textAlign: 'center', lineHeight: 20 },
  btnLogin: {
    backgroundColor: Colors.forest.medium,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 32,
    marginTop: 8,
  },
  btnLoginText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // ── Écran principal ─────────────────────────────────────────────────────────
  container: {
    paddingHorizontal: 16,
    gap: 14,
  },

  // Hero
  hero: { alignItems: 'center', gap: 8, paddingVertical: 4 },
  heroTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.5,
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  seedsHeroBadge: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  seedsHeroText: { fontSize: 14, fontWeight: '700', color: '#fff' },

  // Continuer
  resumeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(20,55,20,0.88)',
    borderRadius: 18,
    padding: 18,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  resumeLeft:    { width: 44, alignItems: 'center' },
  resumeIcon:    { fontSize: 30 },
  resumeCenter:  { flex: 1, gap: 2 },
  resumeAction:  { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', letterSpacing: 0.8 },
  resumeLevel:   { fontSize: 15, fontWeight: '700', color: '#fff' },
  resumeChallenge: { fontSize: 12, color: 'rgba(255,255,255,0.55)' },
  resumeArrow:   { fontSize: 20, color: 'rgba(255,255,255,0.85)' },

  // Défi du Jour
  dailyCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#C8950F', borderRadius: 18, padding: 18, gap: 12,
    borderWidth: 2, borderColor: '#E8B830',
  },
  dailyCardLocked: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(60,60,60,0.75)', borderRadius: 18, padding: 18, gap: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', opacity: 0.7,
  },
  dailyCardSuccess: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(46,125,50,0.9)', borderRadius: 18, padding: 18, gap: 12,
    borderWidth: 1, borderColor: '#43A047',
  },
  dailyCardFailed: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(100,100,100,0.85)', borderRadius: 18, padding: 18, gap: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  dailyLeft:   { width: 44, alignItems: 'center' },
  dailyIcon:   { fontSize: 30 },
  dailyCenter: { flex: 1, gap: 3 },
  dailyAction:       { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.85)', textTransform: 'uppercase', letterSpacing: 0.8 },
  dailyActionDone:   { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.7)',  textTransform: 'uppercase', letterSpacing: 0.8 },
  dailyActionFailed: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.6)',  textTransform: 'uppercase', letterSpacing: 0.8 },
  dailyTitle:       { fontSize: 17, fontWeight: '800', color: '#fff' },
  dailyTitleDone:   { fontSize: 15, fontWeight: '700', color: '#fff' },
  dailyTitleLocked: { fontSize: 15, fontWeight: '700', color: 'rgba(255,255,255,0.5)' },
  dailyTitleFailed: { fontSize: 15, fontWeight: '700', color: '#fff' },
  dailySub:       { fontSize: 12, color: 'rgba(255,255,255,0.7)' },
  dailySubLocked: { fontSize: 12, color: 'rgba(255,255,255,0.35)' },
  dailyArrow:     { fontSize: 22, color: 'rgba(255,255,255,0.9)' },
  dailyRecordBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(212,160,23,0.25)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 2,
  },
  dailyRecordText: { fontSize: 11, fontWeight: '700', color: '#FFD54F' },
  dailyDoneRow:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dailyReplayBtn: {
    backgroundColor: '#C8950F', borderRadius: 14,
    paddingVertical: 16, paddingHorizontal: 14,
    borderWidth: 2, borderColor: '#E8B830',
  },
  dailyReplayText: { fontSize: 13, fontWeight: '700', color: '#fff' },

  // Bouton Tous les défis
  allChallengesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 18,
    padding: 18,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  allChallengesBtnEmoji:  { fontSize: 28 },
  allChallengesBtnCenter: { flex: 1, gap: 2 },
  allChallengesBtnTitle:  { fontSize: 16, fontWeight: '700', color: '#fff' },
  allChallengesBtnSub:    { fontSize: 12, color: 'rgba(255,255,255,0.6)' },
  allChallengesBtnArrow:  { fontSize: 20, color: 'rgba(255,255,255,0.7)' },

  // ── Sous-écran niveaux ──────────────────────────────────────────────────────
  levelsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backBtn: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  backBtnText: { fontSize: 14, fontWeight: '600', color: '#fff' },
  levelsHeaderTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  levelsContainer: { paddingHorizontal: 16, gap: 12 },

  // Navigateur de niveau
  levelNavigator: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  arrowBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
  arrowBtnDisabled: { opacity: 0.25 },
  arrowText: { fontSize: 28, fontWeight: '300', color: '#fff', lineHeight: 32, marginTop: -2 },
  arrowTextDisabled: { color: 'rgba(255,255,255,0.4)' },

  levelCard: {
    flex: 1, borderRadius: 18, borderWidth: 2, padding: 14,
    alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(20,40,20,0.75)', overflow: 'hidden',
  },
  levelCardBg:    { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 16 },
  levelCardEmoji: { fontSize: 32, marginBottom: 1 },
  levelCardLabel: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  levelCardDesc:  { fontSize: 11, color: 'rgba(255,255,255,0.6)', textAlign: 'center' },

  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 8, width: '100%', marginTop: 4 },
  progressBarBg: { flex: 1, height: 5, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 3, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 3 },
  progressLabel: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.7)', minWidth: 30, textAlign: 'right' },

  dotsRow: { flexDirection: 'row', gap: 4, marginTop: 4, flexWrap: 'wrap', justifyContent: 'center' },
  dot:       { width: 6,  height: 6, borderRadius: 3 },
  dotActive: { width: 16, height: 6, borderRadius: 3 },

  lockedContainer: {
    alignItems: 'center', paddingVertical: 24, paddingHorizontal: 32, gap: 10,
    backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 16,
  },
  lockedEmoji:    { fontSize: 40 },
  lockedTitle:    { fontSize: 17, fontWeight: '800', color: '#fff' },
  lockedSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.7)', textAlign: 'center', lineHeight: 18 },

  challengeList: { gap: 8 },
  challengeCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(20,40,20,0.82)', borderRadius: 13,
    paddingVertical: 12, paddingRight: 14, paddingLeft: 0,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', overflow: 'hidden',
  },
  challengeCardDone:   { borderColor: Colors.forest.accent + '90', backgroundColor: 'rgba(30,80,30,0.85)' },
  challengeCardLocked: { opacity: 0.45, backgroundColor: 'rgba(0,0,0,0.5)' },
  challengeAccent: {
    width: 4, alignSelf: 'stretch', marginRight: 10,
    borderTopLeftRadius: 13, borderBottomLeftRadius: 13,
  },
  challengeLeft:   { width: 30, alignItems: 'center' },
  challengeNumber: { fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: '600' },
  challengeCenter: { flex: 1, paddingLeft: 6 },
  challengeTitle:       { fontSize: 14, fontWeight: '600', color: '#fff' },
  challengeTitleLocked: { color: 'rgba(255,255,255,0.4)', fontStyle: 'italic' },
  challengeTimes:   { gap: 2, marginTop: 2 },
  challengeBestTime: { fontSize: 11, color: '#A5D6A7' },
  challengeWr:      { fontSize: 10, color: 'rgba(255,255,255,0.5)' },
  challengeNew:     { fontSize: 10, color: 'rgba(255,255,255,0.35)', fontStyle: 'italic' },
  checkmark:        { fontSize: 16, color: Colors.forest.accent, fontWeight: '800', paddingLeft: 4 },
  challengeArrow:   { fontSize: 14, color: 'rgba(255,255,255,0.5)' },
});
