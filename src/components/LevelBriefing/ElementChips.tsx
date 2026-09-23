// ============================================================
// ElementChips — rangée de miniatures de jetons
// Utilisé dans BoardSummary et RuleCard
// ============================================================

import React from 'react';
import { View, Image, StyleSheet, ViewStyle } from 'react-native';
import { ElementRegistry } from '../../elements/ElementRegistry';

interface ElementChipsProps {
  elementIds: string[];
  /** Taille de chaque jeton miniature (défaut : 36) */
  size?: number;
  style?: ViewStyle;
}

export const ElementChips: React.FC<ElementChipsProps> = ({
  elementIds,
  size = 36,
  style,
}) => {
  return (
    <View style={[styles.row, style]}>
      {elementIds.map((id, index) => {
        const def = ElementRegistry[id];
        if (!def) return null;
        return (
          <View
            key={`${id}-${index}`}
            style={[
              styles.chip,
              {
                width: size,
                height: size,
                borderRadius: size / 2,
                backgroundColor: def.color + '20',
                borderColor: def.color + '60',
              },
            ]}
          >
            <Image
              source={def.icon}
              style={{ width: size * 0.72, height: size * 0.72 }}
              resizeMode="contain"
              accessibilityLabel={def.label}
            />
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chip: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
});
