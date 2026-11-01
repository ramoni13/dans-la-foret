// ============================================================
// CONNECTION — Ligne SVG entre deux cases voisines
// Rendu purement déclaratif depuis BoardDefinition.connections
//
// Les lignes s'arrêtent au bord des cercles (pas sous eux).
//
// Trait unique : bleu marine foncé avec halo blanc pour être
// lisible sur fond clair (haut du plateau) et foncé (bas).
// Épaisseur et opacité varient selon la longueur normalisée :
//   court  → plus épais / plus opaque
//   long   → plus fin / plus transparent
// ============================================================

import React from 'react';
import { Line, G } from 'react-native-svg';
import { CellPosition } from '../../core/models/Board';
import { CELL_SIZE } from './Cell';

interface ConnectionProps {
  from: CellPosition;
  to: CellPosition;
  containerWidth: number;
  containerHeight: number;
  /** Taille effective des cases — pour calculer l'offset correct des lignes */
  cellSize?: number;
}

const LINE_GAP = 5;

// Trait principal : bleu marine foncé bien lisible sur fond clair et foncé
const STROKE_COLOR  = '#1a3a5c';
const HALO_COLOR    = 'rgba(255,255,255,0.55)';

// Épaisseur et opacité selon le ratio longueur/diagonale
function getStyle(ratio: number) {
  if (ratio < 0.25) return { width: 3.5, opacity: 1.00 };   // très court
  if (ratio < 0.40) return { width: 3.0, opacity: 0.90 };   // court-moyen
  if (ratio < 0.58) return { width: 2.5, opacity: 0.80 };   // moyen-long
  return               { width: 2.0, opacity: 0.70 };        // très long
}

export const Connection: React.FC<ConnectionProps> = ({
  from,
  to,
  containerWidth,
  containerHeight,
  cellSize,
}) => {
  const OFFSET = (cellSize ?? CELL_SIZE) / 2 + LINE_GAP;
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
    <G opacity={style.opacity}>
      {/* Halo blanc pour contraste sur fond clair */}
      <Line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={HALO_COLOR}
        strokeWidth={style.width + 2.5}
        strokeLinecap="round"
      />
      {/* Trait principal bleu marine */}
      <Line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={STROKE_COLOR}
        strokeWidth={style.width}
        strokeLinecap="round"
      />
    </G>
  );
};
