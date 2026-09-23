// ============================================================
// LEVEL META — Métadonnées pédagogiques par niveau (1–15)
// Source de vérité pour le briefing de niveau.
// ============================================================

export type RuleCardType =
  | 'no_same_neighbor'   // Interdit deux identiques voisins
  | 'require_neighbor'   // Requiert un voisin spécifique
  | 'forbid_neighbor'    // Interdit un voisin spécifique
  | 'connected_group'    // Tous connexes (meute)
  | 'paired'             // Égalité de quantité (cerf = biche)
  | 'chain'              // Chaîne de voisinage (tas_buches←bucheron)
  | 'singleton';         // Maximum 1 par défi (ruche)

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
const rRequireRucheOurs: RuleCard = {
  id: 'require_ruche_ours',
  type: 'require_neighbor',
  elements: ['ruche', 'ours'],
  i18nKey: 'a11y_require_neighbor',
  i18nVars: { e1: 'ruche', e2: 'ours' },
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
const rNoSameRenard: RuleCard = {
  id: 'no_same_renard',
  type: 'no_same_neighbor',
  elements: ['renard', 'renard'],
  i18nKey: 'a11y_no_same',
  i18nVars: { element: 'renard' },
};
const rForbidRenardMouton: RuleCard = {
  id: 'forbid_renard_mouton',
  type: 'forbid_neighbor',
  elements: ['renard', 'mouton'],
  i18nKey: 'a11y_forbid_neighbor',
  i18nVars: { e1: 'renard', e2: 'mouton' },
};
const rChainTasBuches: RuleCard = {
  id: 'chain_tas_buches',
  type: 'chain',
  elements: ['bucheron', 'tas_buches'],
  i18nKey: 'a11y_chain',
  i18nVars: { e1: 'tas_buches', e2: 'bucheron' },
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

export const LEVEL_META: Record<number, LevelMeta> = {
  1: {
    levelNumber: 1,
    boardCellCount: 6,
    emptyCellsCount: 3,
    newElements: ['bucheron', 'ours', 'mouton', 'ruche'],
    allRules: [
      rNoSameBucheron,
      rNoSameOurs,
      rNoSameMouton,
      rRequireRucheOurs,
      rSingletonRuche,
    ],
    newRules: [
      rNoSameBucheron,
      rNoSameOurs,
      rNoSameMouton,
      rRequireRucheOurs,
      rSingletonRuche,
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
      rRequireRucheOurs,
      rSingletonRuche,
    ],
    newRules: [],
  },

  3: {
    levelNumber: 3,
    boardCellCount: 8,
    emptyCellsCount: 3,
    newElements: ['chien'],
    allRules: [
      rNoSameBucheron,
      rNoSameOurs,
      rNoSameMouton,
      rRequireRucheOurs,
      rSingletonRuche,
      rNoSameChien,
      rConnectedChien,
    ],
    // La règle NOUVELLE et distinctive du chien = la meute connexe.
    // no_same_chien n'est pas mis en avant : c'est la même règle que
    // bucheron/ours/mouton, déjà connue du joueur depuis le niveau 1.
    newRules: [
      rConnectedChien,
    ],
  },

  4: {
    levelNumber: 4,
    boardCellCount: 8,
    emptyCellsCount: 4,
    newElements: [],
    allRules: [
      rNoSameBucheron,
      rNoSameOurs,
      rNoSameMouton,
      rRequireRucheOurs,
      rSingletonRuche,
      rNoSameChien,
      rConnectedChien,
    ],
    newRules: [],
  },

  5: {
    levelNumber: 5,
    boardCellCount: 8,
    emptyCellsCount: 5,
    newElements: ['cerf', 'biche'],
    allRules: [
      rNoSameBucheron,
      rNoSameOurs,
      rNoSameMouton,
      rRequireRucheOurs,
      rSingletonRuche,
      rNoSameChien,
      rConnectedChien,
      rNoSameCerf,
      rNoSameBiche,
      rPairedCerfBiche,
    ],
    newRules: [
      rNoSameCerf,
      rNoSameBiche,
      rPairedCerfBiche,
    ],
  },

  6: {
    levelNumber: 6,
    boardCellCount: 9,
    emptyCellsCount: 3,
    newElements: [],
    allRules: [
      rNoSameBucheron,
      rNoSameOurs,
      rNoSameMouton,
      rRequireRucheOurs,
      rSingletonRuche,
      rNoSameChien,
      rConnectedChien,
      rNoSameCerf,
      rNoSameBiche,
      rPairedCerfBiche,
    ],
    newRules: [],
  },

  7: {
    levelNumber: 7,
    boardCellCount: 9,
    emptyCellsCount: 4,
    newElements: [],
    allRules: [
      rNoSameBucheron,
      rNoSameOurs,
      rNoSameMouton,
      rRequireRucheOurs,
      rSingletonRuche,
      rNoSameChien,
      rConnectedChien,
      rNoSameCerf,
      rNoSameBiche,
      rPairedCerfBiche,
    ],
    newRules: [],
  },

  8: {
    levelNumber: 8,
    boardCellCount: 9,
    emptyCellsCount: 5,
    newElements: ['renard'],
    allRules: [
      rNoSameBucheron,
      rNoSameOurs,
      rNoSameMouton,
      rRequireRucheOurs,
      rSingletonRuche,
      rNoSameChien,
      rConnectedChien,
      rNoSameCerf,
      rNoSameBiche,
      rPairedCerfBiche,
      rNoSameRenard,
      rForbidRenardMouton,
    ],
    newRules: [
      rNoSameRenard,
      rForbidRenardMouton,
    ],
  },

  9: {
    levelNumber: 9,
    boardCellCount: 10,
    emptyCellsCount: 4,
    newElements: [],
    allRules: [
      rNoSameBucheron,
      rNoSameOurs,
      rNoSameMouton,
      rRequireRucheOurs,
      rSingletonRuche,
      rNoSameChien,
      rConnectedChien,
      rNoSameCerf,
      rNoSameBiche,
      rPairedCerfBiche,
      rNoSameRenard,
      rForbidRenardMouton,
    ],
    newRules: [],
  },

  10: {
    levelNumber: 10,
    boardCellCount: 10,
    emptyCellsCount: 5,
    newElements: [],
    allRules: [
      rNoSameBucheron,
      rNoSameOurs,
      rNoSameMouton,
      rRequireRucheOurs,
      rSingletonRuche,
      rNoSameChien,
      rConnectedChien,
      rNoSameCerf,
      rNoSameBiche,
      rPairedCerfBiche,
      rNoSameRenard,
      rForbidRenardMouton,
    ],
    newRules: [],
  },

  11: {
    levelNumber: 11,
    boardCellCount: 11,
    emptyCellsCount: 5,
    newElements: [],
    allRules: [
      rNoSameBucheron,
      rNoSameOurs,
      rNoSameMouton,
      rRequireRucheOurs,
      rSingletonRuche,
      rNoSameChien,
      rConnectedChien,
      rNoSameCerf,
      rNoSameBiche,
      rPairedCerfBiche,
      rNoSameRenard,
      rForbidRenardMouton,
    ],
    newRules: [],
  },

  12: {
    levelNumber: 12,
    boardCellCount: 11,
    emptyCellsCount: 6,
    newElements: ['tas_buches'],
    allRules: [
      rNoSameBucheron,
      rNoSameOurs,
      rNoSameMouton,
      rRequireRucheOurs,
      rSingletonRuche,
      rNoSameChien,
      rConnectedChien,
      rNoSameCerf,
      rNoSameBiche,
      rPairedCerfBiche,
      rNoSameRenard,
      rForbidRenardMouton,
      rChainTasBuches,
    ],
    newRules: [
      rChainTasBuches,
    ],
  },

  13: {
    levelNumber: 13,
    boardCellCount: 12,
    emptyCellsCount: 7,
    newElements: ['chalet'],
    allRules: [
      rNoSameBucheron,
      rNoSameOurs,
      rNoSameMouton,
      rRequireRucheOurs,
      rSingletonRuche,
      rNoSameChien,
      rConnectedChien,
      rNoSameCerf,
      rNoSameBiche,
      rPairedCerfBiche,
      rNoSameRenard,
      rForbidRenardMouton,
      rChainTasBuches,
      rNoSameChalet,
      rRequireChaletBucheron,
    ],
    newRules: [
      rNoSameChalet,
      rRequireChaletBucheron,
    ],
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
      rRequireRucheOurs,
      rSingletonRuche,
      rNoSameChien,
      rConnectedChien,
      rNoSameCerf,
      rNoSameBiche,
      rPairedCerfBiche,
      rNoSameRenard,
      rForbidRenardMouton,
      rChainTasBuches,
      rNoSameChalet,
      rRequireChaletBucheron,
    ],
    newRules: [],
  },

  15: {
    levelNumber: 15,
    boardCellCount: 12,
    emptyCellsCount: 9,
    newElements: [],
    allRules: [
      rNoSameBucheron,
      rNoSameOurs,
      rNoSameMouton,
      rRequireRucheOurs,
      rSingletonRuche,
      rNoSameChien,
      rConnectedChien,
      rNoSameCerf,
      rNoSameBiche,
      rPairedCerfBiche,
      rNoSameRenard,
      rForbidRenardMouton,
      rChainTasBuches,
      rNoSameChalet,
      rRequireChaletBucheron,
    ],
    newRules: [],
  },
};
