// ============================================================
// CONNECTION — Ligne SVG entre deux cases voisines
// Rendu purement déclaratif depuis BoardDefinition.connections
// ============================================================

import React from 'react';
import { Line } from 'react-native-svg';
import { CellPosition } from '../../core/models/Board';
import { Colors } from '../../constants/colors';

interface ConnectionProps {
  from: CellPosition;
  to: CellPosition;
  containerWidth: number;
  containerHeight: number;
}

export const Connection: React.FC<ConnectionProps> = ({
  from,
  to,
  containerWidth,
  containerHeight,
}) => {
  const x1 = (from.x / 100) * containerWidth;
  const y1 = (from.y / 100) * containerHeight;
  const x2 = (to.x / 100) * containerWidth;
  const y2 = (to.y / 100) * containerHeight;

  return (
    <Line
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      stroke={Colors.forest.light}
      strokeWidth={3}
      strokeLinecap="round"
      opacity={0.6}
    />
  );
};
