// ============================================================
// WoodSign — Panneau bois réutilisable
// panneau_bois.png : 322×165px → ratio ≈ 1.952
// resizeMode="contain" — zéro étirement
// ============================================================

import React from 'react';
import {
  Image,
  TouchableOpacity,
  View,
  Text,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';

const PANNEAU_BOIS = require('../../../assets/elements/design_app/panneau_bois.png');
const FLECHE       = require('../../../assets/elements/design_app/fleche.png');

// Ratio natif : 322×165
const ASSET_RATIO = 322 / 165; // ≈ 1.952
const ARROW_SIZE  = 18;

export interface WoodSignProps {
  label: string;
  sublabel?: string;
  /** Afficher la flèche bois à droite si le panneau est cliquable (défaut true) */
  showArrow?: boolean;
  /** Largeur logique du panneau (défaut : 70% écran, max 280) */
  desiredWidth?: number;
  onPress?: () => void;
  disabled?: boolean;
}

export function WoodSign({
  label,
  sublabel,
  showArrow = true,
  desiredWidth,
  onPress,
  disabled,
}: WoodSignProps) {
  const { width: screenWidth } = useWindowDimensions();
  const w = desiredWidth ?? Math.min(280, Math.round(screenWidth * 0.70));
  const h = Math.round(w / ASSET_RATIO);

  // Zone de texte plate centrale (~72% de la largeur, sans chaînes/lianes latérales)
  const textAreaW = Math.round(w * 0.72);

  // Le panneau bois a des chaînes/déco en haut (~18% de hauteur) :
  // le centre visuel du bois est décalé vers le bas. On compense avec marginTop.
  const textOffsetY = Math.round(h * 0.10);

  const inner = (
    <View style={{ width: w, height: h, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' }}>
      <Image
        source={PANNEAU_BOIS}
        style={{ width: w, height: h, position: 'absolute' }}
        resizeMode="contain"
      />
      <View style={[styles.row, { width: textAreaW, marginTop: textOffsetY }]}>
        <View style={styles.center}>
          <Text style={styles.label} numberOfLines={1}>{label}</Text>
          {sublabel ? <Text style={styles.sublabel} numberOfLines={1}>{sublabel}</Text> : null}
        </View>
        {onPress && showArrow && (
          <Image source={FLECHE} style={styles.arrow} resizeMode="contain" />
        )}
      </View>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.82} disabled={disabled}>
        {inner}
      </TouchableOpacity>
    );
  }

  return inner;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  center: {
    flex: 1,
    alignItems: 'center',
  },
  label: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFF8E7',
    textShadowColor: 'rgba(0,0,0,0.65)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
    textAlign: 'center',
  },
  sublabel: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,248,231,0.80)',
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
    textAlign: 'center',
    marginTop: 1,
  },
  arrow: {
    width: ARROW_SIZE,
    height: ARROW_SIZE,
  },
});
