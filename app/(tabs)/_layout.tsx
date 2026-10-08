// ============================================================
// LAYOUT TABS — Navigation par onglets
// Contient aussi la garde d'authentification (un seul onAuthChange dans l'app).
// ============================================================

import { Tabs, useRouter, useSegments } from 'expo-router';
import { Colors } from '../../src/constants/colors';
import { View, Image, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import React, { useEffect, useRef, useState } from 'react';
import { User } from 'firebase/auth';
import { usePlayerStore } from '../../src/store/playerStore';
import { onAuthChange } from '../../src/services/authService';
import { getPlayer } from '../../src/services/playerService';
import { updateDailyStreak } from '../../src/services/badgeService';
import { getDailyDateString, sealDailyRecord } from '../../src/services/dailyChallengeService';
import { auth, db } from '../../src/services/firebase';
import {
  collection,
  query,
  where,
  onSnapshot,
  Timestamp,
} from 'firebase/firestore';

// ── Icônes de navigation (images illustrées) ───────────────────────────────
const TAB_ICONS = {
  index:     require('../../assets/elements/boutons/Accueil.png'),
  rules:     require('../../assets/elements/boutons/Règles.png'),
  challenge: require('../../assets/elements/boutons/Défis.png'),
  profile:   require('../../assets/elements/boutons/Parametres.png'),
} as const;

function TabIcon({ name, focused }: { name: keyof typeof TAB_ICONS; focused: boolean }) {
  return (
    <View style={[tabIconStyles.container, focused && tabIconStyles.focused]}>
      <Image
        source={TAB_ICONS[name]}
        style={tabIconStyles.image}
        resizeMode="contain"
      />
    </View>
  );
}

const tabIconStyles = StyleSheet.create({
  container: {
    width: 70,
    height: 64,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 2,
  },
  focused: {
    // halo vert forêt derrière l'icône active
    backgroundColor: 'rgba(76,175,80,0.28)',
    borderRadius: 16,
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 10,
    elevation: 6,
  },
  image: {
    width: 66,
    height: 60,
  },
});

export default function TabsLayout() {
  const player   = usePlayerStore();
  const insets   = useSafeAreaInsets();
  const router   = useRouter();
  const segments = useSegments();

  // undefined = Firebase pas encore répondu, null = déconnecté, User = connecté
  const [user, setUser] = useState<User | null | undefined>(undefined);
  // Verrou anti-boucle : une seule redirection par changement d'état auth
  const redirectedRef = useRef(false);

  // ── Compteur de défis amis en attente (badge onglet Amis) ──────────────────
  const [pendingChallengesCount, setPendingChallengesCount] = useState(0);

  // ── Un seul abonnement Firebase Auth pour toute l'app ──────────────────────
  useEffect(() => {
    const unsub = onAuthChange(async (firebaseUser) => {
      setUser(firebaseUser);

      const authenticated = !!firebaseUser && !firebaseUser.isAnonymous;
      // Propager l'état auth dans le store pour que les écrans enfants
      // n'aient pas besoin de leur propre onAuthChange (évite les crashes
      // liés aux règles des hooks React).
      player.setAuthState(true, authenticated);

      if (authenticated) {
        // Restaurer le profil Firestore
        const profile = await getPlayer(firebaseUser!.uid);
        if (profile) player.restoreFromCloud(profile);
      }
    });
    return unsub;
  }, []); // [] garanti : onAuthChange est stable

  // Mémorise l'état précédent pour détecter la transition "vient de se connecter"
  const prevAuthenticatedRef = useRef<boolean | null>(null);

  // ── Garde d'authentification — sans boucle ─────────────────────────────────
  // Règle : si l'utilisateur n'est PAS connecté, il ne peut accéder qu'à /profile.
  useEffect(() => {
    if (user === undefined) return; // Firebase pas encore répondu

    const authenticated   = !!user && !user.isAnonymous;
    const inProfileTab    = segments.some(s => s === 'profile');
    const wasAuthenticated = prevAuthenticatedRef.current;

    if (!authenticated && !inProfileTab && !redirectedRef.current) {
      // Non connecté et pas sur le profil → forcer le profil
      redirectedRef.current = true;
      router.replace('/(tabs)/profile');
    } else if (authenticated && wasAuthenticated === false && inProfileTab) {
      // Vient de se connecter depuis /profile → rediriger vers l'accueil
      router.replace('/(tabs)/');
    }
    if (authenticated) {
      // Connecté : réinitialiser le verrou pour les prochaines déconnexions
      redirectedRef.current = false;
    }

    prevAuthenticatedRef.current = authenticated;
  }, [user, segments]);

  // ── Connexion quotidienne ──────────────────────────────────────────────────
  useEffect(() => {
    const isNewDay = player.checkDailyLogin();
    if (isNewDay) {
      player.addSeeds(3);

      const uid    = auth.currentUser?.uid;
      const isAnon = auth.currentUser?.isAnonymous ?? true;
      if (uid && !isAnon) {
        const state = usePlayerStore.getState();
        updateDailyStreak(uid, state.dailyStreak, state.lastPlayedDate).catch(() => {});
      }

      // Sceller le record du jour précédent → crédite dailyWins au gagnant
      const yesterday = new Date();
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      sealDailyRecord(getDailyDateString(yesterday)).catch(() => {});
    }
  }, []); // Une seule fois au montage

  // ── Badge défis amis en attente (Firestore onSnapshot) ────────────────────
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    const isAnon = auth.currentUser?.isAnonymous ?? true;

    if (!uid || isAnon || !player.friendNotifBadgeEnabled) {
      setPendingChallengesCount(0);
      return;
    }

    const now = Date.now();
    const q = query(
      collection(db, 'friendChallenges'),
      where('opponentUid', '==', uid),
      where('status', '==', 'pending'),
    );

    const unsub = onSnapshot(q, (snap) => {
      const count = snap.docs.filter(d => {
        const exp = (d.data().expiresAt as Timestamp)?.toMillis() ?? Infinity;
        return exp > now;
      }).length;
      setPendingChallengesCount(count);
    }, () => {
      // Erreur (permissions) → pas de badge
      setPendingChallengesCount(0);
    });

    return () => unsub();
  }, [user, player.friendNotifBadgeEnabled]);

  const tabBarHeight = insets.bottom + 68;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: 'transparent',
        tabBarInactiveTintColor: 'transparent',
        tabBarShowLabel: false,
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          elevation: 0,
          shadowOpacity: 0,
          height: tabBarHeight,
          paddingBottom: insets.bottom,
          paddingTop: 0,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Jouer',
          tabBarIcon: ({ focused }) => <TabIcon name="index" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="rules"
        options={{
          title: 'R\u00e8gles',
          tabBarIcon: ({ focused }) => <TabIcon name="rules" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="challenge"
        options={{
          title: 'D\u00e9fis amis',
          tabBarIcon: ({ focused }) => <TabIcon name="challenge" focused={focused} />,
          tabBarBadge: player.friendNotifBadgeEnabled && pendingChallengesCount > 0
            ? pendingChallengesCount
            : undefined,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ focused }) => <TabIcon name="profile" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
