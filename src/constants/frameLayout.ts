// ============================================================
// frameLayout.ts — Constantes partagées de mise en page du cadre ForestFrame
//
// Le PNG cadre_vide.png fait 1536×2752 (ratio ≈ 1.792).
// Les boutons nav sont à 93.5% de la hauteur du cadre.
// La bordure bois haute du cadre occupe ≈ 5% de la hauteur du cadre.
// ============================================================

import { useWindowDimensions } from 'react-native';

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
 * Hook — renvoie toutes les dimensions utiles du cadre calculées pour l'écran courant.
 *
 * cadreTop  : position Y du haut du PNG cadre sur l'écran (positive = cadre ne touche pas le haut de l'écran)
 * cadreH    : hauteur rendue du cadre (= screenW * CADRE_RATIO)
 * btnY      : position Y des centres des boutons nav sur l'écran
 * innerTop  : position Y du haut de la zone interne (après la bordure bois haute)
 * innerBottom: position Y du bas de la zone interne (avant la bordure bois basse)
 */
export function useFrameLayout() {
  const { width: screenW, height: screenH } = useWindowDimensions();

  const cadreW  = screenW;
  const cadreH  = screenW * CADRE_RATIO;
  const cadreTop = screenH - cadreH; // peut être positif ou négatif

  const topBarH     = CADRE_TOP_BAR_FRACTION * cadreH;
  const btnY        = BTN_Y_CENTER * cadreH + cadreTop;
  const innerTop    = topBarH + cadreTop; // Y du bas de la barre bois haute (début zone interne)
  const innerBottom = btnY; // bas de la zone interne = hauteur des boutons
  // Padding horizontal à appliquer au contenu pour rester dans la zone bois interne
  const innerPadH   = cadreW * CADRE_SIDE_FRACTION;
  // Centre vertical de la barre bois haute (où vivent graines + bouton retour)
  // +14 = OVERLAY_NUDGE_Y pour coller avec le SeedsOverlay du ForestFrame
  const topBarCenterY = cadreTop + topBarH / 2 + 14;

  return { screenW, screenH, cadreW, cadreH, cadreTop, topBarH, btnY, innerTop, innerBottom, innerPadH, topBarCenterY };
}
