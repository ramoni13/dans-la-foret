// ============================================================
// MODÈLE D'UN ÉLÉMENT DU JEU
// Toute règle de jeu est déclarée ici — jamais dans le moteur
// ============================================================

export interface ElementDefinition {
  id: string;               // "bucheron", "ours", "panneau", etc.
  label: string;            // Nom affiché à l'utilisateur
  icon: number | string;    // require('...png') → number en RN, string pour les URI web
  color: string;            // Couleur hex de l'élément
  maxPerBoard: number;      // Nombre max sur le plateau (ex: 4)
  constraints: ConstraintDefinition[];
  placementRules?: PlacementRule[]; // Restrictions de placement (optionnel)
}

export interface ConstraintDefinition {
  type: ConstraintType;
  targetElementId?: string;  // Élément visé par la contrainte
  mode: 'require' | 'forbid'; // Doit avoir / Ne doit pas avoir
  scope: 'neighbor' | 'board'; // Voisin direct / Tout le plateau
  minCount?: number;          // Minimum requis (ex: chien: 1 voisin chien)
}

export type ConstraintType =
  | 'neighbor_same'       // Même élément en voisin
  | 'neighbor_specific'   // Élément spécifique en voisin
  | 'position_only'       // Placement restreint à certaines cases
  | 'count_on_board';     // Contrainte sur le nombre total

export interface PlacementRule {
  type: 'center_only' | 'edge_only' | 'corner_only' | 'cell_whitelist';
  allowedCells?: number[]; // Indices des cases autorisées
}
