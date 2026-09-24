// ============================================================
// ÉCRAN MODE DÉFI ENTRE AMIS
//
// Nouveau flux :
//   1. Joueur A cherche un ami par pseudo (avec son niveau affiché)
//   2. Joueur A sélectionne un ami → défi généré au niveau min(A, B)
//   3. Joueur A joue sans bonus → au résultat : "Envoyer" ou "Quitter"
//   4. Joueur B reçoit le défi → peut "Refuser" ou "Relever le défi"
//   5. Le vainqueur gagne 15 graines
//
// Expiration : 1 semaine
// Jetons : 1 tous les 5 défis solo, ou 15 graines
// ============================================================

import React, { useCallback, useEffect, useRef, useState } from 'react';
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
  Modal,
  TextInput,
  KeyboardAvoidingView,
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
  refuseFriendChallenge,
  CHALLENGE_WINNER_SEEDS,
} from '../../src/services/challengeService';
import { searchPlayers, PlayerSearchResult } from '../../src/services/playerService';
import { generateChallenge } from '../../src/core/generators/challengeGenerator';
import { BoardRegistry } from '../../src/boards/BoardRegistry';
import { ElementRegistry } from '../../src/elements/ElementRegistry';
import { LEVEL_PARAMS } from '../../src/constants/difficulty';
import { formatTime } from '../../src/utils/boardUtils';

// ── Constantes ──────────────────────────────────────────────
const TOKEN_SEED_COST = 15;

// ── Correspondance niveau → difficulty + boardId ──────────
// On mappe directement le numéro de niveau sur les LEVEL_PARAMS existants.
function getLevelKey(level: number): string {
  const clamped = Math.min(15, Math.max(1, level));
  return `niveau_${clamped}`;
}

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
  const diffD = Math.floor(diffH / 24);
  if (diffH < 1)  return 'expire dans < 1h';
  if (diffD < 1)  return `expire dans ${diffH}h`;
  return `expire dans ${diffD}j`;
}

function showAlert(title: string, message: string) {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n${message}`);
  } else {
    Alert.alert(title, message);
  }
}

// ── Modal recherche d'ami (avant de jouer) ─────────────────
function FriendSearchModal({
  visible,
  myUid,
  myLevel,
  onSelectFriend,
  onClose,
}: {
  visible: boolean;
  myUid: string;
  myLevel: number;
  onSelectFriend: (friend: PlayerSearchResult) => void;
  onClose: () => void;
}) {
  const [query, setQuery]         = useState('');
  const [results, setResults]     = useState<PlayerSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const debounce                  = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Réinitialiser à l'ouverture
  useEffect(() => {
    if (visible) {
      setQuery('');
      setResults([]);
    }
  }, [visible]);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    if (query.length < 2) { setResults([]); setSearching(false); return; }
    setSearching(true);
    debounce.current = setTimeout(async () => {
      try { setResults(await searchPlayers(query, myUid)); }
      catch { setResults([]); }
      finally { setSearching(false); }
    }, 400);
  }, [query, myUid]);

  return (
    <Modal visible={visible} transparent animationType="slide">
      <KeyboardAvoidingView
        style={ms.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={ms.card}>
          <Text style={ms.title}>⚔️ Défier un ami</Text>
          <Text style={ms.subtitle}>
            Ton niveau : <Text style={ms.levelBadge}>Niv. {myLevel}</Text>
          </Text>
          <Text style={ms.hint}>
            Le défi sera au niveau le plus bas entre vous deux (minimum niveau 3, les niveaux 1-2 ne sont pas disponibles en mode défi).
          </Text>

          <TextInput
            style={ms.input}
            placeholder="Chercher par pseudo…"
            placeholderTextColor={Colors.ui.textLight}
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
          />

          {searching && (
            <ActivityIndicator size="small" color={Colors.forest.medium} style={{ marginTop: 8 }} />
          )}

          {results.length > 0 && (
            <View style={ms.list}>
              {results.map(p => {
                const challengeLevel = Math.max(3, Math.min(myLevel, p.level));
                return (
                  <TouchableOpacity
                    key={p.userId}
                    style={ms.row}
                    onPress={() => onSelectFriend(p)}
                    activeOpacity={0.7}
                  >
                    <View style={ms.rowLeft}>
                      <Text style={ms.username}>{p.username}</Text>
                      <Text style={ms.levelText}>(Niveau {p.level})</Text>
                    </View>
                    <View style={ms.rowRight}>
                      <Text style={ms.challengeLevelLabel}>Défi</Text>
                      <Text style={ms.challengeLevel}>Niv. {challengeLevel}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {query.length >= 2 && !searching && results.length === 0 && (
            <Text style={ms.noResult}>Aucun joueur trouvé pour « {query} »</Text>
          )}

          <TouchableOpacity style={ms.btnCancel} onPress={onClose} activeOpacity={0.8}>
            <Text style={ms.btnCancelText}>Annuler</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Composant carte défi reçu ───────────────────────────────
function ReceivedCard({
  item,
  onAccept,
  onRefuse,
}: {
  item: FriendChallengeDoc;
  onAccept: (item: FriendChallengeDoc) => void;
  onRefuse: (item: FriendChallengeDoc) => void;
}) {
  const level = item.challengeData?.level ?? '?';
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
          <Text style={cardStyles.statLabel}>Niveau du défi</Text>
          <Text style={cardStyles.statValue}>Niv. {level}</Text>
        </View>
        <View style={cardStyles.stat}>
          <Text style={cardStyles.statLabel}>Expire</Text>
          <Text style={cardStyles.statExpire}>{expiresIn(item.expiresAt)}</Text>
        </View>
      </View>
      <View style={cardStyles.btnRow}>
        <TouchableOpacity
          style={cardStyles.btnRefuse}
          onPress={() => onRefuse(item)}
          activeOpacity={0.8}
        >
          <Text style={cardStyles.btnRefuseText}>Refuser</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={cardStyles.btnAccept}
          onPress={() => onAccept(item)}
          activeOpacity={0.8}
        >
          <Text style={cardStyles.btnAcceptText}>Relever le défi →</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Composant carte défi envoyé ─────────────────────────────
function SentCard({ item }: { item: FriendChallengeDoc }) {
  const isPending = item.status === 'pending';
  const isExpired = item.status === 'expired';
  const isRefused = item.status === 'refused';
  const level     = item.challengeData?.level ?? '?';

  return (
    <View style={cardStyles.card}>
      <View style={cardStyles.header}>
        <Text style={cardStyles.from}>📤 Défi envoyé à {item.opponentName}</Text>
        <Text style={cardStyles.time}>{timeAgo(item.createdAt)}</Text>
      </View>
      <View style={cardStyles.row}>
        <View style={cardStyles.stat}>
          <Text style={cardStyles.statLabel}>Ton temps</Text>
          <Text style={cardStyles.statValue}>{formatTime(item.challengerTime)}</Text>
        </View>
        <View style={cardStyles.stat}>
          <Text style={cardStyles.statLabel}>Niveau</Text>
          <Text style={cardStyles.statValue}>Niv. {level}</Text>
        </View>
        <View style={cardStyles.stat}>
          <Text style={cardStyles.statLabel}>Statut</Text>
          <Text style={[
            cardStyles.statValue,
            (isExpired || isRefused) && { color: '#F44336', fontSize: 13 },
          ]}>
            {isPending ? '⏳ En attente' : isExpired ? '💨 Expiré' : isRefused ? '❌ Refusé' : '✅ Répondu'}
          </Text>
        </View>
      </View>
    </View>
  );
}

// ── Composant carte défi terminé ────────────────────────────
function CompletedCard({ item, myUid }: { item: FriendChallengeDoc; myUid: string }) {
  const iWon        = item.winnerId === myUid;
  const iChallenger = item.challengerUid === myUid;
  const myTime      = iChallenger ? item.challengerTime : (item.opponentTime ?? 0);
  const theirTime   = iChallenger ? (item.opponentTime ?? 0) : item.challengerTime;
  const theirName   = iChallenger ? item.opponentName : item.challengerName;
  const level       = item.challengeData?.level ?? '?';

  return (
    <View style={[cardStyles.card, iWon ? cardStyles.cardWon : cardStyles.cardLost]}>
      <View style={cardStyles.header}>
        <Text style={cardStyles.from}>
          {iWon ? `🏆 Victoire ! (+${CHALLENGE_WINNER_SEEDS} 🌱)` : '😤 Défaite'}
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
        <View style={cardStyles.stat}>
          <Text style={cardStyles.statLabel}>Niveau</Text>
          <Text style={cardStyles.statValue}>Niv. {level}</Text>
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

  const [activeTab, setActiveTab]         = useState<Tab>('reçus');
  const [received, setReceived]           = useState<FriendChallengeDoc[]>([]);
  const [sent, setSent]                   = useState<FriendChallengeDoc[]>([]);
  const [completed, setCompleted]         = useState<FriendChallengeDoc[]>([]);
  const [loading, setLoading]             = useState(false);
  const [refreshing, setRefreshing]       = useState(false);
  const [generating, setGenerating]       = useState(false);
  const [showSearch, setShowSearch]       = useState(false);

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
    } catch {
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

  // ── Vérifier jetons (avant d'ouvrir la recherche) ─────────
  const handleOpenSearch = async () => {
    if (!uid || isAnon) {
      showAlert('Connexion requise', 'Connecte-toi pour défier un ami.');
      return;
    }

    const hasToken = player.friendChallengeTokens > 0;
    const hasSeeds = player.seeds >= TOKEN_SEED_COST;

    if (!hasToken && !hasSeeds) {
      showAlert(
        'Pas de jeton',
        `Il te faut un jeton défi ami (1 tous les 5 défis solo) ou ${TOKEN_SEED_COST} graines.`,
      );
      return;
    }

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

    setShowSearch(true);
  };

  // ── Sélection d'un ami → génération + navigation ──────────
  const handleSelectFriend = async (friend: PlayerSearchResult) => {
    setShowSearch(false);

    const myLevel        = player.currentLevel;
    // Niveau minimum 3 pour les défis amis : niveaux 1-2 (6-7 cases)
    // ont trop peu de compositions valides après filtrage pédagogique.
    const CHALLENGE_MIN_LEVEL = 3;
    const baseLevel      = Math.max(CHALLENGE_MIN_LEVEL, Math.min(myLevel, friend.level));
    const elementDefs    = ElementRegistry;

    setGenerating(true);

    // Déléguer la génération (CPU-intensive) pour laisser le UI se rendre d'abord
    await new Promise<void>(resolve => setTimeout(resolve, 50));

    try {
      // Tenter la génération en partant du niveau cible, puis en montant
      // si le générateur échoue (certains niveaux ont peu de compositions valides).
      let challenge = null;
      let usedLevel = baseLevel;

      console.log('[Défi] Génération — monNiveau:', myLevel, 'amiNiveau:', friend.level, 'baseLevel:', baseLevel);

      // Boucle montante puis descendante : on tente d'abord baseLevel..15,
      // puis 3..baseLevel-1 si tout a échoué (niveaux inférieurs plus fiables).
      const levelRange = [
        ...Array.from({ length: 16 - baseLevel }, (_, i) => baseLevel + i),
        ...Array.from({ length: Math.max(0, baseLevel - CHALLENGE_MIN_LEVEL) }, (_, i) => baseLevel - 1 - i),
      ];
      for (const lvl of levelRange) {
        const levelKey = getLevelKey(lvl);
        const p        = LEVEL_PARAMS[levelKey as keyof typeof LEVEL_PARAMS];
        if (!p) { console.log('[Défi] Niveau', lvl, '→ params introuvables'); continue; }
        const bd = BoardRegistry[p.boardId];
        if (!bd) { console.log('[Défi] Niveau', lvl, '→ boardDef introuvable pour', p.boardId); continue; }
        console.log('[Défi] Tentative niveau', lvl, '— boardId:', p.boardId);
        try {
          challenge = generateChallenge({ boardId: p.boardId, boardDef: bd, elementDefs, difficulty: levelKey as any });
        } catch (genErr) {
          console.error('[Défi] Exception dans generateChallenge niveau', lvl, ':', genErr);
        }
        if (challenge) {
          usedLevel = lvl;
          console.log('[Défi] Succès au niveau', lvl);
          break;
        }
        console.log('[Défi] Échec au niveau', lvl, '→ essai niveau suivant');
      }

      const challengeLevel = usedLevel ?? baseLevel;

      // Fallback ultime : descendre vers les niveaux 3-7 (board_8_v2 / board_9_v1)
      // qui ont une topologie sans feuilles et génèrent de manière fiable.
      if (!challenge) {
        const fallbackLevels = [7, 6, 5, 4, 3];
        for (const fbLvl of fallbackLevels) {
          const fbKey = getLevelKey(fbLvl);
          const fbP   = LEVEL_PARAMS[fbKey as keyof typeof LEVEL_PARAMS];
          if (!fbP) continue;
          const fbBd  = BoardRegistry[fbP.boardId];
          if (!fbBd)  continue;
          console.warn('[Défi] Fallback niveau', fbLvl, '/', fbP.boardId);
          try {
            challenge = generateChallenge({ boardId: fbP.boardId, boardDef: fbBd, elementDefs, difficulty: fbKey as any });
            if (challenge) { usedLevel = fbLvl; break; }
          } catch (fbErr) {
            console.error('[Défi] Fallback niveau', fbLvl, 'échoué:', fbErr);
          }
        }
      }

      if (!challenge) {
        console.error('[Défi] Impossible de générer un défi — tous les niveaux ont échoué');
        showAlert('Erreur', 'Impossible de générer un défi. Réessaie.');
        player.addFriendChallengeToken();
        return;
      }

      console.log('[Défi] Défi généré :', { challengeLevel, boardId: challenge.boardId, fixedCount: challenge.fixedPlacements.length });

      // Encoder les données du défi + infos ami pour la navigation
      const challengeDataStr = encodeURIComponent(JSON.stringify({
        boardId:         challenge.boardId,
        fixedPlacements: challenge.fixedPlacements,
        availableTokens: challenge.availableTokens,
        solution:        challenge.solution,
        level:           challengeLevel,
      }));

      const friendStr = encodeURIComponent(JSON.stringify({
        userId:   friend.userId,
        username: friend.username,
        level:    friend.level,
      }));

      router.push(
        `/game/friend-challenge?data=${challengeDataStr}&challengerUid=${uid}&challengerName=${encodeURIComponent(player.username)}&challengerLevel=${myLevel}&friendData=${friendStr}`,
      );
    } catch (err) {
      console.error('[Défi] Exception inattendue:', err);
      showAlert('Erreur', `Erreur inattendue : ${err instanceof Error ? err.message : String(err)}`);
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
      `/game/friend-challenge?data=${challengeDataStr}&friendChallengeId=${item.id}&challengerUid=${item.challengerUid}&challengerTime=${item.challengerTime}&opponentUid=${uid}&opponentName=${encodeURIComponent(player.username)}&opponentLevel=${player.currentLevel}`,
    );
  };

  // ── Refuser un défi (Joueur B) ────────────────────────────
  const handleRefuseChallenge = (item: FriendChallengeDoc) => {
    const doRefuse = async () => {
      try {
        await refuseFriendChallenge(item.id!);
        setReceived(prev => prev.filter(d => d.id !== item.id));
      } catch {
        showAlert('Erreur', 'Impossible de refuser le défi. Réessaie.');
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(`Refuser le défi de ${item.challengerName} ?`)) doRefuse();
    } else {
      Alert.alert(
        'Refuser le défi',
        `Refuser le défi de ${item.challengerName} ?`,
        [
          { text: 'Annuler', style: 'cancel' },
          { text: 'Refuser', style: 'destructive', onPress: doRefuse },
        ],
      );
    }
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
        <View>
          <Text style={styles.headerTitle}>⚔️ Défis entre amis</Text>
          <Text style={styles.headerLevel}>Ton niveau : {player.currentLevel}</Text>
        </View>
        <View style={styles.tokenBadge}>
          <Text style={styles.tokenText}>🎟️ {player.friendChallengeTokens}</Text>
        </View>
      </View>

      {/* ── Bouton Défier un ami ── */}
      <View style={styles.launchSection}>
        <TouchableOpacity
          style={[styles.btnLaunch, generating && styles.btnDisabled]}
          onPress={handleOpenSearch}
          disabled={generating}
          activeOpacity={0.85}
        >
          {generating
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnLaunchText}>🔍 Défier un ami</Text>
          }
        </TouchableOpacity>
        <Text style={styles.launchHint}>
          {player.friendChallengeTokens > 0
            ? `${player.friendChallengeTokens} jeton${player.friendChallengeTokens > 1 ? 's' : ''} · 1 tous les 5 défis solo · Vainqueur : +${CHALLENGE_WINNER_SEEDS} 🌱`
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
                      onAccept={handleAcceptChallenge}
                      onRefuse={handleRefuseChallenge}
                    />
                  ))
            )}

            {/* ── Onglet Envoyés ── */}
            {activeTab === 'envoyés' && (
              sent.length === 0
                ? <EmptyState
                    emoji="📤"
                    title="Aucun défi envoyé"
                    desc="Défie un ami pour que ton défi apparaisse ici."
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

      {/* ── Modal recherche d'ami ── */}
      <FriendSearchModal
        visible={showSearch}
        myUid={uid}
        myLevel={player.currentLevel}
        onSelectFriend={handleSelectFriend}
        onClose={() => {
          setShowSearch(false);
          // Rembourser le jeton si on ferme sans choisir
          player.addFriendChallengeToken();
        }}
      />
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

// ── Styles modal recherche ──────────────────────────────────
const ms = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-start',
  },
  card: {
    backgroundColor: Colors.ui.card,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    padding: 24,
    paddingTop: 52,
    gap: 14,
    maxHeight: '75%',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.forest.dark,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: Colors.ui.textLight,
    textAlign: 'center',
  },
  levelBadge: {
    color: Colors.forest.medium,
    fontWeight: '700',
  },
  hint: {
    fontSize: 12,
    color: Colors.ui.textLight,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  input: {
    backgroundColor: Colors.ui.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.ui.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.ui.text,
  },
  list: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.ui.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: Colors.ui.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.ui.border,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  username: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.forest.dark,
  },
  levelText: {
    fontSize: 12,
    color: Colors.ui.textLight,
  },
  rowRight: {
    alignItems: 'center',
    minWidth: 60,
  },
  challengeLevelLabel: {
    fontSize: 10,
    color: Colors.ui.textLight,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  challengeLevel: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.forest.medium,
  },
  noResult: {
    fontSize: 13,
    color: Colors.ui.textLight,
    textAlign: 'center',
    paddingVertical: 8,
  },
  btnCancel: {
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  btnCancelText: {
    fontSize: 14,
    color: Colors.ui.textLight,
    fontWeight: '600',
  },
});

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
    gap: 12,
  },
  stat: {
    flex: 1,
    gap: 2,
  },
  statLabel: {
    fontSize: 10,
    color: Colors.ui.textLight,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.forest.dark,
  },
  statExpire: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.ui.textLight,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  btnAccept: {
    flex: 2,
    backgroundColor: Colors.forest.medium,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  btnAcceptText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  btnRefuse: {
    flex: 1,
    backgroundColor: Colors.ui.background,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F44336' + '60',
  },
  btnRefuseText: {
    color: '#F44336',
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
  headerLevel: {
    fontSize: 12,
    color: Colors.ui.textLight,
    marginTop: 2,
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
  list: {
    padding: 16,
    gap: 12,
    paddingBottom: 40,
  },
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
