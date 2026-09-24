// ============================================================
// ÉCRAN PROFIL JOUEUR
// État 1 : non connecté → formulaire login/inscription
// État 2 : connecté → profil + progression + déconnexion
// ============================================================

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from 'firebase/auth';

import { Colors } from '../../src/constants/colors';
import { usePlayerStore } from '../../src/store/playerStore';
import { formatTime } from '../../src/utils/boardUtils';
import { Lang } from '../../src/i18n';
import {
  registerWithEmail,
  loginWithEmail,
  loginWithGoogle,
  logout,
  onAuthChange,
  sendPasswordReset,
} from '../../src/services/authService';
import { BadgeCollection } from '../../src/components/Badges/BadgeCollection';
import { BadgeCard } from '../../src/components/Badges/BadgeCard';
import { BadgeUnlockProgress } from '../../src/components/Badges/BadgeUnlockProgress';
import { BADGE_MAP } from '../../src/constants/badges';
import { LeaderboardScreen } from '../../src/components/Leaderboard/LeaderboardScreen';

// Niveaux pour la progression (13 niveaux, 10 défis chacun)
const LEVELS = [
  { id: 'niveau_1',  label: 'Niveau 1',  emoji: '🌱', total: 10 },
  { id: 'niveau_2',  label: 'Niveau 2',  emoji: '🌿', total: 10 },
  { id: 'niveau_3',  label: 'Niveau 3',  emoji: '🌳', total: 10 },
  { id: 'niveau_4',  label: 'Niveau 4',  emoji: '🦊', total: 10 },
  { id: 'niveau_5',  label: 'Niveau 5',  emoji: '🏕️', total: 10 },
  { id: 'niveau_6',  label: 'Niveau 6',  emoji: '🌲', total: 10 },
  { id: 'niveau_7',  label: 'Niveau 7',  emoji: '🐺', total: 10 },
  { id: 'niveau_8',  label: 'Niveau 8',  emoji: '🏔️', total: 10 },
  { id: 'niveau_9',  label: 'Niveau 9',  emoji: '🏹', total: 10 },
  { id: 'niveau_10', label: 'Niveau 10', emoji: '🐽', total: 10 },
  { id: 'niveau_11', label: 'Niveau 11', emoji: '🏔️', total: 10 },
  { id: 'niveau_12', label: 'Niveau 12', emoji: '⚡',  total: 10 },
  { id: 'niveau_13', label: 'Niveau 13', emoji: '💀', total: 10 },
];

export default function ProfileScreen() {
  const player = usePlayerStore();
  const insets = useSafeAreaInsets();

  // ── État Firebase Auth ────────────────────────────────────────────────────────────
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading]   = useState(true);
  const [isLogin, setIsLogin]           = useState(true); // true=login, false=inscription
  const [email, setEmail]               = useState('');
  const [password, setPassword]         = useState('');
  const [username, setUsername]         = useState('');
  const [submitting, setSubmitting]     = useState(false);

  // ── Onglets internes du profil connecté ─────────────────────────────────────
  type ProfileTab = 'progression' | 'badges' | 'classement';
  const [activeTab, setActiveTab] = useState<ProfileTab>('progression');
  const [showFullBadges, setShowFullBadges] = useState(false);

  // ── Mot de passe oublié ───────────────────────────────────────────────────
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail]                 = useState('');
  const [resetSent, setResetSent]                   = useState(false);
  const [resetLoading, setResetLoading]             = useState(false);

  // Observer l'état de connexion Firebase (UI seulement — la restauration
  // du profil est gérée dans _layout.tsx au montage de l'app)
  useEffect(() => {
    const unsub = onAuthChange((user) => {
      setFirebaseUser(user);
      setAuthLoading(false);
    });
    return unsub;
  }, []);

  // ── Progression ────────────────────────────────────────────────────────────────
  const totalCompleted  = player.completedChallenges.length;
  const totalChallenges = LEVELS.reduce((sum, l) => sum + l.total, 0);
  const globalPct       = totalChallenges > 0 ? totalCompleted / totalChallenges : 0;
  const allBestTimes    = Object.values(player.stats.bestTimes);
  const fastestTime     = allBestTimes.length > 0 ? Math.min(...allBestTimes) : null;

  // ── Actions auth ────────────────────────────────────────────────────────────────
  // Alerte compatible web + mobile
  const alert = (message: string) => {
    if (Platform.OS === 'web') {
      window.alert(message);
    } else {
      Alert.alert('Information', message);
    }
  };

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      alert('Remplis l’email et le mot de passe.');
      return;
    }
    if (!isLogin && !username.trim()) {
      alert('Choisis un nom de joueur.');
      return;
    }
    setSubmitting(true);
    try {
      if (isLogin) {
        await loginWithEmail(email.trim(), password);
      } else {
        await registerWithEmail(email.trim(), password, username.trim());
      }
    } catch (e: any) {
      alert(e.message ?? 'Une erreur est survenue.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    setSubmitting(true);
    try {
      await loginWithGoogle();
    } catch (e: any) {
      alert(e.message ?? 'Connexion Google échouée.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotPassword = async () => {
    setResetLoading(true);
    try {
      await sendPasswordReset(resetEmail || email);
      setResetSent(true);
    } catch (e: any) {
      alert(e.message ?? 'Impossible d\'envoyer l\'e-mail de réinitialisation.');
    } finally {
      setResetLoading(false);
    }
  };

  // Confirmation compatible web (window.confirm) + mobile (Alert.alert)
  const confirm = (message: string, onConfirm: () => void) => {
    if (Platform.OS === 'web') {
      if (window.confirm(message)) onConfirm();
    } else {
      Alert.alert('Confirmation', message, [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Confirmer', style: 'destructive', onPress: onConfirm },
      ]);
    }
  };

  const handleLogout = () => {
    confirm('Te déconnecter ? Ta progression locale est conservée.', async () => {
      await logout();    // Déconnexion Firebase
      player.logout();   // Reset du store Zustand
    });
  };

  const handleReset = () => {
    confirm('Réinitialiser toute ta progression ? Cette action est irréversible.', async () => {
      player.logout();                                    // Reset store Zustand
      await AsyncStorage.removeItem('dlf_player_v1');    // Effacer AsyncStorage
    });
  };

  // ── Chargement initial ────────────────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.forest.medium} />
          <Text style={styles.loadingText}>Connexion en cours…</Text>
        </View>
      </View>
    );
  }

  // ── NON CONNECTÉ : formulaire ────────────────────────────────────────────────────────────
  if (!firebaseUser) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <ScrollView contentContainerStyle={styles.container}>
          {/* Header */}
          <View style={styles.avatarSection}>
            <View style={styles.avatar}>
              <Text style={styles.avatarEmoji}>🌲</Text>
            </View>
            <Text style={styles.username}>Dans la Forêt</Text>
            <Text style={styles.authSubtitle}>
              Connecte-toi pour sauvegarder ta progression et défier tes amis
            </Text>
          </View>

          {/* Toggle Login / Inscription */}
          <View style={styles.toggleRow}>
            <TouchableOpacity
              style={[styles.toggleBtn, isLogin && styles.toggleBtnActive]}
              onPress={() => { setIsLogin(true); setShowForgotPassword(false); setResetSent(false); }}
            >
              <Text style={[styles.toggleBtnText, isLogin && styles.toggleBtnTextActive]}>
                Connexion
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, !isLogin && styles.toggleBtnActive]}
              onPress={() => { setIsLogin(false); setShowForgotPassword(false); setResetSent(false); }}
            >
              <Text style={[styles.toggleBtnText, !isLogin && styles.toggleBtnTextActive]}>
                Inscription
              </Text>
            </TouchableOpacity>
          </View>

          {/* Formulaire */}
          <View style={styles.form}>
            {!isLogin && (
              <TextInput
                style={styles.input}
                placeholder="Nom de joueur"
                placeholderTextColor={Colors.ui.textLight}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="words"
              />
            )}
            <TextInput
              style={styles.input}
              placeholder="Adresse e-mail"
              placeholderTextColor={Colors.ui.textLight}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <TextInput
              style={styles.input}
              placeholder="Mot de passe"
              placeholderTextColor={Colors.ui.textLight}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
            <TouchableOpacity
              style={styles.btnPrimary}
              onPress={handleSubmit}
              disabled={submitting}
              activeOpacity={0.8}
            >
              {submitting
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.btnPrimaryText}>
                    {isLogin ? 'Se connecter' : 'Créer un compte'}
                  </Text>
              }
            </TouchableOpacity>

            {/* Mot de passe oublié — visible uniquement en mode connexion */}
            {isLogin && !showForgotPassword && (
              <TouchableOpacity
                onPress={() => { setShowForgotPassword(true); setResetEmail(email); setResetSent(false); }}
                style={styles.forgotBtn}
                activeOpacity={0.7}
              >
                <Text style={styles.forgotBtnText}>Mot de passe oublié ?</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* ── Bloc réinitialisation mot de passe ── */}
          {isLogin && showForgotPassword && (
            <View style={styles.forgotBox}>
              {resetSent ? (
                <>
                  <Text style={styles.forgotTitle}>✉️ E-mail envoyé !</Text>
                  <Text style={styles.forgotDesc}>
                    Un lien de réinitialisation a été envoyé à {resetEmail || email}.{'\n'}
                    Vérifie tes spams si tu ne le reçois pas.
                  </Text>
                  <TouchableOpacity
                    style={styles.forgotBack}
                    onPress={() => { setShowForgotPassword(false); setResetSent(false); }}
                  >
                    <Text style={styles.forgotBackText}>← Retour à la connexion</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={styles.forgotTitle}>Réinitialiser le mot de passe</Text>
                  <Text style={styles.forgotDesc}>
                    Saisis ton adresse e-mail et nous t'enverrons un lien pour définir un nouveau mot de passe.
                  </Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Adresse e-mail"
                    placeholderTextColor={Colors.ui.textLight}
                    value={resetEmail}
                    onChangeText={setResetEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoFocus
                  />
                  <TouchableOpacity
                    style={styles.btnPrimary}
                    onPress={handleForgotPassword}
                    disabled={resetLoading}
                    activeOpacity={0.8}
                  >
                    {resetLoading
                      ? <ActivityIndicator color="#fff" />
                      : <Text style={styles.btnPrimaryText}>Envoyer le lien</Text>
                    }
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.forgotBack}
                    onPress={() => setShowForgotPassword(false)}
                  >
                    <Text style={styles.forgotBackText}>← Retour</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          )}

          {/* Séparateur */}
          <View style={styles.separator}>
            <View style={styles.separatorLine} />
            <Text style={styles.separatorText}>ou</Text>
            <View style={styles.separatorLine} />
          </View>

          {/* Google (web uniquement) */}
          {Platform.OS === 'web' && (
            <TouchableOpacity
              style={styles.btnGoogle}
              onPress={handleGoogle}
              disabled={submitting}
              activeOpacity={0.8}
            >
              <Text style={styles.btnGoogleText}>🔵 Continuer avec Google</Text>
            </TouchableOpacity>
          )}

          {/* Sélecteur de langue (accessible même non connecté) */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Langue / Language</Text>
            <View style={styles.langRow}>
              {(['fr', 'en'] as Lang[]).map(lang => (
                <TouchableOpacity
                  key={lang}
                  style={[
                    styles.langBtn,
                    player.language === lang && styles.langBtnActive,
                  ]}
                  onPress={() => player.setLanguage(lang)}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.langBtnText,
                    player.language === lang && styles.langBtnTextActive,
                  ]}>
                    {lang === 'fr' ? '🇫🇷 Français' : '🇬🇧 English'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </ScrollView>
      </View>
    );
  }

  // ── CONNECTÉ : profil complet ────────────────────────────────────────────────────────────
  const displayName = firebaseUser.displayName ?? firebaseUser.email ?? 'Joueur';

  // 4 derniers badges obtenus (pour l'aperçu)
  const recentBadges = [...player.earnedBadges].reverse().slice(0, 4);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Onglets internes : Progression / Badges / Classement */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'progression' && styles.tabBtnActive]}
          onPress={() => setActiveTab('progression')}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabText, activeTab === 'progression' && styles.tabTextActive]}>
            Progression
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'badges' && styles.tabBtnActive]}
          onPress={() => setActiveTab('badges')}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabText, activeTab === 'badges' && styles.tabTextActive]}>
            Badges {player.earnedBadges.length > 0 ? `(${player.earnedBadges.length})` : ''}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'classement' && styles.tabBtnActive]}
          onPress={() => setActiveTab('classement')}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabText, activeTab === 'classement' && styles.tabTextActive]}>
            🌍 Classement
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Onglet PROGRESSION ── */}
      {activeTab === 'progression' && (
        <ScrollView contentContainerStyle={styles.container}>
          {/* Avatar & nom */}
          <View style={styles.avatarSection}>
            <View style={styles.avatar}>
              <Text style={styles.avatarEmoji}>🌲</Text>
            </View>
            <Text style={styles.username}>{displayName}</Text>
            {player.isPremium && (
              <View style={styles.premiumBadge}>
                <Text style={styles.premiumText}>✨ Premium</Text>
              </View>
            )}
          </View>

          {/* Graines */}
          <View style={styles.seedsCard}>
            <Text style={styles.seedsEmoji}>🌱</Text>
            <View>
              <Text style={styles.seedsValue}>{player.seeds}</Text>
              <Text style={styles.seedsLabel}>Graines disponibles</Text>
            </View>
          </View>

          {/* Progression globale */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Progression globale</Text>
              <Text style={styles.sectionSub}>{totalCompleted}/{totalChallenges} défis</Text>
            </View>
            <View style={styles.globalProgressBg}>
              <View style={[styles.globalProgressFill, { width: `${globalPct * 100}%` }]} />
            </View>
          </View>

          {/* Statistiques */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Statistiques</Text>
            <View style={styles.statsGrid}>
              <StatCard label="Défis résolus" value={String(player.stats.totalSolved)} emoji="🏆" />
              <StatCard label="Série actuelle" value={String(player.stats.currentStreak)} emoji="🔥" />
              <StatCard label="Meilleure série" value={String(player.stats.longestStreak)} emoji="⭐" />
              <StatCard
                label="Meilleur temps"
                value={fastestTime ? formatTime(fastestTime) : '—'}
                emoji="⏱"
              />
            </View>
          </View>

          {/* Section Badges — aperçu + bouton voir tous */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Badges</Text>
              <TouchableOpacity onPress={() => setActiveTab('badges')}>
                <Text style={styles.sectionLink}>Voir tous →</Text>
              </TouchableOpacity>
            </View>
            {recentBadges.length > 0 ? (
              <View style={styles.badgePreviewRow}>
                {recentBadges.map(id => {
                  const badge = BADGE_MAP[id];
                  if (!badge) return null;
                  return (
                    <BadgeCard
                      key={id}
                      badge={badge}
                      earned
                      size="small"
                      onPress={() => setActiveTab('badges')}
                    />
                  );
                })}
              </View>
            ) : (
              <Text style={styles.emptyBadges}>
                Complète des défis pour débloquer tes premiers badges !
              </Text>
            )}
          </View>

          {/* Progression par niveau */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Par niveau</Text>
            {LEVELS.map(level => {
              const done = player.completedChallenges.filter(id =>
                id.startsWith(level.id + '_')
              ).length;
              const pct = level.total > 0 ? done / level.total : 0;
              return (
                <View key={level.id} style={styles.levelRow}>
                  <Text style={styles.levelRowEmoji}>{level.emoji}</Text>
                  <Text style={styles.levelRowLabel}>{level.label}</Text>
                  <View style={styles.levelRowBarBg}>
                    <View style={[styles.levelRowBarFill, { width: `${pct * 100}%` }]} />
                  </View>
                  <Text style={styles.levelRowCount}>{done}/{level.total}</Text>
                </View>
              );
            })}
          </View>

          {/* Premium */}
          {!player.isPremium && (
            <View style={styles.premiumCard}>
              <Text style={styles.premiumCardTitle}>✨ Passer Premium</Text>
              <Text style={styles.premiumCardDesc}>
                Accès illimité aux défis Expert & Maître, tous les plateaux, bonus illimités et mode défi entre amis.
              </Text>
              <TouchableOpacity style={styles.premiumBtn} activeOpacity={0.8}>
                <Text style={styles.premiumBtnText}>Débloquer — 3,99 €</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Sélecteur de langue */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Langue / Language</Text>
            <View style={styles.langRow}>
              {(['fr', 'en'] as Lang[]).map(lang => (
                <TouchableOpacity
                  key={lang}
                  style={[
                    styles.langBtn,
                    player.language === lang && styles.langBtnActive,
                  ]}
                  onPress={() => player.setLanguage(lang)}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.langBtnText,
                    player.language === lang && styles.langBtnTextActive,
                  ]}>
                    {lang === 'fr' ? '🇫🇷 Français' : '🇬🇧 English'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Déconnexion */}
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.7}>
            <Text style={styles.logoutBtnText}>🚪 Se déconnecter</Text>
          </TouchableOpacity>

          {/* Réinitialisation */}
          <TouchableOpacity style={styles.resetBtn} onPress={handleReset} activeOpacity={0.7}>
            <Text style={styles.resetBtnText}>🗑️ Réinitialiser la progression</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* ── Onglet BADGES ── */}
      {activeTab === 'badges' && (
        <View style={{ flex: 1 }}>
          {!showFullBadges ? (
            <ScrollView contentContainerStyle={styles.container}>
              {/* Collection complète (aperçu) */}
              <BadgeCollection
                earnedBadges={player.earnedBadges}
                onBadgePress={() => {}}
              />
              {/* Déblocages par rareté */}
              <View style={[styles.section, { marginTop: 16 }]}>
                <BadgeUnlockProgress
                  earnedBadges={player.earnedBadges}
                  unlockedBonuses={player.unlockedBonuses as string[]}
                  unlockedThemes={player.unlockedThemes}
                />
              </View>
            </ScrollView>
          ) : (
            <BadgeCollection
              earnedBadges={player.earnedBadges}
              onBadgePress={() => {}}
            />
          )}
        </View>
      )}

      {/* ── Onglet CLASSEMENT ── */}
      {activeTab === 'classement' && (
        <LeaderboardScreen />
      )}
    </View>
  );
}

function StatCard({ label, value, emoji }: { label: string; value: string; emoji: string }) {
  return (
    <View style={statStyles.card}>
      <Text style={statStyles.emoji}>{emoji}</Text>
      <Text style={statStyles.value}>{value}</Text>
      <Text style={statStyles.label}>{label}</Text>
    </View>
  );
}

const statStyles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: Colors.ui.card,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.ui.border,
    gap: 4,
  },
  emoji: { fontSize: 24 },
  value: { fontSize: 22, fontWeight: '800', color: Colors.forest.dark },
  label: { fontSize: 11, color: Colors.ui.textLight, textAlign: 'center' },
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.ui.background },
  container: { padding: 20, gap: 20, paddingBottom: 40 },
  // ── Onglets internes ──────────────────────────────────────────
  tabRow: {
    flexDirection: 'row',
    backgroundColor: Colors.ui.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.ui.border,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: {
    borderBottomColor: Colors.forest.medium,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.ui.textLight,
  },
  tabTextActive: {
    color: Colors.forest.dark,
    fontWeight: '700',
  },
  // ── Badges aperçu ─────────────────────────────────────────────
  sectionLink: {
    fontSize: 12,
    color: Colors.forest.medium,
    fontWeight: '600',
  },
  badgePreviewRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  emptyBadges: {
    fontSize: 13,
    color: Colors.ui.textLight,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 8,
  },
  avatarSection: { alignItems: 'center', gap: 8, paddingTop: 8 },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Colors.forest.light + '30',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.forest.light,
  },
  avatarEmoji: { fontSize: 44 },
  username: { fontSize: 22, fontWeight: '700', color: Colors.forest.dark },
  premiumBadge: {
    backgroundColor: Colors.ui.seed + '33',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.ui.seed,
  },
  premiumText: { fontSize: 12, fontWeight: '700', color: Colors.ui.text },
  seedsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: Colors.ui.seed + '15',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.ui.seed + '60',
  },
  seedsEmoji: { fontSize: 36 },
  seedsValue: { fontSize: 28, fontWeight: '800', color: Colors.ui.text },
  seedsLabel: { fontSize: 12, color: Colors.ui.textLight },
  section: { gap: 12 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.forest.dark },
  sectionSub: { fontSize: 12, color: Colors.ui.textLight },
  globalProgressBg: {
    height: 10,
    backgroundColor: Colors.ui.border,
    borderRadius: 5,
    overflow: 'hidden',
  },
  globalProgressFill: {
    height: '100%',
    backgroundColor: Colors.forest.accent,
    borderRadius: 5,
  },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  levelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  levelRowEmoji: { fontSize: 16, width: 24, textAlign: 'center' },
  levelRowLabel: { fontSize: 12, color: Colors.ui.textLight, width: 64 },
  levelRowBarBg: {
    flex: 1,
    height: 6,
    backgroundColor: Colors.ui.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  levelRowBarFill: {
    height: '100%',
    backgroundColor: Colors.forest.medium,
    borderRadius: 3,
  },
  levelRowCount: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.ui.textLight,
    width: 36,
    textAlign: 'right',
  },
  // Auth
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 14, color: Colors.ui.textLight },
  authSubtitle: { fontSize: 13, color: Colors.ui.textLight, textAlign: 'center', paddingHorizontal: 24 },
  toggleRow: { flexDirection: 'row', backgroundColor: Colors.ui.border + '40', borderRadius: 12, padding: 4 },
  toggleBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  toggleBtnActive: { backgroundColor: Colors.ui.card, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  toggleBtnText: { fontSize: 14, fontWeight: '600', color: Colors.ui.textLight },
  toggleBtnTextActive: { color: Colors.forest.dark },
  form: { gap: 10 },
  input: {
    backgroundColor: Colors.ui.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.ui.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.ui.text,
  },
  btnPrimary: {
    backgroundColor: Colors.forest.medium,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  btnPrimaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  separator: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  separatorLine: { flex: 1, height: 1, backgroundColor: Colors.ui.border },
  separatorText: { fontSize: 13, color: Colors.ui.textLight },
  btnGoogle: {
    backgroundColor: Colors.ui.card,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.ui.border,
  },
  btnGoogleText: { fontSize: 15, fontWeight: '600', color: Colors.ui.text },

  logoutBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F4433640',
    backgroundColor: '#F4433608',
  },
  logoutBtnText: { fontSize: 13, color: '#F44336', fontWeight: '600' },
  resetBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.ui.border,
    backgroundColor: Colors.ui.card,
  },
  resetBtnText: {
    fontSize: 13,
    color: Colors.ui.textLight,
  },
  langRow: {
    flexDirection: 'row',
    gap: 10,
  },
  langBtn: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.ui.border,
    backgroundColor: Colors.ui.card,
    alignItems: 'center',
  },
  langBtnActive: {
    backgroundColor: Colors.forest.medium + '15',
    borderColor: Colors.forest.medium,
  },
  langBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.ui.textLight,
  },
  langBtnTextActive: {
    color: Colors.forest.dark,
    fontWeight: '700',
  },
  premiumCard: {
    backgroundColor: Colors.forest.dark,
    borderRadius: 20,
    padding: 24,
    gap: 12,
  },
  premiumCardTitle: { fontSize: 18, fontWeight: '800', color: '#fff' },
  premiumCardDesc: { fontSize: 13, color: 'rgba(255,255,255,0.75)', lineHeight: 18 },
  premiumBtn: {
    backgroundColor: Colors.ui.seed,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  premiumBtnText: { fontSize: 15, fontWeight: '700', color: Colors.forest.dark },
  // ── Mot de passe oublié ─────────────────────────────────────
  forgotBtn: {
    alignSelf: 'center',
    marginTop: 4,
    paddingVertical: 8,
  },
  forgotBtnText: {
    fontSize: 13,
    color: Colors.forest.medium,
    fontWeight: '600',
  },
  forgotBox: {
    backgroundColor: Colors.ui.card,
    borderRadius: 16,
    padding: 20,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.ui.border,
  },
  forgotTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.forest.dark,
    textAlign: 'center',
  },
  forgotDesc: {
    fontSize: 13,
    color: Colors.ui.textLight,
    lineHeight: 18,
    textAlign: 'center',
  },
  forgotBack: {
    alignSelf: 'center',
    paddingVertical: 8,
  },
  forgotBackText: {
    fontSize: 13,
    color: Colors.forest.medium,
    fontWeight: '600',
  },
});
