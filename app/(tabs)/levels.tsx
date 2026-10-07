// ============================================================
// ÉCRAN SÉLECTION DES NIVEAUX
// Navigation niveau par niveau avec flèches gauche/droite
// ============================================================

import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';

import { Colors } from '../../src/constants/colors';
import { DifficultyLevel } from '../../src/core/models/Challenge';
import { usePlayerStore } from '../../src/store/playerStore';
import { WorldRecord, subscribeAllWorldRecords } from '../../src/services/worldRecordService';
import { formatTime } from '../../src/utils/boardUtils';
import { getDailyDateString } from '../../src/services/dailyChallengeService';


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
  { id: 'niveau_1',  label: 'Niveau 1',  emoji: '🌱', description: '6 cases · 3 vides · Bucheron/Ours/Mouton',       isPremium: false, color: '#A5D6A7' },
  { id: 'niveau_2',  label: 'Niveau 2',  emoji: '🌿', description: '7 cases · 4 vides · Bucheron/Ours/Mouton',       isPremium: false, color: '#81C784' },
  { id: 'niveau_3',  label: 'Niveau 3',  emoji: '🌳', description: '8 cases · 4 vides · + Chien',                    isPremium: false, color: '#66BB6A' },
  { id: 'niveau_4',  label: 'Niveau 4',  emoji: '🦊', description: '8 cases · 5 vides · Chien',                      isPremium: false, color: '#4CAF50' },
  { id: 'niveau_5',  label: 'Niveau 5',  emoji: '🏕️', description: '9 cases · 5 vides · + Renard',                    isPremium: true,  color: '#43A047' },
  { id: 'niveau_6',  label: 'Niveau 6',  emoji: '🦌', description: '9 cases · 6 vides · Renard',                     isPremium: true,  color: '#388E3C' },
  { id: 'niveau_7',  label: 'Niveau 7',  emoji: '🌲', description: '10 cases · 6 vides · + Ruche',                   isPremium: true,  color: '#2E7D32' },
  { id: 'niveau_8',  label: 'Niveau 8',  emoji: '🐺', description: '10 cases · 7 vides · Ruche',                     isPremium: true,  color: '#1B5E20' },
  { id: 'niveau_9',  label: 'Niveau 9',  emoji: '🏔️', description: '11 cases · 7 vides · + Cerf/Biche',               isPremium: true,  color: '#33691E' },
  { id: 'niveau_10', label: 'Niveau 10', emoji: '🐾', description: '11 cases · 7 vides · Cerf/Biche',                isPremium: true,  color: '#558B2F' },
  { id: 'niveau_11', label: 'Niveau 11', emoji: '🏹', description: '11 cases · 7 vides · + Bûches',           isPremium: true,  color: '#827717' },
  { id: 'niveau_12', label: 'Niveau 12', emoji: '🪵', description: '12 cases · 7 vides · + Chalet',                  isPremium: true,  color: '#6D4C41' },
  { id: 'niveau_13', label: 'Niveau 13', emoji: '🏠', description: '12 cases · 7 vides · Chalet',                    isPremium: true,  color: '#4E342E' },
  { id: 'niveau_14', label: 'Niveau 14', emoji: '⚡',  description: '12 cases · 8 vides · Expert',                     isPremium: true,  color: '#E65100' },
  { id: 'niveau_15', label: 'Niveau 15', emoji: '💀', description: '12 cases · 8 vides · Sans bonus',                isPremium: true,  color: '#3E2723' },
];

const ALL_CHALLENGES: Record<string, any[]> = {
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

export default function LevelsScreen() {
  const router = useRouter();
  const player = usePlayerStore();
  const { authReady, isAuthenticated } = player;

    // Index du niveau courant — initialisé sur le niveau réel du joueur (currentLevel - 1)
  // On clamp à [0, LEVELS.length-1] pour éviter tout dépassement.
  const initialIndex = Math.min(
    Math.max(0, player.currentLevel - 1),
    LEVELS.length - 1,
  );
  const [levelIndex, setLevelIndex] = useState(initialIndex);

  // ── Prochain défi non complété (toutes niveaux confondus) ───────────────
  const nextChallenge = useMemo(() => {
    for (const level of LEVELS) {
      const list = ALL_CHALLENGES[level.id] ?? [];
      const next = list.find((c: any) => !player.completedChallenges.includes(c.id));
      if (next) return { challenge: next, level };
    }
    // Tout terminé → premier défi du premier niveau
    const first = (ALL_CHALLENGES[LEVELS[0].id] ?? [])[0];
    return first ? { challenge: first, level: LEVELS[0] } : null;
  }, [player.completedChallenges]);

  const totalCompleted  = player.completedChallenges.length;
  const totalChallenges = LEVELS.reduce((sum, l) => sum + (ALL_CHALLENGES[l.id]?.length ?? 0), 0);
  const allCompleted = totalCompleted >= totalChallenges;

  // ── Records mondiaux (temps réel) ──────────────────────────────────────────
  const [worldRecords, setWorldRecords] = useState<Map<string, WorldRecord>>(new Map());
  useEffect(() => {
    const unsub = subscribeAllWorldRecords(setWorldRecords);
    return () => unsub();
  }, []);

  // ── Garde : Firebase pas encore répondu ─────────────────────────────────────
  if (!authReady) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.forest.medium} />
        </View>
      </SafeAreaView>
    );
  }

  // ── Garde : non connecté ─────────────────────────────────────────────────────
  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.centered}>
          <Text style={styles.lockEmoji}>🔒</Text>
          <Text style={styles.lockTitle}>Connexion requise</Text>
          <Text style={styles.lockDesc}>
            Connecte-toi pour accéder aux défis et suivre ta progression.
          </Text>
          <TouchableOpacity
            style={styles.btnLogin}
            onPress={() => router.push('/(tabs)/profile')}
            activeOpacity={0.8}
          >
            <Text style={styles.btnLoginText}>Se connecter</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const selectedLevelDef = LEVELS[levelIndex];
  const selectedLevel = selectedLevelDef.id;
  const challenges = ALL_CHALLENGES[selectedLevel] ?? [];

  // Progression : nombre de défis complétés pour le niveau sélectionné
  const completedCount = challenges.filter((c: any) =>
    player.completedChallenges.includes(c.id)
  ).length;

  // ── Logique de déblocage progressif ──────────────────────────────────────
  const isLevelUnlocked = (idx: number): boolean => {
    if (idx === 0) return true;
    const prevLevel = LEVELS[idx - 1];
    const prevChallenges = ALL_CHALLENGES[prevLevel.id] ?? [];
    return prevChallenges.every((c: any) => player.completedChallenges.includes(c.id));
  };

  const currentUnlocked = isLevelUnlocked(levelIndex);

  // Un défi est débloqué si c'est le premier OU si le défi précédent est complété
  const isChallengeUnlocked = (challengeIdx: number): boolean => {
    if (challengeIdx === 0) return true;
    const prevChallenge = challenges[challengeIdx - 1];
    return player.completedChallenges.includes(prevChallenge.id);
  };

  const canGoPrev = levelIndex > 0;
  const canGoNext = levelIndex < LEVELS.length - 1;

  const progressPct = challenges.length > 0
    ? Math.round((completedCount / challenges.length) * 100)
    : 0;

  return (
    <SafeAreaView style={styles.root}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={styles.title}>Choisir un défi</Text>
        <View style={styles.seedsRow}>
          <Text style={styles.seedsText}>🌱 {player.seeds} graines</Text>
        </View>
      </View>

      {/* ── Bouton Defi du Jour ── */}
      {(() => {
        const DAILY_UNLOCK_LEVEL = 12;
        const dailyUnlocked = player.currentLevel >= DAILY_UNLOCK_LEVEL;

        // Verrouille : bouton grise non cliquable
        if (!dailyUnlocked) {
          return (
            <View style={styles.dailyBtnLocked}>
              <Text style={[styles.dailyBtnIcon, { opacity: 0.4 }]}>{'\uD83D\uDD12'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.dailyBtnTextLocked}>Defi du Jour</Text>
                <Text style={styles.dailyBtnSubLocked}>
                  Disponible au niveau {DAILY_UNLOCK_LEVEL}
                </Text>
              </View>
            </View>
          );
        }

        const todayStr = getDailyDateString(new Date());
        const status = player.dailyChallengeStatus;
        const lastDate = player.lastDailyChallengeDate;
        const played = lastDate === todayStr && !!status;

        if (!played) {
          return (
            <TouchableOpacity
              style={styles.dailyBtn}
              onPress={() => router.push('/game/daily')}
              activeOpacity={0.85}
            >
              <Text style={styles.dailyBtnIcon}>{'\uD83C\uDF05'}</Text>
              <Text style={styles.dailyBtnText}>Defi du Jour</Text>
              <Text style={styles.dailyBtnArrow}>{'\u2192'}</Text>
            </TouchableOpacity>
          );
        }

        if (status === 'success') {
          return (
            <View style={styles.dailyBtnDoneRow}>
              <View style={styles.dailyBtnDone}>
                <Text style={styles.dailyBtnIcon}>{'\u2705'}</Text>
                <Text style={styles.dailyBtnTextDone}>Defi du Jour reussi</Text>
              </View>
              {player.username === 'ramoni' && (
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
          <View style={styles.dailyBtnDoneRow}>
            <View style={styles.dailyBtnFailed}>
                <Text style={styles.dailyBtnIcon}>{'\uD83D\uDCA4'}</Text>
              <Text style={styles.dailyBtnTextFailed}>Rendez-vous demain</Text>
            </View>
            {player.username === 'ramoni' && (
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

      {/* ── Carte Continuer ── */}
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

      {/* ── Navigateur de niveau avec flèches ── */}
      <View style={styles.levelNavigator}>
        {/* Flèche gauche */}
        <TouchableOpacity
          style={[styles.arrowBtn, !canGoPrev && styles.arrowBtnDisabled]}
          onPress={() => canGoPrev && setLevelIndex(levelIndex - 1)}
          activeOpacity={canGoPrev ? 0.7 : 1}
          disabled={!canGoPrev}
        >
          <Text style={[styles.arrowText, !canGoPrev && styles.arrowTextDisabled]}>‹</Text>
        </TouchableOpacity>

        {/* Carte du niveau courant */}
        <View style={[
          styles.levelCard,
          { borderColor: currentUnlocked ? selectedLevelDef.color : Colors.ui.border },
        ]}>
          {/* Fond coloré léger */}
          <View style={[
            styles.levelCardBg,
            { backgroundColor: currentUnlocked ? selectedLevelDef.color + '18' : Colors.ui.background },
          ]} />

          <Text style={styles.levelCardEmoji}>
            {currentUnlocked ? selectedLevelDef.emoji : '🔒'}
          </Text>
          <Text style={[
            styles.levelCardLabel,
            { color: currentUnlocked ? selectedLevelDef.color : Colors.ui.textLight },
          ]}>
            {selectedLevelDef.label}
          </Text>
          <Text style={styles.levelCardDesc}>{selectedLevelDef.description}</Text>

          {/* Barre de progression */}
          <View style={styles.progressRow}>
            <View style={styles.progressBarBg}>
              <View
                style={[
                  styles.progressBarFill,
                  {
                    width: `${progressPct}%`,
                    backgroundColor: currentUnlocked ? selectedLevelDef.color : Colors.ui.border,
                  },
                ]}
              />
            </View>
            <Text style={styles.progressLabel}>
              {completedCount}/{challenges.length}
            </Text>
          </View>

          {/* Points de navigation */}
          <View style={styles.dotsRow}>
            {LEVELS.map((lvl, i) => (
              <TouchableOpacity
                key={lvl.id}
                onPress={() => setLevelIndex(i)}
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
              >
                <View
                  style={[
                    styles.dot,
                    i === levelIndex
                      ? [styles.dotActive, { backgroundColor: selectedLevelDef.color }]
                      : { backgroundColor: isLevelUnlocked(i) ? Colors.ui.border : Colors.ui.border + '55' },
                  ]}
                />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Flèche droite */}
        <TouchableOpacity
          style={[styles.arrowBtn, !canGoNext && styles.arrowBtnDisabled]}
          onPress={() => canGoNext && setLevelIndex(levelIndex + 1)}
          activeOpacity={canGoNext ? 0.7 : 1}
          disabled={!canGoNext}
        >
          <Text style={[styles.arrowText, !canGoNext && styles.arrowTextDisabled]}>›</Text>
        </TouchableOpacity>
      </View>

      {/* ── Niveau verrouillé ── */}
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
        /* ── Liste des défis ── */
        <ScrollView contentContainerStyle={styles.challengeList}>
          {challenges.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>Aucun défi disponible pour ce niveau.</Text>
              <Text style={styles.emptySubtext}>Bientôt disponible !</Text>
            </View>
          ) : (
            challenges.map((challenge: any, idx: number) => {
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
                    { backgroundColor: unlocked ? selectedLevelDef.color : Colors.ui.border },
                  ]} />

                  <View style={styles.challengeLeft}>
                    <Text style={styles.challengeNumber}>#{idx + 1}</Text>
                  </View>
                  <View style={styles.challengeCenter}>
                    <Text style={[
                      styles.challengeTitle,
                      !unlocked && styles.challengeTitleLocked,
                    ]}>
                      {unlocked ? `Défi ${challenge.challengeNumber}` : '🔒 Verrouillé'}
                    </Text>
                    {unlocked && (
                      <View style={styles.challengeTimes}>
                        {bestTime ? (
                          <Text style={styles.challengeBestTime}>
                            ⏱ {formatTime(bestTime)}
                          </Text>
                        ) : (
                          <Text style={styles.challengeNew}>Nouveau</Text>
                        )}
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
            })
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.ui.background,
  },

  // ── Garde connexion ──
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 16,
  },
  lockEmoji: {
    fontSize: 48,
  },
  lockTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.forest.dark,
    textAlign: 'center',
  },
  lockDesc: {
    fontSize: 14,
    color: Colors.ui.textLight,
    textAlign: 'center',
    lineHeight: 20,
  },
  btnLogin: {
    backgroundColor: Colors.forest.medium,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 32,
    marginTop: 8,
  },
  btnLoginText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },

  // ── Bouton Defi du Jour ──
  dailyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D4A017',
    borderRadius: 14,
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 8,
    gap: 10,
    borderWidth: 1.5,
    borderColor: '#E8B830',
  },
  dailyBtnLocked: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#5A5A5A',
    borderRadius: 14,
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 8,
    gap: 10,
    borderWidth: 1.5,
    borderColor: '#6E6E6E',
    opacity: 0.7,
  },
  dailyBtnTextLocked: {
    fontSize: 15,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.5)',
  },
  dailyBtnSubLocked: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 2,
  },
  dailyBtnDone: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2E7D32',
    borderRadius: 14,
    padding: 14,
    gap: 10,
    borderWidth: 1.5,
    borderColor: '#43A047',
  },
  dailyBtnFailed: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#9E9E9E',
    borderRadius: 14,
    padding: 14,
    gap: 10,
    borderWidth: 1.5,
    borderColor: '#BDBDBD',
  },
  dailyBtnIcon: {
    fontSize: 22,
  },
  dailyBtnText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  dailyBtnTextDone: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  dailyBtnTextFailed: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  dailyBtnArrow: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.9)',
  },
  dailyBtnDoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 8,
    gap: 8,
  },
  dailyReplayBtn: {
    backgroundColor: '#D4A017',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    borderColor: '#E8B830',
  },
  dailyReplayText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },

  // ── Carte Continuer ──
  resumeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.forest.dark,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    gap: 12,
    shadowColor: Colors.forest.dark,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  resumeLeft: {
    width: 40,
    alignItems: 'center',
  },
  resumeIcon: {
    fontSize: 28,
  },
  resumeCenter: {
    flex: 1,
    gap: 2,
  },
  resumeAction: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.7)',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  resumeLevel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  resumeChallenge: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
  },
  resumeArrow: {
    fontSize: 20,
    color: 'rgba(255,255,255,0.9)',
  },

  // ── Header ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.forest.dark,
  },
  seedsRow: {
    backgroundColor: Colors.ui.seed + '22',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.ui.seed + '55',
  },
  seedsText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.forest.dark,
  },

  // ── Navigateur de niveau ──
  levelNavigator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 12,
    gap: 6,
  },
  arrowBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.ui.card,
    borderWidth: 1.5,
    borderColor: Colors.ui.border,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  arrowBtnDisabled: {
    opacity: 0.3,
  },
  arrowText: {
    fontSize: 30,
    fontWeight: '300',
    color: Colors.forest.dark,
    lineHeight: 34,
    marginTop: -2,
  },
  arrowTextDisabled: {
    color: Colors.ui.textLight,
  },

  // Carte niveau
  levelCard: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 2,
    padding: 16,
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.ui.card,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  levelCardBg: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 18,
  },
  levelCardEmoji: {
    fontSize: 36,
    marginBottom: 2,
  },
  levelCardLabel: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  levelCardDesc: {
    fontSize: 12,
    color: Colors.ui.textLight,
    textAlign: 'center',
  },

  // Barre de progression dans la carte
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    marginTop: 4,
  },
  progressBarBg: {
    flex: 1,
    height: 6,
    backgroundColor: Colors.ui.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.ui.textLight,
    minWidth: 32,
    textAlign: 'right',
  },

  // Points de navigation
  dotsRow: {
    flexDirection: 'row',
    gap: 5,
    marginTop: 6,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  dotActive: {
    width: 18,
    height: 7,
    borderRadius: 4,
  },

  // ── Niveau verrouillé ──
  lockedContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 12,
  },
  lockedEmoji: {
    fontSize: 52,
  },
  lockedTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.forest.dark,
  },
  lockedSubtitle: {
    fontSize: 14,
    color: Colors.ui.textLight,
    textAlign: 'center',
    lineHeight: 20,
  },

  // ── Liste des défis ──
  challengeList: {
    padding: 16,
    gap: 10,
  },
  challengeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.ui.card,
    borderRadius: 14,
    paddingVertical: 14,
    paddingRight: 16,
    paddingLeft: 0,
    borderWidth: 1,
    borderColor: Colors.ui.border,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  challengeCardDone: {
    borderColor: Colors.forest.accent + '80',
    backgroundColor: Colors.forest.accent + '08',
  },
  challengeCardLocked: {
    opacity: 0.45,
    backgroundColor: Colors.ui.background,
  },
  challengeAccent: {
    width: 4,
    alignSelf: 'stretch',
    marginRight: 12,
    borderTopLeftRadius: 14,
    borderBottomLeftRadius: 14,
  },
  challengeLeft: {
    width: 32,
    alignItems: 'center',
  },
  challengeNumber: {
    fontSize: 13,
    color: Colors.ui.textLight,
    fontWeight: '600',
  },
  challengeCenter: {
    flex: 1,
    paddingLeft: 8,
  },
  challengeTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.ui.text,
  },
  challengeTitleLocked: {
    color: Colors.ui.textLight,
    fontStyle: 'italic',
  },
  challengeTimes: {
    gap: 2,
    marginTop: 2,
  },
  challengeBestTime: {
    fontSize: 12,
    color: Colors.forest.medium,
  },
  challengeWr: {
    fontSize: 10,
    color: Colors.ui.textLight,
  },
  challengeNew: {
    fontSize: 11,
    color: Colors.ui.border,
    fontStyle: 'italic',
  },
  checkmark: {
    fontSize: 18,
    color: Colors.forest.accent,
    fontWeight: '800',
    paddingLeft: 4,
  },
  challengeArrow: {
    fontSize: 16,
    color: Colors.ui.textLight,
  },

  // ── Vide ──
  empty: {
    alignItems: 'center',
    paddingTop: 48,
    gap: 8,
  },
  emptyText: {
    fontSize: 15,
    color: Colors.ui.textLight,
  },
  emptySubtext: {
    fontSize: 13,
    color: Colors.ui.border,
  },
});
