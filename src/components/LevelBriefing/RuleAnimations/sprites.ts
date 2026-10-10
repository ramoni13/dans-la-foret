// ============================================================
// sprites.ts — Mapping elementId → sprite 3D pour les animations
// ============================================================

export const ELEMENT_SPRITES: Record<string, any> = {
  bucheron:   require('../../../../assets/elements/sprites/bucheron3D.png'),
  ours:       require('../../../../assets/elements/sprites/ours3D.png'),
  mouton:     require('../../../../assets/elements/sprites/mouton3D.png'),
  ruche:      require('../../../../assets/elements/sprites/ruche3D.png'),
  chien:      require('../../../../assets/elements/sprites/chien3D.png'),
  cerf:       require('../../../../assets/elements/sprites/cerf3D.png'),
  biche:      require('../../../../assets/elements/sprites/biche3D.png'),
  loup:       require('../../../../assets/elements/sprites/loup3D.png'),
  tas_buches: require('../../../../assets/elements/sprites/buches.png'),
  chalet:     require('../../../../assets/elements/sprites/chalet3D.png'),
};

/** Retourne le sprite 3D si disponible, sinon l'icône pastille de l'ElementRegistry */
export function getSpriteOrIcon(elementId: string, fallbackIcon: any): any {
  return ELEMENT_SPRITES[elementId] ?? fallbackIcon;
}
