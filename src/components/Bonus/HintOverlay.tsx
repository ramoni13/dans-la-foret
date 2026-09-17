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

import { BonusId, BONUS_DEFINITIONS } from '../../constants/bonus';
import { Colors } from '../../constants/colors';

interface HintOverlayProps {
  seeds: number;
  bonusUsed: BonusId[];
  selectedElement: string | null;
  isPremium: boolean;
  bonusDisabled: boolean;
  onActivateBonus: (bonusId: BonusId) => boolean;
}

export const HintOverlay: React.FC<HintOverlayProps> = ({
  seeds,
  bonusUsed,
  selectedElement,
  isPremium,
  bonusDisabled,
  onActivateBonus,
}) => {
  const handleBonus = (bonusId: BonusId) => {
    if (bonusDisabled) {
      Alert.alert('Mode Maître', 'Les bonus sont désactivés en mode Maître !');
      return;
    }

    const def = BONUS_DEFINITIONS[bonusId];
    if (seeds < def.cost) {
      Alert.alert(
        'Pas assez de graines 🌱',
        `Ce bonus coûte ${def.cost} graines. Tu en as ${seeds}.`
      );
      return;
    }

    onActivateBonus(bonusId);
  };

  return (
    <View style={styles.container}>
      {/* Compteur de graines */}
      <View style={styles.seedsContainer}>
        <Text style={styles.seedsIcon}>🌱</Text>
        <Text style={styles.seedsCount}>{seeds}</Text>
      </View>

      {/* Boutons bonus */}
      <View style={styles.bonusRow}>
        {(Object.values(BONUS_DEFINITIONS) as typeof BONUS_DEFINITIONS[BonusId][]).map((def) => {
          const alreadyUsed = bonusUsed.includes(def.id);
          const canAfford = seeds >= def.cost;
          const disabled = bonusDisabled || !canAfford;

          return (
            <TouchableOpacity
              key={def.id}
              style={[
                styles.bonusBtn,
                disabled && styles.bonusBtnDisabled,
                alreadyUsed && styles.bonusBtnUsed,
              ]}
              onPress={() => handleBonus(def.id)}
              activeOpacity={0.7}
              disabled={disabled}
            >
              <Text style={styles.bonusIcon}>{def.icon}</Text>
              <Text style={[styles.bonusCost, !canAfford && styles.bonusCostInsufficient]}>
                {def.cost}🌱
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
