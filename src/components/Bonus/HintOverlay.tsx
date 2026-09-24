// ============================================================
// HINTOVERLAY — Barre de bonus + overlay visuel des indices
// ============================================================

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';

import { BonusId, BONUS_DEFINITIONS, BASE_BONUS_IDS, ADVANCED_BONUS_IDS } from '../../constants/bonus';
import { Colors } from '../../constants/colors';

interface HintOverlayProps {
  seeds: number;
  bonusUsed: BonusId[];
  selectedElement: string | null;
  isPremium: boolean;
  bonusDisabled: boolean;
  onActivateBonus: (bonusId: BonusId) => boolean;
  /** Bonus avancés débloqués via badges (instinct, flash) */
  unlockedBonuses?: BonusId[];
}

export const HintOverlay: React.FC<HintOverlayProps> = ({
  seeds,
  bonusUsed,
  selectedElement,
  isPremium,
  bonusDisabled,
  onActivateBonus,
  unlockedBonuses = [],
}) => {
  const handleBonus = (bonusId: BonusId) => {
    const def = BONUS_DEFINITIONS[bonusId];

    // Bonus verrouillé (avancé non débloqué)
    if (def.requiresUnlock && !unlockedBonuses.includes(bonusId)) {
      const unlockHint = bonusId === 'instinct'
        ? 'Débloque 3 badges Or pour accéder au bonus Instinct.'
        : 'Débloque 5 badges Pierre pour accéder au bonus Flash.';
      Alert.alert('Bonus verrouillé 🔒', unlockHint);
      return;
    }

    if (bonusDisabled) {
      Alert.alert('Mode Maître', 'Les bonus sont désactivés en mode Maître !');
      return;
    }

    if (seeds < def.cost) {
      Alert.alert(
        'Pas assez de graines 🌱',
        `Ce bonus coûte ${def.cost} graines. Tu en as ${seeds}.`
      );
      return;
    }

    onActivateBonus(bonusId);
  };

  // Afficher les bonus de base + les avancés débloqués (ou grisés avec cadenas)
  const visibleBonusIds: BonusId[] = [
    ...BASE_BONUS_IDS,
    ...ADVANCED_BONUS_IDS,
  ];

  return (
    <View style={styles.container}>
      {/* Compteur de graines */}
      <View style={styles.seedsContainer}>
        <Text style={styles.seedsIcon}>🌱</Text>
        <Text style={styles.seedsCount}>{seeds}</Text>
      </View>

      {/* Boutons bonus */}
      <View style={styles.bonusRow}>
        {visibleBonusIds.map((bonusId) => {
          const def = BONUS_DEFINITIONS[bonusId];
          const alreadyUsed = bonusUsed.includes(def.id);
          const canAfford = seeds >= def.cost;
          const locked = def.requiresUnlock && !unlockedBonuses.includes(bonusId);
          const disabled = bonusDisabled || !canAfford || locked;

          return (
            <TouchableOpacity
              key={def.id}
              style={[
                styles.bonusBtn,
                disabled && styles.bonusBtnDisabled,
                alreadyUsed && styles.bonusBtnUsed,
                locked && styles.bonusBtnLocked,
              ]}
              onPress={() => handleBonus(def.id)}
              activeOpacity={0.7}
            >
              <Text style={styles.bonusIcon}>{locked ? '🔒' : def.icon}</Text>
              <Text style={[styles.bonusCost, !canAfford && !locked && styles.bonusCostInsufficient]}>
                {locked ? '' : `${def.cost}🌱`}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: Colors.ui.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.ui.border,
  },
  seedsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.ui.seed + '22',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.ui.seed,
  },
  seedsIcon: {
    fontSize: 16,
  },
  seedsCount: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.ui.text,
  },
  bonusRow: {
    flexDirection: 'row',
    gap: 8,
  },
  bonusBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: Colors.forest.light + '22',
    borderWidth: 1.5,
    borderColor: Colors.forest.light,
    gap: 2,
  },
  bonusBtnDisabled: {
    opacity: 0.4,
    backgroundColor: Colors.ui.border + '33',
    borderColor: Colors.ui.border,
  },
  bonusBtnUsed: {
    borderColor: Colors.forest.accent,
    backgroundColor: Colors.forest.accent + '22',
  },
  bonusBtnLocked: {
    borderColor: Colors.ui.border,
    backgroundColor: Colors.ui.border + '44',
    opacity: 0.6,
  },
  bonusIcon: {
    fontSize: 20,
  },
  bonusCost: {
    fontSize: 9,
    fontWeight: '600',
    color: Colors.ui.textLight,
  },
  bonusCostInsufficient: {
    color: '#F44336',
  },
});
