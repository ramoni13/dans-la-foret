// ============================================================
// ADMIN CLEAN MODAL — Nettoyage de la base joueurs
// Réservé à Ramoni. Accessible depuis Réglages > Nettoyer la base.
// ============================================================

import React, { useState, useCallback, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  Platform,
  Alert,
  Animated,
} from 'react-native';
import { Colors } from '../../constants/colors';
import {
  getAllPlayers,
  resetPlayer,
  deletePlayer,
  AdminPlayerSummary,
} from '../../services/adminService';

// ── Types internes ─────────────────────────────────────────────────────────────
type ConfirmAction = 'reset' | 'delete' | null;

interface ConfirmState {
  action: ConfirmAction;
  player: AdminPlayerSummary | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');

// ── Sous-composant : carte joueur ─────────────────────────────────────────────
function PlayerCard({
  player,
  onReset,
  onDelete,
}: {
  player: AdminPlayerSummary;
  onReset: (p: AdminPlayerSummary) => void;
  onDelete: (p: AdminPlayerSummary) => void;
}) {
  return (
    <View style={cardStyles.card}>
      <View style={cardStyles.info}>
        <Text style={cardStyles.username}>{player.username}</Text>
        <Text style={cardStyles.meta}>
          {player.completedCount} défis · {player.earnedBadgesCount} badges · {player.seeds} graines
        </Text>
      </View>
      <View style={cardStyles.actions}>
        <TouchableOpacity
          style={[cardStyles.btn, cardStyles.btnReset]}
          onPress={() => onReset(player)}
          activeOpacity={0.75}
        >
          <Text style={cardStyles.btnResetText}>Réinitialiser</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[cardStyles.btn, cardStyles.btnDelete]}
          onPress={() => onDelete(player)}
          activeOpacity={0.75}
        >
          <Text style={cardStyles.btnDeleteText}>Supprimer</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Sous-composant : modale de confirmation ───────────────────────────────────
function ConfirmModal({
  state,
  loading,
  onConfirm,
  onCancel,
}: {
  state: ConfirmState;
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const native = Platform.OS !== 'web';
  const scaleAnim = useRef(new Animated.Value(0.88)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (state.action) {
      scaleAnim.setValue(0.88);
      opacityAnim.setValue(0);
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, damping: 14, stiffness: 220, useNativeDriver: native }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 150, useNativeDriver: native }),
      ]).start();
    }
  }, [state.action]);

  if (!state.action || !state.player) return null;

  const isDelete = state.action === 'delete';
  const title = isDelete
    ? `Supprimer ${state.player.username} ?`
    : `Réinitialiser ${state.player.username} ?`;
  const body = isDelete
    ? `Toutes les données de ${state.player.username} seront définitivement effacées de Firestore. Le compte Auth reste intact.`
    : `La progression, graines, badges et stats de ${state.player.username} seront remis à zéro. Le nom et le compte Auth sont conservés.`;

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={onCancel}>
      <Animated.View style={[confirmStyles.backdrop, { opacity: opacityAnim }]}>
        <Animated.View style={[confirmStyles.card, { transform: [{ scale: scaleAnim }] }]}>
          <Text style={confirmStyles.emoji}>{isDelete ? '🗑️' : '♻️'}</Text>
          <Text style={confirmStyles.title}>{title}</Text>
          <Text style={confirmStyles.body}>{body}</Text>
          <View style={confirmStyles.btnRow}>
            <TouchableOpacity
              style={confirmStyles.btnCancel}
              onPress={onCancel}
              disabled={loading}
              activeOpacity={0.8}
            >
              <Text style={confirmStyles.btnCancelText}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[confirmStyles.btnAction, isDelete ? confirmStyles.btnActionDelete : confirmStyles.btnActionReset]}
              onPress={onConfirm}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={confirmStyles.btnActionText}>
                  {isDelete ? 'Supprimer' : 'Réinitialiser'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

// ── Composant principal ───────────────────────────────────────────────────────
interface AdminCleanModalProps {
  visible: boolean;
  onClose: () => void;
}

export function AdminCleanModal({ visible, onClose }: AdminCleanModalProps) {
  const [players, setPlayers] = useState<AdminPlayerSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState>({ action: null, player: null });
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // ── Chargement de la liste ─────────────────────────────────────────────────
  const loadPlayers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await getAllPlayers();
      setPlayers(list);
    } catch (e: any) {
      setError('Impossible de charger la liste des joueurs.');
      console.warn('[AdminClean] getAllPlayers error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (visible) {
      setSearch('');
      setSuccessMsg(null);
      setError(null);
      loadPlayers();
    }
  }, [visible]);

  // ── Filtrage par recherche ─────────────────────────────────────────────────
  const filtered = search.trim().length === 0
    ? players
    : players.filter((p) =>
        normalize(p.username).includes(normalize(search.trim()))
      );

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleReset = (p: AdminPlayerSummary) => {
    setConfirm({ action: 'reset', player: p });
  };

  const handleDelete = (p: AdminPlayerSummary) => {
    setConfirm({ action: 'delete', player: p });
  };

  const handleConfirm = async () => {
    if (!confirm.action || !confirm.player) return;
    setActionLoading(true);
    try {
      if (confirm.action === 'reset') {
        await resetPlayer(confirm.player.userId, confirm.player.username);
        setSuccessMsg(`${confirm.player.username} a été réinitialisé.`);
        // Met à jour localement la liste (graines/stats/badges à 0)
        setPlayers((prev) =>
          prev.map((p) =>
            p.userId === confirm.player!.userId
              ? { ...p, seeds: 0, completedCount: 0, earnedBadgesCount: 0 }
              : p
          )
        );
      } else {
        await deletePlayer(confirm.player.userId);
        setSuccessMsg(`${confirm.player.username} a été supprimé.`);
        setPlayers((prev) => prev.filter((p) => p.userId !== confirm.player!.userId));
      }
    } catch (e: any) {
      const msg = `Erreur : ${e?.message ?? 'action impossible'}`;
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Erreur', msg);
    } finally {
      setActionLoading(false);
      setConfirm({ action: null, player: null });
    }
  };

  const handleCancelConfirm = () => {
    if (!actionLoading) setConfirm({ action: null, player: null });
  };

  // ── Rendu ──────────────────────────────────────────────────────────────────
  return (
    <>
      <Modal
        visible={visible}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={onClose}
      >
        <View style={styles.backdrop}>
          <View style={styles.sheet}>

            {/* En-tête */}
            <View style={styles.header}>
              <Text style={styles.title}>🧹 Nettoyer la base</Text>
              <View style={styles.headerRight}>
                <TouchableOpacity
                  style={styles.refreshBtn}
                  onPress={loadPlayers}
                  disabled={loading}
                  activeOpacity={0.7}
                >
                  <Text style={styles.refreshBtnText}>↻</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
                  <Text style={styles.closeBtnText}>✕</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Compteur */}
            <Text style={styles.subtitle}>
              {players.length} joueur{players.length !== 1 ? 's' : ''} enregistré{players.length !== 1 ? 's' : ''}
            </Text>

            {/* Message de succès */}
            {successMsg ? (
              <View style={styles.successBanner}>
                <Text style={styles.successText}>✅ {successMsg}</Text>
              </View>
            ) : null}

            {/* Champ de recherche */}
            <TextInput
              style={styles.searchInput}
              placeholder="Rechercher un joueur…"
              placeholderTextColor={Colors.ui.textLight}
              value={search}
              onChangeText={(t) => { setSearch(t); setSuccessMsg(null); }}
              autoCapitalize="none"
              autoCorrect={false}
              clearButtonMode="while-editing"
            />

            {/* Liste */}
            {loading ? (
              <View style={styles.centered}>
                <ActivityIndicator size="large" color={Colors.forest.medium} />
                <Text style={styles.loadingText}>Chargement…</Text>
              </View>
            ) : error ? (
              <View style={styles.centered}>
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity style={styles.retryBtn} onPress={loadPlayers} activeOpacity={0.8}>
                  <Text style={styles.retryBtnText}>Réessayer</Text>
                </TouchableOpacity>
              </View>
            ) : filtered.length === 0 ? (
              <View style={styles.centered}>
                <Text style={styles.emptyText}>
                  {search.trim() ? 'Aucun joueur ne correspond.' : 'Aucun joueur trouvé.'}
                </Text>
              </View>
            ) : (
              <FlatList
                data={filtered}
                keyExtractor={(item) => item.userId}
                renderItem={({ item }) => (
                  <PlayerCard
                    player={item}
                    onReset={handleReset}
                    onDelete={handleDelete}
                  />
                )}
                contentContainerStyle={styles.list}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              />
            )}

          </View>
        </View>
      </Modal>

      {/* Modale de confirmation (au-dessus de la sheet) */}
      <ConfirmModal
        state={confirm}
        loading={actionLoading}
        onConfirm={handleConfirm}
        onCancel={handleCancelConfirm}
      />
    </>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.ui.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingHorizontal: 16,
    paddingBottom: 32,
    maxHeight: '88%',
    minHeight: 300,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.forest.dark,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.ui.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.ui.textLight,
  },
  subtitle: {
    fontSize: 12,
    color: Colors.ui.textLight,
    marginBottom: 12,
  },
  successBanner: {
    backgroundColor: '#E8F5E9',
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#A5D6A7',
  },
  successText: {
    fontSize: 13,
    color: '#2E7D32',
    fontWeight: '600',
  },
  searchInput: {
    backgroundColor: Colors.ui.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.ui.border,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 9,
    fontSize: 14,
    color: Colors.ui.text,
    marginBottom: 12,
  },
  list: {
    gap: 8,
    paddingBottom: 8,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 10,
  },
  loadingText: { fontSize: 13, color: Colors.ui.textLight },
  errorText: { fontSize: 13, color: '#c0392b', textAlign: 'center' },
  emptyText: { fontSize: 13, color: Colors.ui.textLight, textAlign: 'center' },
  retryBtn: {
    backgroundColor: Colors.forest.medium,
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 9,
  },
  retryBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
});

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.ui.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.ui.border,
    gap: 10,
  },
  info: { gap: 3 },
  username: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.forest.dark,
  },
  meta: {
    fontSize: 12,
    color: Colors.ui.textLight,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  btn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
  },
  btnReset: {
    borderColor: '#F39C12',
    backgroundColor: '#FFF8E1',
  },
  btnResetText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#E67E22',
  },
  btnDelete: {
    borderColor: '#c0392b40',
    backgroundColor: '#FFF0EE',
  },
  btnDeleteText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#c0392b',
  },
});

const confirmStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  card: {
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
  emoji: { fontSize: 40 },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.forest.dark,
    textAlign: 'center',
  },
  body: {
    fontSize: 13,
    color: Colors.ui.textLight,
    textAlign: 'center',
    lineHeight: 19,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
    width: '100%',
  },
  btnCancel: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.ui.border,
    backgroundColor: Colors.ui.background,
  },
  btnCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.ui.textLight,
  },
  btnAction: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  btnActionReset: {
    backgroundColor: '#E67E22',
  },
  btnActionDelete: {
    backgroundColor: '#c0392b',
  },
  btnActionText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
});
