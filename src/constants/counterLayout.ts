// ============================================================
// counterLayout — géométrie des compteurs ⭐ et 🌱 du bandeau (Progression v2, C7)
//
// Les deux compteurs sont côte à côte, centrés sur la bordure haute, sans jamais
// déborder sur les coins du cadre. Fichier PUR (aucune dépendance React Native),
// testé par __tests__/counterLayout.test.ts.
// ============================================================

/** Ratio natif de `bloc_graines.png` : 264 × 85. */
export const COUNTER_BLOCK_RATIO = 264 / 85;

/** Largeur maximale d'un bloc compteur (dp). */
export const COUNTER_MAX_W = 200;

/** Espace entre les deux compteurs (dp). */
export const COUNTER_GAP = 6;

export interface CounterBlock {
  left: number;
  top: number;
  width: number;
  height: number;
  /** Centre absolu, utilisé comme cible des récompenses volantes. */
  centerX: number;
  centerY: number;
}

export interface CountersGeometry {
  /** Étoiles (à gauche). `null` quand l'interface des étoiles n'est pas active (PROGRESSION_V2 désactivé). */
  stars: CounterBlock | null;
  /** Graines (à droite, ou seules et centrées sans les étoiles). */
  seeds: CounterBlock;
}

/**
 * Disposition des compteurs sur la barre haute.
 *
 *   withStars = true  : ⭐ et 🌱 côte à côte, de même taille, centrés entre les coins ;
 *   withStars = false : 🌱 seul et centré, comme avant la Progression v2.
 *
 * @param screenW        largeur d'écran (dp)
 * @param topBarCenterY  Y du centre de la barre haute
 * @param coinW          largeur des coins du cadre : les compteurs restent entre eux
 */
export function computeCountersGeometry(
  screenW: number,
  topBarCenterY: number,
  coinW: number,
  withStars = true,
): CountersGeometry {
  const make = (left: number, width: number): CounterBlock => {
    const height = Math.round(width / COUNTER_BLOCK_RATIO);
    const top = topBarCenterY - height / 2;
    return { left, top, width, height, centerX: left + width / 2, centerY: top + height / 2 };
  };

  if (!withStars) {
    // Comportement historique : un seul bloc, au plus 45 % de l'écran et 200 dp.
    const width = Math.min(COUNTER_MAX_W, Math.round(screenW * 0.45));
    return { stars: null, seeds: make((screenW - width) / 2, width) };
  }

  // Largeur disponible entre les deux coins, moins une marge de sécurité.
  const available = Math.max(0, screenW - 2 * coinW - 8);
  // Chaque bloc : au plus 45 % de l'écran ET au plus COUNTER_MAX_W, et deux blocs + espace tiennent.
  const byAvailable = Math.floor((available - COUNTER_GAP) / 2);
  const width = Math.max(0, Math.min(COUNTER_MAX_W, Math.round(screenW * 0.45), byAvailable));
  const startX = (screenW - (2 * width + COUNTER_GAP)) / 2;
  return { stars: make(startX, width), seeds: make(startX + width + COUNTER_GAP, width) };
}