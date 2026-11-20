// src/theme/forestTheme.ts

export const ForestColors = {
  // Surfaces parchemin (remplace le blanc pur #FFFFFF)
  parchmentLight: '#FAF4E6',
  parchmentBase: '#F4ECD8',
  parchmentDark: '#E5D7B8',
  parchmentBorder: '#C4AE85',

  // Bois sculpté
  woodLight: '#9C6B43',
  woodBase: '#734B2C',
  woodDark: '#4A2E1B',

  // Vert forêt (contraste > 7:1 avec texte blanc)
  forestGreenLight: '#2E7D47',
  forestGreenBase: '#1E5631',
  forestGreenDark: '#12381F',

  // Ambre / Orange (CTA secondaire)
  amberBase: '#D9821E',
  amberDark: '#9E590D',

  // Plateau & Double codage
  stoneBase: '#8A9199',
  stoneDark: '#5C6268',
  goldHighlight: '#FFD166',

  // Typographie haute lisibilité (WCAG AAA)
  textInkPrimary: '#482417',
  textInkSecondary: '#572E1D',
  textOnDark: '#FFFDF9',

  // États
  disabledBg: '#D8CFC0',
  disabledText: '#7A6E5D',
} as const;

export const ForestMetrics = {
  minTouchTarget: 48,
  tokenSize: 58,
  boardNodeSize: 64,
  radiusSm: 10,
  radiusMd: 16,
  radiusLg: 24,
  radiusPill: 999,
} as const;