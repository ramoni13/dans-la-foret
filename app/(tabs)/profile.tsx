// ============================================================
// ÉCRAN PROFIL JOUEUR
// État 1 : non connecté → formulaire login/inscription
// État 2 : connecté → hub 4 tuiles + sous-sections
// ============================================================

import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  Modal,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from 'firebase/auth';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../../src/services/firebase';

import { useFocusEffect, useRouter } from 'expo-router';
import { Colors } from '../../src/constants/colors';
import { useFrameLayout } from '../../src/constants/frameLayout';
import { BgImage } from '../../src/components/UI/BgImage';
import { useNavStore } from '../../src/store/navStore';
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
import { getPlayer, upsertPlayer } from '../../src/services/playerService';
import { BadgeCollection, RankPanel } from '../../src/components/Badges/BadgeCollection';
import { ActiveGoalCard } from '../../src/components/Badges/ActiveGoalCard';
import { useT } from '../../src/i18n';

import { LeaderboardScreen } from '../../src/components/Leaderboard/LeaderboardScreen';
import { MusicPanel } from '../../src/components/Audio/MusicPanel';
import { getBadgeProgress, ELIGIBLE_GOAL_BADGE_IDS, DEFAULT_BADGE_GOALS } from '../../src/core/engine/badgeEngine';
import { getRank, getPlayerScore, getNextRank } from '../../src/constants/badges';
import { AdminCleanModal } from '../../src/components/Admin/AdminCleanModal';

// ── Types ───────────────────────────────────────────────────────────────────────
type ActiveSection = 'hub' | 'stats' | 'badges' | 'classement' | 'reglages' | 'about';



export default function ProfileScreen() {
  const player = usePlayerStore();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { frameBottom, innerTop, innerPadH } = useFrameLayout();
  const { showBack, hideBack } = useNavStore();
  const t = useT();

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

  // ── Modal admin nettoyage base (Ramoni uniquement) ───────────────────────────
  const [showAdminClean, setShowAdminClean] = useState(false);

  // ── Bouton Retour dans la barre bois haute (via ForestFrame) ────────────────
  const goHub = React.useCallback(() => setActiveSection('hub'), []);
  React.useEffect(() => {
    if (activeSection !== 'hub') {
      showBack(goHub);
    } else {
      hideBack();
    }
    return () => { hideBack(); };
  }, [activeSection]);

  // ── Retour au hub quand on quitte l'onglet ───────────────────────────────────
  useFocusEffect(
    useCallback(() => {
      // Appelé quand l'onglet reçoit le focus — rien à faire ici
      return () => {
        // Appelé quand l'onglet perd le focus (changement d'onglet)
        // On remet le hub pour que le prochain accès parte du hub
        setActiveSection('hub');
        hideBack();
      };
    }, [hideBack])
  );

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

  // ── Slots d'objectif libres ───────────────────────────────────────────────────
  const earnedSet = new Set(player.earnedBadges);
  // Objectifs en cours non encore obtenus
  const activeNonEarned = player.activeBadgeGoals.filter(id => !earnedSet.has(id));
  // Badges encore disponibles (non obtenus, non déjà en objectif actif)
  const availableGoalCount = ELIGIBLE_GOAL_BADGE_IDS.filter(
    id => !earnedSet.has(id) && !activeNonEarned.includes(id)
  ).length;
  const goalSlotsToFill = availableGoalCount > 0 ? Math.max(0, 3 - activeNonEarned.length) : 0;
  const hasGoalSlotFree = goalSlotsToFill > 0;

  // ── Stats dérivées ────────────────────────────────────────────────────────────
  const allBestTimes = Object.values(player.stats.bestTimes);
  const fastestTime  = allBestTimes.length > 0 ? Math.min(...allBestTimes) : null;
  // Temps moyen calculé depuis bestTimes (données historiques complètes, défis solo)
  const avgBestTime  = allBestTimes.length > 0
    ? Math.round(allBestTimes.reduce((a, b) => a + b, 0) / allBestTimes.length)
    : null;
  // Total défis résolus toutes catégories confondues
  const totalAllModes = player.stats.totalSolved
    + player.stats.dailyWon
    + player.stats.friendWins
    + player.onfSolvedCount;

  // Stats chantier 5 (affichage dans la section statistiques)
  const dailyPct  = player.stats.dailyPlayed > 0
    ? Math.round(player.stats.dailyWon / player.stats.dailyPlayed * 100)
    : null;
  const friendPct = player.stats.friendPlayed > 0
    ? Math.round((player.stats.friendWins / player.stats.friendPlayed) * 100)
    : null;

  // Contexte partiel pour getBadgeProgress (objectifs actifs — hors partie en cours)
  // failCount = -1 signifie "hors-partie" : les badges qui dépendent de failCount
  // (ex. precision_pousse) affichent 0/1 et non 1/1 par défaut.
  const partialGameCtx = {
    challengeId:              '',
    levelId:                  `niveau_${player.currentLevel}`,
    levelNumber:              player.currentLevel,
    challengeNumber:          0,
    elapsedMs:                0,
    estimatedDurationMs:      0,
    bonusUsed:                [],
    failCount:                -1,
    noErrorStreak:            player.stats.noErrorStreak,
    dailyStreak:              player.dailyStreak,
    earnedBadges:             player.earnedBadges,
    completedChallenges:      player.completedChallenges,
    completedLevels:          [] as string[],
    friendWins:               player.stats.friendWins,
    bestTimes:                player.stats.bestTimes,
    totalFriendsInvited:      player.stats.totalFriendsInvited,
    topDEJCount:              player.stats.topDEJCount,
    playedAt:                 new Date(),
    sameChallengePlays:       player.stats.sameChallengePlays,
    seasonalChallengesPlayed: player.stats.seasonalChallengesPlayed,
    improvedChallengesCount:  player.stats.improvedChallengesCount,
    speedBadgeHits:           player.stats.speedBadgeHits,
    activeBadgeGoals:         player.activeBadgeGoals,
    goalCounters:             player.goalCounters,
    isWorldRecord:            false,
    isFirstRecord:            false,
    rank:                     undefined as any,
  };

  // ── Compat web/mobile ────────────────────────────────────────────────────────
  const showAlert = (message: string) => {
    if (Platform.OS === 'web') window.alert(message);
    else Alert.alert(t('profile_alert_info'), message);
  };

  const showConfirm = (message: string, onConfirm: () => void) => {
    if (Platform.OS === 'web') {
      if (window.confirm(message)) onConfirm();
    } else {
      Alert.alert(t('profile_alert_confirm_title'), message, [
        { text: t('profile_alert_cancel'), style: 'cancel' },
        { text: t('profile_alert_confirm'), style: 'destructive', onPress: onConfirm },
      ]);
    }
  };

  // ── Handlers auth ─────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      showAlert(t('profile_alert_fill_credentials'));
      return;
    }
    if (!isLogin && !username.trim()) {
      showAlert(t('profile_alert_choose_username'));
      return;
    }
    setSubmitting(true);
    try {
      if (isLogin) await loginWithEmail(email.trim(), password);
      else         await registerWithEmail(email.trim(), password, username.trim());
    } catch (e: any) {
      showAlert(e.message ?? t('profile_alert_error'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    setSubmitting(true);
    try { await loginWithGoogle(); }
    catch (e: any) { showAlert(e.message ?? t('profile_alert_google_failed')); }
    finally { setSubmitting(false); }
  };

  const handleForgotPassword = async () => {
    setResetLoading(true);
    try {
      await sendPasswordReset(resetEmail || email);
      setResetSent(true);
    } catch (e: any) {
      showAlert(e.message ?? t('profile_alert_reset_failed'));
    } finally {
      setResetLoading(false);
    }
  };

  const handleLogout = () => {
    showConfirm(t('profile_confirm_logout'), async () => {
      await logout();
      player.logout();
    });
  };

  const handleReset = () => {
    showConfirm(t('profile_confirm_reset'), async () => {
      player.logout();
      await AsyncStorage.removeItem('dlf_player_v1');
    });
  };

  // ── Réinitialisation badges (Ramoni uniquement) ───────────────────────────────
  const handleResetBadges = () => {
    showConfirm(
      t('profile_confirm_reset_badges'),
      async () => {
        // 1. Zustand — réinitialisation locale immédiate (setState direct, un seul re-render)
        usePlayerStore.setState({
          earnedBadges:     [],
          badgeShowcase:    [undefined, undefined, undefined],
          activeBadgeGoals: [...DEFAULT_BADGE_GOALS],
        });

        // 2. Firestore — réinitialisation cloud
        const uid = auth.currentUser?.uid;
        if (uid) {
          try {
            await updateDoc(doc(db, 'players', uid), {
              earnedBadges:     [],
              badgeShowcase:    [],
              activeBadgeGoals: [...DEFAULT_BADGE_GOALS],
              updatedAt:        serverTimestamp(),
            });
          } catch (e) {
            console.warn('[ResetBadges] Firestore error:', e);
          }
        }
      }
    );
  };

  // ── Chargement ───────────────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <View style={StyleSheet.absoluteFill}>
        <BgImage overlay={0.52} />
        <View style={[styles.centered, { paddingTop: Math.max(insets.top, innerTop) }]}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={[styles.loadingText, { color: 'rgba(255,255,255,0.75)' }]}>{t('profile_loading')}</Text>
        </View>
      </View>
    );
  }

  // ──────────────────────────────────────────────────────────────────────────────
  // NON CONNECTÉ : formulaire
  // ──────────────────────────────────────────────────────────────────────────────
  if (!firebaseUser) {
    return (
      <View style={StyleSheet.absoluteFill}>
        <BgImage overlay={0.52} />
      <ScrollView contentContainerStyle={[styles.container, { paddingTop: Math.max(insets.top + 8, innerTop + 8), paddingHorizontal: innerPadH, paddingBottom: frameBottom + 16 }]}>
          <View style={styles.avatarSection}>
            <View style={styles.avatar}>
              <Text style={styles.avatarEmoji}>🌲</Text>
            </View>
            <Text style={styles.usernameText}>{t('profile_app_title')}</Text>
            <Text style={styles.authSubtitle}>
              {t('profile_auth_subtitle')}
            </Text>
          </View>

          <View style={styles.toggleRow}>
            <TouchableOpacity
              style={[styles.toggleBtn, isLogin && styles.toggleBtnActive]}
              onPress={() => { setIsLogin(true); setShowForgotPassword(false); setResetSent(false); }}
            >
              <Text style={[styles.toggleBtnText, isLogin && styles.toggleBtnTextActive]}>{t('profile_login')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, !isLogin && styles.toggleBtnActive]}
              onPress={() => { setIsLogin(false); setShowForgotPassword(false); setResetSent(false); }}
            >
              <Text style={[styles.toggleBtnText, !isLogin && styles.toggleBtnTextActive]}>{t('profile_register')}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.form}>
            {!isLogin && (
              <TextInput
                style={styles.input}
                placeholder={t('profile_placeholder_username')}
                placeholderTextColor={Colors.ui.textLight}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="words"
              />
            )}
            <TextInput
              style={styles.input}
                placeholder={t('profile_placeholder_email')}
                placeholderTextColor={Colors.ui.textLight}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            <TextInput
                style={styles.input}
                placeholder={t('profile_placeholder_password')}
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
                    {isLogin ? t('profile_btn_login') : t('profile_btn_register')}
                  </Text>
              }
            </TouchableOpacity>

            {isLogin && !showForgotPassword && (
              <TouchableOpacity
                onPress={() => { setShowForgotPassword(true); setResetEmail(email); setResetSent(false); }}
                style={styles.forgotBtn}
                activeOpacity={0.7}
              >
                <Text style={styles.forgotBtnText}>{t('profile_forgot_password')}</Text>
              </TouchableOpacity>
            )}
          </View>

          {isLogin && showForgotPassword && (
            <View style={styles.forgotBox}>
              {resetSent ? (
                <>
                  <Text style={styles.forgotTitle}>{t('profile_reset_sent_title')}</Text>
                  <Text style={styles.forgotDesc}>
                    {t('profile_reset_sent_desc', { email: resetEmail || email })}
                  </Text>
                  <TouchableOpacity style={styles.forgotBack} onPress={() => { setShowForgotPassword(false); setResetSent(false); }}>
                    <Text style={styles.forgotBackText}>{t('profile_forgot_back_login')}</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={styles.forgotTitle}>{t('profile_forgot_title')}</Text>
                  <Text style={styles.forgotDesc}>
                    {t('profile_forgot_desc')}
                  </Text>
                  <TextInput
                    style={styles.input}
                    placeholder={t('profile_placeholder_email')}
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
                      : <Text style={styles.btnPrimaryText}>{t('profile_forgot_send')}</Text>
                    }
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.forgotBack} onPress={() => setShowForgotPassword(false)}>
                    <Text style={styles.forgotBackText}>{t('profile_forgot_back')}</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          )}

        </ScrollView>
      </View>
    );
  }

  // ──────────────────────────────────────────────────────────────────────────────
  // CONNECTÉ : hub + sous-sections
  // ──────────────────────────────────────────────────────────────────────────────
  const displayName = firebaseUser.displayName ?? firebaseUser.email ?? 'Joueur';

  // ── Rang forestier ────────────────────────────────────────────────────────────
  const rankActivityStats = {
    soloCompleted:   player.stats.totalSolved,
    friendCompleted: player.stats.friendWins,
    onfCompleted:    player.onfSolvedCount,
    dailyCompleted:  player.stats.dailyWon,
  };
  const playerScore    = getPlayerScore(player.earnedBadges, rankActivityStats);
  const currentRank    = getRank(playerScore);
  const nextRank       = getNextRank(playerScore);
  const rankLabel      = player.language === 'en' ? (currentRank.labelEn ?? currentRank.label) : currentRank.label;

  // ── Section STATS ─────────────────────────────────────────────────────────────
  if (activeSection === 'stats') {
    return (
      <View style={StyleSheet.absoluteFill}>
        <BgImage overlay={0.52} />
        <ScrollView style={[styles.subSection, { top: innerTop }]} contentContainerStyle={[styles.container, { paddingHorizontal: innerPadH, paddingBottom: frameBottom + 16 }]}>
          <Text style={styles.sectionHeading}>{t('profile_section_stats')}</Text>
          <View style={styles.statsGrid}>
            <StatCard
              label={t('profile_stat_challenges')}
              value={String(totalAllModes)}
              emoji="🏆"
              hint={t('profile_stat_challenges_hint')}
            />
            <StatCard
              label={t('profile_stat_streak')}
              value={
                player.longestDailyChallengeStreak > 0
                  ? t('profile_stat_streak_value', { current: String(player.dailyChallengeStreak), record: String(player.longestDailyChallengeStreak) })
                  : String(player.dailyChallengeStreak)
              }
              emoji="🔥"
              hint={t('profile_stat_streak_hint', { current: String(player.dailyChallengeStreak), record: String(player.longestDailyChallengeStreak) })}
            />
            <StatCard
              label={t('profile_stat_daily_accuracy')}
              value={
                dailyPct !== null
                  ? `${dailyPct}%`
                  : '—'
              }
              emoji="📅"
              hint={t('profile_stat_daily_accuracy_hint', { won: String(player.stats.dailyWon), played: String(player.stats.dailyPlayed) })}
            />
            <StatCard
              label={t('profile_stat_friend_accuracy')}
              value={
                friendPct !== null
                  ? `${friendPct}%`
                  : '—'
              }
              emoji="🤝"
              hint={t('profile_stat_friend_accuracy_hint', { won: String(player.stats.friendWins), played: String(player.stats.friendPlayed) })}
            />
            <StatCard
              label={t('profile_stat_avg_time')}
              value={avgBestTime !== null ? formatTime(avgBestTime) : '—'}
              emoji="⏱"
              hint={t('profile_stat_avg_time_hint')}
            />
          </View>
        </ScrollView>
      </View>
    );
  }

  // ── Section BADGES ────────────────────────────────────────────────────────────
  if (activeSection === 'badges') {
    return (
      <View style={StyleSheet.absoluteFill}>
        <BgImage overlay={0.52} />
        <ScrollView style={[styles.subSection, { top: innerTop }]} contentContainerStyle={[styles.container, { paddingHorizontal: innerPadH, paddingBottom: frameBottom + 16 }]}>
          <Text style={styles.sectionHeading}>{t('profile_section_badges')}</Text>

          {/* ── Objectifs actifs ──────────────────────────────────────────── */}
          <View style={goalStyles.goalSection}>
            <View style={goalStyles.goalHeader}>
              <Text style={goalStyles.goalTitle}>{t('profile_goals_title')}</Text>
            </View>

            <View style={goalStyles.goalList}>
              {/* 3 slots fixes : actif ou vide */}
              {[0, 1, 2].map(slotIdx => {
                const badgeId = player.activeBadgeGoals[slotIdx];
                if (badgeId) {
                  const progress = getBadgeProgress(badgeId, partialGameCtx as any);
                  const isObtained = player.earnedBadges.includes(badgeId);
                  return (
                    <ActiveGoalCard
                      key={badgeId}
                      progress={progress ?? { badgeId, currentValue: 1, targetValue: 1, percentage: 1 }}
                      obtained={isObtained}
                    />
                  );
                }
                // Slot vide
                return (
                  <View
                    key={`empty-${slotIdx}`}
                    style={goalStyles.emptySlot}
                  >
                    <Text style={goalStyles.emptySlotEmoji}>🎯</Text>
                    <Text style={goalStyles.emptySlotText}>{t('profile_goal_empty_slot')}</Text>
                  </View>
                );
              })}
            </View>
          </View>

          {/* ── Rang forestier (complet avec paliers) ────────────────────── */}
          <RankPanel
            earnedBadges={player.earnedBadges}
            language={player.language}
            t={t}
          />

          <BadgeCollection
            earnedBadges={player.earnedBadges}
            onBadgePress={() => {}}
            hideRankPanel
          />

          {/* ── Bouton dev Ramoni uniquement ── */}
          {player.username === 'Ramoni' && (
            <TouchableOpacity
              style={devStyles.resetBadgesBtn}
              onPress={handleResetBadges}
              activeOpacity={0.8}
            >
              <Text style={devStyles.resetBadgesBtnText}>🔄 Réinitialiser mes badges</Text>
            </TouchableOpacity>
          )}
        </ScrollView>


      </View>
    );
  }

  // ── Section CLASSEMENT ────────────────────────────────────────────────────────
  if (activeSection === 'classement') {
    return (
      <View style={StyleSheet.absoluteFill}>
        <BgImage overlay={0.52} />
        <View style={[styles.subSection, { top: innerTop }]}>
          <LeaderboardScreen />
        </View>
      </View>
    );
  }

  // ── Section RÉGLAGES ─────────────────────────────────────────────────────────
  if (activeSection === 'reglages') {
    return (
      <View style={StyleSheet.absoluteFill}>
        <BgImage overlay={0.52} />
        <ScrollView style={[styles.subSection, { top: innerTop }]} contentContainerStyle={[styles.container, { paddingHorizontal: innerPadH, paddingBottom: frameBottom + 16 }]}>
            <Text style={styles.sectionHeading}>{t('profile_section_settings')}</Text>

          {/* Langue */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('profile_setting_language')}</Text>
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
              <Text style={styles.settingLabel}>{t('profile_setting_friend_badge')}</Text>
              <Text style={styles.settingDesc}>
                {t('profile_setting_friend_badge_desc')}
              </Text>
            </View>
            <Switch
              value={player.friendNotifBadgeEnabled}
              onValueChange={(val) => player.setFriendNotifBadgeEnabled(val)}
              trackColor={{ false: Colors.ui.border, true: Colors.forest.medium }}
              thumbColor="#fff"
            />
          </View>

          {/* Nettoyer la base + Séquence badges — Ramoni uniquement */}
          {player.username === 'Ramoni' && (
            <>
              <TouchableOpacity
                style={devStyles.adminCleanBtn}
                onPress={() => setShowAdminClean(true)}
                activeOpacity={0.8}
              >
                <Text style={devStyles.adminCleanBtnText}>🧹 Nettoyer la base</Text>
              </TouchableOpacity>
              <AdminCleanModal
                visible={showAdminClean}
                onClose={() => setShowAdminClean(false)}
              />
              <TouchableOpacity
                style={[devStyles.adminCleanBtn, { marginTop: 8 }]}
                onPress={() => router.push('/admin/badge-sequence')}
                activeOpacity={0.8}
              >
                <Text style={devStyles.adminCleanBtnText}>Sequence des badges</Text>
              </TouchableOpacity>
            </>
          )}

          {/* Déconnexion */}
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.7}>
            <Text style={styles.logoutBtnText}>{t('profile_btn_logout')}</Text>
          </TouchableOpacity>


        </ScrollView>
      </View>
    );
  }

  // ── Section À PROPOS ─────────────────────────────────────────────────────────
  if (activeSection === 'about') {
    return (
      <View style={StyleSheet.absoluteFill}>
        <BgImage overlay={0.52} />
        <ScrollView
          style={[styles.subSection, { top: innerTop }]}
          contentContainerStyle={[styles.container, { paddingHorizontal: innerPadH, paddingBottom: frameBottom + 16 }]}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.sectionHeading}>{t('about_title')}</Text>
          <Text style={aboutStyles.subtitle}>{t('about_subtitle')}</Text>

          {/* Histoire */}
          <View style={aboutStyles.card}>
            <Text style={aboutStyles.cardTitle}>{t('about_history_title')}</Text>
            <Text style={aboutStyles.cardBody}>{t('about_history_body')}</Text>
            <View style={aboutStyles.featureList}>
              <Text style={aboutStyles.featureItem}>{t('about_feature_1')}</Text>
              <Text style={aboutStyles.featureItem}>{t('about_feature_2')}</Text>
              <Text style={aboutStyles.featureItem}>{t('about_feature_3')}</Text>
              <Text style={aboutStyles.featureItem}>{t('about_feature_4')}</Text>
              <Text style={aboutStyles.featureItem}>{t('about_feature_5')}</Text>
            </View>
          </View>

          {/* Démarche */}
          <View style={aboutStyles.card}>
            <Text style={aboutStyles.cardTitle}>{t('about_approach_title')}</Text>
            <Text style={aboutStyles.cardBody}>{t('about_approach_body')}</Text>
          </View>

          {/* Partenariat ONF */}
          <View style={[aboutStyles.card, aboutStyles.cardOnf]}>
            <View style={aboutStyles.onfHeader}>
              <Text style={aboutStyles.onfEmoji}>🌲</Text>
              <Text style={[aboutStyles.cardTitle, aboutStyles.onfTitle]}>{t('about_onf_title')}</Text>
            </View>
            <Text style={aboutStyles.cardBody}>{t('about_onf_body')}</Text>
            <View style={aboutStyles.onfHighlight}>
              <Text style={aboutStyles.onfHighlightText}>{t('about_onf_highlight')}</Text>
            </View>
            <Text style={[aboutStyles.cardBody, { marginTop: 8 }]}>{t('about_onf_ads')}</Text>
          </View>

          {/* Équipe */}
          <View style={aboutStyles.card}>
            <Text style={aboutStyles.cardTitle}>{t('about_team_title')}</Text>
            <Text style={aboutStyles.cardBody}>{t('about_team_body')}</Text>
            <View style={aboutStyles.creditsList}>
              <AboutCreditRow label={t('about_credit_author')} value="Cédric Martinez" />
              <AboutCreditRow label={t('about_credit_music')} value="Dantès" />
              <AboutCreditRow label={t('about_credit_dev')} value="Ramoni & Marty Touch" />
              <AboutCreditRow label={t('about_credit_illustrations')} value="Kikou" />
            </View>
          </View>

          <Text style={aboutStyles.copyright}>{t('about_copyright')}</Text>
        </ScrollView>
      </View>
    );
  }

  // ── HUB (état initial) ────────────────────────────────────────────────────────
  return (
    <View style={StyleSheet.absoluteFill}>
      <BgImage overlay={0.52} />
      <ScrollView contentContainerStyle={[styles.container, { paddingTop: Math.max(insets.top + 8, innerTop + 8), paddingHorizontal: innerPadH, paddingBottom: frameBottom + 16 }]}>

        {/* Avatar + nom */}
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarEmoji}>{currentRank.emoji}</Text>
          </View>
          <Text style={styles.usernameText}>{displayName}</Text>
          <View style={styles.rankBadge}>
            <Text style={styles.rankBadgeText}>{rankLabel}</Text>
            {nextRank && (
              <Text style={styles.rankScoreText}>{playerScore} / {nextRank.minScore} pts</Text>
            )}
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
            <Text style={styles.tileLabel}>{t('profile_tile_stats')}</Text>
            <Text style={styles.tileSub}>{t('profile_tile_stats_sub', { count: String(player.stats.totalSolved) })}</Text>
          </TouchableOpacity>

          {/* Badges */}
          <TouchableOpacity
            style={styles.tile}
            onPress={() => setActiveSection('badges')}
            activeOpacity={0.8}
          >
            {hasGoalSlotFree && (
              <View style={goalDotStyles.badge}>
                <Text style={goalDotStyles.badgeText}>{goalSlotsToFill}</Text>
              </View>
            )}
            <Text style={styles.tileEmoji}>🏅</Text>
            <Text style={styles.tileLabel}>{t('profile_tile_badges')}</Text>
            <Text style={styles.tileSub}>
              {hasGoalSlotFree
                ? t('profile_tile_badges_sub_goals', { active: String(3 - goalSlotsToFill) })
                : player.earnedBadges.length > 0
                  ? t('profile_tile_badges_sub_earned', { count: String(player.earnedBadges.length) })
                  : t('profile_tile_badges_sub_none')}
            </Text>
          </TouchableOpacity>

          {/* Classement */}
          <TouchableOpacity
            style={styles.tile}
            onPress={() => setActiveSection('classement')}
            activeOpacity={0.8}
          >
            <Text style={styles.tileEmoji}>🌍</Text>
            <Text style={styles.tileLabel}>{t('profile_tile_leaderboard')}</Text>
            <Text style={styles.tileSub}>{t('profile_tile_leaderboard_sub')}</Text>
          </TouchableOpacity>

          {/* Réglages */}
          <TouchableOpacity
            style={styles.tile}
            onPress={() => setActiveSection('reglages')}
            activeOpacity={0.8}
          >
            <Text style={styles.tileEmoji}>{'⚙️'}</Text>
            <Text style={styles.tileLabel}>{t('profile_tile_settings')}</Text>
            <Text style={styles.tileSub}>{t('profile_tile_settings_sub')}</Text>
          </TouchableOpacity>

        </View>

        {/* À propos */}
        <TouchableOpacity
          style={styles.aboutBtn}
          onPress={() => setActiveSection('about')}
          activeOpacity={0.7}
        >
          <View style={styles.aboutBtnInner}>
            <View style={{ flex: 1 }}>
              <Text style={styles.aboutBtnText}>{t('profile_btn_about')}</Text>
              <Text style={styles.aboutBtnSub}>{t('profile_btn_about_sub')}</Text>
            </View>
            <Text style={styles.aboutBtnChevron}>›</Text>
          </View>
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
}

// ── Modale d'explication d'une StatCard ───────────────────────────────────────
const native = Platform.OS !== 'web';

function StatHintModal({ visible, label, emoji, hint, onClose }: {
  visible: boolean;
  label: string;
  emoji: string;
  hint: string;
  onClose: () => void;
}) {
  const t = useT();
  const scaleAnim   = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      scaleAnim.setValue(0.85);
      opacityAnim.setValue(0);
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, damping: 14, stiffness: 220, useNativeDriver: native }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 160, useNativeDriver: native }),
      ]).start();
    } else {
      scaleAnim.setValue(0.85);
      opacityAnim.setValue(0);
    }
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <Animated.View style={[statStyles.modalBackdrop, { opacity: opacityAnim }]}>
        <Animated.View style={[statStyles.modalCard, { transform: [{ scale: scaleAnim }] }]}>
          <Text style={statStyles.modalEmoji}>{emoji}</Text>
          <Text style={statStyles.modalTitle}>{label}</Text>
          <Text style={statStyles.modalBody}>{hint}</Text>
          <TouchableOpacity style={statStyles.modalBtn} onPress={onClose} activeOpacity={0.8}>
            <Text style={statStyles.modalBtnText}>{t('profile_understood')}</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

// ── Composant StatCard ────────────────────────────────────────────────────────
function StatCard({ label, value, emoji, hint }: { label: string; value: string; emoji: string; hint?: string }) {
  const [modalVisible, setModalVisible] = useState(false);

  return (
    <>
      <TouchableOpacity
        style={statStyles.card}
        onPress={hint != null ? () => setModalVisible(true) : undefined}
        activeOpacity={hint != null ? 0.7 : 1}
      >
        <Text style={statStyles.emoji}>{emoji}</Text>
        <Text style={statStyles.value}>{value}</Text>
        <View style={statStyles.labelRow}>
          <Text style={statStyles.label}>{label}</Text>
          {hint != null && (
            <View style={statStyles.hintBadge}>
              <Text style={statStyles.hintIcon}>?</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>

      {hint != null && (
        <StatHintModal
          visible={modalVisible}
          label={label}
          emoji={emoji}
          hint={hint}
          onClose={() => setModalVisible(false)}
        />
      )}
    </>
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
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  label: { fontSize: 11, color: Colors.ui.textLight, textAlign: 'center' },
  hintBadge: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: Colors.ui.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hintIcon: { fontSize: 9, fontWeight: '700', color: Colors.ui.textLight, lineHeight: 13 },
  // Modale
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.60)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  modalCard: {
    backgroundColor: Colors.ui.card,
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    width: '100%',
    maxWidth: 340,
    borderWidth: 2,
    borderColor: Colors.ui.border,
    elevation: 16,
    gap: 10,
  },
  modalEmoji: { fontSize: 40 },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.forest.dark,
    textAlign: 'center',
  },
  modalBody: {
    fontSize: 14,
    color: Colors.ui.textLight,
    textAlign: 'center',
    lineHeight: 21,
  },
  modalBtn: {
    marginTop: 6,
    backgroundColor: Colors.forest.medium,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 36,
    alignItems: 'center',
    width: '100%',
  },
  modalBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  // Zone de contenu des sous-sections, positionnée sous la barre bois haute
  subSection: {
    position: 'absolute',
    // top est injecté dynamiquement (= innerTop) via style inline
    left: 0,
    right: 0,
    bottom: 0,
  },
  container: { paddingVertical: 20, gap: 20 },

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
  usernameText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },

  rankBadge: {
    alignItems: 'center',
    gap: 2,
  },
  rankBadgeText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFE082',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  rankScoreText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.65)',
  },

  seedsBadge: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  seedsBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
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
    color: '#fff',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 4,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },

  // (backBtn supprimé — le bouton Retour vit dans ForestFrame via navStore)

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

  // À propos
  aboutBtn: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.ui.border,
    backgroundColor: Colors.ui.card,
    overflow: 'hidden',
  },
  aboutBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 8,
  },
  aboutBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.ui.text,
  },
  aboutBtnSub: {
    fontSize: 12,
    color: Colors.ui.textLight,
    marginTop: 2,
  },
  aboutBtnChevron: {
    fontSize: 22,
    color: Colors.ui.textLight,
    lineHeight: 24,
  },

  // Déconnexion / réinitialisation
  logoutBtn: {
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F4433660',
    backgroundColor: Colors.ui.card,
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
  authSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.75)', textAlign: 'center', paddingHorizontal: 24 },
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
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#fff' },
  langRow: { flexDirection: 'row', gap: 10 },
  langBtn: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: 'rgba(26,58,26,0.82)',
    alignItems: 'center',
  },
  langBtnActive: {
    backgroundColor: 'rgba(26,58,26,0.82)',
    borderColor: Colors.forest.accent,
  },
  langBtnText: { fontSize: 13, fontWeight: '600', color: '#fff' },
  langBtnTextActive: { color: '#fff', fontWeight: '700' },

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

// ── Styles objectifs actifs ───────────────────────────────────────────────────
const goalStyles = StyleSheet.create({
  goalSection: {
    backgroundColor: Colors.ui.card,
    borderRadius: 16,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.ui.border,
    marginBottom: 16,
  },
  goalHeader: {
    gap: 8,
  },
  goalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.forest.dark,
  },
  autoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
    paddingHorizontal: 2,
    backgroundColor: Colors.ui.background,
    borderRadius: 10,
    paddingLeft: 10,
    paddingRight: 6,
  },
  autoLabel: {
    fontSize: 13,
    color: Colors.ui.textLight,
    fontWeight: '500',
  },
  goalEmpty: {
    fontSize: 13,
    color: Colors.ui.textLight,
    lineHeight: 18,
    textAlign: 'center',
    paddingVertical: 8,
  },
  goalList: {
    gap: 8,
  },
  emptySlot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.badges.or + '70',
    borderStyle: 'dashed',
    backgroundColor: Colors.badges.or + '08',
  },
  emptySlotEmoji: {
    fontSize: 20,
    width: 28,
    textAlign: 'center',
  },
  emptySlotText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.forest.medium,
  },
  emptySlotArrow: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.badges.or,
  },
});

const goalDotStyles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: 6,
    right: 6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#E53935',
    borderWidth: 1.5,
    borderColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    zIndex: 2,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFF',
    lineHeight: 13,
  },
});

// ── Composant ligne de crédit (section About) ─────────────────────────────────
function AboutCreditRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={aboutCreditStyles.row}>
      <Text style={aboutCreditStyles.label}>{label}</Text>
      <Text style={aboutCreditStyles.value}>{value}</Text>
    </View>
  );
}

const aboutCreditStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: Colors.ui.border,
  },
  label: {
    width: 120,
    fontSize: 13,
    fontWeight: '600',
    color: Colors.ui.textLight,
  },
  value: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: Colors.ui.text,
  },
});

// ── Styles section About ──────────────────────────────────────────────────────
const aboutStyles = StyleSheet.create({
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.75)',
    textAlign: 'center',
    marginTop: -10,
    marginBottom: 4,
  },
  card: {
    backgroundColor: Colors.ui.card,
    borderRadius: 18,
    padding: 20,
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.ui.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.forest.dark,
  },
  cardBody: {
    fontSize: 14,
    color: Colors.ui.textLight,
    lineHeight: 21,
  },
  featureList: {
    gap: 6,
    marginTop: 4,
  },
  featureItem: {
    fontSize: 13,
    color: Colors.ui.text,
    lineHeight: 19,
    paddingLeft: 4,
  },
  cardOnf: {
    borderColor: Colors.forest.medium + '60',
  },
  onfHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  onfEmoji: {
    fontSize: 22,
  },
  onfTitle: {
    flex: 1,
  },
  onfHighlight: {
    backgroundColor: Colors.forest.light + '20',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderLeftWidth: 3,
    borderLeftColor: Colors.forest.medium,
  },
  onfHighlightText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.forest.dark,
    lineHeight: 20,
  },
  creditsList: {
    gap: 4,
    marginTop: 4,
  },
  copyright: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.45)',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
});

// ── Styles dev (Ramoni uniquement) ────────────────────────────────────────────
const devStyles = StyleSheet.create({
  resetBadgesBtn: {
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#c0392b',
    backgroundColor: Colors.ui.card,
  },
  resetBadgesBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#c0392b',
  },
  adminCleanBtn: {
    alignItems: 'center',
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#7B1FA260',
    backgroundColor: Colors.ui.card,
  },
  adminCleanBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#7B1FA2',
  },
});
