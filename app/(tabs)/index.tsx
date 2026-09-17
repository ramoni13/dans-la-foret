// ============================================================
// ÉCRAN D'ACCUEIL
// Progression globale + dernier défi joué + stats rapides
// ============================================================

import React, { useMemo, useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import { onAuthChange } from '../../src/services/authService';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../../src/constants/colors';
import { usePlayerStore } from '../../src/store/playerStore';

// Toutes les collections de défis pour calculer la progression globale
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

const ALL_CHALLENGES = [
  ...niveau1.challenges,
  ...niveau2.challenges,
  ...niveau3.challenges,
  ...niveau4.challenges,
  ...niveau5.challenges,
  ...niveau6.challenges,
  ...niveau7.challenges,
  ...niveau8.challenges,
  ...niveau9.challenges,
  ...niveau10.challenges,
  ...niveau11.challenges,
  ...niveau12.challenges,
  ...niveau13.challenges,
];

// Libellés des niveaux pour la carte "Reprendre"
const LEVEL_LABELS: Record<string, string> = {
  niveau_1:  '🌱 Niveau 1 — Premiers pas',
  niveau_2:  '🌿 Niveau 2 — Éveil',
  niveau_3:  '🌳 Niveau 3 — Découverte',
  niveau_4:  '🦊 Niveau 4 — Exploration',
  niveau_5:  '🏕️ Niveau 5 — Aventure',
  niveau_6:  '🌲 Niveau 6 — Profondeur',
  niveau_7:  '🐺 Niveau 7 — Grande Forêt',
  niveau_8:  '🏔️ Niveau 8 — Immensité',
  niveau_9:  '🏹 Niveau 9 — Précision',
  niveau_10: '🐽 Niveau 10 — Ours Solitaire',
  niveau_11: '🏔️ Niveau 11 — Ténèbres',
  niveau_12: '⚡ Niveau 12 — Expert',
  niveau_13: '💀 Niveau 13 — Maître',
};

export default function HomeScreen() {
  const router = useRouter();
  const player = usePlayerStore();

  // ── Redirection vers accueil après connexion ────────────────────────────────────────────
  const [prevUser, setPrevUser] = useState<User | null | undefined>(undefined);
  useEffect(() => {
    const unsub = onAuthChange(user => {
      // Dès qu'on passe de non-connecté à connecté → on est déjà sur l'accueil
      setPrevUser(user);
    });
    return unsub;
  }, []);

  // ── Progression globale ────────────────────────────────────────────────────────────
  const totalChallenges = ALL_CHALLENGES.length;
  const totalCompleted  = player.completedChallenges.length;
  const progressPct     = totalChallenges > 0
    ? Math.round((totalCompleted / totalChallenges) * 100)
    : 0;

  // ── Prochain défi à jouer ────────────────────────────────────────────────────────────
  // Premier défi non complété dans l'ordre, ou niveau_1_001 si tout est fait
  const nextChallenge = useMemo(() => {
    const next = ALL_CHALLENGES.find(c => !player.completedChallenges.includes(c.id));
    return next ?? ALL_CHALLENGES[0]; // Si tout complété → recommencer depuis le début
  }, [player.completedChallenges]);

  const allCompleted = totalCompleted >= totalChallenges;

  // Meilleur niveau atteint (dernier niveau avec au moins 1 défi complété)
  const bestLevel = useMemo(() => {
    const levels = ['niveau_13','niveau_12','niveau_11','niveau_10','niveau_9',
                    'niveau_8','niveau_7','niveau_6','niveau_5','niveau_4',
                    'niveau_3','niveau_2','niveau_1'];
    for (const lvl of levels) {
      if (player.completedChallenges.some(id => id.startsWith(lvl))) {
        return LEVEL_LABELS[lvl] ?? lvl;
      }
    }
    return null;
  }, [player.completedChallenges]);

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero ── */}
        <View style={styles.hero}>
          <Text style={styles.heroEmoji}>🌲</Text>
          <Text style={styles.heroTitle}>Dans la Forêt</Text>
          <Text style={styles.heroSubtitle}>Jeu de logique</Text>
        </View>

        {/* ── Graines + progression globale ── */}
        <View style={styles.progressCard}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressTitle}>Progression globale</Text>
            <View style={styles.seedsBadge}>
              <Text style={styles.seedsText}>🌱 {player.seeds}</Text>
            </View>
          </View>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${progressPct}%` }]} />
          </View>
          <Text style={styles.progressLabel}>
            {totalCompleted} / {totalChallenges} défis complétés — {progressPct}%
          </Text>
        </View>

        {/* ── Carte Prochain défi (toujours affichée) ── */}
        <TouchableOpacity
          style={styles.resumeCard}
          onPress={() => router.push(`/game/${nextChallenge.id}`)}
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
              {LEVEL_LABELS[nextChallenge.level] ?? nextChallenge.level}
            </Text>
            <Text style={styles.resumeChallenge}>
              Défi n°{nextChallenge.challengeNumber}
            </Text>
          </View>
          <Text style={styles.resumeArrow}>→</Text>
        </TouchableOpacity>

        {/* ── Actions secondaires ── */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.btnSecondary}
            onPress={() => router.push('/(tabs)/challenge')}
            activeOpacity={0.8}
          >
            <Text style={styles.btnSecondaryText}>⚔️ Défier un ami</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.btnTertiary}
            onPress={() => router.push('/(tabs)/profile')}
            activeOpacity={0.8}
          >
            <Text style={styles.btnTertiaryText}>👤 Mon profil</Text>
          </TouchableOpacity>
        </View>

        {/* ── Stats rapides ── */}
        <View style={styles.statsCard}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{player.stats.totalSolved}</Text>
            <Text style={styles.statLabel}>Défis résolus</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>{player.stats.currentStreak}</Text>
            <Text style={styles.statLabel}>Série en cours</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>{player.stats.longestStreak}</Text>
            <Text style={styles.statLabel}>Meilleure série</Text>
          </View>
        </View>

        {/* ── Meilleur niveau atteint ── */}
        {bestLevel && (
          <View style={styles.bestLevelCard}>
            <Text style={styles.bestLevelLabel}>Meilleur niveau atteint</Text>
            <Text style={styles.bestLevelValue}>{bestLevel}</Text>
          </View>
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
  container: {
    padding: 20,
    gap: 16,
    paddingBottom: 40,
  },

  // Hero
  hero: {
    alignItems: 'center',
    paddingVertical: 8,
    gap: 4,
  },
  heroEmoji: {
    fontSize: 64,
    marginBottom: 4,
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: Colors.forest.dark,
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    fontSize: 14,
    color: Colors.ui.textLight,
    fontWeight: '500',
  },

  // Progression globale
  progressCard: {
    backgroundColor: Colors.ui.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.ui.border,
    gap: 8,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.forest.dark,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  seedsBadge: {
    backgroundColor: Colors.ui.seed + '22',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.ui.seed + '66',
  },
  seedsText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.forest.dark,
  },
  progressBarBg: {
    height: 8,
    backgroundColor: Colors.ui.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: Colors.forest.medium,
    borderRadius: 4,
  },
  progressLabel: {
    fontSize: 12,
    color: Colors.ui.textLight,
    textAlign: 'right',
  },

  // Carte Reprendre
  resumeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.forest.dark + '08',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: Colors.forest.medium + '55',
    gap: 12,
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
    fontSize: 13,
    fontWeight: '700',
    color: Colors.forest.medium,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  resumeLevel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.forest.dark,
  },
  resumeChallenge: {
    fontSize: 12,
    color: Colors.ui.textLight,
  },
  resumeArrow: {
    fontSize: 20,
    color: Colors.forest.medium,
  },

  // Actions
  actions: {
    gap: 10,
  },
  btnPrimary: {
    backgroundColor: Colors.forest.medium,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  btnPrimaryText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  btnSecondary: {
    backgroundColor: Colors.forest.light + '18',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.forest.light,
  },
  btnSecondaryText: {
    color: Colors.forest.dark,
    fontSize: 15,
    fontWeight: '600',
  },
  btnTertiary: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  btnTertiaryText: {
    color: Colors.ui.textLight,
    fontSize: 14,
  },

  // Stats
  statsCard: {
    flexDirection: 'row',
    backgroundColor: Colors.ui.card,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: Colors.ui.border,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.forest.dark,
  },
  statLabel: {
    fontSize: 10,
    color: Colors.ui.textLight,
    textAlign: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: Colors.ui.border,
    marginVertical: 4,
  },

  // Meilleur niveau
  bestLevelCard: {
    backgroundColor: Colors.forest.accent + '15',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.forest.accent + '40',
    gap: 4,
  },
  bestLevelLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.ui.textLight,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  bestLevelValue: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.forest.dark,
  },
});
