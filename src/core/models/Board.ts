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
  /**
   * Métadonnées de grille — présentes uniquement sur les plateaux ONF.
   * Définit les groupes de cases formant chaque ligne et chaque colonne.
   * Le validateur standard l'ignore ; le validateur ONF l'utilise pour
   * vérifier la contrainte row_col_unique (max 1 élément identique par ligne/colonne).
   */
  gridMeta?: {
    rows: number[][];  // gridMeta.rows[i] = indices des cases de la ligne i
    cols: number[][];  // gridMeta.cols[j] = indices des cases de la colonne j
  };
}

export interface CellPosition {
  x: number; // Position X en pourcentage (0-100)
  y: number; // Position Y en pourcentage (0-100)
}
