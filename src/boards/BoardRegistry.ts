// ============================================================
// REGISTRE DES PLATEAUX
// Ajouter un nouveau plateau = créer son fichier + une ligne ici
// Le rendu SVG s'adapte automatiquement via BoardRenderer
// ============================================================

import { BoardDefinition } from '../core/models/Board';
import { board12cells } from './board_12cells';
import { board6cellsV1 } from './board_6cells_v1';
import { board8cellsV2 } from './board_8cells_v2';
import { board10cellsV3 } from './board_10cells_v3';

export const BoardRegistry: Record<string, BoardDefinition> = {
  board_6_v1: board6cellsV1,   //  6 cases — Clairière
  board_8_v2: board8cellsV2,   //  8 cases — Lisière
  board_10_v3: board10cellsV3,  // 10 cases — Sous-bois
  board_12: board12cells,    // 12 cases — Forêt Profonde
  // 👇 Ajouter un nouveau plateau ici
};
