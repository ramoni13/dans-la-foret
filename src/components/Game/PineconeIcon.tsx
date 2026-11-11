// ============================================================
// PineconeIcon / PineconeText — la pomme de pin remplace l'étoile (thème forestier)
//
//   PineconeIcon  : l'image seule (vide / bois / dorée), `size` = HAUTEUR en pixels ;
//   PineconeText  : un texte traduit où le jeton `[pp]` devient une petite pomme de pin dorée
//                   alignée sur le texte (remplace l'ancien ⭐ des phrases).
// Décoratif : l'accessibilité est portée par le parent (jamais d'image seule lue à voix haute).
// ============================================================

import React from 'react';
import { Image, ImageSourcePropType, StyleProp, StyleSheet, Text, TextStyle, View } from 'react-native';
import {
  PINECONE_ASPECT,
  PineconeVariant,
  splitPineconeText,
  stripPineconeToken,
} from '../../constants/pinecone';
import { useT } from '../../i18n';

export const PINECONE_IMAGES: Record<PineconeVariant, ImageSourcePropType> = {
  empty: require('../../../assets/elements/design_app/PP_vide2.png'),
  wood: require('../../../assets/elements/design_app/PP_bois.png'),
  gold: require('../../../assets/elements/design_app/PP_or.png'),
};

interface PineconeIconProps {
  /** Hauteur de la pomme de pin ; la largeur suit le rapport des images. */
  size: number;
  variant: PineconeVariant;
  opacity?: number;
}

export function PineconeIcon({ size, variant, opacity = 1 }: PineconeIconProps) {
  return (
    <Image
      source={PINECONE_IMAGES[variant]}
      style={{ width: Math.round(size * PINECONE_ASPECT), height: size, opacity }}
      resizeMode="contain"
      accessible={false}
    />
  );
}

interface PineconeTextProps {
  text: string;
  style?: StyleProp<TextStyle>;
  /** Hauteur de la pomme de pin inline (défaut : un peu plus que le corps du texte). */
  iconSize?: number;
  numberOfLines?: number;
  /** Annonce les changements aux lecteurs d'écran (compteurs qui évoluent). */
  liveRegion?: boolean;
}

/**
 * Texte avec jeton `[pp]` → pomme de pin dorée inline. Sans jeton : un simple `<Text>`.
 * Les lecteurs d'écran lisent « pommes de pin » à la place de l'image.
 */
export function PineconeText({ text, style, iconSize, numberOfLines, liveRegion }: PineconeTextProps) {
  const t = useT();
  const parts = splitPineconeText(text);
  const spoken = stripPineconeToken(text, ` ${t('pinecone_unit')}`);
  const flat = StyleSheet.flatten(style) ?? {};
  const fontSize = typeof flat.fontSize === 'number' ? flat.fontSize : 14;
  const h = iconSize ?? Math.round(fontSize * 1.25);
  const w = Math.round(h * PINECONE_ASPECT);
  return (
    <Text
      style={style}
      numberOfLines={numberOfLines}
      accessibilityLabel={spoken}
      accessibilityLiveRegion={liveRegion ? 'polite' : undefined}
    >
      {parts.map((p, i) =>
        p.type === 'text' ? (
          <Text key={i}>{p.value}</Text>
        ) : (
          // Une <View> dans un <Text> s'aligne sur la ligne de base : marge fine de chaque côté.
          <Text key={i}>
            {' '}
            <View style={{ width: w, height: h, transform: [{ translateY: Math.round(h * 0.18) }] }}>
              <Image
                source={PINECONE_IMAGES.gold}
                style={{ width: w, height: h }}
                resizeMode="contain"
                accessible={false}
              />
            </View>
          </Text>
        ),
      )}
    </Text>
  );
}
