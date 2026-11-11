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
import { useAudioStore } from '../../src/store/audioStore';
import { useNavStore } from '../../src/store/navStore';
import { onAuthChange } from '../../src/services/authService';
import { runInactivePurgeIfDue } from '../../src/services/inactiveAccountService';
import { isAuthAccountOlderThan } from '../../src/constants/inactiveAccounts';
import { buildSoloProgressionPayload, createPlayer, getPlayer, isUsernameTaken, resetPlayerProgression, updateDailyLimits, updateNewFeatureBadges, updatePremium, updateSeeds, updateSoloProgression, updateStats } from '../../src/services/playerService';
import { awardEarnedTrophies } from '../../src/services/trophyService';
import { awardBadgesFirestore } from '../../src/services/badgeService';
import { publishLeaderboardEntry, resetLeaderboardCache } from '../../src/services/leaderboardService';
import { PROGRESSION_V2 } from '../../src/constants/featureFlags';
import { needsProgressionReset } from '../../src/constants/progression';
import { updateDailyStreak } from '../../src/services/badgeService';
import { getDailyDateString, sealDailyRecord } from '../../src/services/dailyChallengeService';
import { incrementJackpotIfNeeded } from '../../src/services/jackpotService';
import { db } from '../../src/services/firebase';
import {
  collection,
  query,
  where,
  onSnapshot,
  Timestamp,
} from 'firebase/firestore';
import { recordSession, initPlayerMetrics } from '../../src/services/metricsService';
import { getRankForLevel } from '../../src/constants/progression';
import { Platform } from 'react-native';

export default function TabsLayout() {
  const player   = usePlayerStore();
  const router   = useRouter();
  const segments = useSegments();
  const { setPendingFriendChallenges } = useNavStore();

  // undefined = Firebase pas encore répondu, null = déconnecté, User = connecté
  const [user, setUser] = useState<User | null | undefined>(undefined);
  // Verrou anti-boucle : une seule redirection par changement d'état auth
  const redirectedRef = useRef(false);

  // Verrou : checkDailyLogin ne s'exécute qu'une seule fois par session,
  // après que l'état auth et la restauration cloud soient connus.
  const dailyLoginCheckedRef = useRef(false);

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
        // Restaurer le profil Firestore AVANT de vérifier la connexion quotidienne
        let profile = await getPlayer(firebaseUser!.uid);

        // ── Compte purgé pour inactivité (2 ans, comptes gratuits) : le compte Auth existe encore mais le profil
        // a été effacé. On recrée un profil neuf. Garde : compte Auth créé il y a plus de 10 min, sinon c'est une
        // inscription en cours (`registerWithEmail` crée le profil juste après le compte Auth).
        if (!profile && isAuthAccountOlderThan(firebaseUser!.metadata.creationTime, 10 * 60_000)) {
          try {
            const wanted = firebaseUser!.displayName?.trim() || '';
            const name = wanted && !(await isUsernameTaken(wanted)) ? wanted : 'Joueur';
            await createPlayer(firebaseUser!.uid, name);
            profile = await getPlayer(firebaseUser!.uid);
          } catch (err) {
            console.warn('[inactivePurge] Recréation du profil impossible', err);
          }
        }

        // ── Progression v2 (C9) : remise à zéro UNIQUE du profil pré-v2 ──────────
        // Faite AVANT restoreFromCloud, sinon l'ancien profil cloud serait refusionné
        // dans l'état local. Si l'écriture Firestore échoue (hors-ligne), on ne restaure
        // surtout pas l'ancien profil : la remise à zéro sera retentée à la prochaine connexion.
        if (profile && PROGRESSION_V2 && needsProgressionReset(profile.progressionVersion)) {
          try {
            await resetPlayerProgression(firebaseUser!.uid);
            player.resetProgression();
            profile = await getPlayer(firebaseUser!.uid);
          } catch (err) {
            console.warn('[progression-v2] Remise à zéro cloud impossible, retentée à la prochaine connexion', err);
            profile = null;
          }
        }

        if (profile) {
          // `logout()` remet isPremium à false : un isPremium local présent ici vient d'un achat fait sur ce compte.
          const localWasPremium = usePlayerStore.getState().isPremium;
          player.restoreFromCloud(profile);

          // Lot A : la fusion peut avoir gardé un achat premium local ou des compteurs que le cloud ne connaît pas
          // encore : on les écrit pour que le cloud devienne la référence.
          const merged = usePlayerStore.getState();
          if (merged.isPremium && !profile.isPremium && localWasPremium) updatePremium(firebaseUser!.uid, true).catch(() => {});
          updateDailyLimits(firebaseUser!.uid, merged).catch(() => {});
          // Lot D : les statistiques fusionnées (max local/cloud) deviennent la référence du cloud
          updateStats(firebaseUser!.uid, merged.stats, { countedDuelIds: merged.countedDuelIds, duelWinStreak: merged.duelWinStreak }).catch(() => {});

          // ── Progression v2 (C3) : rattrapage des graines de fin de chapitre ─────
          // Un chapitre terminé sur un autre appareil, ou avant ce lot, n'a pas été versé ici :
          // on le verse maintenant (idempotent), puis on synchronise graines et chapitres.
          const grant = usePlayerStore.getState().grantChapterRewards();
          // Cartes d'Herbier de fin de chapitre : rattrapage d'un chapitre terminé ailleurs (idempotent)
          const cardsBefore = usePlayerStore.getState().collectedTreeCardIds.length;
          usePlayerStore.getState().grantChapterCards();
          const gotCards = usePlayerStore.getState().collectedTreeCardIds.length > cardsBefore;
          // Cérémonies : un chapitre terminé ailleurs (ou avant ce lot) sans cérémonie vue ici est mis
          // en file ; l'accueil la rejouera. Idempotent.
          const queued = usePlayerStore.getState().enqueueCeremonies();
          // Trophées : rattrapage de ceux atteints ailleurs (étoiles cumulées, Herbier, trophée final…). Idempotent.
          const caughtUp = awardEarnedTrophies();
          if (caughtUp.length > 0) awardBadgesFirestore(firebaseUser!.uid, caughtUp).catch(() => {});
          if (grant.chapters.length > 0 || queued.length > 0 || gotCards || caughtUp.length > 0) {
            const after = usePlayerStore.getState();
            if (grant.chapters.length > 0) updateSeeds(firebaseUser!.uid, after.seeds).catch(() => {});
            updateSoloProgression(firebaseUser!.uid, buildSoloProgressionPayload(after)).catch(() => {});
          }
          // Restaurer la sélection musicale depuis le cloud
          const cloudIngame = (profile as any).selectedIngameTrackId as string | undefined;
          const cloudMenu   = (profile as any).selectedMenuTrackId   as string | undefined;
          if (cloudIngame || cloudMenu) {
            const audio = useAudioStore.getState();
            if (cloudIngame) audio.setSelectedTrack('ingame', cloudIngame);
            if (cloudMenu)   audio.setSelectedTrack('menu',   cloudMenu);
          }

          // ── Métriques de rétention — session start ─────────────────────────
          // Initialise le document si premier login, sinon met à jour.
          const state = usePlayerStore.getState();
          const platform = Platform.OS; // 'ios' | 'android' | 'web'
          const rankDef = getRankForLevel(state.currentLevel);

          // initPlayerMetrics ne fait rien si le document existe déjà (merge:true)
          initPlayerMetrics(firebaseUser!.uid, platform).catch(() => {});
          recordSession(
            firebaseUser!.uid,
            platform,
            state.isPremium,
            state.currentLevel,
            state.seeds,
            state.earnedBadges.length,
            rankDef.labelFr,
            state.dailyStreak,
            state.longestDailyChallengeStreak,
          ).catch(() => {});

          // ── Purge des comptes gratuits inactifs depuis 2 ans (premium exclus) ──
          // Une fois par jour au plus, compte administrateur uniquement, tant que INACTIVE_PURGE_ON_LAUNCH = true.
          // En arrière-plan : n'attend rien et ne bloque pas le démarrage.
          runInactivePurgeIfDue({ username: profile.username, currentUid: firebaseUser!.uid }).catch(() => {});
        }
      }

      // Vérifier la connexion quotidienne après que le profil soit restauré,
      // seulement une fois par session (evite le double-déclenchement et
      // le faux positif au premier lancement / inscription).
      if (!dailyLoginCheckedRef.current) {
        dailyLoginCheckedRef.current = true;

        // Lire lastPlayedDate AVANT checkDailyLogin (qui va l'écrire)
        // pour détecter un nouveau compte (jamais joué = chaîne vide).
        const isReturningPlayer = usePlayerStore.getState().lastPlayedDate !== '';
        const isNewDay = player.checkDailyLogin();
        if (isNewDay && isReturningPlayer) {
          player.addSeeds(3);

          const uid    = firebaseUser?.uid;
          const isAnon = firebaseUser?.isAnonymous ?? true;
          if (uid && !isAnon) {
            const state = usePlayerStore.getState();
            updateDailyStreak(uid, state.dailyStreak, state.lastPlayedDate).catch(() => {});
          }

          // Sceller le record du jour précédent → crédite dailyWins au gagnant
          const yesterday = new Date();
          yesterday.setUTCDate(yesterday.getUTCDate() - 1);
          sealDailyRecord(getDailyDateString(yesterday)).catch(() => {});

          // Incrémenter le jackpot journalier (si pas encore fait aujourd'hui)
          const todayDate = getDailyDateString(new Date());
          incrementJackpotIfNeeded(todayDate).catch(() => {});
        }
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

  // ── Limites quotidiennes et premium → Firestore (Lot A) ───────────────────
  // Les compteurs du jour (grilles Forestier, jetons Duel, bonus, pub) et `isPremium` sont écrits dans le profil
  // dès qu'ils changent (debounce 1 s). Sans cela, se déconnecter ou changer d'appareil les remettait à neuf.
  // On n'écrit que lorsque le store appartient bien à ce compte (`userId`, posé par `restoreFromCloud`) : avant la
  // restauration cloud, on écraserait sinon le cloud avec l'état local de départ.
  useEffect(() => {
    const uid    = user?.uid;
    const isAnon = user?.isAnonymous ?? true;
    if (!uid || isAnon) return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    const flush = () => {
      const s = usePlayerStore.getState();
      if (s.userId !== uid) return; // profil d'un autre compte encore en mémoire : on n'écrit rien
      updateDailyLimits(uid, s).catch(() => {});
    };
    const unsub = usePlayerStore.subscribe((n, p) => {
      if (n.userId !== uid) return;
      const limitsChanged =
        n.onfDailyCount         !== p.onfDailyCount ||
        n.friendChallengeTokens !== p.friendChallengeTokens ||
        n.adViews               !== p.adViews ||
        n.lastBonusResetDate    !== p.lastBonusResetDate ||
        n.dailyBonusUses        !== p.dailyBonusUses;
      if (limitsChanged) {
        if (timer) clearTimeout(timer);
        timer = setTimeout(flush, 1000);
      }
      // Achat premium : écrit tout de suite (jamais en différé, c'est de l'argent)
      if (n.isPremium && !p.isPremium) updatePremium(uid, true).catch(() => {});
    });
    return () => {
      unsub();
      if (timer) clearTimeout(timer);
    };
  }, [user]);

  // ── Pastilles « Nouveau » → Firestore ────────────────────────────────────────
  // Une pastille effacée à la 1re partie d'un mode doit l'être aussi dans le cloud : `restoreFromCloud` fait l'UNION
  // local + cloud, donc une pastille encore présente dans Firestore revenait à la reconnexion / au rechargement.
  useEffect(() => {
    const uid    = user?.uid;
    const isAnon = user?.isAnonymous ?? true;
    if (!uid || isAnon) return;

    const unsub = usePlayerStore.subscribe((n, p) => {
      if (n.userId !== uid) return;
      if (n.newFeatureBadges !== p.newFeatureBadges && n.newFeatureBadges.length < p.newFeatureBadges.length) {
        updateNewFeatureBadges(uid, n.newFeatureBadges).catch(() => {});
      }
    });
    return unsub;
  }, [user]);

  // ── Statistiques → Firestore (Lot D) ─────────────────────────────────────────
  // Point d'entrée UNIQUE de la synchronisation des statistiques : Solo, Journalier, Forestier, Duel, graines, pubs,
  // jours joués. Avant ce lot, le Journalier et le Duel n'écrivaient jamais leurs stats dans `players/{uid}`. Debounce 5 s
  // (une victoire met à jour plusieurs compteurs en rafale). Même garde que les limites : le store doit appartenir à ce
  // compte (`userId`, posé par `restoreFromCloud`), sinon on écraserait le cloud avec un état local de départ.
  useEffect(() => {
    const uid    = user?.uid;
    const isAnon = user?.isAnonymous ?? true;
    if (!uid || isAnon) return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    const flush = () => {
      const s = usePlayerStore.getState();
      if (s.userId !== uid) return;
      updateStats(uid, s.stats, { countedDuelIds: s.countedDuelIds, duelWinStreak: s.duelWinStreak }).catch(() => {});
    };
    const unsub = usePlayerStore.subscribe((n, p) => {
      if (n.userId !== uid) return;
      if (n.stats !== p.stats || n.countedDuelIds !== p.countedDuelIds) {
        if (timer) clearTimeout(timer);
        timer = setTimeout(flush, 5000);
      }
    });
    return () => {
      unsub();
      // Une écriture en attente part tout de suite (changement de compte ou fermeture) : jamais perdue
      if (timer) { clearTimeout(timer); flush(); }
    };
  }, [user]);

  // ── Classement : publication unique, tous modes confondus (Lot C) ──────────
  // La position du joueur (étoiles, ⭐⭐⭐, trophées, Herbier) est republiée dès que l'un de ces éléments change : Solo,
  // Journalier, Forestier, Duel, plantation d'une carte, trophée gagné ailleurs. Avant ce lot, seule une victoire Solo
  // mettait le classement à jour. Debounce 3 s (les victoires enchaînent étoiles, trophées et cartes en rafale) ;
  // `publishLeaderboardEntry` n'écrit rien si l'entrée n'a pas changé. Même garde que ci-dessus : le store doit
  // appartenir à ce compte (`userId` posé par `restoreFromCloud`).
  useEffect(() => {
    const uid    = user?.uid;
    const isAnon = user?.isAnonymous ?? true;
    if (!uid || isAnon) return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    const publish = () => {
      const s = usePlayerStore.getState();
      if (s.userId !== uid) return;
      publishLeaderboardEntry({
        userId: uid,
        username: s.username,
        challengeStars: s.challengeStars,
        trophyCount: s.earnedBadges.length,
        levelsCompleted: s.levelsCompleted,
        herbierCount: s.collectedTreeCardIds.length,
      }).catch(() => {});
    };
    const schedule = (delay: number) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(publish, delay);
    };
    const unsub = usePlayerStore.subscribe((n, p) => {
      if (n.userId !== uid) return;
      // Arrivée du profil (restoreFromCloud pose userId) : première publication / rattrapage
      if (p.userId !== uid) { schedule(500); return; }
      if (
        n.challengeStars !== p.challengeStars ||
        n.earnedBadges.length !== p.earnedBadges.length ||
        n.levelsCompleted !== p.levelsCompleted ||
        n.collectedTreeCardIds.length !== p.collectedTreeCardIds.length ||
        n.username !== p.username
      ) schedule(3000);
    });
    // Le profil est peut-être déjà chargé quand cet effet démarre
    if (usePlayerStore.getState().userId === uid) schedule(500);
    return () => {
      unsub();
      if (timer) clearTimeout(timer);
    };
  }, [user]);

  // Déconnexion : le prochain compte relit sa propre position publiée
  useEffect(() => {
    if (user === null) resetLeaderboardCache();
  }, [user]);

  // ── Badge défis amis en attente (Firestore onSnapshot) ────────────────────
  useEffect(() => {
    // Utiliser `user` (état React stable) plutôt que auth.currentUser (peut être null au montage)
    const uid    = user?.uid;
    const isAnon = user?.isAnonymous ?? true;

    if (!uid || isAnon || !player.friendNotifBadgeEnabled) {
      setPendingFriendChallenges(0);
      return;
    }

    const q = query(
      collection(db, 'friendChallenges'),
      where('opponentUid', '==', uid),
      where('status', '==', 'pending'),
    );

    const unsub = onSnapshot(q, (snap) => {
      const now = Date.now();
      const count = snap.docs.filter(d => {
        const exp = (d.data().expiresAt as Timestamp)?.toMillis() ?? Infinity;
        return exp > now;
      }).length;
      setPendingFriendChallenges(count);
    }, () => {
      // Erreur (permissions) → pas de badge
      setPendingFriendChallenges(0);
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
        <Tabs.Screen name="rules"     options={{ title: 'Règles' }} />
        <Tabs.Screen name="challenge" options={{ title: 'Défis' }} />
        <Tabs.Screen name="profile"   options={{ title: 'Profil' }} />
      </Tabs>

      {/* ── Cadre bois + boutons navigation (superposé en absolu) ─────── */}
      <ForestFrame />
    </View>
  );
}
