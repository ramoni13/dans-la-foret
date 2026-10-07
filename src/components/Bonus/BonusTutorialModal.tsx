// ============================================================
// MODAL TUTORIEL BONUS — BonusTutorialModal.tsx
// Popup imagée expliquant le fonctionnement d'un bonus.
// Affichée la première fois qu'on tape sur un bonus.
// Case "Ne plus me montrer" → persisté dans playerStore.
// ============================================================

import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';

import { BonusId } from '../../constants/bonus';
import { Colors } from '../../constants/colors';
import { useT } from '../../i18n';

// ── Données visuelles par bonus ──────────────────────────────

interface StepVisual {
  emoji: string;
  textKey: string;
}

interface BonusTutorialData {
  titleKey: string;
  descKey: string;
  headerEmoji: string;
  headerColor: string;
  steps: StepVisual[];
}

const TUTORIAL_DATA: Record<BonusId, BonusTutorialData> = {
  highlight_valid_cells: {
    titleKey: 'bonus_highlight_title',
    descKey: 'bonus_highlight_desc',
    headerEmoji: '💡',
    headerColor: Colors.cell.valid,
    steps: [
      { emoji: '👆', textKey: 'bonus_highlight_step1' },
      { emoji: '✅', textKey: 'bonus_highlight_step2' },
      { emoji: '🔄', textKey: 'bonus_highlight_step3' },
    ],
  },
  instinct: {
    titleKey: 'bonus_instinct_title',
    descKey: 'bonus_instinct_desc',
    headerEmoji: '🔴',
    headerColor: Colors.cell.wrong,
    steps: [
      { emoji: '🧩', textKey: 'bonus_instinct_step1' },
      { emoji: '⚠️', textKey: 'bonus_instinct_step2' },
      { emoji: '🧠', textKey: 'bonus_instinct_step3' },
    ],
  },
};

// ── Props ────────────────────────────────────────────────────

interface BonusTutorialModalProps {
  visible: boolean;
  bonusId: BonusId;
  onConfirm: (dismiss: boolean) => void;
}

// ── Composant ────────────────────────────────────────────────

export const BonusTutorialModal: React.FC<BonusTutorialModalProps> = ({
  visible,
  bonusId,
  onConfirm,
}) => {
  const t = useT();
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const data = TUTORIAL_DATA[bonusId];
  if (!data) return null;

  const handleConfirm = () => {
    onConfirm(dontShowAgain);
    setDontShowAgain(false); // Reset pour prochaine ouverture
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleConfirm}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {/* En-tête avec icône */}
          <View style={[styles.header, { backgroundColor: data.headerColor + '22' }]}>
            <Text style={styles.headerEmoji}>{data.headerEmoji}</Text>
            <Text style={[styles.title, { color: data.headerColor }]}>
              {t(data.titleKey)}
            </Text>
          </View>

          {/* Description */}
          <Text style={styles.description}>{t(data.descKey)}</Text>

          {/* Étapes visuelles */}
          <View style={styles.stepsContainer}>
            {data.steps.map((step, i) => (
              <View key={i} style={styles.stepRow}>
                <View style={styles.stepBadge}>
                  <Text style={styles.stepEmoji}>{step.emoji}</Text>
                </View>
                <Text style={styles.stepText}>{t(step.textKey)}</Text>
              </View>
            ))}
          </View>

          {/* Checkbox "Ne plus me montrer" */}
          <TouchableOpacity
            style={styles.checkboxRow}
            onPress={() => setDontShowAgain(prev => !prev)}
            activeOpacity={0.7}
          >
            <View style={[styles.checkbox, dontShowAgain && styles.checkboxChecked]}>
              {dontShowAgain && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.checkboxLabel}>{t('bonus_tutorial_dismiss')}</Text>
          </TouchableOpacity>

          {/* Bouton OK */}
          <TouchableOpacity
            style={[styles.okBtn, { backgroundColor: data.headerColor }]}
            onPress={handleConfirm}
            activeOpacity={0.8}
          >
            <Text style={styles.okBtnText}>{t('bonus_tutorial_ok')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

// ── Styles ───────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: Colors.ui.card,
    borderRadius: 20,
    width: '100%',
    maxWidth: 340,
    overflow: 'hidden',
    ...(Platform.OS !== 'web'
      ? {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.25,
          shadowRadius: 12,
          elevation: 8,
        }
      : {}),
  },
  header: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  headerEmoji: {
    fontSize: 40,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
  },
  description: {
    fontSize: 14,
    color: Colors.ui.textLight,
    textAlign: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    lineHeight: 20,
  },
  stepsContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 12,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.ui.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.ui.border,
  },
  stepEmoji: {
    fontSize: 20,
  },
  stepText: {
    flex: 1,
    fontSize: 13,
    color: Colors.ui.text,
    lineHeight: 18,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.ui.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.ui.background,
  },
  checkboxChecked: {
    borderColor: Colors.forest.accent,
    backgroundColor: Colors.forest.accent,
  },
  checkmark: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  checkboxLabel: {
    fontSize: 13,
    color: Colors.ui.textLight,
  },
  okBtn: {
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 20,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  okBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
