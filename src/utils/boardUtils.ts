// ============================================================
// UTILITAIRES PLATEAU
// ============================================================

import { BoardDefinition, CellPosition } from '../core/models/Board';

/**
 * Convertit une position en pourcentage vers des pixels absolus.
 */
export function cellPositionToPx(
  pos: CellPosition,
  containerWidth: number,
  containerHeight: number,
  cellSize: number
): { x: number; y: number } {
  return {
    x: (pos.x / 100) * containerWidth - cellSize / 2,
    y: (pos.y / 100) * containerHeight - cellSize / 2,
  };
}

/**
 * Trouve la case la plus proche d'un point (x, y) en pixels.
 * Utilisé pour le snap du drag & drop.
 */
export function findNearestCell(
  px: number,
  py: number,
  boardDef: BoardDefinition,
  containerWidth: number,
  containerHeight: number,
  cellSize: number,
  snapRadius: number = 60
): number | null {
  let nearestIdx: number | null = null;
  let minDist = snapRadius;

  for (let i = 0; i < boardDef.cellPositions.length; i++) {
    const pos = boardDef.cellPositions[i];
    const cx = (pos.x / 100) * containerWidth;
    const cy = (pos.y / 100) * containerHeight;
    const dist = Math.sqrt((px - cx) ** 2 + (py - cy) ** 2);

    if (dist < minDist) {
      minDist = dist;
      nearestIdx = i;
    }
  }

  return nearestIdx;
}

/**
 * Retourne les voisins d'une case.
 */
export function getNeighbors(cellIndex: number, boardDef: BoardDefinition): number[] {
  return boardDef.connections[cellIndex] ?? [];
}

/**
 * Formate le temps en mm:ss.
 */
export function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
