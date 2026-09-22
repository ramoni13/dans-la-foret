// ============================================================
// CONNECTION — Ligne SVG entre deux cases voisines
// Rendu purement déclaratif depuis BoardDefinition.connections
//
// Les lignes s'arrêtent au bord des cercles (pas sous eux).
//
// Palette de 4 couleurs foncées selon la longueur normalisée
// (court → long) pour hiérarchiser la lecture du graphe :
//   Q1 (très court)  : vert forêt foncé
//   Q2 (court-moyen) : bleu nuit
//   Q3 (moyen-long)  : marron foncé
//   Q4 (très long)   : gris anthracite
// Les lignes plus courtes = connexions directes = plus épaisses/opaques.
// ============================================================

import React from 'react';
import { Line } from 'react-native-svg';
import { CellPosition } from '../../core/models/Board';
import { CELL_SIZE } from './Cell';

interface ConnectionProps {
  from: CellPosition;
  to: CellPosition;
  containerWidth: number;
  containerHeight: number;
}

const CELL_RADIUS = CELL_SIZE / 2;
const LINE_GAP = 5;
const OFFSET = CELL_RADIUS + LINE_GAP;

// 4 couleurs foncées, lisibles sur fond vert vif
const PALETTE = [
  { color: '#1B4332', width: 3.0, opacity: 0.95 }, // Q1 très court  — vert forêt foncé
  { color: '#1A237E', width: 2.5, opacity: 0.85 }, // Q2 court-moyen — bleu nuit
  { color: '#4E2C0A', width: 2.0, opacity: 0.75 }, // Q3 moyen-long  — marron foncé
  { color: '#37474F', width: 1.5, opacity: 0.60 }, // Q4 très long   — gris anthracite
];

// Seuils de découpage en quartiles (ratio longueur / diagonale container)
const THRESHOLDS = [0.25, 0.40, 0.58]; // < Q1 | Q1-Q2 | Q2-Q3 | > Q3

function getStyle(ratio: number) {
  if (ratio < THRESHOLDS[0]) return PALETTE[0];
  if (ratio < THRESHOLDS[1]) return PALETTE[1];
  if (ratio < THRESHOLDS[2]) return PALETTE[2];
  return PALETTE[3];
}

export const Connection: React.FC<ConnectionProps> = ({
  from,
  to,
  containerWidth,
  containerHeight,
}) => {
  const cx1 = (from.x / 100) * containerWidth;
  const cy1 = (from.y / 100) * containerHeight;
  const cx2 = (to.x / 100) * containerWidth;
  const cy2 = (to.y / 100) * containerHeight;

  const dx = cx2 - cx1;
  const dy = cy2 - cy1;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist === 0) return null;

  const diagonal = Math.sqrt(containerWidth * containerWidth + containerHeight * containerHeight);
  const ratio = dist / diagonal;
  const style = getStyle(ratio);

  const ux = dx / dist;
  const uy = dy / dist;

  const x1 = cx1 + ux * OFFSET;
  const y1 = cy1 + uy * OFFSET;
  const x2 = cx2 - ux * OFFSET;
  const y2 = cy2 - uy * OFFSET;

  return (
    <Line
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      stroke={style.color}
      strokeWidth={style.width}
      strokeLinecap="round"
      opacity={style.opacity}
    />
  );
};
