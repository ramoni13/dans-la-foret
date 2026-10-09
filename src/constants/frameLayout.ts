// ============================================================
// frameLayout.ts — Constantes partagées de mise en page du cadre ForestFrame
//
// Le PNG cadre_vide.png fait 1536×2752 (ratio ≈ 1.792).
// Les boutons nav sont à 93.5% de la hauteur du cadre.
// La bordure bois haute du cadre occupe ≈ 5% de la hauteur du cadre.
//
// Stratégie "cover" :
//   Le cadre est scalé pour couvrir toujours toute la hauteur visible
//   (screenH - insets.bottom) sans jamais laisser de zone vide en haut.
//   Si le cadre dépasse en largeur, les bords bois sortent hors écran
//   (invisibles de toute façon). cadreTop est toujours ≤ 0.
// ============================================================

import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const CADRE_NATIVE_W = 1536;
export const CADRE_NATIVE_H = 2752;
export const CADRE_RATIO = CADRE_NATIVE_H / CADRE_NATIVE_W; // ≈ 1.792

/** Fraction Y des centres de boutons dans le PNG (hauteur cadre) */
export const BTN_Y_CENTER = 0.935;

/** Fraction Y du haut de la bordure bois haute (dans le PNG) */
export const CADRE_TOP_BAR_FRACTION = 0.055; // ≈ 5.5% de cadreH

/** Fractions X des centres de boutons (index, rules, challenge, profile) */
export const BTN_X_CENTERS = [0.193, 0.397, 0.603, 0.808];

/** Fraction de la hauteur du cadre occupée par la bordure basse du cadre */
export const FRAME_BOTTOM_FRACTION = 1 - BTN_Y_CENTER; // 0.065

/**
 * Fraction de la largeur du cadre occupée par chaque bordure bois latérale.
 * Le cadre PNG a des bordures ~7% de chaque côté (mesuré sur 1536px natif).
 * innerLeft  = cadreW * CADRE_SIDE_FRACTION
 * innerRight = cadreW * (1 - CADRE_SIDE_FRACTION)
 */
export const CADRE_SIDE_FRACTION = 0.07; // ≈ 7% de la largeur du cadre

/**
 * Calcule les dimensions "cover" du cadre pour une hauteur visible donnée.
 * Le cadre couvre toujours toute la zone visible (cadreTop ≤ 0).
 */
export function computeFrameLayout(screenW: number, visibleH: number) {
  // Scale par largeur
  const cadreH_byW = screenW * CADRE_RATIO;

  let cadreW: number;
  let cadreH: number;

  if (cadreH_byW >= visibleH) {
    // Le cadre scalé par largeur est déjà assez grand verticalement → scale par largeur
    cadreW = screenW;
    cadreH = cadreH_byW;
  } else {
    // Le cadre scalé par largeur ne couvre pas toute la hauteur → scale par hauteur
    cadreH = visibleH;
    cadreW = visibleH / CADRE_RATIO;
  }

  // cadreTop ≤ 0 : le cadre déborde toujours en haut (jamais de zone vide)
  const cadreTop  = visibleH - cadreH;
  const cadreLeft = (screenW - cadreW) / 2; // centré horizontalement si cadreW > screenW

  const topBarH     = CADRE_TOP_BAR_FRACTION * cadreH;
  const btnY        = BTN_Y_CENTER * cadreH + cadreTop;
  const innerTop    = topBarH + cadreTop;
  const innerBottom = btnY;
  const innerPadH   = cadreW * CADRE_SIDE_FRACTION;
  const topBarCenterY = cadreTop + topBarH / 2 + 14;

  return { cadreW, cadreH, cadreTop, cadreLeft, topBarH, btnY, innerTop, innerBottom, innerPadH, topBarCenterY };
}

/**
 * Hook — renvoie toutes les dimensions utiles du cadre calculées pour l'écran courant.
 *
 * Utilise insets.bottom pour exclure la barre de navigation Android de la hauteur visible.
 * Le cadre est toujours en mode "cover" : aucune zone vide en haut, cadreTop ≤ 0.
 *
 * cadreTop    : position Y du haut du PNG cadre (≤ 0, le cadre déborde en haut)
 * cadreH      : hauteur rendue du cadre
 * btnY        : position Y des centres des boutons nav sur l'écran
 * innerTop    : position Y du haut de la zone interne (après la bordure bois haute)
 * innerBottom : position Y du bas de la zone interne (avant la bordure bois basse)
 */
export function useFrameLayout() {
  const { width: screenW, height: screenH } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  // Hauteur réellement visible (exclut la barre de navigation Android)
  const visibleH = screenH - insets.bottom;

  const layout = computeFrameLayout(screenW, visibleH);

  // frameBottom : espace à réserver en bas du contenu scrollable pour ne pas
  // être masqué par la bordure bois basse du cadre.
  // = hauteur de la zone bois basse + barre nav système
  const frameBottom = layout.cadreH * FRAME_BOTTOM_FRACTION + insets.bottom;

  return { screenW, screenH, visibleH, frameBottom, ...layout };
}
