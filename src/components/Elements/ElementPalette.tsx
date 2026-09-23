// ============================================================
// ELEMENTPALETTE — Palette de jetons disponibles
// Affiche les jetons restants à placer avec leur compteur
// Web : intègre DragGhost + useWebDrag pour le drag natif
// ============================================================

import React from 'react';
import { View, Text, StyleSheet, ScrollView, Platform, useWindowDimensions } from 'react-native';

import { ElementToken, TOKEN_SIZE, MobileDragCallbacks } from './ElementToken';
import { DragGhost } from './DragGhost';
import { useWebDrag } from '../../hooks/useWebDrag';
import { ElementRegistry } from '../../elements/ElementRegistry';
import { TokenCount } from '../../core/models/Challenge';
import { Colors } from '../../constants/colors';

// Taille minimale en dessous de laquelle le jeton devient illisible
const TOKEN_MIN_SIZE = 44;
// Marges horizontales du conteneur (paddingHorizontal * 2 + scroll padding * 2)
const PALETTE_H_PADDING = (8 + 4) * 2;
// Espace réservé au badge (+8 autour du jeton) + gap entre jetons
const TOKEN_WRAPPER_EXTRA = 8; // selectedRing padding
const GAP = 12;

interface ElementPaletteProps {
  availableTokens: TokenCount[];
  playerBoard: (string | null)[];
  fixedCells: Set<number>;          // ← cases fixes à exclure du décompte
  selectedElement: string | null;
  onSelectElement: (elementId: string | null) => void;
  onDragStart: (elementId: string) => void;
  onDragMove: (x: number, y: number) => void;
  onDragEnd: (x: number, y: number) => void;
  mobileDragCallbacks?: MobileDragCallbacks; // ghost natif mobile
}

export const ElementPalette: React.FC<ElementPaletteProps> = ({
  availableTokens,
  playerBoard,
  fixedCells,
  selectedElement,
  onSelectElement,
  onDragStart,
  onDragMove,
  onDragEnd,
  mobileDragCallbacks,
}) => {
  const isWeb = Platform.OS === 'web';
  const { width: screenWidth } = useWindowDimensions();

  // Calcule la taille de jeton adaptée pour que tous les jetons tiennent
  // sans scroll horizontal sur l'écran courant.
  const tokenSize = React.useMemo(() => {
    const tokenCount = availableTokens.length;
    if (tokenCount === 0) return TOKEN_SIZE;
    // Largeur disponible = écran - marges palette
    const availableWidth = screenWidth - PALETTE_H_PADDING;
    // Chaque wrapper = taille + TOKEN_WRAPPER_EXTRA, séparés par GAP
    // totalWidth = tokenCount * (size + TOKEN_WRAPPER_EXTRA) + (tokenCount - 1) * GAP
    const maxSize = Math.floor(
      (availableWidth - (tokenCount - 1) * GAP) / tokenCount - TOKEN_WRAPPER_EXTRA
    );
    return Math.max(TOKEN_MIN_SIZE, Math.min(TOKEN_SIZE, maxSize));
  }, [availableTokens.length, screenWidth]);

  // ── Ghost web ───────────────────────────────────────────────
  const { webDragState, startWebDrag } = useWebDrag({
    onDragStart,
    onDragMove,
    onDragEnd,
  });

  // Ne compter que les jetons posés par le JOUEUR (cases non-fixes)
  // Les fixedPlacements sont déjà sur le plateau et ne viennent pas de la palette
  const placedCounts = React.useMemo(() => {
    const counts: Record<string, number> = {};
    playerBoard.forEach((el, i) => {
      if (el && !fixedCells.has(i)) {
        counts[el] = (counts[el] ?? 0) + 1;
      }
    });
    return counts;
  }, [playerBoard, fixedCells]);

  return (
    <View style={styles.container}>
      {/* Ghost web : rendu dans document.body via portail */}
      {isWeb && (
        <DragGhost
          elementId={webDragState.elementId}
          x={webDragState.ghostX}
          y={webDragState.ghostY}
          visible={webDragState.isDragging}
        />
      )}

      <Text style={styles.title}>Jetons disponibles</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { gap: GAP }]}
      >
        {availableTokens.map(({ elementId, count }) => {
          const elementDef = ElementRegistry[elementId];
          if (!elementDef) return null;

          const placed     = placedCounts[elementId] ?? 0;
          const remaining  = count - placed;
          const isSelected = selectedElement === elementId;
          const isEmpty    = remaining <= 0;

          // Styles dynamiques basés sur tokenSize calculé
          const wrapperSize = tokenSize + TOKEN_WRAPPER_EXTRA;
          const ringStyle = {
            position: 'absolute' as const,
            top: -4,
            left: -4,
            width: wrapperSize,
            height: wrapperSize,
            borderRadius: wrapperSize / 2,
            borderWidth: 3,
            borderColor: elementDef.color,
            zIndex: 0,
          };

          return (
            <View key={elementId} style={[styles.tokenWrapper, { width: wrapperSize }]}>
              {isSelected && <View style={ringStyle} />}
              <ElementToken
                elementDef={elementDef}
                isFixed={isEmpty}
                size={tokenSize}
                onDragStart={!isEmpty ? onDragStart : undefined}
                onDragMove={!isEmpty ? onDragMove : undefined}
                onDragEnd={!isEmpty ? onDragEnd : undefined}
                mobileDragCallbacks={!isWeb && !isEmpty ? mobileDragCallbacks : undefined}
                onWebMouseDown={isWeb && !isEmpty ? startWebDrag : undefined}
                onTap={!isEmpty ? () => onSelectElement(isSelected ? null : elementId) : undefined}
              />
              <View style={[
                styles.badge,
                { backgroundColor: isEmpty ? Colors.ui.border : elementDef.color },
              ]}>
                <Text style={styles.badgeText}>{remaining}</Text>
              </View>
              <Text style={[styles.label, isEmpty && styles.labelEmpty]} numberOfLines={1}>
                {elementDef.label}
              </Text>
              {isEmpty && <View style={[styles.emptyOverlay, { borderRadius: tokenSize / 2 }]} />}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.ui.card,
    borderTopWidth: 1,
    borderTopColor: Colors.ui.border,
    paddingVertical: 16,
    paddingHorizontal: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,         // ← réduit pour ne pas écraser le jeton dragé (elevation 999)
    zIndex: 2,            // ← au-dessus du plateau (1) mais sous le jeton dragé (999)
    overflow: 'visible',  // ← laisse le jeton sortir vers le haut pendant le drag
  },
  title: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.ui.textLight,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 14, // ← plus d'espace pour que la pastille ne soit pas coupée
    marginLeft: 4,
  },
  scroll: {
    flexDirection: 'row',
    alignItems: 'center',
    // gap est passé dynamiquement via style inline
    paddingHorizontal: 4,
    paddingTop: 8, // ← espace pour la pastille en haut
  },
  tokenWrapper: {
    alignItems: 'center',
    position: 'relative',
    // width est passé dynamiquement (tokenSize + TOKEN_WRAPPER_EXTRA)
    overflow: 'visible',  // ← le jeton doit pouvoir sortir du wrapper pendant le drag
    zIndex: 100,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    zIndex: 10,
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  label: {
    marginTop: 6,
    fontSize: 10,
    color: Colors.ui.textLight,
    fontWeight: '500',
  },
  labelEmpty: {
    color: Colors.ui.border,
  },
  emptyOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(255,255,255,0.6)',
    // borderRadius est passé dynamiquement (tokenSize / 2)
    pointerEvents: 'none' as any, // ne bloque pas le drag même quand vide
  },
});
