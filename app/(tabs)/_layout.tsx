// ============================================================
// LAYOUT TABS — Navigation par onglets
// Contient aussi la garde d'authentification (un seul onAuthChange dans l'app).
// ============================================================

import { Tabs, useRouter, useSegments } from 'expo-router';
import { View } from 'react-native';
import React, { useEffect, useRef, useState } from 'react';
import ForestFrame from '../../src/components/Navigation/ForestFrame';
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

export default function TabsLayout() {
  const player   = usePlayerStore();
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

  return (
    <View style={{ flex: 1 }}>
      {/* ── Tabs Expo Router — tab bar native masquée ─────────────────── */}
      <Tabs
        screenOptions={{
          headerShown: false,
          // Tab bar native masquée — ForestFrame gère la navigation
          tabBarStyle: { display: 'none' },
        }}
      >
        <Tabs.Screen name="index"     options={{ title: 'Accueil' }} />
        <Tabs.Screen name="rules"     options={{ title: 'R\u00e8gles' }} />
        <Tabs.Screen
          name="challenge"
          options={{
            title: 'D\u00e9fis',
            tabBarBadge: player.friendNotifBadgeEnabled && pendingChallengesCount > 0
              ? pendingChallengesCount
              : undefined,
          }}
        />
        <Tabs.Screen name="profile"   options={{ title: 'Profil' }} />
      </Tabs>

      {/* ── Cadre bois + boutons navigation (superposé en absolu) ─────── */}
      <ForestFrame />
    </View>
  );
}
