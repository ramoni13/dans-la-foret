// ============================================================
// ELEMENTPALETTE — Palette de jetons disponibles
// Tap pour sélectionner un jeton → tap sur une case pour placer
// Animations : spring scale-up + halo pulsant sur le jeton sélectionné
// ============================================================

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  useWindowDimensions,
  Animated,
  Platform,
} from 'react-native';

import { ElementToken, TOKEN_SIZE } from './ElementToken';
import { ElementRegistry } from '../../elements/ElementRegistry';
import { TokenCount } from '../../core/models/Challenge';
import { Colors } from '../../constants/colors';
import { impactLight } from '../../utils/haptics';

const ARROW_RIGHT = require('../../../assets/elements/design_app/fleche.png');
const ARROW_LEFT  = require('../../../assets/elements/design_app/fleche_gauche.png');

// Taille minimale en dessous de laquelle le jeton devient illisible
const TOKEN_MIN_SIZE = 44;
// Marges horizontales du conteneur
const PALETTE_H_PADDING = (8 + 4) * 2;
// Espace réservé au badge + gap entre jetons
const TOKEN_WRAPPER_EXTRA = 8;
const GAP = 12;

// ── Composant wrapper animé pour chaque jeton ───────────────────────────────
interface AnimatedTokenWrapperProps {
  elementId: string;
  elementColor: string;
  isSelected: boolean;
  isEmpty: boolean;
  remaining: number;
  tokenSize: number;
  onSelect: () => void;
  label: string;
  elementDef: any;
}

const AnimatedTokenWrapper: React.FC<AnimatedTokenWrapperProps> = ({
  elementId,
  elementColor,
  isSelected,
  isEmpty,
  remaining,
  tokenSize,
  onSelect,
  label,
  elementDef,
}) => {
  const wrapperSize = tokenSize + TOKEN_WRAPPER_EXTRA;

  // ── Animations (Animated API RN — compatible web + mobile) ──
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const haloOpacity = useRef(new Animated.Value(0)).current;
  const haloScale = useRef(new Animated.Value(1)).current;
  const badgeScale = useRef(new Animated.Value(1)).current;
  const haloLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  // Ref pour détecter le changement de remaining (bounce du badge)
  const prevRemainingRef = useRef(remaining);

  // ── Animation de sélection / désélection ────────────────────
  useEffect(() => {
    if (isSelected) {
      // Scale-up spring
      Animated.spring(scaleAnim, {
        toValue: 1.15,
        friction: 5,
        tension: 200,
        useNativeDriver: Platform.OS !== 'web',
      }).start();

      // Halo pulsant : apparaît puis pulse
      haloOpacity.setValue(0);
      haloScale.setValue(0.8);
      Animated.timing(haloOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: Platform.OS !== 'web',
      }).start();

      haloLoopRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(haloScale, {
            toValue: 1.25,
            duration: 800,
            useNativeDriver: Platform.OS !== 'web',
          }),
          Animated.timing(haloScale, {
            toValue: 1.05,
            duration: 800,
            useNativeDriver: Platform.OS !== 'web',
          }),
        ])
      );
      haloLoopRef.current.start();
    } else {
      // Retour à la normale
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 6,
        tension: 180,
        useNativeDriver: Platform.OS !== 'web',
      }).start();

      haloLoopRef.current?.stop();
      haloLoopRef.current = null;
      Animated.timing(haloOpacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: Platform.OS !== 'web',
      }).start();
    }

    return () => { haloLoopRef.current?.stop(); };
  }, [isSelected]);

  // ── Bounce du badge quand remaining change (retour de jeton) ──
  useEffect(() => {
    if (remaining !== prevRemainingRef.current) {
      prevRemainingRef.current = remaining;
      Animated.sequence([
        Animated.timing(badgeScale, {
          toValue: 1.4,
          duration: 120,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.spring(badgeScale, {
          toValue: 1,
          friction: 4,
          tension: 200,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]).start();
    }
  }, [remaining]);

  const handleTap = () => {
    if (!isEmpty) {
      impactLight();
      onSelect();
    }
  };

  return (
    <View style={[styles.tokenWrapper, { width: wrapperSize }]}>
      {/* Halo pulsant (derrière le jeton) */}
      <Animated.View
        style={[
          styles.halo,
          {
            width: wrapperSize + 8,
            height: wrapperSize + 8,
            borderRadius: (wrapperSize + 8) / 2,
            backgroundColor: elementColor + '25',
            borderColor: elementColor + '50',
            opacity: haloOpacity,
            transform: [{ scale: haloScale }],
          },
        ]}
        pointerEvents="none"
      />

      {/* Jeton avec scale animé */}
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <ElementToken
          elementDef={elementDef}
          isFixed={isEmpty}
          size={tokenSize}
          onTap={handleTap}
        />
      </Animated.View>

      {/* Badge compteur avec bounce */}
      <Animated.View style={[
        styles.badge,
        {
          backgroundColor: isEmpty ? Colors.ui.border : elementColor,
          transform: [{ scale: badgeScale }],
        },
      ]}>
        <Text style={styles.badgeText}>{remaining}</Text>
      </Animated.View>

      <Text style={[styles.label, isEmpty && styles.labelEmpty]} numberOfLines={1}>
        {label}
      </Text>

      {isEmpty && <View style={[styles.emptyOverlay, { borderRadius: tokenSize / 2 }]} />}
    </View>
  );
};

// ── Composant principal ─────────────────────────────────────────────────────
interface ElementPaletteProps {
  availableTokens: TokenCount[];
  playerBoard: (string | null)[];
  fixedCells: Set<number>;
  selectedElement: string | null;
  onSelectElement: (elementId: string | null) => void;
}

// Largeur du scroll à déplacer par tap de flèche
const ARROW_SCROLL_STEP = 140;
// Taille des flèches
const ARROW_SIZE = 28;

export const ElementPalette: React.FC<ElementPaletteProps> = ({
  availableTokens,
  playerBoard,
  fixedCells,
  selectedElement,
  onSelectElement,
}) => {
  const { width: screenWidth } = useWindowDimensions();
  const scrollRef   = useRef<ScrollView>(null);
  const scrollX     = useRef(0);
  const [canScrollLeft,  setCanScrollLeft]  = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const contentWidth  = useRef(0);
  const containerWidth = useRef(0);

  const updateArrows = (x: number) => {
    setCanScrollLeft(x > 4);
    setCanScrollRight(x < contentWidth.current - containerWidth.current - 4);
  };

  const tokenSize = React.useMemo(() => {
    const tokenCount = availableTokens.length;
    if (tokenCount === 0) return TOKEN_SIZE;
    const availableWidth = screenWidth - PALETTE_H_PADDING;
    const maxSize = Math.floor(
      (availableWidth - (tokenCount - 1) * GAP) / tokenCount - TOKEN_WRAPPER_EXTRA
    );
    return Math.max(TOKEN_MIN_SIZE, Math.min(TOKEN_SIZE, maxSize));
  }, [availableTokens.length, screenWidth]);

  const placedCounts = React.useMemo(() => {
    const counts: Record<string, number> = {};
    playerBoard.forEach((el, i) => {
      if (el && !fixedCells.has(i)) {
        counts[el] = (counts[el] ?? 0) + 1;
      }
    });
    return counts;
  }, [playerBoard, fixedCells]);

  const scrollLeft = () => {
    const next = Math.max(0, scrollX.current - ARROW_SCROLL_STEP);
    scrollRef.current?.scrollTo({ x: next, animated: true });
  };

  const scrollRight = () => {
    const next = scrollX.current + ARROW_SCROLL_STEP;
    scrollRef.current?.scrollTo({ x: next, animated: true });
  };

  const showArrows = canScrollLeft || canScrollRight;

  return (
    <View style={styles.container}>
      {/* Titre + flèches à droite (uniquement si le contenu déborde) */}
      <View style={styles.titleRow}>
        <Text style={styles.title}>Jetons disponibles</Text>
        {showArrows && (
          <View style={styles.arrowsInline}>
            <TouchableOpacity
              onPress={scrollLeft}
              activeOpacity={canScrollLeft ? 0.7 : 0.3}
              hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
              disabled={!canScrollLeft}
            >
              <Image
                source={ARROW_LEFT}
                style={[styles.arrowImg, !canScrollLeft && styles.arrowDisabled]}
                resizeMode="contain"
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={scrollRight}
              activeOpacity={canScrollRight ? 0.7 : 0.3}
              hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
              disabled={!canScrollRight}
            >
              <Image
                source={ARROW_RIGHT}
                style={[styles.arrowImg, !canScrollRight && styles.arrowDisabled]}
                resizeMode="contain"
              />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* ScrollView sans flèches latérales — layout intact */}
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { gap: GAP }]}
        onScroll={(e) => {
          scrollX.current = e.nativeEvent.contentOffset.x;
          updateArrows(scrollX.current);
        }}
        scrollEventThrottle={16}
        onLayout={(e) => {
          containerWidth.current = e.nativeEvent.layout.width;
          updateArrows(scrollX.current);
        }}
        onContentSizeChange={(w) => {
          contentWidth.current = w;
          updateArrows(scrollX.current);
        }}
      >
        {availableTokens.map(({ elementId, count }) => {
          const elementDef = ElementRegistry[elementId];
          if (!elementDef) return null;

          const placed    = placedCounts[elementId] ?? 0;
          const remaining = count - placed;
          const isSelected = selectedElement === elementId;
          const isEmpty    = remaining <= 0;

          return (
            <AnimatedTokenWrapper
              key={elementId}
              elementId={elementId}
              elementColor={elementDef.color}
              isSelected={isSelected}
              isEmpty={isEmpty}
              remaining={remaining}
              tokenSize={tokenSize}
              onSelect={() => onSelectElement(isSelected ? null : elementId)}
              label={elementDef.label}
              elementDef={elementDef}
            />
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
    elevation: 2,
    zIndex: 2,
  },
  title: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.ui.textLight,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    marginLeft: 4,
  },
  arrowsInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 8,
  },
  arrowImg: {
    width: ARROW_SIZE,
    height: ARROW_SIZE,
  },
  arrowDisabled: {
    opacity: 0.3,
  },
  scroll: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingTop: 12, // espace pour le halo
  },
  tokenWrapper: {
    alignItems: 'center',
    position: 'relative',
    overflow: 'visible',
    zIndex: 100,
  },
  halo: {
    position: 'absolute',
    top: -8,
    left: -8,
    borderWidth: 2,
    zIndex: -1,
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
    pointerEvents: 'none' as any,
  },
});
