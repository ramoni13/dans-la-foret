// ============================================================
// HOOK useDragDrop
// Coordonne le drag depuis la palette vers le plateau.
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
  onDrop: (cellIndex: number, elementId: string) => void;
  findNearestCell: (x: number, y: number) => number | null;
}

export function useDragDrop({ onDrop, findNearestCell }: UseDragDropOptions) {
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
  const findNearestRef = useRef(findNearestCell);
  const onDropRef = useRef(onDrop);
  findNearestRef.current = findNearestCell;   // mise à jour à chaque render
  onDropRef.current = onDrop;

  // Case actuellement survolée (pour le highlight)
  const [hoveredCell, setHoveredCell] = useState<number | null>(null);

  const handleDragStart = useCallback((elementId: string) => {
    elementIdRef.current = elementId;
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

    if (nearest !== null && elementId) {
      onDropRef.current(nearest, elementId);
      impactLight();
    } else {
      notificationWarning();
    }

    elementIdRef.current = null;
    setDragState({ isDragging: false, elementId: null, currentX: 0, currentY: 0 });
    setHoveredCell(null);
  }, []);   // ← aucune dépendance : tout passe par les refs

  return {
    dragState,
    hoveredCell,
    handleDragStart,
    handleDragMove,
    handleDragEnd,
  };
}
