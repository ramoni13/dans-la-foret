// ============================================================
// HOOK useDragDrop
// Coordonne le drag depuis la palette OU depuis une case du plateau.
// Maintient l'état du drag en cours et notifie le BoardRenderer.
// ============================================================

import { useState, useCallback, useRef } from 'react';
import { impactMedium, impactLight, notificationWarning } from '../utils/haptics';

interface DragState {
  isDragging: boolean;
  elementId: string | null;
  currentX: number;
  currentY: number;
}

interface UseDragDropOptions {
  // Appelé quand le drag vient de la palette (sourceCell = null)
  onDrop: (cellIndex: number, elementId: string) => void;
  // Appelé quand le drag vient d'une case de la grille
  onMoveFromCell: (fromCell: number, toCell: number) => void;
  findNearestCell: (x: number, y: number) => number | null;
}

export function useDragDrop({ onDrop, onMoveFromCell, findNearestCell }: UseDragDropOptions) {
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    elementId: null,
    currentX: 0,
    currentY: 0,
  });

  // ── Refs pour éviter les problèmes de closure ────────────────
  // Le state React est asynchrone : au moment du mouseup,
  // les callbacks liraient d'anciennes valeurs via leur closure.
  // Les refs sont toujours synchrones et à jour.
  const elementIdRef = useRef<string | null>(null);
  // null = drag depuis la palette, number = index de la case source
  const sourceCellRef = useRef<number | null>(null);
  const findNearestRef = useRef(findNearestCell);
  const onDropRef = useRef(onDrop);
  const onMoveFromCellRef = useRef(onMoveFromCell);
  findNearestRef.current = findNearestCell;   // mise à jour à chaque render
  onDropRef.current = onDrop;
  onMoveFromCellRef.current = onMoveFromCell;

  // Case actuellement survolée (pour le highlight)
  const [hoveredCell, setHoveredCell] = useState<number | null>(null);

  // Drag depuis la palette
  const handleDragStart = useCallback((elementId: string) => {
    elementIdRef.current = elementId;
    sourceCellRef.current = null;
    setDragState({ isDragging: true, elementId, currentX: 0, currentY: 0 });
    impactMedium();
  }, []);

  // Drag depuis une case de la grille
  const handleCellDragStart = useCallback((cellIndex: number, elementId: string) => {
    elementIdRef.current = elementId;
    sourceCellRef.current = cellIndex;
    setDragState({ isDragging: true, elementId, currentX: 0, currentY: 0 });
    impactMedium();
  }, []);

  const handleDragMove = useCallback((x: number, y: number) => {
    setDragState(prev => ({ ...prev, currentX: x, currentY: y }));
    const nearest = findNearestRef.current(x, y);
    setHoveredCell(nearest);
  }, []);

  const handleDragEnd = useCallback((x: number, y: number) => {
    const nearest = findNearestRef.current(x, y);
    const elementId = elementIdRef.current;
    const sourceCell = sourceCellRef.current;

    if (nearest !== null && elementId) {
      if (sourceCell !== null) {
        // Drag grille → grille : déplacement ou permutation
        onMoveFromCellRef.current(sourceCell, nearest);
      } else {
        // Drag palette → grille : placement classique
        onDropRef.current(nearest, elementId);
      }
      impactLight();
    } else {
      notificationWarning();
    }

    elementIdRef.current = null;
    sourceCellRef.current = null;
    setDragState({ isDragging: false, elementId: null, currentX: 0, currentY: 0 });
    setHoveredCell(null);
  }, []);   // ← aucune dépendance : tout passe par les refs

  return {
    dragState,
    hoveredCell,
    handleDragStart,
    handleCellDragStart,
    handleDragMove,
    handleDragEnd,
  };
}
