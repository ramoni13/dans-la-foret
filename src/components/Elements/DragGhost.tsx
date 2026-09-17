// ============================================================
// DRAGGHOST — Fantôme visuel pendant le drag (web uniquement)
// Rendu dans document.body via un portail React
// Suit le curseur en position fixed, toujours au-dessus de tout
// ============================================================

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ElementRegistry } from '../../elements/ElementRegistry';

export const TOKEN_SIZE = 64;

interface DragGhostProps {
  elementId: string | null;
  x: number;
  y: number;
  visible: boolean;
}

export const DragGhost: React.FC<DragGhostProps> = ({ elementId, x, y, visible }) => {
  // On utilise un state pour forcer un re-render après la création du div
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const div = document.createElement('div');
    div.id = 'drag-ghost-portal';
    document.body.appendChild(div);
    setPortalRoot(div);

    return () => {
      document.body.removeChild(div);
    };
  }, []);

  // Pas encore monté, ou drag inactif
  if (!portalRoot || !visible || !elementId) return null;

  const elementDef = ElementRegistry[elementId];
  if (!elementDef) return null;

  const iconSrc = typeof elementDef.icon === 'string'
    ? elementDef.icon
    : (elementDef.icon as any)?.uri ?? '';

  return createPortal(
    <div
      style={{
        position: 'fixed',
        left: x - TOKEN_SIZE / 2,
        top: y - TOKEN_SIZE / 2,
        width: TOKEN_SIZE,
        height: TOKEN_SIZE,
        borderRadius: TOKEN_SIZE / 2,
        backgroundColor: elementDef.color + '33',
        border: `3px solid ${elementDef.color}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999,          // toujours au-dessus de tout
        pointerEvents: 'none',  // ne bloque pas les événements souris
        transform: 'scale(1.15)',
        opacity: 0.92,
        boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
        transition: 'none',
      }}
    >
      {iconSrc ? (
        <img
          src={iconSrc}
          alt={elementDef.label}
          style={{
            width: TOKEN_SIZE * 0.7,
            height: TOKEN_SIZE * 0.7,
            objectFit: 'contain',
            pointerEvents: 'none',
          }}
        />
      ) : (
        <span style={{ fontSize: 28 }}>{elementDef.label[0]}</span>
      )}
    </div>,
    portalRoot
  );
};
