// ============================================================
// ADMIN PURGE MODAL — Purge de la progression v2 (données partagées)
// Réservé au compte administrateur. Accessible depuis le Profil.
//
// Deux temps, comme `scripts/purgeProgressionV2.ts` :
//   1. « Compter (simulation) » : dry-run, aucune écriture ;
//   2. suppression réelle, déverrouillée UNIQUEMENT après le comptage ET la saisie du mot de confirmation.
// Voir docs/purge-progression-v2.md.
// ============================================================

import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Platform,
} from 'react-native';
import { Colors } from '../../constants/colors';
import { useT } from '../../i18n';
import { usePlayerStore } from '../../store/playerStore';
import { isAdminAccount } from '../../constants/devAccess';
import {
  PURGE_CONFIRM_WORD,
  canRunPurge,
  type PurgeTargetCount,
} from '../../constants/purgeProgression';
import { countPurgeTargets, executePurge } from '../../services/purgeProgressionService';

type Phase = 'idle' | 'counting' | 'counted' | 'running' | 'done';

interface AdminPurgeModalProps {
  visible: boolean;
  onClose: () => void;
}

export function AdminPurgeModal({ visible, onClose }: AdminPurgeModalProps) {
  const t = useT();
  const username = usePlayerStore(s => s.username);
  const isAdmin = isAdminAccount(username);

  const [phase, setPhase] = useState<Phase>('idle');
  const [targets, setTargets] = useState<PurgeTargetCount[]>([]);
  const [total, setTotal] = useState(0);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [confirmInput, setConfirmInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Chaque ouverture repart de zéro : jamais de suppression « restée armée » d'une session précédente.
  useEffect(() => {
    if (!visible) return;
    setPhase('idle');
    setTargets([]);
    setTotal(0);
    setProgress({ done: 0, total: 0 });
    setConfirmInput('');
    setError(null);
  }, [visible]);

  const busy = phase === 'counting' || phase === 'running';

  const handleCount = async () => {
    setError(null);
    setPhase('counting');
    try {
      const report = await countPurgeTargets(username);
      setTargets(report.targets);
      setTotal(report.total);
      setConfirmInput('');
      setPhase('counted');
    } catch (e: any) {
      setError(t('admin_purge_error', { message: String(e?.message ?? e) }));
      setPhase('idle');
    }
  };

  const handleRun = async () => {
    if (!canRunPurge({ isAdmin, confirmInput, total, busy })) return;
    setError(null);
    setPhase('running');
    setProgress({ done: 0, total });
    try {
      const report = await executePurge(username, (done, all) => setProgress({ done, total: all }));
      setTargets(report.targets);
      setTotal(report.total);
      setConfirmInput('');
      setPhase('done');
    } catch (e: any) {
      setError(t('admin_purge_error', { message: String(e?.message ?? e) }));
      setPhase('counted');
    }
  };

  // Garde de sécurité : jamais d'interface de suppression pour un autre compte
  if (!isAdmin) return null;

  const canRun = canRunPurge({ isAdmin, confirmInput, total, busy });

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={() => { if (!busy) onClose(); }}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>{t('admin_purge_title')}</Text>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              disabled={busy}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={t('admin_purge_close')}
            >
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
            <Text style={styles.intro}>{t('admin_purge_intro')}</Text>

            {phase !== 'done' && (
              <TouchableOpacity
                style={[styles.countBtn, busy && styles.btnDisabled]}
                onPress={handleCount}
                disabled={busy}
                activeOpacity={0.8}
                accessibilityRole="button"
              >
                {phase === 'counting' ? (
                  <View style={styles.row}>
                    <ActivityIndicator color="#fff" size="small" />
                    <Text style={styles.countBtnText}>{t('admin_purge_counting')}</Text>
                  </View>
                ) : (
                  <Text style={styles.countBtnText}>{t('admin_purge_count_btn')}</Text>
                )}
              </TouchableOpacity>
            )}

            {(phase === 'counted' || phase === 'running' || phase === 'done') && (
              <View style={styles.report}>
                <Text style={styles.reportTitle}>{t('admin_purge_result_title')}</Text>
                {targets.map(tg => (
                  <View key={tg.label} style={styles.reportRow}>
                    <Text style={styles.reportLabel}>{tg.label}</Text>
                    <Text style={styles.reportCount}>{tg.count}</Text>
                  </View>
                ))}
                <Text style={styles.reportTotal}>{t('admin_purge_total', { count: String(total) })}</Text>
              </View>
            )}

            {phase === 'counted' && total === 0 && (
              <Text style={styles.nothing}>{t('admin_purge_nothing')}</Text>
            )}

            {phase === 'counted' && total > 0 && (
              <View style={styles.dangerBox}>
                <Text style={styles.warning}>{t('admin_purge_warning', { word: PURGE_CONFIRM_WORD })}</Text>
                <TextInput
                  style={styles.input}
                  value={confirmInput}
                  onChangeText={setConfirmInput}
                  placeholder={t('admin_purge_input_placeholder')}
                  placeholderTextColor={Colors.ui.textLight}
                  autoCapitalize="characters"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  style={[styles.runBtn, !canRun && styles.btnDisabled]}
                  onPress={handleRun}
                  disabled={!canRun}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !canRun }}
                >
                  <Text style={styles.runBtnText}>{t('admin_purge_run_btn')}</Text>
                </TouchableOpacity>
              </View>
            )}

            {phase === 'running' && (
              <View style={styles.row}>
                <ActivityIndicator color={Colors.forest.medium} size="small" />
                <Text style={styles.progressText}>
                  {t('admin_purge_running', { done: String(progress.done), total: String(progress.total) })}
                </Text>
              </View>
            )}

            {phase === 'done' && (
              <View style={styles.successBanner}>
                <Text style={styles.successText}>✅ {t('admin_purge_done', { count: String(total) })}</Text>
              </View>
            )}

            {error ? <Text style={styles.errorText}>{error}</Text> : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  title: { fontSize: 20, fontWeight: '800', color: Colors.forest.dark, flexShrink: 1 },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.ui.border,
    alignItems: 'center', justifyContent: 'center',
  },
  closeBtnText: { fontSize: 14, fontWeight: '700', color: Colors.ui.textLight },
  content: { gap: 12, paddingBottom: 8 },
  intro: { fontSize: 13, color: Colors.ui.textLight, lineHeight: 19 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  countBtn: { backgroundColor: Colors.forest.medium, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  countBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  btnDisabled: { opacity: 0.45 },
  report: {
    backgroundColor: Colors.ui.card, borderRadius: 14, padding: 14, borderWidth: 1,
    borderColor: Colors.ui.border, gap: 6,
  },
  reportTitle: { fontSize: 14, fontWeight: '800', color: Colors.forest.dark, marginBottom: 2 },
  reportRow: { flexDirection: 'row', justifyContent: 'space-between' },
  reportLabel: { fontSize: 13, color: Colors.ui.text },
  reportCount: { fontSize: 13, fontWeight: '700', color: Colors.ui.text },
  reportTotal: { fontSize: 14, fontWeight: '800', color: Colors.forest.dark, marginTop: 6 },
  nothing: { fontSize: 13, color: Colors.ui.textLight, textAlign: 'center' },
  dangerBox: {
    backgroundColor: '#FFF0EE', borderRadius: 14, padding: 14, borderWidth: 1,
    borderColor: '#c0392b40', gap: 10,
  },
  warning: { fontSize: 13, color: '#c0392b', fontWeight: '700', lineHeight: 19 },
  input: {
    backgroundColor: Colors.ui.card, borderRadius: 12, borderWidth: 1, borderColor: Colors.ui.border,
    paddingHorizontal: 14, paddingVertical: Platform.OS === 'ios' ? 12 : 9, fontSize: 14, color: Colors.ui.text,
  },
  runBtn: { backgroundColor: '#c0392b', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  runBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  progressText: { fontSize: 13, color: Colors.ui.text },
  successBanner: {
    backgroundColor: '#E8F5E9', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: '#A5D6A7',
  },
  successText: { fontSize: 13, color: '#2E7D32', fontWeight: '600' },
  errorText: { fontSize: 13, color: '#c0392b', textAlign: 'center' },
});
