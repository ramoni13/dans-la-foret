// ============================================================
// MODÈLE D'UN PLATEAU DE JEU
// Chaque plateau = un fichier de définition + enregistrement
// Le rendu SVG est 100% dynamique à partir de ce modèle
// ============================================================

export interface BoardDefinition {
  id: string;                  // "board_12", "board_6_v1", etc.
  label: string;               // "Forêt Profonde", "Clairière", etc.
  cellCount: number;           // Nombre total de cases
  connections: number[][];     // connections[i] = indices des voisins de i
  cellPositions: CellPosition[]; // Position visuelle de chaque case (%)
  backgroundAsset: number | string; // require('...jpg') → number en RN
  availableElements: string[]; // IDs des éléments utilisables sur ce plateau
  specialCells?: {             // Cases avec rôles spéciaux (optionnel)
    center?: number[];
    edges?: number[];
    corners?: number[];
  };
}

export interface CellPosition {
  x: number; // Position X en pourcentage (0-100)
  y: number; // Position Y en pourcentage (0-100)
}
