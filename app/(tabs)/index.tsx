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
  Platform,
  ActivityIndicator,
} from 'react-native';

const native = Platform.OS !== 'web';
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

  // ── État d'authentification ──────────────────────────────────────────────────
  // undefined = Firebase pas encore répondu, null = déconnecté, User = connecté
  const [user, setUser] = useState<User | null | undefined>(undefined);
  useEffect(() => {
    const unsub = onAuthChange(u => setUser(u));
    return unsub;
  }, []);

  // ── Garde : non connecté ─────────────────────────────────────────────────────
  if (user === undefined) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.forest.medium} />
        </View>
      </SafeAreaView>
    );
  }

  if (!user || user.isAnonymous) {
    return (
      <SafeAreaView style={styles.root}>
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
      </SafeAreaView>
    );
  }

  // ── Prochain défi à jouer ────────────────────────────────────────────────────────────
  // Premier défi non complété dans l'ordre, ou niveau_1_001 si tout est fait
  const nextChallenge = useMemo(() => {
    const next = ALL_CHALLENGES.find(c => !player.completedChallenges.includes(c.id));
    return next ?? ALL_CHALLENGES[0]; // Si tout complété → recommencer depuis le début
  }, [player.completedChallenges]);

  const totalCompleted  = player.completedChallenges.length;
  const totalChallenges = ALL_CHALLENGES.length;
  const allCompleted = totalCompleted >= totalChallenges;

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero ── */}
        <View style={styles.hero}>
          {/* Couches superposées pour simuler un dégradé sans LinearGradient */}
          <View style={styles.heroBg1} />
          <View style={styles.heroBg2} />
          <Text style={styles.heroEmoji}>🌲</Text>
          <Text style={styles.heroTitle}>Dans la Forêt</Text>
          <Text style={styles.heroSubtitle}>Jeu de logique</Text>
          <View style={styles.seedsHeroBadge}>
            <Text style={styles.seedsHeroText}>🌱 {player.seeds} graines</Text>
          </View>
        </View>

        {/* ── Carte Prochain défi ── */}
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
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
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
  container: {
    padding: 20,
    gap: 16,
    paddingBottom: 40,
  },

  // Hero
  hero: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
    borderRadius: 24,
    gap: 6,
    backgroundColor: Colors.forest.dark,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  // Couches pour simuler un dégradé diagonal
  heroBg1: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.forest.medium,
    opacity: 0.6,
    borderRadius: 24,
    top: '30%',
    left: '40%',
  },
  heroBg2: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.forest.light,
    opacity: 0.25,
    borderRadius: 24,
    top: '60%',
    left: '60%',
  },
  heroEmoji: {
    fontSize: 72,
    marginBottom: 4,
  },
  heroTitle: {
    fontSize: 34,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.75)',
    fontWeight: '500',
  },
  seedsHeroBadge: {
    marginTop: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  seedsHeroText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },

  // Carte Reprendre
  resumeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.forest.dark,
    borderRadius: 20,
    padding: 20,
    gap: 12,
    shadowColor: Colors.forest.dark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  resumeLeft: {
    width: 44,
    alignItems: 'center',
  },
  resumeIcon: {
    fontSize: 32,
  },
  resumeCenter: {
    flex: 1,
    gap: 3,
  },
  resumeAction: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.7)',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  resumeLevel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  resumeChallenge: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
  },
  resumeArrow: {
    fontSize: 22,
    color: 'rgba(255,255,255,0.9)',
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

});
