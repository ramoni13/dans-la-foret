// ============================================================
// LIENS LÉGAUX — CGU, politique de confidentialité, mentions légales, contact
//
// `LegalConsentNotice` : phrase affichée sous le bouton « Créer un compte » (information avant collecte).
// `LegalLinksPanel`    : bloc « Informations légales » du Profil → Réglages.
// Les pages sont hébergées dans `Site/` (URLs : src/constants/legal.ts) et ouvertes dans le navigateur.
// ============================================================

import React from 'react';
import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '../../constants/colors';
import { useT } from '../../i18n';
import { buildContactMailto, getLegalUrl, type LegalPage } from '../../constants/legal';

function openUrl(url: string) {
  Linking.openURL(url).catch(() => {});
}

export function openLegalPage(page: LegalPage) {
  openUrl(getLegalUrl(page));
}

/** « En créant un compte, tu acceptes les CGU et la politique de confidentialité. » (liens cliquables) */
export function LegalConsentNotice() {
  const t = useT();
  return (
    <Text style={styles.notice}>
      {t('legal_consent_prefix')}
      <Text style={styles.noticeLink} onPress={() => openLegalPage('terms')} accessibilityRole="link">
        {t('legal_terms')}
      </Text>
      {t('legal_consent_and')}
      <Text style={styles.noticeLink} onPress={() => openLegalPage('privacy')} accessibilityRole="link">
        {t('legal_privacy')}
      </Text>
      {t('legal_consent_suffix')}
    </Text>
  );
}

/** Bloc de liens du Profil → Réglages. */
export function LegalLinksPanel() {
  const t = useT();
  const rows: Array<{ key: string; label: string; onPress: () => void }> = [
    { key: 'privacy', label: t('legal_privacy_title'), onPress: () => openLegalPage('privacy') },
    { key: 'terms', label: t('legal_terms_title'), onPress: () => openLegalPage('terms') },
    { key: 'notice', label: t('legal_notice_title'), onPress: () => openLegalPage('legal_notice') },
    { key: 'contact', label: t('legal_contact'), onPress: () => openUrl(buildContactMailto(t('legal_contact_subject'))) },
  ];
  return (
    <View style={styles.panel}>
      <Text style={styles.panelTitle}>{t('legal_section_title')}</Text>
      {rows.map((r, i) => (
        <TouchableOpacity
          key={r.key}
          style={[styles.row, i > 0 && styles.rowBorder]}
          onPress={r.onPress}
          activeOpacity={0.7}
          accessibilityRole="link"
        >
          <Text style={styles.rowText}>{r.label}</Text>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  notice: {
    fontSize: 13,
    lineHeight: 19,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 8,
  },
  noticeLink: { color: '#FFE082', fontWeight: '700', textDecorationLine: 'underline' },
  panel: {
    backgroundColor: Colors.ui.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.ui.border,
    overflow: 'hidden',
  },
  panelTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.forest.dark,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    minHeight: 48,
  },
  rowBorder: { borderTopWidth: 1, borderTopColor: Colors.ui.border },
  rowText: { flex: 1, fontSize: 15, color: Colors.ui.text, fontWeight: '600' },
  chevron: { fontSize: 22, color: Colors.ui.textLight },
});
