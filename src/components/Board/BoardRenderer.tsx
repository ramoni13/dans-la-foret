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
  hintCells: number[];
  hintType: 'valid' | 'invalid' | 'correct' | 'wrong' | null;
  selectedElement: string | null;
  hoveredCell?: number | null;
  getCellColor: (cellIndex: number) => string;
  onCellPress: (cellIndex: number) => void;
  onDrop: (cellIndex: number, elementId: string) => void;
  // Drag depuis une case de la grille vers une autre
  onCellDragStart?: (cellIndex: number, elementId: string, x: number, y: number) => void;
  onCellDragMove?: (x: number, y: number) => void;
  onCellDragEnd?: (x: number, y: number) => void;
}

export const BoardRenderer: React.FC<BoardRendererProps> = ({
  boardDef,
  playerBoard,
  fixedCells,
  getCellColor,
  onCellPress,
  onDrop,
  hoveredCell = null,
  onCellDragStart,
  onCellDragMove,
  onCellDragEnd,
}) => {
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setContainerSize({ width, height });
  }, []);

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
      CELL_SIZE
    );
    return (
      <Cell
        key={idx}
        cellIndex={idx}
        elementId={playerBoard[idx] ?? null}
        isFixed={fixedCells.has(idx)}
        backgroundColor={getCellColor(idx)}
        isDragTarget={hoveredCell === idx}
        onPress={onCellPress}
        onDrop={onDrop}
        positionStyle={{ left: x, top: y }}
        onCellDragStart={onCellDragStart}
        onCellDragMove={onCellDragMove}
        onCellDragEnd={onCellDragEnd}
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
    zIndex: 1,      // plateau en dessous du jeton dragé (zIndex 999)
    elevation: 1,   // Android
  },
  backgroundImage: {
    borderRadius: 16,
  },
});
