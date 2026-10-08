// ============================================================
// LEVEL META — Métadonnées pédagogiques par niveau (1–15)
// Source de vérité pour le briefing de niveau.
// ============================================================

export type RuleCardType =
  | 'no_same_neighbor'      // Interdit deux identiques voisins
  | 'require_neighbor'      // Requiert un voisin spécifique
  | 'require_all_neighbor'  // TOUS les exemplaires doivent être voisins d'un élément
  | 'forbid_neighbor'       // Interdit un voisin spécifique
  | 'connected_group'       // Tous connexes (meute)
  | 'paired'                // Égalité de quantité (cerf = biche)
  | 'paired_exclusive'      // 1 cerf ↔ 1 biche seulement (pas 1→2)
  | 'chain'                 // Chaîne de voisinage (bûches←bucheron)
  | 'singleton'             // Maximum 1 par défi (ruche)
  | 'center_only';          // Placement uniquement sur les cases centrales (champignon)

export interface RuleCard {
  id: string;
  type: RuleCardType;
  /** Éléments affichés dans l'animation, dans l'ordre gauche→droite */
  elements: string[];
  /** Clé i18n pour l'accessibilité (texte de secours) */
  i18nKey: string;
  /** Variables d'interpolation pour i18nKey */
  i18nVars?: Record<string, string>;
}

export interface LevelMeta {
  levelNumber: number;      // 1–15
  boardCellCount: number;
  emptyCellsCount: number;  // valeur fixe du niveau (cf. difficulty.ts)
  newElements: string[];    // éléments introduits à CE niveau (absents avant)
  allRules: RuleCard[];     // toutes les règles actives à ce niveau
  newRules: RuleCard[];     // sous-ensemble : seulement les règles nouvellement introduites
}

// ── Règles réutilisables ─────────────────────────────────────────────────────

const rNoSameBucheron: RuleCard = {
  id: 'no_same_bucheron',
  type: 'no_same_neighbor',
  elements: ['bucheron', 'bucheron'],
  i18nKey: 'a11y_no_same',
  i18nVars: { element: 'bucheron' },
};
const rNoSameOurs: RuleCard = {
  id: 'no_same_ours',
  type: 'no_same_neighbor',
  elements: ['ours', 'ours'],
  i18nKey: 'a11y_no_same',
  i18nVars: { element: 'ours' },
};
const rNoSameMouton: RuleCard = {
  id: 'no_same_mouton',
  type: 'no_same_neighbor',
  elements: ['mouton', 'mouton'],
  i18nKey: 'a11y_no_same',
  i18nVars: { element: 'mouton' },
};
// Nouvelle règle ruche : c'est l'ours qui doit être voisin de la ruche
// (inversé par rapport à l'ancien rRequireRucheOurs)
const rRequireOursRuche: RuleCard = {
  id: 'require_ours_ruche',
  type: 'require_neighbor',
  elements: ['ours', 'ruche'],
  i18nKey: 'a11y_require_neighbor',
  i18nVars: { e1: 'ours', e2: 'ruche' },
};
// Règle visuelle : TOUS les ours doivent être connectés à la ruche
// Animation : 3 ours → flèches → 1 ruche centrale
const rAllOursRuche: RuleCard = {
  id: 'all_ours_ruche',
  type: 'require_all_neighbor',
  elements: ['ours', 'ours', 'ours', 'ruche'],
  i18nKey: 'a11y_require_all_neighbor',
  i18nVars: { e1: 'ours', e2: 'ruche' },
};
const rSingletonRuche: RuleCard = {
  id: 'singleton_ruche',
  type: 'singleton',
  elements: ['ruche'],
  i18nKey: 'a11y_singleton',
  i18nVars: { element: 'ruche' },
};
const rNoSameChien: RuleCard = {
  id: 'no_same_chien',
  type: 'no_same_neighbor',
  elements: ['chien', 'chien'],
  i18nKey: 'a11y_no_same',
  i18nVars: { element: 'chien' },
};
const rConnectedChien: RuleCard = {
  id: 'connected_chien',
  type: 'connected_group',
  elements: ['chien', 'chien', 'chien'],  // 3 chiens pour illustrer la meute
  i18nKey: 'a11y_connected_group',
  i18nVars: { element: 'chien' },
};
const rNoSameloup: RuleCard = {
  id: 'no_same_loup',
  type: 'no_same_neighbor',
  elements: ['loup', 'loup'],
  i18nKey: 'a11y_no_same',
  i18nVars: { element: 'loup' },
};
const rForbidloupMouton: RuleCard = {
  id: 'forbid_loup_mouton',
  type: 'forbid_neighbor',
  elements: ['loup', 'mouton'],
  i18nKey: 'a11y_forbid_neighbor',
  i18nVars: { e1: 'loup', e2: 'mouton' },
};
const rNoSameCerf: RuleCard = {
  id: 'no_same_cerf',
  type: 'no_same_neighbor',
  elements: ['cerf', 'cerf'],
  i18nKey: 'a11y_no_same',
  i18nVars: { element: 'cerf' },
};
const rNoSameBiche: RuleCard = {
  id: 'no_same_biche',
  type: 'no_same_neighbor',
  elements: ['biche', 'biche'],
  i18nKey: 'a11y_no_same',
  i18nVars: { element: 'biche' },
};
const rPairedCerfBiche: RuleCard = {
  id: 'paired_cerf_biche',
  type: 'paired',
  elements: ['cerf', 'biche'],
  i18nKey: 'a11y_paired',
  i18nVars: { e1: 'cerf', e2: 'biche' },
};
// Règle exclusive cerf : 1 cerf ne peut pas être connecté à 2 biches
const rPairedExclusiveCerf: RuleCard = {
  id: 'paired_exclusive_cerf',
  type: 'paired_exclusive',
  elements: ['cerf', 'biche', 'biche'],
  i18nKey: 'a11y_paired_exclusive',
  i18nVars: { e1: 'cerf', e2: 'biche' },
};
// Règle exclusive biche : 1 biche ne peut pas être connectée à 2 cerfs
const rPairedExclusiveBiche: RuleCard = {
  id: 'paired_exclusive_biche',
  type: 'paired_exclusive',
  elements: ['biche', 'cerf', 'cerf'],
  i18nKey: 'a11y_paired_exclusive',
  i18nVars: { e1: 'biche', e2: 'cerf' },
};
// Niveau 11 : tas_buches doit etre voisin d'un bucheron (pas de chalet encore)
const rChainTasBuches: RuleCard = {
  id: 'chain_tas_buches',
  type: 'chain',
  elements: ['bucheron', 'tas_buches'],
  i18nKey: 'a11y_chain',
  i18nVars: { e1: 'tas_buches', e2: 'bucheron' },
};
// Niveau 12 : quand chalet est present, tas_buches doit aussi etre voisin du chalet
const rChainTasBuchesChalet: RuleCard = {
  id: 'chain_tas_buches_chalet',
  type: 'chain',
  elements: ['tas_buches', 'chalet'],
  i18nKey: 'a11y_chain_chalet',
  i18nVars: { e1: 'chalet', e2: 'tas_buches' },
};
const rNoSameChalet: RuleCard = {
  id: 'no_same_chalet',
  type: 'no_same_neighbor',
  elements: ['chalet', 'chalet'],
  i18nKey: 'a11y_no_same',
  i18nVars: { element: 'chalet' },
};
const rRequireChaletBucheron: RuleCard = {
  id: 'require_chalet_bucheron',
  type: 'require_neighbor',
  elements: ['chalet', 'bucheron'],
  i18nKey: 'a11y_require_neighbor',
  i18nVars: { e1: 'chalet', e2: 'bucheron' },
};

// ── LEVEL_META × 15 niveaux ──────────────────────────────────────────────────
// Nouvel ordre d'introduction :
//   Niv 1  : bucheron, ours, mouton
//   Niv 3  : chien
//   Niv 5  : loup
//   Niv 7  : ruche
//   Niv 9  : cerf, biche
//   Niv 11 : tas_buches
//   Niv 12 : chalet

export const LEVEL_META: Record<number, LevelMeta> = {
  1: {
    levelNumber: 1,
    boardCellCount: 6,
    emptyCellsCount: 3,
    newElements: ['bucheron', 'ours', 'mouton'],
    allRules: [
      rNoSameBucheron,
      rNoSameOurs,
      rNoSameMouton,
    ],
    newRules: [
      rNoSameBucheron,
      rNoSameOurs,
      rNoSameMouton,
    ],
  },

  2: {
    levelNumber: 2,
    boardCellCount: 7,
    emptyCellsCount: 4,
    newElements: [],
    allRules: [
      rNoSameBucheron,
      rNoSameOurs,
      rNoSameMouton,
    ],
    newRules: [],
  },

  3: {
    levelNumber: 3,
    boardCellCount: 8,
    emptyCellsCount: 4,
    newElements: ['chien'],
    allRules: [
      rNoSameBucheron,
      rNoSameOurs,
      rNoSameMouton,
      rNoSameChien,
      rConnectedChien,
    ],
    newRules: [
      rConnectedChien,
    ],
  },

  4: {
    levelNumber: 4,
    boardCellCount: 8,
    emptyCellsCount: 5,
    newElements: [],
    allRules: [
      rNoSameBucheron,
      rNoSameOurs,
      rNoSameMouton,
      rNoSameChien,
      rConnectedChien,
    ],
    newRules: [],
  },

  5: {
    levelNumber: 5,
    boardCellCount: 9,
    emptyCellsCount: 5,
    newElements: ['loup'],
    allRules: [
      rNoSameBucheron,
      rNoSameOurs,
      rNoSameMouton,
      rNoSameChien,
      rConnectedChien,
      rNoSameloup,
      rForbidloupMouton,
    ],
    newRules: [
      rNoSameloup,
      rForbidloupMouton,
    ],
  },

  6: {
    levelNumber: 6,
    boardCellCount: 9,
    emptyCellsCount: 6,
    newElements: [],
    allRules: [
      rNoSameBucheron,
      rNoSameOurs,
      rNoSameMouton,
      rNoSameChien,
      rConnectedChien,
      rNoSameloup,
      rForbidloupMouton,
    ],
    newRules: [],
  },

  7: {
    levelNumber: 7,
    boardCellCount: 10,
    emptyCellsCount: 6,
    newElements: ['ruche'],
    allRules: [
      rNoSameBucheron,
      rNoSameOurs,
      rNoSameMouton,
      rNoSameChien,
      rConnectedChien,
      rNoSameloup,
      rForbidloupMouton,
      rSingletonRuche,
      rRequireOursRuche,
      rAllOursRuche,
    ],
    newRules: [
      rSingletonRuche,
      rRequireOursRuche,
      rAllOursRuche,
    ],
  },

  8: {
    levelNumber: 8,
    boardCellCount: 10,
    emptyCellsCount: 7,
    newElements: [],
    allRules: [
      rNoSameBucheron,
      rNoSameOurs,
      rNoSameMouton,
      rNoSameChien,
      rConnectedChien,
      rNoSameloup,
      rForbidloupMouton,
      rSingletonRuche,
      rRequireOursRuche,
      rAllOursRuche,
    ],
    newRules: [],
  },

  9: {
    levelNumber: 9,
    boardCellCount: 11,
    emptyCellsCount: 7,
    newElements: ['cerf', 'biche'],
    allRules: [
      rNoSameBucheron,
      rNoSameOurs,
      rNoSameMouton,
      rNoSameChien,
      rConnectedChien,
      rNoSameloup,
      rForbidloupMouton,
      rSingletonRuche,
      rRequireOursRuche,
      rAllOursRuche,
      rNoSameCerf,
      rNoSameBiche,
      rPairedCerfBiche,
      rPairedExclusiveCerf,
      rPairedExclusiveBiche,
    ],
    newRules: [
      rNoSameCerf,
      rNoSameBiche,
      rPairedCerfBiche,
      rPairedExclusiveCerf,
      rPairedExclusiveBiche,
    ],
  },

  10: {
    levelNumber: 10,
    boardCellCount: 11,
    emptyCellsCount: 7,
    newElements: [],
    allRules: [
      rNoSameBucheron,
      rNoSameOurs,
      rNoSameMouton,
      rNoSameChien,
      rConnectedChien,
      rNoSameloup,
      rForbidloupMouton,
      rSingletonRuche,
      rRequireOursRuche,
      rAllOursRuche,
      rNoSameCerf,
      rNoSameBiche,
      rPairedCerfBiche,
      rPairedExclusiveCerf,
      rPairedExclusiveBiche,
    ],
    newRules: [],
  },

  11: {
    levelNumber: 11,
    boardCellCount: 11,
    emptyCellsCount: 7,
    newElements: ['tas_buches'],
    allRules: [
      rNoSameBucheron,
      rNoSameOurs,
      rNoSameMouton,
      rNoSameChien,
      rConnectedChien,
      rNoSameloup,
      rForbidloupMouton,
      rSingletonRuche,
      rRequireOursRuche,
      rAllOursRuche,
      rNoSameCerf,
      rNoSameBiche,
      rPairedCerfBiche,
      rPairedExclusiveCerf,
      rPairedExclusiveBiche,
      rChainTasBuches,
    ],
    newRules: [
      rChainTasBuches,
    ],
  },

  12: {
    levelNumber: 12,
    boardCellCount: 12,
    emptyCellsCount: 7,
    newElements: ['chalet'],
    allRules: [
      rNoSameBucheron,
      rNoSameOurs,
      rNoSameMouton,
      rNoSameChien,
      rConnectedChien,
      rNoSameloup,
      rForbidloupMouton,
      rSingletonRuche,
      rRequireOursRuche,
      rAllOursRuche,
      rNoSameCerf,
      rNoSameBiche,
      rPairedCerfBiche,
      rPairedExclusiveCerf,
      rPairedExclusiveBiche,
      rChainTasBuches,
      rChainTasBuchesChalet,
      rNoSameChalet,
      rRequireChaletBucheron,
    ],
    newRules: [
      rChainTasBuchesChalet,
      rNoSameChalet,
      rRequireChaletBucheron,
    ],
  },

  13: {
    levelNumber: 13,
    boardCellCount: 12,
    emptyCellsCount: 7,
    newElements: [],
    allRules: [
      rNoSameBucheron,
      rNoSameOurs,
      rNoSameMouton,
      rNoSameChien,
      rConnectedChien,
      rNoSameloup,
      rForbidloupMouton,
      rSingletonRuche,
      rRequireOursRuche,
      rAllOursRuche,
      rNoSameCerf,
      rNoSameBiche,
      rPairedCerfBiche,
      rPairedExclusiveCerf,
      rPairedExclusiveBiche,
      rChainTasBuches,
      rChainTasBuchesChalet,
      rNoSameChalet,
      rRequireChaletBucheron,
    ],
    newRules: [],
  },

  14: {
    levelNumber: 14,
    boardCellCount: 12,
    emptyCellsCount: 8,
    newElements: [],
    allRules: [
      rNoSameBucheron,
      rNoSameOurs,
      rNoSameMouton,
      rNoSameChien,
      rConnectedChien,
      rNoSameloup,
      rForbidloupMouton,
      rSingletonRuche,
      rRequireOursRuche,
      rAllOursRuche,
      rNoSameCerf,
      rNoSameBiche,
      rPairedCerfBiche,
      rPairedExclusiveCerf,
      rPairedExclusiveBiche,
      rChainTasBuches,
      rChainTasBuchesChalet,
      rNoSameChalet,
      rRequireChaletBucheron,
    ],
    newRules: [],
  },

  15: {
    levelNumber: 15,
    boardCellCount: 12,
    emptyCellsCount: 8,
    newElements: [],
    allRules: [
      rNoSameBucheron,
      rNoSameOurs,
      rNoSameMouton,
      rNoSameChien,
      rConnectedChien,
      rNoSameloup,
      rForbidloupMouton,
      rSingletonRuche,
      rRequireOursRuche,
      rAllOursRuche,
      rNoSameCerf,
      rNoSameBiche,
      rPairedCerfBiche,
      rPairedExclusiveCerf,
      rPairedExclusiveBiche,
      rChainTasBuches,
      rChainTasBuchesChalet,
      rNoSameChalet,
      rRequireChaletBucheron,
    ],
    newRules: [],
  },
};
