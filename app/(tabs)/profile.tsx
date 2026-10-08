// ============================================================
// ÉCRAN PROFIL JOUEUR
// État 1 : non connecté → formulaire login/inscription
// État 2 : connecté → hub 4 tuiles + sous-sections
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
  Switch,
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
import { BadgeUnlockProgress } from '../../src/components/Badges/BadgeUnlockProgress';
import { LeaderboardScreen } from '../../src/components/Leaderboard/LeaderboardScreen';
import { MusicPanel } from '../../src/components/Audio/MusicPanel';

// ── Types ───────────────────────────────────────────────────────────────────────
type ActiveSection = 'hub' | 'stats' | 'badges' | 'classement' | 'reglages';

export default function ProfileScreen() {
  const player = usePlayerStore();
  const insets = useSafeAreaInsets();

  // ── État Firebase Auth ────────────────────────────────────────────────────────
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading]   = useState(true);
  const [isLogin, setIsLogin]           = useState(true);
  const [email, setEmail]               = useState('');
  const [password, setPassword]         = useState('');
  const [username, setUsername]         = useState('');
  const [submitting, setSubmitting]     = useState(false);

  // ── Hub navigation ──────────────────────────────────────────────────────────
  const [activeSection, setActiveSection] = useState<ActiveSection>('hub');

  // ── Mot de passe oublié ──────────────────────────────────────────────────────
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail]                 = useState('');
  const [resetSent, setResetSent]                   = useState(false);
  const [resetLoading, setResetLoading]             = useState(false);

  // Observer l'état Firebase (UI uniquement — la restauration est dans _layout.tsx)
  useEffect(() => {
    const unsub = onAuthChange((user) => {
      setFirebaseUser(user);
      setAuthLoading(false);
    });
    return unsub;
  }, []);

  // ── Stats dérivées ────────────────────────────────────────────────────────────
  const allBestTimes = Object.values(player.stats.bestTimes);
  const fastestTime  = allBestTimes.length > 0 ? Math.min(...allBestTimes) : null;

  // ── Compat web/mobile ────────────────────────────────────────────────────────
  const showAlert = (message: string) => {
    if (Platform.OS === 'web') window.alert(message);
    else Alert.alert('Information', message);
  };

  const showConfirm = (message: string, onConfirm: () => void) => {
    if (Platform.OS === 'web') {
      if (window.confirm(message)) onConfirm();
    } else {
      Alert.alert('Confirmation', message, [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Confirmer', style: 'destructive', onPress: onConfirm },
      ]);
    }
  };

  // ── Handlers auth ─────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      showAlert("Remplis l'email et le mot de passe.");
      return;
    }
    if (!isLogin && !username.trim()) {
      showAlert('Choisis un nom de joueur.');
      return;
    }
    setSubmitting(true);
    try {
      if (isLogin) await loginWithEmail(email.trim(), password);
      else         await registerWithEmail(email.trim(), password, username.trim());
    } catch (e: any) {
      showAlert(e.message ?? 'Une erreur est survenue.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    setSubmitting(true);
    try { await loginWithGoogle(); }
    catch (e: any) { showAlert(e.message ?? 'Connexion Google échouée.'); }
    finally { setSubmitting(false); }
  };

  const handleForgotPassword = async () => {
    setResetLoading(true);
    try {
      await sendPasswordReset(resetEmail || email);
      setResetSent(true);
    } catch (e: any) {
      showAlert(e.message ?? 'Impossible d\'envoyer le lien de réinitialisation.');
    } finally {
      setResetLoading(false);
    }
  };

  const handleLogout = () => {
    showConfirm('Te déconnecter ? Ta progression locale est conservée.', async () => {
      await logout();
      player.logout();
    });
  };

  const handleReset = () => {
    showConfirm('Réinitialiser toute ta progression ? Cette action est irréversible.', async () => {
      player.logout();
      await AsyncStorage.removeItem('dlf_player_v1');
    });
  };

  // ── Chargement ───────────────────────────────────────────────────────────────
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

  // ──────────────────────────────────────────────────────────────────────────────
  // NON CONNECTÉ : formulaire
  // ──────────────────────────────────────────────────────────────────────────────
  if (!firebaseUser) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <ScrollView contentContainerStyle={styles.container}>
          <View style={styles.avatarSection}>
            <View style={styles.avatar}>
              <Text style={styles.avatarEmoji}>🌲</Text>
            </View>
            <Text style={styles.usernameText}>Dans la Forêt</Text>
            <Text style={styles.authSubtitle}>
              Connecte-toi pour sauvegarder ta progression et défier tes amis
            </Text>
          </View>

          <View style={styles.toggleRow}>
            <TouchableOpacity
              style={[styles.toggleBtn, isLogin && styles.toggleBtnActive]}
              onPress={() => { setIsLogin(true); setShowForgotPassword(false); setResetSent(false); }}
            >
              <Text style={[styles.toggleBtnText, isLogin && styles.toggleBtnTextActive]}>Connexion</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, !isLogin && styles.toggleBtnActive]}
              onPress={() => { setIsLogin(false); setShowForgotPassword(false); setResetSent(false); }}
            >
              <Text style={[styles.toggleBtnText, !isLogin && styles.toggleBtnTextActive]}>Inscription</Text>
            </TouchableOpacity>
          </View>

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

          {isLogin && showForgotPassword && (
            <View style={styles.forgotBox}>
              {resetSent ? (
                <>
                  <Text style={styles.forgotTitle}>✉️ E-mail envoyé !</Text>
                  <Text style={styles.forgotDesc}>
                    Un lien de réinitialisation a été envoyé à {resetEmail || email}.{'\n'}
                    Vérifie tes spams si tu ne le reçois pas.
                  </Text>
                  <TouchableOpacity style={styles.forgotBack} onPress={() => { setShowForgotPassword(false); setResetSent(false); }}>
                    <Text style={styles.forgotBackText}>← Retour à la connexion</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={styles.forgotTitle}>Réinitialiser le mot de passe</Text>
                  <Text style={styles.forgotDesc}>
                    Saisis ton adresse e-mail et nous t'enverrons un lien.
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
                  <TouchableOpacity style={styles.forgotBack} onPress={() => setShowForgotPassword(false)}>
                    <Text style={styles.forgotBackText}>← Retour</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          )}

          <View style={styles.separator}>
            <View style={styles.separatorLine} />
            <Text style={styles.separatorText}>ou</Text>
            <View style={styles.separatorLine} />
          </View>

          {Platform.OS === 'web' && (
            <TouchableOpacity style={styles.btnGoogle} onPress={handleGoogle} disabled={submitting} activeOpacity={0.8}>
              <Text style={styles.btnGoogleText}>🔵 Continuer avec Google</Text>
            </TouchableOpacity>
          )}

          <MusicPanel />

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Langue / Language</Text>
            <View style={styles.langRow}>
              {(['fr', 'en'] as Lang[]).map(lang => (
                <TouchableOpacity
                  key={lang}
                  style={[styles.langBtn, player.language === lang && styles.langBtnActive]}
                  onPress={() => player.setLanguage(lang)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.langBtnText, player.language === lang && styles.langBtnTextActive]}>
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

  // ──────────────────────────────────────────────────────────────────────────────
  // CONNECTÉ : hub + sous-sections
  // ──────────────────────────────────────────────────────────────────────────────
  const displayName = firebaseUser.displayName ?? firebaseUser.email ?? 'Joueur';

  // ── Bouton retour vers le hub ─────────────────────────────────────────────────
  const BackBtn = () => (
    <TouchableOpacity style={styles.backBtn} onPress={() => setActiveSection('hub')} activeOpacity={0.7}>
      <Text style={styles.backBtnText}>← Retour</Text>
    </TouchableOpacity>
  );

  // ── Section STATS ─────────────────────────────────────────────────────────────
  if (activeSection === 'stats') {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <BackBtn />
        <ScrollView contentContainerStyle={styles.container}>
          <Text style={styles.sectionHeading}>📊 Statistiques</Text>
          <View style={styles.statsGrid}>
            <StatCard label="Graines disponibles"  value={String(player.seeds)}                emoji="🌱" />
            <StatCard label="Défis résolus"         value={String(player.stats.totalSolved)}    emoji="🏆" />
            <StatCard label="Meilleure série"        value={String(player.stats.longestStreak)}  emoji="⭐" />
            <StatCard
              label="Meilleur temps"
              value={fastestTime ? formatTime(fastestTime) : '—'}
              emoji="⏱"
            />
            <StatCard label="Streak journalier"     value={String(player.dailyChallengeStreak)} emoji="🔥" />
          </View>
        </ScrollView>
      </View>
    );
  }

  // ── Section BADGES ────────────────────────────────────────────────────────────
  if (activeSection === 'badges') {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <BackBtn />
        <ScrollView contentContainerStyle={styles.container}>
          <Text style={styles.sectionHeading}>🏅 Badges</Text>
          <BadgeCollection
            earnedBadges={player.earnedBadges}
            onBadgePress={() => {}}
          />
          <View style={[styles.section, { marginTop: 16 }]}>
            <BadgeUnlockProgress
              earnedBadges={player.earnedBadges}
              unlockedBonuses={player.unlockedBonuses as string[]}
              unlockedThemes={player.unlockedThemes}
            />
          </View>
        </ScrollView>
      </View>
    );
  }

  // ── Section CLASSEMENT ────────────────────────────────────────────────────────
  if (activeSection === 'classement') {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <BackBtn />
        <LeaderboardScreen />
      </View>
    );
  }

  // ── Section RÉGLAGES ─────────────────────────────────────────────────────────
  if (activeSection === 'reglages') {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <BackBtn />
        <ScrollView contentContainerStyle={styles.container}>
          <Text style={styles.sectionHeading}>⚙️ Réglages</Text>

          {/* Langue */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Langue / Language</Text>
            <View style={styles.langRow}>
              {(['fr', 'en'] as Lang[]).map(lang => (
                <TouchableOpacity
                  key={lang}
                  style={[styles.langBtn, player.language === lang && styles.langBtnActive]}
                  onPress={() => player.setLanguage(lang)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.langBtnText, player.language === lang && styles.langBtnTextActive]}>
                    {lang === 'fr' ? '🇫🇷 Français' : '🇬🇧 English'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Musique */}
          <MusicPanel />

          {/* Toggle notification badge amis */}
          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <Text style={styles.settingLabel}>⚔️ Badge défis amis</Text>
              <Text style={styles.settingDesc}>
                Affiche un badge rouge sur l'onglet Amis quand un défi est en attente
              </Text>
            </View>
            <Switch
              value={player.friendNotifBadgeEnabled}
              onValueChange={(val) => player.setFriendNotifBadgeEnabled(val)}
              trackColor={{ false: Colors.ui.border, true: Colors.forest.medium }}
              thumbColor="#fff"
            />
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
      </View>
    );
  }

  // ── HUB (état initial) ────────────────────────────────────────────────────────
  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.container}>

        {/* Avatar + nom */}
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarEmoji}>🌲</Text>
          </View>
          <Text style={styles.usernameText}>{displayName}</Text>
          <View style={styles.seedsBadge}>
            <Text style={styles.seedsBadgeText}>🌱 {player.seeds} graines</Text>
          </View>
        </View>

        {/* Grille 2×2 de tuiles */}
        <View style={styles.tilesGrid}>

          {/* Stats */}
          <TouchableOpacity
            style={styles.tile}
            onPress={() => setActiveSection('stats')}
            activeOpacity={0.8}
          >
            <Text style={styles.tileEmoji}>📊</Text>
            <Text style={styles.tileLabel}>Stats</Text>
            <Text style={styles.tileSub}>{player.stats.totalSolved} défis</Text>
          </TouchableOpacity>

          {/* Badges */}
          <TouchableOpacity
            style={styles.tile}
            onPress={() => setActiveSection('badges')}
            activeOpacity={0.8}
          >
            <Text style={styles.tileEmoji}>🏅</Text>
            <Text style={styles.tileLabel}>Badges</Text>
            <Text style={styles.tileSub}>
              {player.earnedBadges.length > 0
                ? `${player.earnedBadges.length} obtenus`
                : 'Aucun encore'}
            </Text>
          </TouchableOpacity>

          {/* Classement */}
          <TouchableOpacity
            style={styles.tile}
            onPress={() => setActiveSection('classement')}
            activeOpacity={0.8}
          >
            <Text style={styles.tileEmoji}>🌍</Text>
            <Text style={styles.tileLabel}>Classement</Text>
            <Text style={styles.tileSub}>Mondial</Text>
          </TouchableOpacity>

          {/* Réglages */}
          <TouchableOpacity
            style={styles.tile}
            onPress={() => setActiveSection('reglages')}
            activeOpacity={0.8}
          >
            <Text style={styles.tileEmoji}>⚙️</Text>
            <Text style={styles.tileLabel}>Réglages</Text>
            <Text style={styles.tileSub}>Langue, musique…</Text>
          </TouchableOpacity>

        </View>

      </ScrollView>
    </View>
  );
}

// ── Composant StatCard ────────────────────────────────────────────────────────
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

  // Chargement
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 14, color: Colors.ui.textLight },

  // Avatar
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
  usernameText: { fontSize: 22, fontWeight: '700', color: Colors.forest.dark },

  seedsBadge: {
    backgroundColor: Colors.ui.seed + '22',
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.ui.seed + '55',
  },
  seedsBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.forest.dark,
  },

  // Grille de tuiles 2×2
  tilesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  tile: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: Colors.ui.card,
    borderRadius: 18,
    padding: 20,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.ui.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  tileEmoji: { fontSize: 36 },
  tileLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.forest.dark,
  },
  tileSub: {
    fontSize: 11,
    color: Colors.ui.textLight,
    textAlign: 'center',
  },

  // En-tête sous-section
  sectionHeading: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.forest.dark,
  },

  // Bouton retour
  backBtn: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.ui.border,
    backgroundColor: Colors.ui.card,
  },
  backBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.forest.medium,
  },

  // Stats
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },

  // Réglages
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.ui.card,
    borderRadius: 14,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.ui.border,
  },
  settingLeft: { flex: 1, gap: 3 },
  settingLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.ui.text,
  },
  settingDesc: {
    fontSize: 12,
    color: Colors.ui.textLight,
    lineHeight: 16,
  },

  // Déconnexion / réinitialisation
  logoutBtn: {
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F4433640',
    backgroundColor: '#F4433608',
  },
  logoutBtnText: { fontSize: 14, color: '#F44336', fontWeight: '600' },
  resetBtn: {
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.ui.border,
    backgroundColor: Colors.ui.card,
  },
  resetBtnText: { fontSize: 14, color: Colors.ui.textLight },

  // Auth form
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

  // Langue
  section: { gap: 12 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: Colors.forest.dark },
  langRow: { flexDirection: 'row', gap: 10 },
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
  langBtnText: { fontSize: 13, fontWeight: '600', color: Colors.ui.textLight },
  langBtnTextActive: { color: Colors.forest.dark, fontWeight: '700' },

  // Mot de passe oublié
  forgotBtn: { alignSelf: 'center', marginTop: 4, paddingVertical: 8 },
  forgotBtnText: { fontSize: 13, color: Colors.forest.medium, fontWeight: '600' },
  forgotBox: {
    backgroundColor: Colors.ui.card,
    borderRadius: 16,
    padding: 20,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.ui.border,
  },
  forgotTitle: { fontSize: 16, fontWeight: '700', color: Colors.forest.dark, textAlign: 'center' },
  forgotDesc: { fontSize: 13, color: Colors.ui.textLight, lineHeight: 18, textAlign: 'center' },
  forgotBack: { alignSelf: 'center', paddingVertical: 8 },
  forgotBackText: { fontSize: 13, color: Colors.forest.medium, fontWeight: '600' },
});
