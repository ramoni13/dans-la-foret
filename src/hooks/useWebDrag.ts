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

    // ── Helpers partagés mouse + touch ────────────────────
    const handleMove = (x: number, y: number) => {
      setWebDragState(prev => ({ ...prev, ghostX: x, ghostY: y }));
      onDragMoveRef.current(x, y);
    };

    const handleEnd = (x: number, y: number) => {
      onDragEndRef.current(x, y);
      setWebDragState({ isDragging: false, elementId: null, ghostX: 0, ghostY: 0 });
      cleanup();
    };

    // ── Listeners souris (desktop) ────────────────────────
    const onMouseMove = (e: MouseEvent) => { e.preventDefault(); handleMove(e.clientX, e.clientY); };
    const onMouseUp = (e: MouseEvent) => { e.preventDefault(); handleEnd(e.clientX, e.clientY); };

    // ── Listeners touch (simulation mobile F12 + vrai mobile web) ──
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const t = e.touches[0];
      if (t) handleMove(t.clientX, t.clientY);
    };
    const onTouchEnd = (e: TouchEvent) => {
      e.preventDefault();
      const t = e.changedTouches[0];
      if (t) handleEnd(t.clientX, t.clientY);
    };

    const cleanup = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      cleanupRef.current = null;
    };

    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'grabbing';

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', onTouchEnd, { passive: false });

    cleanupRef.current = cleanup;
  }, [isWeb]);   // ← stable : tout passe par les refs

  return {
    webDragState,
    startWebDrag,
    isWeb,
  };
}
