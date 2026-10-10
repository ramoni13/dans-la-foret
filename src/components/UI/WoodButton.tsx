// ============================================================
// WoodButton — Bouton action vectoriel (SVG inline)
//   - Cadre bois biseauté (brun clair haut / brun sombre bas)
//   - Fond coloré (vert ou jaune) avec dégradé vertical
//   - Reflet elliptique blanc semi-transparent en haut
//   - Flèche bois PNG à droite (fleche.png 38×39)
// ============================================================

import React, { useRef } from 'react';
import {
  TouchableOpacity,
  Animated,
  View,
  Text,
  Image,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import Svg, {
  Rect,
  Defs,
  LinearGradient,
  Stop,
  ClipPath,
  Ellipse,
} from 'react-native-svg';

const FLECHE = require('../../../assets/elements/design_app/fleche.png');
// Ratio natif 38×39 ≈ carré — affichée à taille fixe
const ARROW_SIZE = 22;

// ── Palette couleurs ──────────────────────────────────────────
const WOOD_BEVEL_TOP = '#C8923A';
const WOOD_BEVEL_BOT = '#6B3A10';
const WOOD_INNER     = 'rgba(255,220,160,0.22)';

const VARIANTS = {
  green: {
    fillTop:     '#6CC94A',
    fillBot:     '#3A8A1E',
    shineColor:  'rgba(255,255,255,0.32)',
    bevelTop:    WOOD_BEVEL_TOP,
    bevelBot:    WOOD_BEVEL_BOT,
    innerBorder: WOOD_INNER,
  },
  yellow: {
    fillTop:     '#F0C040',
    fillBot:     '#B87A00',
    shineColor:  'rgba(255,255,255,0.28)',
    bevelTop:    WOOD_BEVEL_TOP,
    bevelBot:    WOOD_BEVEL_BOT,
    innerBorder: WOOD_INNER,
  },
  locked: {
    fillTop:     '#5A3E2A',
    fillBot:     '#2E1C0E',
    shineColor:  'rgba(255,255,255,0.08)',
    bevelTop:    '#7A5535',
    bevelBot:    '#180C04',
    innerBorder: 'rgba(255,200,140,0.10)',
  },

} as const;

export interface WoodButtonProps {
  label: string;
  sublabel?: string;
  variant: 'green' | 'yellow' | 'locked';
  /** Afficher la flèche bois à droite (défaut true) */
  showArrow?: boolean;
  /** Icône gauche override pour variant locked (remplace 🔒 par défaut) */
  lockIcon?: string;
  height?: number;
  onPress: () => void;
  disabled?: boolean;
  animated?: boolean;
  animatedStyle?: any;
}

export function WoodButton({
  label,
  sublabel,
  variant,
  showArrow = true,
  lockIcon,
  height = 72,
  onPress,
  disabled,
  animated: useAnimated = false,
  animatedStyle,
}: WoodButtonProps) {
  const { width: screenWidth } = useWindowDimensions();
  // Aligné sur WoodSign : 70% écran, plafonné à 280
  const btnWidth = Math.min(280, Math.round(screenWidth * 0.70));
  const c = VARIANTS[variant];
  // IDs SVG uniques par instance pour éviter les collisions quand plusieurs boutons coexistent
  const uid = useRef(`wb_${Math.random().toString(36).slice(2)}`).current;
  const gradId = `bg_${uid}`;
  const clipId = `clip_${uid}`;

  // Géométrie
  const r  = 14;
  const bO = 4;
  const bI = 2;
  const bL = 1.5;
  const innerX = bO + bI;
  const innerY = bO + bI;
  const innerW = btnWidth - 2 * (bO + bI);
  const innerH = height   - 2 * (bO + bI);
  const innerR = Math.max(2, r - bO - bI);

  const inner = (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.80}
      disabled={disabled}
      style={{ width: btnWidth, alignSelf: 'center' }}
    >
      {/* Couche SVG — fond + cadre */}
      <Svg width={btnWidth} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={c.fillTop} stopOpacity="1" />
            <Stop offset="1" stopColor={c.fillBot} stopOpacity="1" />
          </LinearGradient>
          <ClipPath id={clipId}>
            <Rect x={innerX} y={innerY} width={innerW} height={innerH} rx={innerR} />
          </ClipPath>
        </Defs>

        {/* Ombre portée */}
        <Rect x={2} y={height - 6} width={btnWidth - 4} height={8} rx={r} fill="rgba(0,0,0,0.25)" />
        {/* Biseau bas (sombre) */}
        <Rect x={0} y={bO} width={btnWidth} height={height - bO} rx={r} fill={c.bevelBot} />
        {/* Biseau haut (clair) */}
        <Rect x={0} y={0} width={btnWidth} height={height - bO} rx={r} fill={c.bevelTop} />
        {/* Fond coloré */}
        <Rect x={innerX} y={innerY} width={innerW} height={innerH} rx={innerR} fill={`url(#${gradId})`} />
        {/* Reflet */}
        <Ellipse
          cx={btnWidth / 2}
          cy={innerY + innerH * 0.22}
          rx={innerW * 0.42}
          ry={innerH * 0.22}
          fill={c.shineColor}
          clipPath={`url(#${clipId})`}
        />
        {/* Liseré interne */}
        <Rect
          x={innerX + bL} y={innerY + bL}
          width={innerW - 2 * bL} height={innerH - 2 * bL}
          rx={Math.max(1, innerR - 1)}
          fill="none"
          stroke={c.innerBorder}
          strokeWidth={bL}
        />
      </Svg>

      {/* Contenu texte + flèche par-dessus le SVG */}
      <View style={[styles.row, { height }]}>
        {variant === 'locked' && <Text style={styles.lockIcon}>{lockIcon ?? '🔒'}</Text>}
        <View style={styles.center}>
          <Text style={styles.label} numberOfLines={1}>{label}</Text>
          {sublabel ? <Text style={styles.sublabel} numberOfLines={1}>{sublabel}</Text> : null}
        </View>
        {showArrow && variant !== 'locked' && (
          <Image source={FLECHE} style={styles.arrow} resizeMode="contain" />
        )}
      </View>
    </TouchableOpacity>
  );

  if (useAnimated && animatedStyle) {
    return <Animated.View style={animatedStyle}>{inner}</Animated.View>;
  }

  return inner;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    gap: 10,
  },
  center: {
    flex: 1,
    alignItems: 'center',
  },
  label: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFF8E7',
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
    textAlign: 'center',
  },
  sublabel: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,248,231,0.85)',
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
    textAlign: 'center',
    marginTop: 1,
  },
  arrow: {
    width: ARROW_SIZE,
    height: ARROW_SIZE,
  },
  lockIcon: { fontSize: 20 },
});
