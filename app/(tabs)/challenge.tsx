// ============================================================
// ÉCRAN MODE DÉFI ENTRE AMIS
//
// Flux :
//   1. Joueur A utilise un jeton → génère un défi inédit → le joue sans bonus
//   2. Joueur A partage le lien Firestore
//   3. Joueur B ouvre le lien → joue le même défi sans bonus
//   4. Résultat comparé dans l'onglet "Terminés"
//
// Jetons : 1 tous les 5 défis solo complétés, ou 15 graines
// Plateau : 10 cases (Sous-bois), éléments de base (Bucheron/Ours/Mouton/Chien)
// Bonus : interdits (conditions identiques pour les deux joueurs)
// ============================================================

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Alert,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Timestamp } from 'firebase/firestore';

import { Colors } from '../../src/constants/colors';
import { usePlayerStore } from '../../src/store/playerStore';
import { auth } from '../../src/services/firebase';
import {
  FriendChallengeDoc,
  createFriendChallenge,
  getReceivedChallenges,
  getSentChallenges,
  getCompletedChallenges,
} from '../../src/services/challengeService';
import { generateChallenge } from '../../src/core/generators/challengeGenerator';
import { BoardRegistry } from '../../src/boards/BoardRegistry';
import { ElementRegistry } from '../../src/elements/ElementRegistry';
import { formatTime } from '../../src/utils/boardUtils';

// ── Constantes du défi ami ──────────────────────────────────
const FRIEND_BOARD_ID    = 'board_10_v3';   // 10 cases — Sous-bois
const FRIEND_DIFFICULTY  = 'niveau_7';      // 10 cases, 5 vides, éléments de base
const TOKEN_SEED_COST    = 15;              // Coût en graines si plus de jetons

// ── Onglets ────────────────────────────────────────────────
type Tab = 'reçus' | 'envoyés' | 'terminés';

// ── Helpers ────────────────────────────────────────────────
function timeAgo(ts?: Timestamp): string {
  if (!ts) return '';
  const diffMs  = Date.now() - ts.toMillis();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1)  return 'à l\'instant';
  if (diffMin < 60) return `il y a ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24)   return `il y a ${diffH}h`;
  return `il y a ${Math.floor(diffH / 24)}j`;
}

function expiresIn(ts?: Timestamp): string {
  if (!ts) return '';
  const diffMs = ts.toMillis() - Date.now();
  if (diffMs <= 0) return 'expiré';
  const diffH = Math.floor(diffMs / 3600000);
  if (diffH < 1) return 'expire dans < 1h';
  return `expire dans ${diffH}h`;
}

// ── Alerte compatible web + mobile ─────────────────────────
function showAlert(title: string, message: string) {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n${message}`);
  } else {
    Alert.alert(title, message);
  }
}

// ── Composant carte défi reçu ───────────────────────────────
function ReceivedCard({
  item,
  myUid,
  onAccept,
}: {
  item: FriendChallengeDoc;
  myUid: string;
  onAccept: (item: FriendChallengeDoc) => void;
}) {
  return (
    <View style={cardStyles.card}>
      <View style={cardStyles.header}>
        <Text style={cardStyles.from}>⚔️ {item.challengerName} te défie !</Text>
        <Text style={cardStyles.time}>{timeAgo(item.createdAt)}</Text>
      </View>
      <View style={cardStyles.row}>
        <View style={cardStyles.stat}>
          <Text style={cardStyles.statLabel}>Son temps</Text>
          <Text style={cardStyles.statValue}>{formatTime(item.challengerTime)}</Text>
        </View>
        <View style={cardStyles.stat}>
          <Text style={cardStyles.statLabel}>Expire</Text>
          <Text style={cardStyles.statExpire}>{expiresIn(item.expiresAt)}</Text>
        </View>
      </View>
      <TouchableOpacity
        style={cardStyles.btnAccept}
        onPress={() => onAccept(item)}
        activeOpacity={0.8}
      >
        <Text style={cardStyles.btnAcceptText}>Relever le défi →</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Composant carte défi envoyé ─────────────────────────────
function SentCard({ item }: { item: FriendChallengeDoc }) {
  const isPending   = item.status === 'pending';
  const isExpired   = item.status === 'expired';

  const handleShare = () => {
    const link = `danslaforet://challenge/${item.id}`;
    if (Platform.OS === 'web' && navigator.clipboard) {
      navigator.clipboard.writeText(link);
      window.alert('Lien copié !\n' + link);
    } else {
      showAlert('Partager', `Envoie ce lien à ton ami :\n${link}`);
    }
  };

  return (
    <View style={cardStyles.card}>
      <View style={cardStyles.header}>
        <Text style={cardStyles.from}>📤 Défi envoyé</Text>
        <Text style={cardStyles.time}>{timeAgo(item.createdAt)}</Text>
      </View>
      <View style={cardStyles.row}>
        <View style={cardStyles.stat}>
          <Text style={cardStyles.statLabel}>Ton temps</Text>
          <Text style={cardStyles.statValue}>{formatTime(item.challengerTime)}</Text>
        </View>
        <View style={cardStyles.stat}>
          <Text style={cardStyles.statLabel}>Statut</Text>
          <Text style={[
            cardStyles.statValue,
            isExpired && { color: '#F44336' },
          ]}>
            {isPending ? '⏳ En attente' : isExpired ? '💨 Expiré' : '✅ Répondu'}
          </Text>
        </View>
      </View>
      {isPending && (
        <TouchableOpacity
          style={cardStyles.btnShare}
          onPress={handleShare}
          activeOpacity={0.8}
        >
          <Text style={cardStyles.btnShareText}>📋 Copier le lien</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── Composant carte défi terminé ────────────────────────────
function CompletedCard({ item, myUid }: { item: FriendChallengeDoc; myUid: string }) {
  const iWon       = item.winnerId === myUid;
  const iChallenger = item.challengerUid === myUid;
  const myTime     = iChallenger ? item.challengerTime : (item.opponentTime ?? 0);
  const theirTime  = iChallenger ? (item.opponentTime ?? 0) : item.challengerTime;
  const theirName  = iChallenger ? (item.opponentName ?? '?') : item.challengerName;

  return (
    <View style={[cardStyles.card, iWon ? cardStyles.cardWon : cardStyles.cardLost]}>
      <View style={cardStyles.header}>
        <Text style={cardStyles.from}>
          {iWon ? '🏆 Victoire !' : '😤 Défaite'}
        </Text>
        <Text style={cardStyles.time}>{timeAgo(item.updatedAt)}</Text>
      </View>
      <View style={cardStyles.row}>
        <View style={cardStyles.stat}>
          <Text style={cardStyles.statLabel}>Ton temps</Text>
          <Text style={[cardStyles.statValue, iWon && { color: Colors.forest.medium }]}>
            {formatTime(myTime)}
          </Text>
        </View>
        <View style={cardStyles.stat}>
          <Text style={cardStyles.statLabel}>{theirName}</Text>
          <Text style={[cardStyles.statValue, !iWon && { color: Colors.forest.medium }]}>
            {formatTime(theirTime)}
          </Text>
        </View>
      </View>
    </View>
  );
}

// ── Écran principal ─────────────────────────────────────────
export default function ChallengeScreen() {
  const router  = useRouter();
  const player  = usePlayerStore();
  const uid     = auth.currentUser?.uid ?? null;
  const isAnon  = auth.currentUser?.isAnonymous ?? true;

  const [activeTab, setActiveTab]       = useState<Tab>('reçus');
  const [received, setReceived]         = useState<FriendChallengeDoc[]>([]);
  const [sent, setSent]                 = useState<FriendChallengeDoc[]>([]);
  const [completed, setCompleted]       = useState<FriendChallengeDoc[]>([]);
  const [loading, setLoading]           = useState(false);
  const [refreshing, setRefreshing]     = useState(false);
  const [generating, setGenerating]     = useState(false);

  // ── Chargement des défis ──────────────────────────────────
  const loadChallenges = useCallback(async (silent = false) => {
    if (!uid || isAnon) return;
    if (!silent) setLoading(true);
    try {
      const [r, s, c] = await Promise.all([
        getReceivedChallenges(uid),
        getSentChallenges(uid),
        getCompletedChallenges(uid),
      ]);
      setReceived(r);
      setSent(s.filter(x => x.status !== 'completed'));
      setCompleted(c);
    } catch (e) {
      // Silencieux
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [uid, isAnon]);

  useEffect(() => { loadChallenges(); }, [loadChallenges]);

  const onRefresh = () => {
    setRefreshing(true);
    loadChallenges(true);
  };

  // ── Lancer un défi (Joueur A) ─────────────────────────────
  const handleLaunchChallenge = async () => {
    if (!uid || isAnon) {
      showAlert('Connexion requise', 'Connecte-toi pour défier un ami.');
      return;
    }

    // Vérifier les jetons
    const hasToken = player.friendChallengeTokens > 0;
    const hasSeeds = player.seeds >= TOKEN_SEED_COST;

    if (!hasToken && !hasSeeds) {
      showAlert(
        'Pas de jeton',
        `Il te faut un jeton défi ami (1 tous les 5 défis solo) ou ${TOKEN_SEED_COST} graines.`,
      );
      return;
    }

    // Si pas de jeton mais des graines → proposer l'achat
    if (!hasToken && hasSeeds) {
      const msg = `Tu n'as plus de jeton défi ami.\nDépenser ${TOKEN_SEED_COST} graines pour en obtenir un ?`;
      const confirmed = Platform.OS === 'web'
        ? window.confirm(msg)
        : await new Promise<boolean>(resolve =>
            Alert.alert('Acheter un jeton', msg, [
              { text: 'Annuler', onPress: () => resolve(false), style: 'cancel' },
              { text: 'Dépenser', onPress: () => resolve(true) },
            ])
          );
      if (!confirmed) return;
      player.spendSeeds(TOKEN_SEED_COST);
    } else {
      player.spendFriendChallengeToken();
    }

    // Générer le défi
    setGenerating(true);
    try {
      const boardDef    = BoardRegistry[FRIEND_BOARD_ID];
      const elementDefs = ElementRegistry;

      const challenge = generateChallenge({
        boardId:     FRIEND_BOARD_ID,
        boardDef,
        elementDefs,
        difficulty:  FRIEND_DIFFICULTY as any,
      });

      if (!challenge) {
        showAlert('Erreur', 'Impossible de générer un défi. Réessaie.');
        // Rembourser le jeton
        player.addFriendChallengeToken();
        return;
      }

      // Stocker le défi dans Firestore + naviguer vers l'écran de jeu en mode défi
      // On passe les données via les params de navigation (encodées en JSON)
      const challengeDataStr = encodeURIComponent(JSON.stringify({
        boardId:         challenge.boardId,
        fixedPlacements: challenge.fixedPlacements,
        availableTokens: challenge.availableTokens,
        solution:        challenge.solution,
      }));

      router.push(
        `/game/friend-challenge?data=${challengeDataStr}&challengerUid=${uid}&challengerName=${encodeURIComponent(player.username)}`,
      );
    } catch (e) {
      showAlert('Erreur', 'Une erreur est survenue. Réessaie.');
      player.addFriendChallengeToken();
    } finally {
      setGenerating(false);
    }
  };

  // ── Accepter un défi (Joueur B) ───────────────────────────
  const handleAcceptChallenge = (item: FriendChallengeDoc) => {
    if (!uid) return;
    const challengeDataStr = encodeURIComponent(JSON.stringify(item.challengeData));
    router.push(
      `/game/friend-challenge?data=${challengeDataStr}&friendChallengeId=${item.id}&challengerTime=${item.challengerTime}&opponentUid=${uid}&opponentName=${encodeURIComponent(player.username)}`,
    );
  };

  // ── Rendu : non connecté ──────────────────────────────────
  if (!uid || isAnon) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.centered}>
          <Text style={styles.emptyEmoji}>🔒</Text>
          <Text style={styles.emptyTitle}>Connexion requise</Text>
          <Text style={styles.emptyDesc}>
            Connecte-toi pour défier tes amis et comparer vos temps.
          </Text>
          <TouchableOpacity
            style={styles.btnPrimary}
            onPress={() => router.push('/(tabs)/profile')}
            activeOpacity={0.8}
          >
            <Text style={styles.btnPrimaryText}>Se connecter</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Rendu principal ───────────────────────────────────────
  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'reçus',    label: 'Reçus',    count: received.length  },
    { key: 'envoyés',  label: 'Envoyés',  count: sent.length      },
    { key: 'terminés', label: 'Terminés', count: completed.length },
  ];

  return (
    <SafeAreaView style={styles.root}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>⚔️ Défis entre amis</Text>
        {/* Jetons */}
        <View style={styles.tokenBadge}>
          <Text style={styles.tokenText}>🎟️ {player.friendChallengeTokens}</Text>
        </View>
      </View>

      {/* ── Bouton Lancer un défi ── */}
      <View style={styles.launchSection}>
        <TouchableOpacity
          style={[styles.btnLaunch, generating && styles.btnDisabled]}
          onPress={handleLaunchChallenge}
          disabled={generating}
          activeOpacity={0.85}
        >
          {generating
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnLaunchText}>🎯 Lancer un défi ami</Text>
          }
        </TouchableOpacity>
        <Text style={styles.launchHint}>
          {player.friendChallengeTokens > 0
            ? `${player.friendChallengeTokens} jeton${player.friendChallengeTokens > 1 ? 's' : ''} disponible${player.friendChallengeTokens > 1 ? 's' : ''} · 1 tous les 5 défis solo`
            : `Plus de jeton · Dépenser ${TOKEN_SEED_COST} 🌱 ou compléter 5 défis solo`
          }
        </Text>
      </View>

      {/* ── Onglets ── */}
      <View style={styles.tabBar}>
        {tabs.map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
              {tab.label}
              {(tab.count ?? 0) > 0 ? ` (${tab.count})` : ''}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Contenu ── */}
      {loading
        ? <View style={styles.centered}>
            <ActivityIndicator size="large" color={Colors.forest.medium} />
          </View>
        : <ScrollView
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={Colors.forest.medium}
              />
            }
          >
            {/* ── Onglet Reçus ── */}
            {activeTab === 'reçus' && (
              received.length === 0
                ? <EmptyState
                    emoji="📭"
                    title="Aucun défi reçu"
                    desc="Quand un ami te défie, son défi apparaît ici."
                  />
                : received.map(item => (
                    <ReceivedCard
                      key={item.id}
                      item={item}
                      myUid={uid}
                      onAccept={handleAcceptChallenge}
                    />
                  ))
            )}

            {/* ── Onglet Envoyés ── */}
            {activeTab === 'envoyés' && (
              sent.length === 0
                ? <EmptyState
                    emoji="📤"
                    title="Aucun défi envoyé"
                    desc="Lance un défi et partage le lien à un ami."
                  />
                : sent.map(item => (
                    <SentCard key={item.id} item={item} />
                  ))
            )}

            {/* ── Onglet Terminés ── */}
            {activeTab === 'terminés' && (
              completed.length === 0
                ? <EmptyState
                    emoji="🏁"
                    title="Aucun défi terminé"
                    desc="Tes résultats contre tes amis apparaîtront ici."
                  />
                : completed.map(item => (
                    <CompletedCard key={item.id} item={item} myUid={uid} />
                  ))
            )}
          </ScrollView>
      }
    </SafeAreaView>
  );
}

// ── Composant état vide ─────────────────────────────────────
function EmptyState({ emoji, title, desc }: { emoji: string; title: string; desc: string }) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyEmoji}>{emoji}</Text>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyDesc}>{desc}</Text>
    </View>
  );
}

// ── Styles cartes ───────────────────────────────────────────
const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.ui.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.ui.border,
    gap: 12,
  },
  cardWon: {
    borderColor: Colors.forest.medium + '80',
    backgroundColor: Colors.forest.medium + '08',
  },
  cardLost: {
    borderColor: Colors.ui.border,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  from: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.forest.dark,
    flex: 1,
  },
  time: {
    fontSize: 11,
    color: Colors.ui.textLight,
  },
  row: {
    flexDirection: 'row',
    gap: 16,
  },
  stat: {
    flex: 1,
    gap: 2,
  },
  statLabel: {
    fontSize: 11,
    color: Colors.ui.textLight,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.forest.dark,
  },
  statExpire: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.ui.textLight,
  },
  btnAccept: {
    backgroundColor: Colors.forest.medium,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  btnAcceptText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  btnShare: {
    backgroundColor: Colors.ui.background,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.ui.border,
  },
  btnShareText: {
    color: Colors.forest.dark,
    fontSize: 14,
    fontWeight: '600',
  },
});

// ── Styles écran ────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.ui.background,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: Colors.ui.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.ui.border,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.forest.dark,
  },
  tokenBadge: {
    backgroundColor: Colors.ui.seed + '25',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: Colors.ui.seed + '80',
  },
  tokenText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.forest.dark,
  },

  // Bouton lancer
  launchSection: {
    padding: 16,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.ui.border,
  },
  btnLaunch: {
    backgroundColor: Colors.forest.dark,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  btnDisabled: {
    opacity: 0.5,
  },
  btnLaunchText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  launchHint: {
    fontSize: 12,
    color: Colors.ui.textLight,
    textAlign: 'center',
  },

  // Onglets
  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.ui.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.ui.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: Colors.forest.medium,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.ui.textLight,
  },
  tabTextActive: {
    color: Colors.forest.medium,
  },

  // Liste
  list: {
    padding: 16,
    gap: 12,
    paddingBottom: 40,
  },

  // États vides + connexion
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 10,
  },
  emptyEmoji: {
    fontSize: 48,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.forest.dark,
  },
  emptyDesc: {
    fontSize: 13,
    color: Colors.ui.textLight,
    textAlign: 'center',
    lineHeight: 18,
  },
  btnPrimary: {
    backgroundColor: Colors.forest.medium,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  btnPrimaryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
