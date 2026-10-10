// ============================================================
// BOARDRENDERER — Rendu dynamique du plateau
// 100% piloté par BoardDefinition : positions, connexions, cases
// ============================================================

import React, { useCallback, useState } from 'react';
import { View, StyleSheet, LayoutChangeEvent, ImageBackground } from 'react-native';
import Svg from 'react-native-svg';

import { BoardDefinition } from '../../core/models/Board';
import { Connection } from './Connection';
import { Cell, CELL_SIZE } from './Cell';
import { cellPositionToPx } from '../../utils/boardUtils';

interface BoardRendererProps {
  boardDef: BoardDefinition;
  playerBoard: (string | null)[];
  fixedCells: Set<number>;
  selectedElement: string | null;
  highlightActive: boolean;   // un bonus visuel est actif → pas de pulsation cases vides
  getCellColor: (cellIndex: number) => string;
  onCellPress: (cellIndex: number) => void;
}

export const BoardRenderer: React.FC<BoardRendererProps> = ({
  boardDef,
  playerBoard,
  fixedCells,
  selectedElement,
  highlightActive,
  getCellColor,
  onCellPress,
}) => {
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setContainerSize({ width, height });
  }, []);

  /**
   * Taille effective d'une case : garantit que même les cases aux positions
   * extrêmes (ex : x=7% ou x=93% dans board_12cells) restent dans les limites
   * du container.
   * minMargin = min(pos.x, 100-pos.x, pos.y, 100-pos.y) sur toutes les cases
   * → cellSize ≤ 2 * minMargin% * containerSize
   *
   * Plancher à 52 px : les plateaux 12 cases et daily (15 cases) ont des cases
   * aux positions très extrêmes (5–7% de marge), ce qui les ramènerait à ~38 px.
   * On les remonte à la taille des niveaux 6–11 (~53–60 px) pour que les
   * personnages et le cadenas restent lisibles.
   */
  const effectiveCellSize = React.useMemo(() => {
    if (containerSize.width === 0 || containerSize.height === 0) return CELL_SIZE;
    let minMarginPct = 50; // commence au centre, réduit selon positions extrêmes
    for (const pos of boardDef.cellPositions) {
      minMarginPct = Math.min(minMarginPct, pos.x, 100 - pos.x, pos.y, 100 - pos.y);
    }
    // La case doit tenir dans la marge disponible de chaque côté
    const maxCellSize = Math.floor(2 * (minMarginPct / 100) * Math.min(containerSize.width, containerSize.height));
    // Plancher : jamais en dessous de 52 px (taille des niveaux 6–11)
    const CELL_SIZE_MIN = 52;
    return Math.min(CELL_SIZE, Math.max(CELL_SIZE_MIN, maxCellSize));
  }, [containerSize, boardDef]);

  // Quand le bonus highlight est actif, les cases valides ont leur propre
  // indicateur (bordure + badge ✓ + pulsation verte) — les cases vides
  // non valides ne doivent PAS pulser pour éviter le bruit visuel.
  const hasSelection = selectedElement !== null && !highlightActive;

  // ── Connexions dédupliquées ────────────────────────────────
  const connections = React.useMemo(() => {
    const drawn = new Set<string>();
    const pairs: Array<{ fromIdx: number; toIdx: number }> = [];
    boardDef.connections.forEach((neighbors, fromIdx) => {
      neighbors.forEach(toIdx => {
        const key = [Math.min(fromIdx, toIdx), Math.max(fromIdx, toIdx)].join('-');
        if (!drawn.has(key)) {
          drawn.add(key);
          pairs.push({ fromIdx, toIdx });
        }
      });
    });
    return pairs;
  }, [boardDef]);

  // ── Cases ──────────────────────────────────────────────────
  const cells = boardDef.cellPositions.map((pos, idx) => {
    const { x, y } = cellPositionToPx(
      pos,
      containerSize.width,
      containerSize.height,
      effectiveCellSize
    );
    return (
      <Cell
        key={idx}
        cellIndex={idx}
        elementId={playerBoard[idx] ?? null}
        isFixed={fixedCells.has(idx)}
        backgroundColor={getCellColor(idx)}
        hasSelection={hasSelection}
        onPress={onCellPress}
        cellSize={effectiveCellSize}
        positionStyle={{ left: x, top: y }}
      />
    );
  });

  return (
    <ImageBackground
      source={boardDef.backgroundAsset as any}
      style={styles.container}
      imageStyle={styles.backgroundImage}
      resizeMode="cover"
      onLayout={onLayout}
    >
      {/* Couche SVG : lignes de connexion */}
      {containerSize.width > 0 && (
        <Svg
          style={StyleSheet.absoluteFill}
          width={containerSize.width}
          height={containerSize.height}
        >
          {connections.map(({ fromIdx, toIdx }) => (
            <Connection
              key={`${fromIdx}-${toIdx}`}
              from={boardDef.cellPositions[fromIdx]}
              to={boardDef.cellPositions[toIdx]}
              containerWidth={containerSize.width}
              containerHeight={containerSize.height}
              cellSize={effectiveCellSize}
            />
          ))}
        </Svg>
      )}

      {/* Cases */}
      {containerSize.width > 0 && cells}
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
    zIndex: 1,
    elevation: 1,
  },
  backgroundImage: {
    borderRadius: 16,
  },
});
