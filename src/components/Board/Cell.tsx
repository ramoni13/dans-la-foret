// ============================================================
// CELL — Case individuelle du plateau
//
// Distinction visuelle cases fixes vs joueur :
// - Cases fixes : bordure grise épaisse + fond assombri + micro-cadenas
// - Cases joueur : bordure verte fine, fond clair
//
// Bonus visuels (ergonomie cognitive — triple codage redondant) :
// - Cases valides (highlight) : bordure verte + badge ✓ + pulsation halo vert
// - Cases en erreur (Instinct) : bordure rouge + badge ⚠ + pulsation halo rouge
//
// Animations :
// - Pop-in spring   quand un jeton est PLACÉ (elementId : null → valeur)
// - Shrink + fade   quand un jeton est RETIRÉ (elementId : valeur → null)
// - Pulsation douce des cases vides quand un jeton est sélectionné
// - Haptic feedback au placement et au retrait
// ============================================================

import React, { useCallback, useEffect, useRef } from 'react';
import {
  Animated,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
  Platform,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import ReAnimated, {
  useSharedValue,
  useAnimatedStyle,
  runOnJS,
} from 'react-native-reanimated';
import { Colors } from '../../constants/colors';
import { ElementRegistry } from '../../elements/ElementRegistry';
import { impactLight, impactMedium } from '../../utils/haptics';

export const CELL_SIZE = 64;

interface CellProps {
  cellIndex: number;
  elementId: string | null;
  isFixed: boolean;
  backgroundColor: string;
  hasSelection: boolean;    // un jeton est sélectionné dans la palette
  positionStyle: ViewStyle;
  onPress: (cellIndex: number) => void;
}

const native = Platform.OS !== 'web';

const CellComponent: React.FC<CellProps> = ({
  cellIndex,
  elementId,
  isFixed,
  backgroundColor,
  hasSelection,
  positionStyle,
  onPress,
}) => {
  const elementDef = elementId ? ElementRegistry[elementId] : null;

  // ── Détection des états bonus ────────────────────────────
  const isHighlighted = backgroundColor === Colors.cell.valid;
  const isErrorCell   = backgroundColor === Colors.cell.wrong;

  // ── Pulsation bonus (highlight valide OU erreur Instinct) ──
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const loopRef   = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (isHighlighted || isErrorCell) {
      loopRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.35,
            duration: 600,
            useNativeDriver: native,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: native,
          }),
        ])
      );
      loopRef.current.start();
    } else {
      loopRef.current?.stop();
      loopRef.current = null;
      pulseAnim.setValue(1);
    }
    return () => { loopRef.current?.stop(); };
  }, [isHighlighted, isErrorCell]);

  // ── Pop-in / shrink-fade pour le contenu du jeton ──────────
  const contentScale   = useRef(new Animated.Value(elementId ? 1 : 0)).current;
  const contentOpacity = useRef(new Animated.Value(elementId ? 1 : 0)).current;
  const prevElementRef = useRef(elementId);

  useEffect(() => {
    const prevEl = prevElementRef.current;
    prevElementRef.current = elementId;

    if (prevEl === null && elementId !== null) {
      // ── PLACEMENT : pop-in spring ──────────────────────────
      contentScale.setValue(0);
      contentOpacity.setValue(1);
      Animated.spring(contentScale, {
        toValue: 1,
        friction: 5,
        tension: 200,
        useNativeDriver: native,
      }).start();
      impactLight();

    } else if (prevEl !== null && elementId === null) {
      // ── RETRAIT : shrink + fade ────────────────────────────
      Animated.parallel([
        Animated.timing(contentScale, {
          toValue: 0,
          duration: 180,
          useNativeDriver: native,
        }),
        Animated.timing(contentOpacity, {
          toValue: 0,
          duration: 180,
          useNativeDriver: native,
        }),
      ]).start();
      impactMedium();

    } else if (prevEl !== null && elementId !== null && prevEl !== elementId) {
      // ── SWAP : un élément remplace un autre → petit pop ────
      contentScale.setValue(0.7);
      contentOpacity.setValue(1);
      Animated.spring(contentScale, {
        toValue: 1,
        friction: 5,
        tension: 200,
        useNativeDriver: native,
      }).start();
      impactLight();

    } else if (elementId !== null) {
      // ── Chargement initial (pas d'animation) ───────────────
      contentScale.setValue(1);
      contentOpacity.setValue(1);
    }
  }, [elementId]);

  // ── Pulsation cases vides quand un jeton est sélectionné ────
  const emptyPulseAnim = useRef(new Animated.Value(1)).current;
  const emptyPulseRef  = useRef<Animated.CompositeAnimation | null>(null);
  const isEmpty = elementId === null && !isFixed;

  useEffect(() => {
    if (isEmpty && hasSelection) {
      emptyPulseRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(emptyPulseAnim, {
            toValue: 1.08,
            duration: 700,
            useNativeDriver: native,
          }),
          Animated.timing(emptyPulseAnim, {
            toValue: 1,
            duration: 700,
            useNativeDriver: native,
          }),
        ])
      );
      emptyPulseRef.current.start();
    } else {
      emptyPulseRef.current?.stop();
      emptyPulseRef.current = null;
      emptyPulseAnim.setValue(1);
    }
    return () => { emptyPulseRef.current?.stop(); };
  }, [isEmpty, hasSelection]);

  // ── Styles dynamiques : cases fixes vs joueur ──────────────
  // Priorité des bordures :
  //  1. Cases en erreur (Instinct) → rouge épaisse
  //  2. Cases valides (highlight) → vert épaisse
  //  3. Cases fixes → gris épaisse
  //  4. Cases normales → vert forêt fin
  let borderColor = isFixed ? Colors.cell.fixed : Colors.forest.medium;
  let borderWidth = isFixed ? 2.5 : 1.5;

  if (isHighlighted) {
    borderColor = Colors.cell.valid;   // Vert foncé
    borderWidth = 3;
  } else if (isErrorCell) {
    borderColor = Colors.cell.wrongGlow; // Rouge
    borderWidth = 3;
  }

  // Cases fixes : fond légèrement assombri (overlay sur backgroundColor)
  const cellBg = isFixed ? Colors.cell.fixed + '30' : backgroundColor;

  // ── Refs stables pour les callbacks passés à runOnJS ────────
  const cellIndexRef = useRef(cellIndex);
  const onPressRef   = useRef(onPress);
  const isFixedRef   = useRef(isFixed);
  cellIndexRef.current = cellIndex;
  onPressRef.current   = onPress;
  isFixedRef.current   = isFixed;

  // ── Valeurs animées ReAnimated (mobile gesture) ──────────────
  const rCellOpacity = useSharedValue(1);
  const rCellScale   = useSharedValue(1);

  const reanimatedStyle = useAnimatedStyle(() => ({
    opacity: rCellOpacity.value,
    transform: [{ scale: rCellScale.value }],
  }), [rCellOpacity, rCellScale]);

  const jsPress = useCallback(() => {
    if (!isFixedRef.current) onPressRef.current(cellIndexRef.current);
  }, []);

  // ── Gesture Tap (mobile) ────────────────────────────────────
  const tapGesture = Gesture.Tap()
    .enabled(Platform.OS !== 'web')
    .onEnd(() => {
      'worklet';
      runOnJS(jsPress)();
    });

  // ── Styles ────────────────────────────────────────────────
  const cellStyle = {
    backgroundColor: cellBg,
    borderColor,
    borderWidth,
    shadowOpacity: isFixed ? 0.08 : 0.15,
    elevation: isFixed ? 2 : 3,
  };

  // ── Couleur du halo pulsation (selon l'état) ──────────────
  const pulseOverlayColor = isErrorCell
    ? Colors.cell.wrongGlow   // Rouge pour erreur
    : Colors.cell.validGlow;  // Vert clair pour valide

  // ── Contenu du jeton (animé) + badges ──────────────────────
  const cellContent = (
    <>
      {/* Overlay pulsation bonus (valide OU erreur) */}
      {(isHighlighted || isErrorCell) && (
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            styles.pulseOverlay,
            {
              opacity: pulseAnim,
              backgroundColor: pulseOverlayColor + '40',
            },
          ]}
          pointerEvents="none"
        />
      )}

      {/* Overlay fond assombri pour les cases fixes */}
      {isFixed && (
        <View style={styles.fixedOverlay} pointerEvents="none" />
      )}

      {/* Icône de l'élément */}
      {elementDef && (
        <Animated.View style={{
          transform: [{ scale: contentScale }],
          opacity: contentOpacity,
        }}>
          <Image
            source={typeof elementDef.icon === 'string' ? { uri: elementDef.icon } : elementDef.icon}
            style={styles.icon}
            resizeMode="contain"
          />
        </Animated.View>
      )}

      {/* Badge ✓ (coin haut-droit) — cases valides */}
      {isHighlighted && (
        <View style={styles.validBadge}>
          <Text style={styles.validBadgeIcon}>✓</Text>
        </View>
      )}

      {/* Badge ⚠ (coin haut-gauche) — cases en erreur (Instinct) */}
      {isErrorCell && (
        <View style={styles.errorBadge}>
          <Text style={styles.errorBadgeIcon}>⚠</Text>
        </View>
      )}

      {/* Micro-cadenas sur les cases fixes */}
      {isFixed && (
        <View style={styles.lockBadge}>
          <Text style={styles.lockIcon}>🔒</Text>
        </View>
      )}
    </>
  );

  // ── Rendu WEB ─────────────────────────────────────────────
  if (Platform.OS === 'web') {
    return (
      <Animated.View style={[
        styles.cell,
        positionStyle,
        cellStyle,
        { transform: [{ scale: emptyPulseAnim }] },
      ]}>
        <TouchableOpacity
          activeOpacity={isFixed ? 1 : 0.7}
          onPress={() => !isFixed && onPress(cellIndex)}
          style={styles.innerTouchable}
        >
          {cellContent}
        </TouchableOpacity>
      </Animated.View>
    );
  }

  // ── Rendu MOBILE ──────────────────────────────────────────
  return (
    <GestureDetector gesture={tapGesture}>
      <Animated.View style={[
        styles.cell,
        positionStyle,
        cellStyle,
        {
          transform: [{ scale: emptyPulseAnim }],
        },
      ]}>
        {cellContent}
      </Animated.View>
    </GestureDetector>
  );
};

const styles = StyleSheet.create({
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: CELL_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  innerTouchable: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: CELL_SIZE / 2,
  },
  pulseOverlay: {
    borderRadius: CELL_SIZE / 2,
  },
  // ── Overlay assombri pour les cases fixes ──────────────────
  fixedOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: CELL_SIZE / 2,
    backgroundColor: 'rgba(0, 0, 0, 0.08)', // voile sombre subtil
  },
  icon: {
    width: CELL_SIZE * 0.72,
    height: CELL_SIZE * 0.72,
  },
  // ── Badge ✓ (coin haut-droit) — cases valides ─────────────
  validBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.cell.valid,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  validBadgeIcon: {
    fontSize: 11,
    fontWeight: '900',
    color: '#FFFFFF',
    lineHeight: 14,
  },
  // ── Badge ⚠ (coin haut-gauche) — cases en erreur ──────────
  errorBadge: {
    position: 'absolute',
    top: -2,
    left: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.cell.wrongGlow,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  errorBadgeIcon: {
    fontSize: 11,
    fontWeight: '900',
    color: '#FFFFFF',
    lineHeight: 14,
  },
  // ── Badge cadenas (coin bas-droit) ────────────────────────
  lockBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  lockIcon: {
    fontSize: 10,
    lineHeight: 14,
  },
});

// ── Export avec React.memo ────────────────────────────────────────────────────
export const Cell = React.memo(CellComponent, (prev, next) =>
  prev.cellIndex       === next.cellIndex       &&
  prev.elementId       === next.elementId       &&
  prev.isFixed         === next.isFixed         &&
  prev.backgroundColor === next.backgroundColor &&
  prev.hasSelection    === next.hasSelection    &&
  prev.positionStyle   === next.positionStyle
);
