// ============================================================
// frameLayout.ts — Géométrie historique et dock des onglets
//
// Le dock utilise le ratio natif de menu_bas.png. La géométrie historique
// reste utilisée par l'accueil pour ses marges.
// ============================================================

import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ── Ratios natifs ────────────────────────────────────────────────────────────
/** Dimensions historiques des coins du cadre. */
export const COIN_NATIVE_W = 558;
export const COIN_NATIVE_H = 549;
export const COIN_RATIO    = COIN_NATIVE_H / COIN_NATIVE_W; // ≈ 0.9839

/** menu_bas.png : 1352×318 */
export const MENU_NATIVE_W = 1352;
export const MENU_NATIVE_H = 318;
export const MENU_RATIO    = MENU_NATIVE_H / MENU_NATIVE_W; // ≈ 0.2352

/**
 * Largeur rendue des coins : ~11% de la largeur d'écran, min 60 dp.
 * Les coins sont quasi-carrés → coinH ≈ coinW × COIN_RATIO.
 */
export const COIN_W_FRACTION = 0.11; // fraction de screenW

/**
 * Largeur historique des bordures : ~5% de la largeur d'écran, min 16 dp.
 */
export const BORDER_W_FRACTION = 0.05;

/**
 * Fractions X des centres des 4 boutons nav dans menu_bas.png
 * (mesurées sur le PNG 1352px natif, ordre : accueil, règles, défi, profil)
 */
export const BTN_X_CENTERS = [0.165, 0.397, 0.603, 0.835];

/**
 * Fraction Y du centre des boutons dans menu_bas.png (≈ 50%)
 */
export const BTN_Y_IN_MENU = 0.50;

/** Dimensions du dock compact et espace réservé aux compteurs. */
export function getMenuLayout(screenW: number, insetTop: number, insetBottom: number) {
  const menuWidth = Math.min(screenW * 0.9, 430);
  const menuHeight = menuWidth * MENU_RATIO;
  const menuBottom = Math.max(insetBottom, 8);
  return {
    menuWidth,
    menuHeight,
    menuLeft: (screenW - menuWidth) / 2,
    menuBottom,
    frameBottom: menuHeight + menuBottom,
    contentTop: insetTop + 104,
    innerPadH: 20,
  };
}

export function useMenuLayout() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  return getMenuLayout(width, insets.top, insets.bottom);
}

/**
 * Calcule toutes les dimensions du cadre modulaire pour un écran donné.
 *
 * @param screenW  Largeur d'écran en dp
 * @param screenH  Hauteur d'écran en dp (totale, avant insets)
 * @param insetsBottom  Insets bas (Android nav bar) en dp
 */
export function computeFrameLayout(screenW: number, screenH: number, insetsBottom: number) {
  // ── Dimensions des composants ─────────────────────────────────────────────
  const coinW   = Math.max(60, Math.round(screenW * COIN_W_FRACTION));
  const coinH   = Math.round(coinW * COIN_RATIO);

  const menuH   = Math.round(screenW * MENU_RATIO);
  const borderW = Math.max(16, Math.round(screenW * BORDER_W_FRACTION));
  // Le menu est rendu à 70% de la largeur pleine
  const menuW70 = Math.round(screenW * 0.7);
  // menuH70 = hauteur du menu rendu à menuW70 (ratio natif conservé)
  const menuH70 = Math.round(menuW70 * MENU_RATIO);

  // ── Zones de contenu ──────────────────────────────────────────────────────
  /**
   * Padding top de la zone de contenu (scrollviews).
   * Reste fixé à coinH pour conserver le même décalage visuel qu'avant —
   * les coins dépassent légèrement dans la zone de contenu par le haut, c'est voulu.
   */
  const innerTop  = coinH;
  /**
   * Nouveau layout bas :
   *   bordure basse : bottom: 0, hauteur: borderW
   *   menu bas      : bottom: borderW, hauteur: menuH70
   * Y du haut du menu = bas de la zone de contenu
   */
  const innerBottom = screenH - borderW - menuH70;
  /** Padding horizontal interne (largeur bordure) */
  const innerPadH = borderW;

  // ── Positions des boutons nav ──────────────────────────────────────────────
  /**
   * Y du centre des boutons nav.
   * Le menu est à bottom: borderW, donc son bord haut = screenH - borderW - menuH70.
   * Le centre Y des icônes = bord haut du menu + BTN_Y_IN_MENU * menuH70.
   */
  const btnY = screenH - borderW - menuH70 + Math.round(menuH70 * BTN_Y_IN_MENU);
  /**
   * X de l'origine gauche du menu (centré dans screenW).
   * Les btnX sont calculés depuis cette origine dans ForestFrame.
   */
  const menuLeft = Math.round((screenW - menuW70) / 2);
  /**
   * Rayon de la zone de tap : ~7.5% de menuW70.
   * Proportionnel au menu, donc stable quelle que soit la résolution.
   */
  const tapHalf = Math.round(menuW70 * 0.075);

  // ── Barre haute (zone coins) ───────────────────────────────────────────────
  const topBarH = coinH;
  /**
   * Y du centre visuel de la barre haute.
   * topBarCenterY = coinH → les coins commencent à coinH dp du bord supérieur,
   * laissant une zone libre en haut (0..coinH) pour le haut-parleur et le
   * bouton retour, et descendant le compteur de graines sous l'objectif avant.
   * Le compteur reste centré sur la bordure haute (qui est à top: topBarCenterY).
   */
  const topBarCenterY = Math.round(coinH);

  /**
   * Y du bord supérieur du haut-parleur et du bouton retour.
   * Centré dans la zone libre [0 .. coinH] : (coinH - SIZE_ICON) / 2.
   * Ne dépend PAS de topBarCenterY pour rester stable en haut de l'écran.
   */
  const SIZE_ICON = 36;
  const iconTopY  = Math.max(0, Math.round((coinH - SIZE_ICON) / 2));

  // ── Padding bas pour ScrollView (ne pas être caché par menu + bordure bas) ─
  const frameBottom = menuH70 + borderW;

  return {
    coinW, coinH,
    menuH, menuW70, menuH70, menuLeft,
    borderW,
    innerTop,
    innerBottom,
    innerPadH,
    btnY, tapHalf,
    topBarH,
    topBarCenterY,
    iconTopY,
    frameBottom,
  };
}

/**
 * Hook — retourne toutes les dimensions du cadre pour l'écran courant.
 */
export function useFrameLayout() {
  const { width: screenW, height: screenH } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const layout = computeFrameLayout(screenW, screenH, insets.bottom);

  return { screenW, screenH, ...layout };
}
