// ============================================================
// BoardSummary — Résumé du défi (grille stylisée + éléments)
// Affichée comme dernière carte du briefing ou en mode recap
// ============================================================

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Challenge } from '../../core/models/Challenge';
import { LevelMeta } from '../../data/levelMeta';
import { ElementChips } from './ElementChips';
import { Colors } from '../../constants/colors';
import { useT } from '../../i18n';

interface BoardSummaryProps {
  challenge: Challenge;
  levelMeta: LevelMeta;
  isExpertMode?: boolean;
}

export const BoardSummary: React.FC<BoardSummaryProps> = ({
  challenge,
  levelMeta,
  isExpertMode = false,
}) => {
  const t = useT();

  const totalCells = levelMeta.boardCellCount;
  const emptyCells = levelMeta.emptyCellsCount;
  const filledCells = totalCells - emptyCells;

  // Extraire les IDs uniques des éléments du défi
  const elementIds = React.useMemo(() => {
    const ids = new Set<string>();
    challenge.availableTokens.forEach(t => ids.add(t.elementId));
    challenge.fixedPlacements.forEach(fp => ids.add(fp.elementId));
    return Array.from(ids);
  }, [challenge]);

  // Construire la grille stylisée : filledCells cases colorées, emptyCells grises
  const cells = React.useMemo(() => {
    const arr: ('filled' | 'empty')[] = [];
    for (let i = 0; i < filledCells; i++) arr.push('filled');
    for (let i = 0; i < emptyCells; i++) arr.push('empty');
    return arr;
  }, [filledCells, emptyCells]);

  return (
    <View style={styles.container} accessibilityRole="summary">
      {/* Titre */}
      <Text style={styles.title}>{t('briefing_recap_title')}</Text>

      {/* Grille stylisée */}
      <View style={styles.gridContainer}>
        <View style={styles.grid}>
          {cells.map((type, i) => (
            <View
              key={i}
              style={[
                styles.cell,
                type === 'filled' ? styles.cellFilled : styles.cellEmpty,
              ]}
            />
          ))}
        </View>

        {/* Légende */}
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, styles.legendDotFilled]} />
            <Text style={styles.legendText}>
              {filledCells} {t('label_cells')}
            </Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, styles.legendDotEmpty]} />
            <Text style={styles.legendText}>
              {emptyCells} {t('label_empty')}
            </Text>
          </View>
        </View>
      </View>

      {/* Jetons disponibles */}
      <ElementChips elementIds={elementIds} size={40} style={styles.chips} />

      {/* Mode expert */}
      {isExpertMode && (
        <View style={styles.expertBadge}>
          <Text style={styles.expertText}>{t('label_expert')}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.forest.dark,
  },
  gridContainer: {
    alignItems: 'center',
    gap: 10,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    maxWidth: 200,
    justifyContent: 'center',
  },
  cell: {
    width: 22,
    height: 22,
    borderRadius: 5,
  },
  cellFilled: {
    backgroundColor: Colors.forest.medium,
  },
  cellEmpty: {
    backgroundColor: Colors.ui.border,
    borderWidth: 1,
    borderColor: Colors.ui.border,
  },
  legend: {
    flexDirection: 'row',
    gap: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  legendDotFilled: {
    backgroundColor: Colors.forest.medium,
  },
  legendDotEmpty: {
    backgroundColor: Colors.ui.border,
    borderWidth: 1,
    borderColor: Colors.ui.textLight,
  },
  legendText: {
    fontSize: 12,
    color: Colors.ui.textLight,
  },
  chips: {
    paddingHorizontal: 8,
  },
  expertBadge: {
    backgroundColor: Colors.forest.dark + '15',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: Colors.forest.dark + '30',
  },
  expertText: {
    fontSize: 11,
    color: Colors.forest.dark,
    fontWeight: '600',
    fontStyle: 'italic',
  },
});
