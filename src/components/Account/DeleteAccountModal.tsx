// ============================================================
// SUPPRIMER MON COMPTE — modale de confirmation (Profil → Réglages)
//
// Exigence Apple (5.1.1(v)) et Google Play : un compte créé dans l'app doit pouvoir y être supprimé.
// Le joueur tape un mot de confirmation, puis son mot de passe (compte e-mail) ; la suppression est
// exécutée par `deleteMyAccount` (src/services/accountDeletionService.ts).
// ============================================================

import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Colors } from '../../constants/colors';
import { useT } from '../../i18n';
import { usePlayerStore } from '../../store/playerStore';
import { showAlert } from '../../store/dialogStore';
import { deleteMyAccount, getCurrentReauthMethod } from '../../services/accountDeletionService';
import { getDeletionConfirmWord, isDeletionConfirmed, mapDeletionError } from '../../constants/accountDeletion';
import { CONTACT_EMAIL } from '../../constants/legal';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function DeleteAccountModal({ visible, onClose }: Props) {
  const t = useT();
  const lang = usePlayerStore(s => s.language);
  const [confirmText, setConfirmText] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const method = visible ? getCurrentReauthMethod() : 'none';
  const word = getDeletionConfirmWord(lang);
  const confirmed = isDeletionConfirmed(confirmText, lang);
  const canSubmit = confirmed && (method !== 'password' || password.length > 0) && !busy;

  useEffect(() => {
    if (!visible) { setConfirmText(''); setPassword(''); setError(null); setBusy(false); }
  }, [visible]);

  const handleDelete = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const { residual } = await deleteMyAccount({
        password: method === 'password' ? password : undefined,
        beforeAuthDelete: () => usePlayerStore.getState().logout(),
      });
      onClose();
      showAlert({
        title: t('account_delete_done_title'),
        message: residual.length > 0
          ? t('account_delete_done_partial', { email: CONTACT_EMAIL })
          : t('account_delete_done_body'),
      });
    } catch (e: any) {
      setError(t(mapDeletionError(e?.code), { email: CONTACT_EMAIL }));
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={busy ? undefined : onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <Text style={styles.title}>{t('account_delete_title')}</Text>
            <Text style={styles.body}>{t('account_delete_warning')}</Text>
            <View style={styles.list}>
              <Text style={styles.item}>{t('account_delete_item_profile')}</Text>
              <Text style={styles.item}>{t('account_delete_item_public')}</Text>
              <Text style={styles.item}>{t('account_delete_item_premium')}</Text>
            </View>

            <Text style={styles.label}>{t('account_delete_type_word', { word })}</Text>
            <TextInput
              style={styles.input}
              value={confirmText}
              onChangeText={setConfirmText}
              autoCapitalize="characters"
              autoCorrect={false}
              placeholder={word}
              placeholderTextColor={Colors.ui.textLight}
              editable={!busy}
              accessibilityLabel={t('account_delete_type_word', { word })}
            />

            {method === 'password' && (
              <>
                <Text style={styles.label}>{t('account_delete_password')}</Text>
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoCapitalize="none"
                  placeholder={t('profile_placeholder_password')}
                  placeholderTextColor={Colors.ui.textLight}
                  editable={!busy}
                  accessibilityLabel={t('account_delete_password')}
                />
              </>
            )}

            {error && <Text style={styles.error}>{error}</Text>}

            <TouchableOpacity
              style={[styles.deleteBtn, !canSubmit && styles.btnDisabled]}
              onPress={handleDelete}
              disabled={!canSubmit}
              activeOpacity={0.8}
              accessibilityRole="button"
            >
              {busy
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.deleteBtnText}>{t('account_delete_confirm_btn')}</Text>}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={onClose}
              disabled={busy}
              activeOpacity={0.7}
              accessibilityRole="button"
            >
              <Text style={styles.cancelBtnText}>{t('profile_alert_cancel')}</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '90%',
    backgroundColor: Colors.ui.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.ui.border,
    overflow: 'hidden',
  },
  content: { padding: 20, gap: 12 },
  title: { fontSize: 20, fontWeight: '800', color: '#C62828', textAlign: 'center' },
  body: { fontSize: 16, color: Colors.ui.text, lineHeight: 22 },
  list: { gap: 6 },
  item: { fontSize: 15, color: Colors.ui.text, lineHeight: 21 },
  label: { fontSize: 15, fontWeight: '700', color: Colors.ui.text, marginTop: 4 },
  input: {
    backgroundColor: Colors.ui.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.ui.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: Colors.ui.text,
    minHeight: 48,
  },
  error: { fontSize: 15, color: '#C62828', lineHeight: 21 },
  deleteBtn: {
    backgroundColor: '#C62828',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
    marginTop: 4,
  },
  btnDisabled: { opacity: 0.45 },
  deleteBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  cancelBtn: { alignItems: 'center', paddingVertical: 12, minHeight: 44, justifyContent: 'center' },
  cancelBtnText: { fontSize: 16, color: Colors.forest.medium, fontWeight: '600' },
});
