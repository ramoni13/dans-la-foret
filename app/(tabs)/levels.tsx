// ============================================================
// ÉCRAN SÉLECTION DES NIVEAUX
// ============================================================

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';

import { Colors } from '../../src/constants/colors';
import { DifficultyLevel } from '../../src/core/models/Challenge';
import { usePlayerStore } from '../../src/store/playerStore';


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

const LEVELS: Array<{
  id: DifficultyLevel;
  label: string;
  emoji: string;
  description: string;
  isPremium: boolean;
  color: string;
}> = [
  { id: 'niveau_1',  label: 'Niveau 1',  emoji: '🌱', description: '6 cases · 3 vides · 3 types',           isPremium: false, color: '#A5D6A7' },
  { id: 'niveau_2',  label: 'Niveau 2',  emoji: '🌿', description: '6 cases · 4 vides · 4 types',           isPremium: false, color: '#81C784' },
  { id: 'niveau_3',  label: 'Niveau 3',  emoji: '🌳', description: '8 cases · 3 vides · 4 types',           isPremium: false, color: '#66BB6A' },
  { id: 'niveau_4',  label: 'Niveau 4',  emoji: '🦊', description: '8 cases · 4 vides · 4 types',           isPremium: false, color: '#4CAF50' },
  { id: 'niveau_5',  label: 'Niveau 5',  emoji: '🏕️', description: '8 cases · 5 vides · 4 types',           isPremium: true,  color: '#43A047' },
  { id: 'niveau_6',  label: 'Niveau 6',  emoji: '🌲', description: '10 cases · 4 vides · 3-4 types',        isPremium: true,  color: '#388E3C' },
  { id: 'niveau_7',  label: 'Niveau 7',  emoji: '🐺', description: '10 cases · 5 vides · 4 types',          isPremium: true,  color: '#2E7D32' },
  { id: 'niveau_8',  label: 'Niveau 8',  emoji: '🏔️', description: '10 cases · 6 vides · 4 types',          isPremium: true,  color: '#1B5E20' },
  { id: 'niveau_9',  label: 'Niveau 9',  emoji: '🏹', description: '12 cases · 5 vides · 4 types',          isPremium: true,  color: '#33691E' },
  { id: 'niveau_10', label: 'Niveau 10', emoji: '🐽', description: '12 cases · 6 vides · 4 types',          isPremium: true,  color: '#558B2F' },
  { id: 'niveau_11', label: 'Niveau 11', emoji: '🏔️', description: '12 cases · 7 vides · 5 types + Chalet', isPremium: true,  color: '#827717' },
  { id: 'niveau_12', label: 'Niveau 12', emoji: '⚡',  description: '12 cases · 8 vides · 6 types + Renard', isPremium: true,  color: '#E65100' },
  { id: 'niveau_13', label: 'Niveau 13', emoji: '💀', description: '12 cases · 9 vides · 6 types · Sans bonus', isPremium: true,  color: '#3E2723' },
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
};

export default function LevelsScreen() {
  const router = useRouter();
  const player = usePlayerStore();
  const [selectedLevel, setSelectedLevel] = useState<DifficultyLevel>('niveau_1');

  const challenges = ALL_CHALLENGES[selectedLevel] ?? [];
  const selectedLevelDef = LEVELS.find(l => l.id === selectedLevel)!;

  // Progression : nombre de défis complétés pour le niveau sélectionné
  const completedCount = challenges.filter(c =>
    player.completedChallenges.includes(c.id)
  ).length;

  // ── Logique de déblocage progressif ────────────────────────────────────────────────────────────
  // Un niveau est débloqué si tous les défis du niveau précédent sont complétés
  const isLevelUnlocked = (levelId: string): boolean => {
    const idx = LEVELS.findIndex(l => l.id === levelId);
    if (idx === 0) return true; // Niveau 1 toujours accessible
    const prevLevel = LEVELS[idx - 1];
    const prevChallenges = ALL_CHALLENGES[prevLevel.id] ?? [];
    return prevChallenges.every(c => player.completedChallenges.includes(c.id));
  };

  // Un défi est débloqué si c'est le premier OU si le défi précédent est complété
  const isChallengeUnlocked = (challengeIdx: number): boolean => {
    if (challengeIdx === 0) return true;
    const prevChallenge = challenges[challengeIdx - 1];
    return player.completedChallenges.includes(prevChallenge.id);
  };

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>Choisir un défi</Text>
        <View style={styles.seedsRow}>
          <Text style={styles.seedsText}>🌱 {player.seeds} graines</Text>
        </View>
      </View>

      {/* Sélecteur de niveau */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.levelTabs}
      >
        {LEVELS.map(level => {
          const unlocked = isLevelUnlocked(level.id);
          const isSelected = selectedLevel === level.id;
          return (
            <TouchableOpacity
              key={level.id}
              style={[
                styles.levelTab,
                isSelected && unlocked && { backgroundColor: level.color, borderColor: level.color },
                !unlocked && styles.levelTabLocked,
              ]}
              onPress={() => unlocked && setSelectedLevel(level.id)}
              activeOpacity={unlocked ? 0.8 : 1}
            >
              <Text style={styles.levelTabEmoji}>{unlocked ? level.emoji : '🔒'}</Text>
              <Text style={[styles.levelTabLabel, isSelected && unlocked && styles.levelTabLabelSelected]}>
                {level.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Description du niveau + barre de progression */}
      <View style={[styles.levelDesc, { borderLeftColor: selectedLevelDef.color }]}>
        <Text style={styles.levelDescText}>{selectedLevelDef.description}</Text>
        <View style={styles.progressRow}>
          <View style={styles.progressBarBg}>
            <View
              style={[
                styles.progressBarFill,
                {
                  width: challenges.length > 0
                    ? `${(completedCount / challenges.length) * 100}%`
                    : '0%',
                  backgroundColor: selectedLevelDef.color,
                },
              ]}
            />
          </View>
          <Text style={styles.progressLabel}>
            {completedCount}/{challenges.length}
          </Text>
        </View>
      </View>

      {/* Liste des défis */}
      <ScrollView contentContainerStyle={styles.challengeList}>
        {challenges.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Aucun défi disponible pour ce niveau.</Text>
            <Text style={styles.emptySubtext}>Bientôt disponible !</Text>
          </View>
        ) : (
          challenges.map((challenge, idx) => {
            const isCompleted = player.completedChallenges.includes(challenge.id);
            const unlocked    = isChallengeUnlocked(idx);
            const bestTime    = player.stats.bestTimes[challenge.id];

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
                {/* Indicateur coloré sur le bord gauche */}
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
                  {unlocked && (bestTime ? (
                    <Text style={styles.challengeBestTime}>
                      ⏱ {Math.floor(bestTime / 60000)}:{String(Math.floor((bestTime % 60000) / 1000)).padStart(2, '0')}
                    </Text>
                  ) : (
                    <Text style={styles.challengeNew}>Nouveau</Text>
                  ))}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.ui.background,
  },
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
  levelTabs: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  levelTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: Colors.ui.border,
    backgroundColor: Colors.ui.card,
  },
  levelTabLocked: {
    opacity: 0.5,
  },
  levelTabEmoji: {
    fontSize: 16,
  },
  levelTabLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.ui.textLight,
  },
  levelTabLabelSelected: {
    color: '#fff',
  },
  lockIcon: {
    fontSize: 11,
  },
  levelDesc: {
    marginHorizontal: 20,
    marginBottom: 8,
    paddingLeft: 12,
    borderLeftWidth: 3,
    gap: 6,
  },
  levelDescText: {
    fontSize: 13,
    color: Colors.ui.textLight,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  checkmark: {
    fontSize: 18,
    color: Colors.forest.accent,
    fontWeight: '800',
    paddingLeft: 4,
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
  challengeBestTime: {
    fontSize: 12,
    color: Colors.forest.medium,
    marginTop: 2,
  },
  challengeNew: {
    fontSize: 11,
    color: Colors.ui.border,
    marginTop: 2,
    fontStyle: 'italic',
  },
  challengeArrow: {
    fontSize: 16,
    color: Colors.ui.textLight,
  },
  challengeCardLocked: {
    opacity: 0.45,
    backgroundColor: Colors.ui.background,
  },
  challengeTitleLocked: {
    color: Colors.ui.textLight,
    fontStyle: 'italic',
  },
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
