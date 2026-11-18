// ============================================================
// BoardBackdrop — Fond du plateau en plein cadre
// À placer en premier enfant de la zone de jeu (conteneur à position relative) :
// l'image remplit TOUTE la zone, bord à bord (resizeMode="cover"), quel que soit le
// ratio ou la taille de l'appareil. Le plateau est posé par-dessus.
//
// Largeur / hauteur explicites à 100 % : sur le web (react-native-web), un simple
// `absoluteFill` laissait l'image à sa taille d'origine (370×370).
// ============================================================

import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import type { BoardDefinition } from '../../core/models/Board';

interface BoardBackdropProps {
  boardDef: BoardDefinition;
}

export const BoardBackdrop: React.FC<BoardBackdropProps> = ({ boardDef }) => (
  <View style={styles.fill} pointerEvents="none">
    <Image
      source={boardDef.backgroundAsset as any}
      style={styles.image}
      resizeMode="cover"
    />
  </View>
);

const styles = StyleSheet.create({
  fill: {
    ...StyleSheet.absoluteFill,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
});