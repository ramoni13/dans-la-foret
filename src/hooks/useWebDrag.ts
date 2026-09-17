// ============================================================
// HOOK useWebDrag — Drag & Drop natif pour le navigateur web
// Utilise les événements souris natifs (mousedown/mousemove/mouseup)
// Le ghost suit le curseur via un portail rendu dans document.body
// Compatible avec le hook useDragDrop existant (même interface)
// ============================================================

import { useState, useCallback, useRef, useEffect } from 'react';
import { Platform } from 'react-native';

export interface WebDragState {
  isDragging: boolean;
  elementId: string | null;
  ghostX: number;  // position absolue dans la page (px)
  ghostY: number;
}

interface UseWebDragOptions {
  onDragStart: (elementId: string) => void;
  onDragMove: (x: number, y: number) => void;
  onDragEnd: (x: number, y: number) => void;
}

export function useWebDrag({ onDragStart, onDragMove, onDragEnd }: UseWebDragOptions) {
  const [webDragState, setWebDragState] = useState<WebDragState>({
    isDragging: false,
    elementId: null,
    ghostX: 0,
    ghostY: 0,
  });

  const isWeb = Platform.OS === 'web';

  // ── Refs : callbacks toujours à jour, sans problème de closure ─
  const onDragStartRef = useRef(onDragStart);
  const onDragMoveRef = useRef(onDragMove);
  const onDragEndRef = useRef(onDragEnd);
  onDragStartRef.current = onDragStart;
  onDragMoveRef.current = onDragMove;
  onDragEndRef.current = onDragEnd;

  // ── Nettoyage des listeners globaux ───────────────────────
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      if (cleanupRef.current) cleanupRef.current();
    };
  }, []);

  // ── Démarrer le drag (appelé depuis ElementToken) ─────────
  const startWebDrag = useCallback((elementId: string, startX: number, startY: number) => {
    if (!isWeb) return;

    setWebDragState({
      isDragging: true,
      elementId,
      ghostX: startX,
      ghostY: startY,
    });

    onDragStartRef.current(elementId);

    // ── Listeners globaux sur document ────────────────────
    const onMouseMove = (e: MouseEvent) => {
      e.preventDefault();
      setWebDragState(prev => ({
        ...prev,
        ghostX: e.clientX,
        ghostY: e.clientY,
      }));
      onDragMoveRef.current(e.clientX, e.clientY);
    };

    const onMouseUp = (e: MouseEvent) => {
      e.preventDefault();
      // Via ref : garantit la version à jour de handleDragEnd
      onDragEndRef.current(e.clientX, e.clientY);

      setWebDragState({
        isDragging: false,
        elementId: null,
        ghostX: 0,
        ghostY: 0,
      });

      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      cleanupRef.current = null;

      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };

    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'grabbing';

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);

    cleanupRef.current = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [isWeb]);   // ← stable : tout passe par les refs

  return {
    webDragState,
    startWebDrag,
    isWeb,
  };
}
