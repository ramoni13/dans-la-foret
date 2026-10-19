// ============================================================
// BADGEGOALPICKERMODAL — Sélection des 3 objectifs actifs
// Affiche tous les badges éligibles, obtenus en grisé.
// Le joueur peut en cocher jusqu'à 3 parmi les non-obtenus.
// ============================================================

import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { BADGE_MAP, BADGE_DEFINITIONS, BadgeRarity, getBadgeTexts } from '../../constants/badges';
import { usePlayerStore } from '../../store/playerStore';
import { ELIGIBLE_GOAL_BADGE_IDS } from '../../core/engine/badgeEngine';
import { Colors } from '../../constants/colors';
import { useT } from '../../i18n';

interface BadgeGoalPickerModalProps {
  visible: boolean;
  earnedBadges: string[];
  currentGoals: string[];
  /** Appelé avec les IDs des nouveaux objectifs sélectionnés */
  onConfirm: (ids: string[]) => void;
  onClose: () => void;
}

// Ordre des catégories dans le picker (labels traduits dans le composant via useT)
const CATEGORY_KEYS = [
  { key: 'vitesse',          tKey: 'cat_vitesse' },
  { key: 'precision',        tKey: 'cat_precision' },
  { key: 'regularite',       tKey: 'cat_regularite' },
  { key: 'amelioration',     tKey: 'cat_amelioration' },
  { key: 'exploration',      tKey: 'cat_exploration' },
  { key: 'social',           tKey: 'cat_social' },
  { key: 'regularite_daily', tKey: 'cat_regularite_daily' },
] as const;

// Couleur du bord selon la rareté
const RARITY_COLORS: Record<BadgeRarity, string> = {
  bois:    Colors.badges.bois,
  pierre:  Colors.badges.pierre,
  or:      Colors.badges.or,
  cristal: Colors.badges.cristal,
};

export const BadgeGoalPickerModal: React.FC<BadgeGoalPickerModalProps> = ({
  visible,
  earnedBadges,
  currentGoals,
  onConfirm,
  onClose,
}) => {
  const t = useT();
  const language = usePlayerStore(s => s.language);
  const earnedSet = new Set(earnedBadges);

  // Objectifs en cours = ceux qui NE SONT PAS encore obtenus
  // (un badge peut rester dans activeBadgeGoals même après obtention dans certains états)
  const activeGoals = currentGoals.filter(id => !earnedSet.has(id));

  // Nombre de slots libres = 3 moins les objectifs vraiment en cours
  const maxSelectable = 3 - activeGoals.length;

  const [selected, setSelected] = useState<string[]>([]);

  // Réinitialiser la sélection à l'ouverture
  React.useEffect(() => {
    if (visible) setSelected([]);
  }, [visible]);

  // On exclut de "currentGoalSet" les badges déjà obtenus : ils libèrent leur slot
  const currentGoalSet = new Set(activeGoals);

  // Séparer les daily (regularite daily : daily_*)
  const dailyIds = ELIGIBLE_GOAL_BADGE_IDS.filter(id => id.startsWith('daily_'));
  const mainIds  = ELIGIBLE_GOAL_BADGE_IDS.filter(id => !id.startsWith('daily_'));

  // Grouper par catégorie
  const grouped: Record<string, string[]> = {};
  for (const id of mainIds) {
    const def = BADGE_MAP[id];
    if (!def) continue;
    const cat = def.category;
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(id);
  }
  if (dailyIds.length > 0) {
    grouped['regularite_daily'] = dailyIds;
  }

  /**
   * Pour chaque catégorie, seul le premier badge non-obtenu ET non-déjà-objectif-actif
   * est proposé. Les suivants sont verrouillés (il faut finir le précédent d'abord).
   */
  const getNextAvailableInCategory = (ids: string[]): string | null => {
    for (const id of ids) {
      if (!earnedSet.has(id) && !currentGoalSet.has(id)) return id;
    }
    return null;
  };

  const toggle = (badgeId: string) => {
    setSelected(prev => {
      if (prev.includes(badgeId)) return prev.filter(id => id !== badgeId);
      if (prev.length >= maxSelectable) return prev;
      return [...prev, badgeId];
    });
  };

  const handleConfirm = () => {
    // Objectifs finaux = objectifs actifs en cours + nouvelles sélections
    const merged = [...activeGoals, ...selected];
    // goalCounters remis à 0 pour les nouvelles sélections dans setActiveBadgeGoals
    onConfirm(merged);
    onClose();
  };

  const availableCount = ELIGIBLE_GOAL_BADGE_IDS.filter(
    id => !earnedSet.has(id) && !currentGoalSet.has(id)
  ).length;

  const totalSelected = activeGoals.length + selected.length;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.title}>{t('goal_picker_title')}</Text>
          <Text style={styles.subtitle}>
            {t('goal_picker_subtitle', { selected: String(totalSelected), available: String(availableCount) })}
          </Text>

          <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
            {CATEGORY_KEYS.map(({ key, tKey }) => {
              const label = t(tKey);
              const ids = grouped[key];
              if (!ids || ids.length === 0) return null;

              // Premier badge disponible dans cette catégorie
              const nextAvailableId = getNextAvailableInCategory(ids);

              // Si tous les badges de cette catégorie sont obtenus ou déjà en objectif, masquer
              const hasAnyToShow = ids.some(
                id => earnedSet.has(id) || currentGoalSet.has(id) || id === nextAvailableId
              );
              if (!hasAnyToShow) return null;

              return (
                <View key={key} style={styles.categoryBlock}>
                  <Text style={styles.categoryLabel}>{label}</Text>
                  {ids.map(badgeId => {
                    const badge    = BADGE_MAP[badgeId];
                    if (!badge) return null;
                    const badgeTexts   = getBadgeTexts(badge, language);
                    const isEarned     = earnedSet.has(badgeId);
                    const isCurrentGoal = currentGoalSet.has(badgeId);
                    const isNext       = badgeId === nextAvailableId;
                    const isChosen     = selected.includes(badgeId);
                    const isFull       = !isChosen && selected.length >= maxSelectable;
                    // Seul le prochain badge disponible est sélectionnable
                    const isSelectable = isNext && !isFull;
                    const disabled     = !isSelectable || isEarned || isCurrentGoal;
                    const rarityColor  = RARITY_COLORS[badge.rarity] ?? Colors.ui.border;

                    // Masquer les badges ni obtenus, ni objectifs, ni "le prochain"
                    if (!isEarned && !isCurrentGoal && !isNext) return null;

                    return (
                      <TouchableOpacity
                        key={badgeId}
                        style={[
                          styles.row,
                          isChosen       && { borderColor: rarityColor, backgroundColor: rarityColor + '18' },
                          isCurrentGoal  && styles.rowCurrentGoal,
                          isEarned       && styles.rowEarned,
                          (!isSelectable && !isEarned && !isCurrentGoal) && styles.rowFull,
                        ]}
                        onPress={() => isNext && toggle(badgeId)}
                        activeOpacity={isSelectable ? 0.75 : 1}
                        disabled={disabled}
                      >
                        <Text style={[styles.rowEmoji, (isEarned || isCurrentGoal) && styles.dimmed]}>
                          {badge.emoji}
                        </Text>
                        <View style={styles.rowText}>
                          <Text style={[styles.rowLabel, (isEarned || isCurrentGoal) && styles.dimmed]} numberOfLines={1}>
                            {badgeTexts.label}
                          </Text>
                          <Text style={[styles.rowDesc, (isEarned || isCurrentGoal) && styles.dimmed]} numberOfLines={2}>
                            {isEarned
                              ? t('goal_picker_earned')
                              : isCurrentGoal
                                ? t('goal_picker_in_progress')
                                : badgeTexts.description}
                          </Text>
                        </View>
                        {isEarned ? (
                          <Text style={[styles.check, styles.checkEarned]}>✓</Text>
                        ) : isCurrentGoal ? (
                          <Text style={[styles.check, styles.checkCurrent]}>⏳</Text>
                        ) : (
                          <Text style={[styles.check, isChosen && { color: rarityColor }]}>
                            {isChosen ? '✓' : '○'}
                          </Text>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              );
            })}

            {availableCount === 0 && (
              <Text style={styles.empty}>
                {t('goal_picker_empty')}
              </Text>
            )}
          </ScrollView>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.8}>
              <Text style={styles.cancelText}>{t('goal_picker_cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmBtn, selected.length === 0 && styles.confirmBtnDisabled]}
              onPress={handleConfirm}
              activeOpacity={0.8}
              disabled={selected.length === 0}
            >
              <Text style={styles.confirmText}>{t('goal_picker_confirm')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '85%',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.forest.dark,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.ui.textLight,
    marginBottom: 16,
  },
  list: {
    flexShrink: 1,
  },
  listContent: {
    gap: 16,
    paddingBottom: 8,
  },
  categoryBlock: {
    gap: 6,
  },
  categoryLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.ui.textLight,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  empty: {
    textAlign: 'center',
    color: Colors.ui.textLight,
    fontSize: 14,
    paddingVertical: 24,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.ui.border,
    backgroundColor: Colors.ui.card,
  },
  rowEarned: {
    opacity: 0.45,
    borderColor: Colors.ui.border,
    backgroundColor: Colors.ui.card,
  },
  rowFull: {
    opacity: 0.5,
  },
  rowCurrentGoal: {
    opacity: 0.55,
    borderColor: Colors.forest.medium,
    backgroundColor: Colors.forest.medium + '10',
  },
  dimmed: {
    opacity: 0.6,
  },
  rowEmoji: {
    fontSize: 22,
    width: 30,
    textAlign: 'center',
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.forest.dark,
  },
  rowDesc: {
    fontSize: 11,
    color: Colors.ui.textLight,
    lineHeight: 15,
  },
  check: {
    fontSize: 17,
    color: Colors.forest.medium,
    fontWeight: '700',
    width: 22,
    textAlign: 'center',
  },
  checkEarned: {
    color: Colors.badges.bois,
  },
  checkCurrent: {
    color: Colors.forest.medium,
    fontSize: 14,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.ui.border,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.ui.textLight,
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: Colors.forest.medium,
    alignItems: 'center',
  },
  confirmBtnDisabled: {
    opacity: 0.4,
  },
  confirmText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
});
