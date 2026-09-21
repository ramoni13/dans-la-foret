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
  targetElementId?: string;   // Élément visé par la contrainte
  mode: 'require' | 'forbid'; // Doit avoir / Ne doit pas avoir
  scope: 'neighbor' | 'board'; // Voisin direct / Tout le plateau
  minCount?: number;           // Minimum requis (ex: chien: 1 voisin chien)
  //
  // Champ additionnel pour 'neighbor_specific_chain' :
  // Si chainTargetElementId est présent sur le plateau, cet élément
  // doit aussi en être voisin (contrainte conditionnelle).
  // Ex : tas_buches doit être voisin de bucheron ET de chalet si chalet présent.
  chainTargetElementId?: string;
}

export type ConstraintType =
  | 'neighbor_same'            // Même élément en voisin (forbid ou require)
  | 'neighbor_specific'        // Élément spécifique en voisin (forbid ou require)
  | 'position_only'            // Placement restreint à certaines cases
  | 'count_on_board'           // Contrainte sur le nombre total sur le plateau
  | 'connected_group'          // Tous les exemplaires forment UN SEUL groupe connexe
  //   → chien : toute la meute reliée, pas de sous-groupes
  | 'paired_specific'          // Couplage 1-pour-1 avec targetElementId
  //   → cerf/biche : chaque cerf voisin d'exactement 1 biche
  //     et inversement ; counts égaux obligatoires
  | 'neighbor_specific_chain'; // Voisinage requis + voisinage conditionnel
//   → tas_buches : voisin bucheron TOUJOURS
//     + voisin chalet SI chalet présent sur le plateau

export interface PlacementRule {
  type: 'center_only' | 'edge_only' | 'corner_only' | 'cell_whitelist';
  allowedCells?: number[]; // Indices des cases autorisées
}
