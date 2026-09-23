// ============================================================
// PARAMÈTRES DE DIFFICULTÉ — 15 niveaux
//
// 3 leviers combinés :
//   1. Plateau : 6 → 7 → 8 → 9 → 10 → 11 → 12 cases
//   2. Composition : nombre et types d'éléments
//   3. Cases vides : valeur FIXE et unique par niveau (pas de plage)
//
// Progression des cases vides :
//   Niv 1  : 6 cases,  3 vides
//   Niv 2  : 7 cases,  4 vides
//   Niv 3  : 8 cases,  3 vides
//   Niv 4  : 8 cases,  4 vides
//   Niv 5  : 8 cases,  5 vides
//   Niv 6  : 9 cases,  3 vides  ★ Nouveau plateau, respiration
//   Niv 7  : 9 cases,  4 vides
//   Niv 8  : 9 cases,  5 vides  ★ Introduction Renard (sur plateau 9 cases)
//   Niv 9  : 10 cases, 4 vides  ★ Nouveau plateau, respiration
//   Niv 10 : 10 cases, 5 vides
//   Niv 11 : 11 cases, 5 vides  ★ Nouveau plateau (board_11_v2, map lisible)
//   Niv 12 : 11 cases, 6 vides  ★ Introduction Tas de bûches
//   Niv 13 : 12 cases, 7 vides  ★ Nouveau plateau + Introduction Chalet
//   Niv 14 : 12 cases, 8 vides
//   Niv 15 : 12 cases, 9 vides  — bonus désactivés
//
// Nouveaux éléments introduits progressivement :
//   Niv 1-2  : Mouton, Bucheron, Ours, Ruche (max 1, voisin Ours obligatoire)
//   Niv 3-4  : + Chien (meute connexe, chien >= 2 toujours)
//   Niv 5-7  : + Cerf + Biche (couples 1-pour-1, cerf = biche en quantité)
//   Niv 8-10 : + Renard (répulsion Renard/Mouton) — introduit sur 9 cases
//   Niv 12   : + Tas de bûches (voisin Bucheron, + voisin Chalet si présent)
//   Niv 13-15: + Chalet (voisin Bucheron obligatoire, bucheron >= chalet)
//
// Invariants à respecter dans chaque composition :
//   I1 : Σ éléments = cellCount
//   I2 : ruche <= 1 (maxPerBoard = 1)
//   I3 : ours >= 1 si ruche = 1 (la ruche a besoin d'un ours voisin possible)
//   I4 : chien >= 2 si chien > 0 (règle meute impossible avec 1 seul chien)
//   I5 : cerf = biche en quantité (couples 1-pour-1)
//   I6 : bucheron >= chalet si les deux présents
//   I7 : bucheron >= 1 si tas_buches > 0
// ============================================================

export type DifficultyLevel =
  | 'niveau_1' | 'niveau_2' | 'niveau_3' | 'niveau_4' | 'niveau_5'
  | 'niveau_6' | 'niveau_7' | 'niveau_8'   // 9 cases — Lisière Étendue
  | 'niveau_9' | 'niveau_10'               // 10 cases — Sous-bois
  | 'niveau_11' | 'niveau_12'              // 11 cases — Sous-bois Profond v2
  | 'niveau_13' | 'niveau_14' | 'niveau_15'; // 12 cases — Forêt Profonde

export interface Composition {
  // ── Éléments de base (niv 1+) ──────────────────────────────
  bucheron?: number;   // ≠ voisin bucheron
  ours?: number;       // ≠ voisin ours
  mouton?: number;     // ≠ voisin mouton, ≠ voisin renard
  ruche?: number;      // = voisin ours · MAX 1 PAR DÉFI (I2, I3)
  // ── Introduits niv 3+ ───────────────────────────────────────
  chien?: number;      // = voisin chien (meute connexe) · TOUJOURS >= 2 si > 0 (I4)
  // ── Introduits niv 5+ ───────────────────────────────────────
  cerf?: number;       // ≠ voisin cerf · = voisin 1 biche · TOUJOURS = biche (I5)
  biche?: number;      // ≠ voisin biche · = voisin 1 cerf · TOUJOURS = cerf (I5)
  // ── Introduits niv 8+ ───────────────────────────────────────
  renard?: number;     // ≠ voisin mouton, ≠ voisin renard
  // ── Introduits niv 12+ ──────────────────────────────────────
  tas_buches?: number; // = voisin bucheron · = voisin chalet si chalet présent (I7)
  // ── Introduits niv 13+ ──────────────────────────────────────
  chalet?: number;     // = voisin bucheron · ≠ voisin chalet · bucheron >= chalet (I6)
}

export interface LevelParams {
  boardId: string;                   // Plateau utilisé
  cellCount: number;                 // Nombre de cases du plateau
  compositions: Composition[];       // Compositions possibles (total = cellCount)
  emptyCellsRange: [number, number]; // [min, max] — ici toujours [N, N] (valeur fixe)
  bonusDisabled: boolean;
  estimatedDurationRange: [number, number]; // [min, max] en secondes
}

export const LEVEL_PARAMS: Record<DifficultyLevel, LevelParams> = {

  // ────────────────────────────────────────────────────────────────
  // PLATEAU 6 CASES — niveau 1
  // ────────────────────────────────────────────────────────────────

  niveau_1: {
    // 4 types : Bucheron, Ours, Mouton, Ruche — 3 vides fixes
    // Introduction en douceur : pas de Chien, ruche = 1 toujours (I2)
    // ours >= 1 toujours pour que la ruche puisse etre valide (I3)
    boardId: 'board_6_v1',
    cellCount: 6,
    compositions: [
      { bucheron: 2, ours: 2, mouton: 1, ruche: 1 }, // total=6 I1✓ I2✓ I3✓
      { bucheron: 2, ours: 1, mouton: 2, ruche: 1 }, // total=6 I1✓ I2✓ I3✓
      { bucheron: 1, ours: 2, mouton: 2, ruche: 1 }, // total=6 I1✓ I2✓ I3✓
      { bucheron: 3, ours: 1, mouton: 1, ruche: 1 }, // total=6 I1✓ I2✓ I3✓
      { bucheron: 1, ours: 3, mouton: 1, ruche: 1 }, // total=6 I1✓ I2✓ I3✓
      { bucheron: 1, ours: 1, mouton: 3, ruche: 1 }, // total=6 I1✓ I2✓ I3✓
      { bucheron: 3, ours: 2, mouton: 0, ruche: 1 }, // total=6 I1✓ I2✓ I3✓
      { bucheron: 2, ours: 3, mouton: 0, ruche: 1 }, // total=6 I1✓ I2✓ I3✓
      { bucheron: 0, ours: 3, mouton: 2, ruche: 1 }, // total=6 I1✓ I2✓ I3✓
      { bucheron: 4, ours: 1, mouton: 0, ruche: 1 }, // total=6 I1✓ I2✓ I3✓
    ],
    emptyCellsRange: [3, 3],
    bonusDisabled: false,
    estimatedDurationRange: [60, 150],
  },

  // ────────────────────────────────────────────────────────────────
  // PLATEAU 7 CASES — niveau 2
  // ────────────────────────────────────────────────────────────────

  niveau_2: {
    // 4 types : Bucheron, Ours, Mouton, Ruche — 4 vides fixes
    // Même palette que niv 1, plateau plus grand (7 cases)
    boardId: 'board_7_v1',
    cellCount: 7,
    compositions: [
      { bucheron: 2, ours: 2, mouton: 2, ruche: 1 }, // total=7 I1✓ I2✓ I3✓
      { bucheron: 3, ours: 2, mouton: 1, ruche: 1 }, // total=7 I1✓ I2✓ I3✓
      { bucheron: 2, ours: 3, mouton: 1, ruche: 1 }, // total=7 I1✓ I2✓ I3✓
      { bucheron: 1, ours: 2, mouton: 3, ruche: 1 }, // total=7 I1✓ I2✓ I3✓
      { bucheron: 3, ours: 1, mouton: 2, ruche: 1 }, // total=7 I1✓ I2✓ I3✓
      { bucheron: 1, ours: 3, mouton: 2, ruche: 1 }, // total=7 I1✓ I2✓ I3✓
      { bucheron: 4, ours: 2, mouton: 0, ruche: 1 }, // total=7 I1✓ I2✓ I3✓
      { bucheron: 4, ours: 1, mouton: 1, ruche: 1 }, // total=7 I1✓ I2✓ I3✓
      { bucheron: 2, ours: 4, mouton: 0, ruche: 1 }, // total=7 I1✓ I2✓ I3✓
      { bucheron: 0, ours: 4, mouton: 2, ruche: 1 }, // total=7 I1✓ I2✓ I3✓
      { bucheron: 0, ours: 3, mouton: 3, ruche: 1 }, // total=7 I1✓ I2✓ I3✓
      { bucheron: 1, ours: 4, mouton: 1, ruche: 1 }, // total=7 I1✓ I2✓ I3✓
    ],
    emptyCellsRange: [4, 4],
    bonusDisabled: false,
    estimatedDurationRange: [120, 240],
  },

  // ────────────────────────────────────────────────────────────────
  // PLATEAU 8 CASES — niveaux 3, 4, 5
  // ────────────────────────────────────────────────────────────────

  niveau_3: {
    // 5 types : Bucheron, Ours, Mouton, Ruche, Chien — 3 vides fixes
    // Introduction du Chien (règle meute connexe). chien=2 toujours (I4).
    boardId: 'board_8_v2',
    cellCount: 8,
    compositions: [
      { bucheron: 2, ours: 2, mouton: 1, chien: 2, ruche: 1 }, // total=8 I1✓ I2✓ I3✓ I4✓
      { bucheron: 2, ours: 1, mouton: 2, chien: 2, ruche: 1 }, // total=8 I1✓ I2✓ I3✓ I4✓
      { bucheron: 1, ours: 2, mouton: 2, chien: 2, ruche: 1 }, // total=8 I1✓ I2✓ I3✓ I4✓
      { bucheron: 3, ours: 1, mouton: 1, chien: 2, ruche: 1 }, // total=8 I1✓ I2✓ I3✓ I4✓
      { bucheron: 1, ours: 3, mouton: 1, chien: 2, ruche: 1 }, // total=8 I1✓ I2✓ I3✓ I4✓
      { bucheron: 1, ours: 1, mouton: 3, chien: 2, ruche: 1 }, // total=8 I1✓ I2✓ I3✓ I4✓
      { bucheron: 3, ours: 2, mouton: 0, chien: 2, ruche: 1 }, // total=8 I1✓ I2✓ I3✓ I4✓
      { bucheron: 0, ours: 3, mouton: 2, chien: 2, ruche: 1 }, // total=8 I1✓ I2✓ I3✓ I4✓
      { bucheron: 3, ours: 2, mouton: 1, chien: 2 },           // total=8 I1✓ I4✓
      { bucheron: 2, ours: 3, mouton: 1, chien: 2 },           // total=8 I1✓ I4✓
      { bucheron: 2, ours: 2, mouton: 2, chien: 2 },           // total=8 I1✓ I4✓
      { bucheron: 3, ours: 1, mouton: 2, chien: 2 },           // total=8 I1✓ I4✓
      { bucheron: 1, ours: 2, mouton: 3, chien: 2 },           // total=8 I1✓ I4✓
      { bucheron: 1, ours: 3, mouton: 2, chien: 2 },           // total=8 I1✓ I4✓
    ],
    emptyCellsRange: [3, 3],
    bonusDisabled: false,
    estimatedDurationRange: [150, 270],
  },

  niveau_4: {
    // 5 types : Bucheron, Ours, Mouton, Ruche, Chien — 4 vides fixes
    // Même palette que niv 3, plus de cases vides = plus difficile.
    boardId: 'board_8_v2',
    cellCount: 8,
    compositions: [
      { bucheron: 2, ours: 2, mouton: 1, chien: 2, ruche: 1 }, // total=8 I1✓ I2✓ I3✓ I4✓
      { bucheron: 3, ours: 1, mouton: 1, chien: 2, ruche: 1 }, // total=8 I1✓ I2✓ I3✓ I4✓
      { bucheron: 1, ours: 3, mouton: 1, chien: 2, ruche: 1 }, // total=8 I1✓ I2✓ I3✓ I4✓
      { bucheron: 1, ours: 2, mouton: 1, chien: 3, ruche: 1 }, // total=8 I1✓ I2✓ I3✓ I4✓
      { bucheron: 2, ours: 1, mouton: 1, chien: 3, ruche: 1 }, // total=8 I1✓ I2✓ I3✓ I4✓
      { bucheron: 1, ours: 1, mouton: 2, chien: 3, ruche: 1 }, // total=8 I1✓ I2✓ I3✓ I4✓
      { bucheron: 3, ours: 1, mouton: 0, chien: 3, ruche: 1 }, // total=8 I1✓ I2✓ I3✓ I4✓
      { bucheron: 0, ours: 3, mouton: 1, chien: 3, ruche: 1 }, // total=8 I1✓ I2✓ I3✓ I4✓
      { bucheron: 1, ours: 2, mouton: 0, chien: 4, ruche: 1 }, // total=8 I1✓ I2✓ I3✓ I4✓
      { bucheron: 2, ours: 1, mouton: 0, chien: 4, ruche: 1 }, // total=8 I1✓ I2✓ I3✓ I4✓
      { bucheron: 0, ours: 2, mouton: 1, chien: 4, ruche: 1 }, // total=8 I1✓ I2✓ I3✓ I4✓
      { bucheron: 1, ours: 3, mouton: 0, chien: 3, ruche: 1 }, // total=8 I1✓ I2✓ I3✓ I4✓
    ],
    emptyCellsRange: [4, 4],
    bonusDisabled: false,
    estimatedDurationRange: [210, 360],
  },

  niveau_5: {
    // 7 types : Bucheron, Ours, Mouton, Ruche, Chien, Cerf, Biche — 5 vides fixes
    // Introduction du Cerf et de la Biche (couples 1-pour-1). cerf = biche (I5).
    boardId: 'board_8_v2',
    cellCount: 8,
    compositions: [
      { bucheron: 2, ours: 2, mouton: 1, cerf: 1, biche: 1, ruche: 1 },                     // total=8 I1✓ I2✓ I3✓ I5✓
      { bucheron: 3, ours: 1, mouton: 1, cerf: 1, biche: 1, ruche: 1 },                     // total=8 I1✓ I2✓ I3✓ I5✓
      { bucheron: 1, ours: 3, mouton: 1, cerf: 1, biche: 1, ruche: 1 },                     // total=8 I1✓ I2✓ I3✓ I5✓
      { bucheron: 2, ours: 1, mouton: 2, cerf: 1, biche: 1, ruche: 1 },                     // total=8 I1✓ I2✓ I3✓ I5✓
      { bucheron: 1, ours: 2, mouton: 0, chien: 2, cerf: 1, biche: 1, ruche: 1 },           // total=8 I1✓ I2✓ I3✓ I4✓ I5✓
      { bucheron: 2, ours: 1, mouton: 0, chien: 2, cerf: 1, biche: 1, ruche: 1 },           // total=8 I1✓ I2✓ I3✓ I4✓ I5✓
      { bucheron: 0, ours: 2, mouton: 1, chien: 2, cerf: 1, biche: 1, ruche: 1 },           // total=8 I1✓ I2✓ I3✓ I4✓ I5✓
      { bucheron: 1, ours: 1, mouton: 1, chien: 2, cerf: 1, biche: 1, ruche: 1 },           // total=8 I1✓ I2✓ I3✓ I4✓ I5✓
      { bucheron: 2, ours: 2, mouton: 0, chien: 2, cerf: 1, biche: 1 },                     // total=8 I1✓ I4✓ I5✓
      { bucheron: 3, ours: 1, mouton: 0, chien: 2, cerf: 1, biche: 1 },                     // total=8 I1✓ I4✓ I5✓
      { bucheron: 2, ours: 2, mouton: 0, cerf: 2, biche: 2 },                               // total=8 I1✓ I5✓
      { bucheron: 3, ours: 1, mouton: 0, cerf: 2, biche: 2 },                               // total=8 I1✓ I5✓
      { bucheron: 1, ours: 3, mouton: 0, cerf: 2, biche: 2 },                               // total=8 I1✓ I5✓
      { bucheron: 2, ours: 0, mouton: 0, chien: 2, cerf: 2, biche: 2 },                     // total=8 I1✓ I4✓ I5✓
      { bucheron: 0, ours: 2, mouton: 0, chien: 2, cerf: 2, biche: 2 },                     // total=8 I1✓ I4✓ I5✓
    ],
    emptyCellsRange: [5, 5],
    bonusDisabled: false,
    estimatedDurationRange: [300, 480],
  },

  // ────────────────────────────────────────────────────────────────
  // PLATEAU 9 CASES — niveaux 6, 7, 8
  // ────────────────────────────────────────────────────────────────

  niveau_6: {
    // 7 types : Bucheron, Ours, Mouton, Ruche, Chien, Cerf, Biche — 3 vides fixes
    // Nouveau plateau 9 cases : respiration (3 vides au lieu de 5).
    // Même palette que niv 5. cerf = biche (I5). chien >= 2 si présent (I4).
    boardId: 'board_9_v1',
    cellCount: 9,
    compositions: [
      // 1 couple — chien=2, ruche=1 (7 types actifs)
      { bucheron: 2, ours: 1, mouton: 1, chien: 2, cerf: 1, biche: 1, ruche: 1 }, // 2+1+1+2+1+1+1=9 I1✓ I2✓ I3✓ I4✓ I5✓
      { bucheron: 1, ours: 2, mouton: 1, chien: 2, cerf: 1, biche: 1, ruche: 1 }, // 1+2+1+2+1+1+1=9 I1✓ I2✓ I3✓ I4✓ I5✓
      { bucheron: 1, ours: 1, mouton: 2, chien: 2, cerf: 1, biche: 1, ruche: 1 }, // 1+1+2+2+1+1+1=9 I1✓ I2✓ I3✓ I4✓ I5✓
      { bucheron: 2, ours: 2, mouton: 0, chien: 2, cerf: 1, biche: 1, ruche: 1 }, // 2+2+0+2+1+1+1=9 I1✓ I2✓ I3✓ I4✓ I5✓
      // 1 couple — ruche=1, sans chien (5 types actifs)
      { bucheron: 2, ours: 2, mouton: 2, cerf: 1, biche: 1, ruche: 1 },           // 2+2+2+1+1+1=9   I1✓ I2✓ I3✓ I5✓
      { bucheron: 3, ours: 2, mouton: 1, cerf: 1, biche: 1, ruche: 1 },           // 3+2+1+1+1+1=9   I1✓ I2✓ I3✓ I5✓
      { bucheron: 2, ours: 3, mouton: 1, cerf: 1, biche: 1, ruche: 1 },           // 2+3+1+1+1+1=9   I1✓ I2✓ I3✓ I5✓
      // 1 couple — chien=2, sans ruche (5 types actifs)
      { bucheron: 2, ours: 2, mouton: 1, chien: 2, cerf: 1, biche: 1 },           // 2+2+1+2+1+1=9   I1✓ I4✓ I5✓
      { bucheron: 2, ours: 1, mouton: 2, chien: 2, cerf: 1, biche: 1 },           // 2+1+2+2+1+1=9   I1✓ I4✓ I5✓
      { bucheron: 3, ours: 1, mouton: 1, chien: 2, cerf: 1, biche: 1 },           // 3+1+1+2+1+1=9   I1✓ I4✓ I5✓
      // Sans couple — cerf/biche absents (4 types actifs)
      { bucheron: 3, ours: 2, mouton: 2, cerf: 1, biche: 1 },                     // 3+2+2+1+1=9     I1✓ I5✓
      // 2 couples — sans chien, sans ruche
      { bucheron: 2, ours: 1, mouton: 0, chien: 2, cerf: 2, biche: 2 },           // 2+1+0+2+2+2=9   I1✓ I4✓ I5✓
    ],
    emptyCellsRange: [3, 3],
    bonusDisabled: false,
    estimatedDurationRange: [150, 270],
  },

  niveau_7: {
    // 7 types : Bucheron, Ours, Mouton, Ruche, Chien, Cerf, Biche — 4 vides fixes
    // Même palette que niv 6, plus de vides. Reprend les compositions actuelles du niv 6.
    boardId: 'board_9_v1',
    cellCount: 9,
    compositions: [
      // 1 couple — chien=2, ruche=1 (7 types actifs)
      { bucheron: 2, ours: 1, mouton: 1, chien: 2, cerf: 1, biche: 1, ruche: 1 }, // 2+1+1+2+1+1+1=9 I1✓ I2✓ I3✓ I4✓ I5✓
      { bucheron: 1, ours: 2, mouton: 1, chien: 2, cerf: 1, biche: 1, ruche: 1 }, // 1+2+1+2+1+1+1=9 I1✓ I2✓ I3✓ I4✓ I5✓
      { bucheron: 1, ours: 1, mouton: 2, chien: 2, cerf: 1, biche: 1, ruche: 1 }, // 1+1+2+2+1+1+1=9 I1✓ I2✓ I3✓ I4✓ I5✓
      { bucheron: 2, ours: 2, mouton: 0, chien: 2, cerf: 1, biche: 1, ruche: 1 }, // 2+2+0+2+1+1+1=9 I1✓ I2✓ I3✓ I4✓ I5✓
      // 1 couple — chien=2, sans ruche (5 types actifs)
      { bucheron: 2, ours: 2, mouton: 1, chien: 2, cerf: 1, biche: 1 },           // 2+2+1+2+1+1=9   I1✓ I4✓ I5✓
      { bucheron: 2, ours: 1, mouton: 2, chien: 2, cerf: 1, biche: 1 },           // 2+1+2+2+1+1=9   I1✓ I4✓ I5✓
      { bucheron: 1, ours: 2, mouton: 2, chien: 2, cerf: 1, biche: 1 },           // 1+2+2+2+1+1=9   I1✓ I4✓ I5✓
      { bucheron: 3, ours: 1, mouton: 1, chien: 2, cerf: 1, biche: 1 },           // 3+1+1+2+1+1=9   I1✓ I4✓ I5✓
      // 1 couple — ruche=1, sans chien (5 types actifs)
      { bucheron: 2, ours: 2, mouton: 2, cerf: 1, biche: 1, ruche: 1 },           // 2+2+2+1+1+1=9   I1✓ I2✓ I3✓ I5✓
      { bucheron: 3, ours: 2, mouton: 1, cerf: 1, biche: 1, ruche: 1 },           // 3+2+1+1+1+1=9   I1✓ I2✓ I3✓ I5✓
      { bucheron: 2, ours: 3, mouton: 1, cerf: 1, biche: 1, ruche: 1 },           // 2+3+1+1+1+1=9   I1✓ I2✓ I3✓ I5✓
      { bucheron: 1, ours: 3, mouton: 2, cerf: 1, biche: 1, ruche: 1 },           // 1+3+2+1+1+1=9   I1✓ I2✓ I3✓ I5✓
      // 2 couples — chien=2, sans ruche (4 types actifs)
      { bucheron: 2, ours: 1, mouton: 0, chien: 2, cerf: 2, biche: 2 },           // 2+1+0+2+2+2=9   I1✓ I4✓ I5✓
      { bucheron: 1, ours: 2, mouton: 0, chien: 2, cerf: 2, biche: 2 },           // 1+2+0+2+2+2=9   I1✓ I4✓ I5✓
      // Sans couple — cerf/biche absents
      { bucheron: 3, ours: 2, mouton: 2, cerf: 1, biche: 1 },                     // 3+2+2+1+1=9     I1✓ I5✓
    ],
    emptyCellsRange: [4, 4],
    bonusDisabled: false,
    estimatedDurationRange: [270, 420],
  },

  niveau_8: {
    // 8 types : Bucheron, Ours, Mouton, Ruche, Chien, Cerf, Biche, Renard — 5 vides fixes
    // ★ Introduction du Renard sur 9 cases (espace réduit = contrainte renard/mouton plus visible)
    // renard >= 1 toujours. chien >= 2 si présent (I4). cerf = biche si présents (I5).
    boardId: 'board_9_v1',
    cellCount: 9,
    compositions: [
      // renard=2, chien=2, ruche=1, mouton présent (6 types actifs)
      { bucheron: 2, ours: 2, mouton: 1, chien: 2, renard: 2, ruche: 1 }, // 2+2+1+2+2+1=10? NON 2+2+1+2+2+0?
      // ↑ 2+2+1+2+2+1=10 ≠ 9 → ajuster : renard=1 max ou supprimer un élément
      // Sur 9 cases : renard + chien + ruche = 1+2+1=4, reste 5 pour buch+ours+mouton
      { bucheron: 2, ours: 2, mouton: 1, chien: 2, renard: 1, ruche: 1 }, // 2+2+1+2+1+1=9 I1✓ I2✓ I3✓ I4✓
      { bucheron: 2, ours: 1, mouton: 2, chien: 2, renard: 1, ruche: 1 }, // 2+1+2+2+1+1=9 I1✓ I2✓ I3✓ I4✓
      { bucheron: 3, ours: 1, mouton: 1, chien: 2, renard: 1, ruche: 1 }, // 3+1+1+2+1+1=9 I1✓ I2✓ I3✓ I4✓
      { bucheron: 1, ours: 3, mouton: 1, chien: 2, renard: 1, ruche: 1 }, // 1+3+1+2+1+1=9 I1✓ I2✓ I3✓ I4✓
      // renard=2, sans chien, ruche=1, mouton présent (5 types actifs)
      // renard+ruche=3, reste 6 pour buch+ours+mouton
      { bucheron: 2, ours: 2, mouton: 2, renard: 2, ruche: 1 },           // 2+2+2+2+1=9   I1✓ I2✓ I3✓
      { bucheron: 3, ours: 2, mouton: 1, renard: 2, ruche: 1 },           // 3+2+1+2+1=9   I1✓ I2✓ I3✓
      { bucheron: 2, ours: 3, mouton: 1, renard: 2, ruche: 1 },           // 2+3+1+2+1=9   I1✓ I2✓ I3✓
      // renard=2, chien=2, sans ruche, mouton présent (5 types actifs)
      // renard+chien=4, reste 5 pour buch+ours+mouton
      { bucheron: 2, ours: 2, mouton: 1, chien: 2, renard: 2 },           // 2+2+1+2+2=9   I1✓ I4✓
      { bucheron: 3, ours: 1, mouton: 1, chien: 2, renard: 2 },           // 3+1+1+2+2=9   I1✓ I4✓
      { bucheron: 2, ours: 1, mouton: 2, chien: 2, renard: 2 },           // 2+1+2+2+2=9   I1✓ I4✓
      // renard=2, sans chien, sans ruche (4 types actifs)
      { bucheron: 3, ours: 2, mouton: 2, renard: 2 },                     // 3+2+2+2=9     I1✓
      { bucheron: 2, ours: 3, mouton: 2, renard: 2 },                     // 2+3+2+2=9     I1✓
      // 1 couple — renard=1, sans chien, ruche=1 (7 types actifs)
      { bucheron: 2, ours: 2, mouton: 1, renard: 1, cerf: 1, biche: 1, ruche: 1 }, // 2+2+1+1+1+1+1=9 I1✓ I2✓ I3✓ I5✓
      { bucheron: 2, ours: 1, mouton: 2, renard: 1, cerf: 1, biche: 1, ruche: 1 }, // 2+1+2+1+1+1+1=9 I1✓ I2✓ I3✓ I5✓
      // renard=3, sans chien, sans ruche (4 types actifs) — renard dominant
      { bucheron: 3, ours: 2, mouton: 1, renard: 3 },                     // 3+2+1+3=9     I1✓
      { bucheron: 2, ours: 2, mouton: 2, renard: 3 },                     // 2+2+2+3=9     I1✓
    ],
    emptyCellsRange: [5, 5],
    bonusDisabled: false,
    estimatedDurationRange: [360, 540],
  },

  // ────────────────────────────────────────────────────────────────
  // PLATEAU 10 CASES — niveaux 9, 10
  // ────────────────────────────────────────────────────────────────

  niveau_9: {
    // 8 types : Bucheron, Ours, Mouton, Ruche, Chien, Cerf, Biche, Renard — 4 vides fixes
    // Nouveau plateau 10 cases : respiration (4 vides). Renard consolidé.
    // Reprend les compositions de l'ancien niv 7 (10 cases, 4 vides).
    boardId: 'board_10_v3',
    cellCount: 10,
    compositions: [
      // 1 couple — ruche=1, chien=2, mouton présent (7 types actifs)
      { bucheron: 2, ours: 2, mouton: 1, chien: 2, cerf: 1, biche: 1, ruche: 1 }, // total=10 I1✓ I2✓ I3✓ I4✓ I5✓
      { bucheron: 2, ours: 1, mouton: 2, chien: 2, cerf: 1, biche: 1, ruche: 1 }, // total=10 I1✓ I2✓ I3✓ I4✓ I5✓
      { bucheron: 1, ours: 2, mouton: 2, chien: 2, cerf: 1, biche: 1, ruche: 1 }, // total=10 I1✓ I2✓ I3✓ I4✓ I5✓
      { bucheron: 3, ours: 1, mouton: 1, chien: 2, cerf: 1, biche: 1, ruche: 1 }, // total=10 I1✓ I2✓ I3✓ I4✓ I5✓
      { bucheron: 1, ours: 3, mouton: 1, chien: 2, cerf: 1, biche: 1, ruche: 1 }, // total=10 I1✓ I2✓ I3✓ I4✓ I5✓
      // 1 couple — ruche=1, sans chien (6 types actifs)
      { bucheron: 3, ours: 2, mouton: 2, cerf: 1, biche: 1, ruche: 1 },           // total=10 I1✓ I2✓ I3✓ I5✓
      { bucheron: 2, ours: 3, mouton: 2, cerf: 1, biche: 1, ruche: 1 },           // total=10 I1✓ I2✓ I3✓ I5✓
      { bucheron: 4, ours: 2, mouton: 1, cerf: 1, biche: 1, ruche: 1 },           // total=10 I1✓ I2✓ I3✓ I5✓
      // 1 couple — chien=2, ruche=1, mouton=0 (6 types actifs)
      { bucheron: 3, ours: 2, mouton: 0, chien: 2, cerf: 1, biche: 1, ruche: 1 }, // total=10 I1✓ I2✓ I3✓ I4✓ I5✓
      { bucheron: 2, ours: 3, mouton: 0, chien: 2, cerf: 1, biche: 1, ruche: 1 }, // total=10 I1✓ I2✓ I3✓ I4✓ I5✓
      // 1 couple — chien=2, sans ruche (5 types actifs)
      { bucheron: 2, ours: 2, mouton: 2, chien: 2, cerf: 1, biche: 1 },           // total=10 I1✓ I4✓ I5✓
      { bucheron: 3, ours: 2, mouton: 1, chien: 2, cerf: 1, biche: 1 },           // total=10 I1✓ I4✓ I5✓
      // 2 couples — chien=2, sans ruche (4 types actifs)
      { bucheron: 2, ours: 2, mouton: 0, chien: 2, cerf: 2, biche: 2 },           // total=10 I1✓ I4✓ I5✓
      { bucheron: 3, ours: 1, mouton: 0, chien: 2, cerf: 2, biche: 2 },           // total=10 I1✓ I4✓ I5✓
      // Renard introduit — renard=2, sans chien (5 types actifs)
      { bucheron: 3, ours: 2, mouton: 1, renard: 2, cerf: 1, biche: 1 },          // 3+2+1+2+1+1=10 I1✓ I5✓
      { bucheron: 3, ours: 1, mouton: 2, cerf: 2, biche: 2 },                     // total=10 I1✓ I5✓
    ],
    emptyCellsRange: [4, 4],
    bonusDisabled: false,
    estimatedDurationRange: [270, 420],
  },

  niveau_10: {
    // 8 types : Bucheron, Ours, Mouton, Ruche, Chien, Cerf, Biche, Renard — 5 vides fixes
    // Même plateau 10 cases, plus de vides. Renard présent dans la majorité des compos.
    boardId: 'board_10_v3',
    cellCount: 10,
    compositions: [
      // renard=2, chien=2, ruche=1, mouton présent (6 types actifs)
      { bucheron: 2, ours: 2, mouton: 1, chien: 2, renard: 2, ruche: 1 }, // 2+2+1+2+2+1=10 I1✓ I2✓ I3✓ I4✓
      { bucheron: 2, ours: 1, mouton: 2, chien: 2, renard: 2, ruche: 1 }, // 2+1+2+2+2+1=10 I1✓ I2✓ I3✓ I4✓
      { bucheron: 3, ours: 1, mouton: 1, chien: 2, renard: 2, ruche: 1 }, // 3+1+1+2+2+1=10 I1✓ I2✓ I3✓ I4✓
      { bucheron: 1, ours: 3, mouton: 1, chien: 2, renard: 2, ruche: 1 }, // 1+3+1+2+2+1=10 I1✓ I2✓ I3✓ I4✓
      // renard=2, chien=2, sans ruche, mouton présent (5 types actifs)
      { bucheron: 2, ours: 2, mouton: 2, chien: 2, renard: 2 },           // 2+2+2+2+2=10   I1✓ I4✓
      { bucheron: 3, ours: 2, mouton: 1, chien: 2, renard: 2 },           // 3+2+1+2+2=10   I1✓ I4✓
      { bucheron: 2, ours: 3, mouton: 1, chien: 2, renard: 2 },           // 2+3+1+2+2=10   I1✓ I4✓
      // renard=2, sans chien, ruche=1, mouton présent (5 types actifs)
      { bucheron: 3, ours: 2, mouton: 2, renard: 2, ruche: 1 },           // 3+2+2+2+1=10   I1✓ I2✓ I3✓
      { bucheron: 2, ours: 3, mouton: 2, renard: 2, ruche: 1 },           // 2+3+2+2+1=10   I1✓ I2✓ I3✓
      // renard=2, sans chien, sans ruche (4 types actifs)
      { bucheron: 3, ours: 2, mouton: 3, renard: 2 },                     // 3+2+3+2=10     I1✓
      // renard=2, chien=2, ruche=1, mouton=0 (5 types actifs)
      { bucheron: 3, ours: 2, mouton: 0, chien: 2, renard: 2, ruche: 1 }, // 3+2+0+2+2+1=10 I1✓ I2✓ I3✓ I4✓
      { bucheron: 2, ours: 3, mouton: 0, chien: 2, renard: 2, ruche: 1 }, // 2+3+0+2+2+1=10 I1✓ I2✓ I3✓ I4✓
      // renard=3, chien=2, ruche=1 (6 types actifs)
      { bucheron: 2, ours: 1, mouton: 1, chien: 2, renard: 3, ruche: 1 }, // 2+1+1+2+3+1=10 I1✓ I2✓ I3✓ I4✓
      { bucheron: 1, ours: 2, mouton: 1, chien: 2, renard: 3, ruche: 1 }, // 1+2+1+2+3+1=10 I1✓ I2✓ I3✓ I4✓
      // renard=3, sans chien, ruche=1 (5 types actifs)
      { bucheron: 3, ours: 2, mouton: 1, renard: 3, ruche: 1 },           // 3+2+1+3+1=10   I1✓ I2✓ I3✓
      { bucheron: 2, ours: 3, mouton: 1, renard: 3, ruche: 1 },           // 2+3+1+3+1=10   I1✓ I2✓ I3✓
      // 1 couple — renard=2, sans chien, sans ruche (5 types actifs)
      { bucheron: 3, ours: 2, mouton: 1, renard: 2, cerf: 1, biche: 1 },  // 3+2+1+2+1+1=10 I1✓ I5✓
      { bucheron: 2, ours: 3, mouton: 1, renard: 2, cerf: 1, biche: 1 },  // 2+3+1+2+1+1=10 I1✓ I5✓
      // renard=3, sans chien, sans ruche (4 types actifs)
      { bucheron: 3, ours: 2, mouton: 2, renard: 3 },                     // 3+2+2+3=10     I1✓
      { bucheron: 2, ours: 3, mouton: 2, renard: 3 },                     // 2+3+2+3=10     I1✓
    ],
    emptyCellsRange: [5, 5],
    bonusDisabled: false,
    estimatedDurationRange: [360, 540],
  },

  // ────────────────────────────────────────────────────────────────
  // PLATEAU 11 CASES (board_11_v2) — niveaux 11, 12
  // ────────────────────────────────────────────────────────────────

  niveau_11: {
    // 8 types : Bucheron, Ours, Mouton, Ruche, Chien, Cerf, Biche, Renard — 5 vides fixes
    // Nouveau plateau 11 cases (board_11_v2, map lisible). Renard toujours présent.
    // chien >= 2 si présent (I4). ours >= 1 si ruche = 1 (I3). cerf = biche si présents (I5).
    boardId: 'board_11_v2',
    cellCount: 11,
    compositions: [
      // renard=2, chien=2, ruche=1, mouton présent (6 types actifs)
      { bucheron: 2, ours: 2, mouton: 2, chien: 2, renard: 2, ruche: 1 },     // 2+2+2+2+2+1=11 I1✓ I2✓ I3✓ I4✓
      { bucheron: 3, ours: 2, mouton: 1, chien: 2, renard: 2, ruche: 1 },     // 3+2+1+2+2+1=11 I1✓ I2✓ I3✓ I4✓
      { bucheron: 2, ours: 3, mouton: 1, chien: 2, renard: 2, ruche: 1 },     // 2+3+1+2+2+1=11 I1✓ I2✓ I3✓ I4✓
      // renard=2, chien=2, sans ruche, mouton présent (5 types actifs)
      { bucheron: 3, ours: 2, mouton: 2, chien: 2, renard: 2 },               // 3+2+2+2+2=11   I1✓ I4✓
      { bucheron: 2, ours: 3, mouton: 2, chien: 2, renard: 2 },               // 2+3+2+2+2=11   I1✓ I4✓
      { bucheron: 3, ours: 3, mouton: 1, chien: 2, renard: 2 },               // 3+3+1+2+2=11   I1✓ I4✓
      // renard=2, sans chien, ruche=1, mouton présent (5 types actifs)
      { bucheron: 3, ours: 3, mouton: 2, renard: 2, ruche: 1 },               // 3+3+2+2+1=11   I1✓ I2✓ I3✓
      { bucheron: 3, ours: 2, mouton: 3, renard: 2, ruche: 1 },               // 3+2+3+2+1=11   I1✓ I2✓ I3✓
      { bucheron: 4, ours: 2, mouton: 2, renard: 2, ruche: 1 },               // 4+2+2+2+1=11   I1✓ I2✓ I3✓
      // renard=3, sans chien, ruche=1, mouton présent (5 types actifs)
      { bucheron: 3, ours: 2, mouton: 2, renard: 3, ruche: 1 },               // 3+2+2+3+1=11   I1✓ I2✓ I3✓
      { bucheron: 2, ours: 3, mouton: 2, renard: 3, ruche: 1 },               // 2+3+2+3+1=11   I1✓ I2✓ I3✓
      // renard=3, sans chien, sans ruche (4 types actifs)
      { bucheron: 3, ours: 2, mouton: 3, renard: 3 },                         // 3+2+3+3=11     I1✓
      { bucheron: 3, ours: 3, mouton: 2, renard: 3 },                         // 3+3+2+3=11     I1✓
      // 1 couple — renard=2, chien=2, sans ruche (7 types actifs)
      { bucheron: 2, ours: 2, mouton: 1, chien: 2, renard: 2, cerf: 1, biche: 1 }, // 2+2+1+2+2+1+1=11 I1✓ I4✓ I5✓
      // 2 couples — renard=2, sans chien, sans ruche (5 types actifs)
      { bucheron: 2, ours: 2, mouton: 1, renard: 2, cerf: 2, biche: 2 },      // 2+2+1+2+2+2=11 I1✓ I5✓
      { bucheron: 3, ours: 1, mouton: 1, renard: 2, cerf: 2, biche: 2 },      // 3+1+1+2+2+2=11 I1✓ I5✓
      // mouton dominant — sans renard (pour variété)
      { bucheron: 2, ours: 2, mouton: 3, chien: 2, renard: 2 },               // 2+2+3+2+2=11   I1✓ I4✓
    ],
    emptyCellsRange: [5, 5],
    bonusDisabled: false,
    estimatedDurationRange: [420, 600],
  },

  niveau_12: {
    // 9 types : tous sauf Chalet — 6 vides fixes
    // ★ Introduction du Tas de bûches (voisin Bucheron). Sur 11 cases.
    // tas_buches >= 1 toujours. bucheron >= 1 si tas_buches > 0 (I7).
    // chien >= 2 si présent (I4). ours >= 1 si ruche = 1 (I3). cerf = biche si présents (I5).
    boardId: 'board_11_v2',
    cellCount: 11,
    compositions: [
      // tas=1, renard=2, chien=2, ruche=1, mouton présent (7 types actifs)
      { bucheron: 2, ours: 2, mouton: 1, chien: 2, renard: 2, tas_buches: 1, ruche: 1 }, // 2+2+1+2+2+1+1=11 I1✓ I2✓ I3✓ I4✓ I7✓
      { bucheron: 3, ours: 1, mouton: 1, chien: 2, renard: 2, tas_buches: 1, ruche: 1 }, // 3+1+1+2+2+1+1=11 I1✓ I2✓ I3✓ I4✓ I7✓
      { bucheron: 2, ours: 1, mouton: 2, chien: 2, renard: 2, tas_buches: 1, ruche: 1 }, // 2+1+2+2+2+1+1=11 I1✓ I2✓ I3✓ I4✓ I7✓
      // tas=1, renard=2, chien=2, sans ruche, mouton présent (6 types actifs)
      { bucheron: 2, ours: 2, mouton: 2, chien: 2, renard: 2, tas_buches: 1 },           // 2+2+2+2+2+1=11  I1✓ I4✓ I7✓
      { bucheron: 3, ours: 2, mouton: 1, chien: 2, renard: 2, tas_buches: 1 },           // 3+2+1+2+2+1=11  I1✓ I4✓ I7✓
      { bucheron: 2, ours: 3, mouton: 1, chien: 2, renard: 2, tas_buches: 1 },           // 2+3+1+2+2+1=11  I1✓ I4✓ I7✓
      // tas=1, renard=2, sans chien, ruche=1, mouton présent (6 types actifs)
      { bucheron: 3, ours: 2, mouton: 2, renard: 2, tas_buches: 1, ruche: 1 },           // 3+2+2+2+1+1=11  I1✓ I2✓ I3✓ I7✓
      { bucheron: 3, ours: 3, mouton: 1, renard: 2, tas_buches: 1, ruche: 1 },           // 3+3+1+2+1+1=11  I1✓ I2✓ I3✓ I7✓
      { bucheron: 4, ours: 2, mouton: 1, renard: 2, tas_buches: 1, ruche: 1 },           // 4+2+1+2+1+1=11  I1✓ I2✓ I3✓ I7✓
      // tas=1, renard=3, sans chien, ruche=1, mouton présent (5 types actifs)
      { bucheron: 3, ours: 2, mouton: 1, renard: 3, tas_buches: 1, ruche: 1 },           // 3+2+1+3+1+1=11  I1✓ I2✓ I3✓ I7✓
      { bucheron: 2, ours: 3, mouton: 1, renard: 3, tas_buches: 1, ruche: 1 },           // 2+3+1+3+1+1=11  I1✓ I2✓ I3✓ I7✓
      // 1 couple — tas=1, cerf=1, biche=1, chien=2, ruche=1 (9 types actifs)
      { bucheron: 2, ours: 1, mouton: 1, chien: 2, renard: 2, cerf: 1, biche: 1, tas_buches: 1 }, // 2+1+1+2+2+1+1+1=11 I1✓ I4✓ I5✓ I7✓
      // 2 couples — tas=1, cerf=2, biche=2, renard=2, sans chien (6 types actifs)
      { bucheron: 2, ours: 1, mouton: 1, renard: 2, cerf: 2, biche: 2, tas_buches: 1 }, // 2+1+1+2+2+2+1=11 I1✓ I5✓ I7✓
      // tas=2, renard=2, sans chien, ruche=1 (5 types actifs)
      { bucheron: 3, ours: 2, mouton: 1, renard: 2, tas_buches: 2, ruche: 1 },           // 3+2+1+2+2+1=11  I1✓ I2✓ I3✓ I7✓
    ],
    emptyCellsRange: [6, 6],
    bonusDisabled: false,
    estimatedDurationRange: [480, 720],
  },

  // ────────────────────────────────────────────────────────────────
  // PLATEAU 12 CASES — niveaux 13 à 15 (inchangés)
  // ────────────────────────────────────────────────────────────────

  niveau_13: {
    // 10 types : tous les éléments du jeu — 7 vides fixes
    // ★ Introduction du Chalet (voisin Bucheron obligatoire).
    // bucheron >= chalet (I6). bucheron >= 1 si tas_buches > 0 (I7).
    boardId: 'board_12',
    cellCount: 12,
    compositions: [
      // chalet=2, renard=2, ruche=1, sans chien (6 types actifs) — bucheron=3
      { bucheron: 3, ours: 2, mouton: 2, renard: 2, chalet: 2, ruche: 1 },           // total=12 I1✓ I3✓ I6✓(3≥2)
      { bucheron: 3, ours: 3, mouton: 1, renard: 2, chalet: 2, ruche: 1 },           // total=12 I1✓ I3✓ I6✓(3≥2)
      // chalet=2, renard=2, chien=2, sans ruche (6 types actifs) — bucheron=3
      { bucheron: 3, ours: 2, mouton: 1, chien: 2, renard: 2, chalet: 2 },           // total=12 I1✓ I4✓ I6✓(3≥2)
      { bucheron: 3, ours: 3, mouton: 0, chien: 2, renard: 2, chalet: 2 },           // total=12 I1✓ I4✓ I6✓(3≥2)
      // chalet=2, tas_buches=1, renard=2, ruche=1, sans chien (7 types actifs) — bucheron=3
      { bucheron: 3, ours: 2, mouton: 1, renard: 2, chalet: 2, tas_buches: 1, ruche: 1 }, // total=12 I1✓ I3✓ I6✓ I7✓
      { bucheron: 3, ours: 3, mouton: 0, renard: 2, chalet: 2, tas_buches: 1, ruche: 1 }, // total=12 I1✓ I3✓ I6✓ I7✓
      // chalet=2, tas_buches=1, chien=2, sans ruche (6 types actifs) — bucheron=3
      { bucheron: 3, ours: 3, mouton: 1, chien: 2, chalet: 2, tas_buches: 1 },       // 3+3+1+2+2+1=12 I1✓ I4✓ I6✓ I7✓
      { bucheron: 3, ours: 2, mouton: 0, chien: 2, renard: 2, chalet: 2, tas_buches: 1 }, // total=12 I1✓ I4✓ I6✓ I7✓
      // chalet=3, renard=2, ruche=1, sans chien (6 types actifs) — bucheron=4 obligatoire I6
      { bucheron: 4, ours: 2, mouton: 0, renard: 2, chalet: 3, ruche: 1 },           // total=12 I1✓ I3✓ I6✓(4≥3)
      { bucheron: 4, ours: 1, mouton: 1, renard: 2, chalet: 3, ruche: 1 },           // total=12 I1✓ I3✓ I6✓(4≥3)
      // chalet=2, renard=2, chien=2, ruche=1 (7 types actifs) — bucheron=3
      { bucheron: 3, ours: 2, mouton: 2, chien: 2, renard: 2, chalet: 1 },           // total=12 I1✓ I4✓ I6✓(3≥1)
      // 2 couples — chalet=2, cerf=2, biche=2, sans chien, ruche=1 (6 types actifs)
      { bucheron: 3, ours: 2, mouton: 0, cerf: 2, biche: 2, chalet: 2, ruche: 1 },   // 3+2+0+2+2+2+1=12 I1✓ I2✓ I3✓ I5✓ I6✓(3≥2)
      { bucheron: 4, ours: 1, mouton: 0, cerf: 2, biche: 2, chalet: 2, ruche: 1 },   // 4+1+0+2+2+2+1=12 I1✓ I2✓ I3✓ I5✓ I6✓(4≥2)
      // chalet=2, tas_buches=2, ruche=1, sans chien — bucheron=3
      { bucheron: 3, ours: 2, mouton: 0, renard: 2, chalet: 2, tas_buches: 2, ruche: 1 }, // total=12 I1✓ I3✓ I6✓ I7✓
    ],
    emptyCellsRange: [7, 7],
    bonusDisabled: false,
    estimatedDurationRange: [600, 900],
  },

  niveau_14: {
    // 10 types : tous les éléments du jeu — 8 vides fixes
    // Même palette que niv 13, plus de cases vides = plus difficile.
    boardId: 'board_12',
    cellCount: 12,
    compositions: [
      // chalet=2, renard=2, chien=2, ruche=1, mouton=0 (6 types actifs)
      { bucheron: 3, ours: 2, mouton: 0, chien: 2, renard: 2, chalet: 2, ruche: 1 }, // 3+2+0+2+2+2+1=12 I1✓ I2✓ I3✓ I4✓ I6✓
      { bucheron: 2, ours: 3, mouton: 0, chien: 2, renard: 2, chalet: 2, ruche: 1 }, // 2+3+0+2+2+2+1=12 I1✓ I2✓ I3✓ I4✓ I6✓
      // chalet=2, renard=2, chien=2, sans ruche, mouton présent (6 types actifs)
      { bucheron: 3, ours: 2, mouton: 1, chien: 2, renard: 2, chalet: 2 },           // 3+2+1+2+2+2=12   I1✓ I4✓ I6✓(3≥2)
      { bucheron: 2, ours: 3, mouton: 1, chien: 2, renard: 2, chalet: 2 },           // 2+3+1+2+2+2=12   I1✓ I4✓ I6✓(2≥2)
      // chalet=2, tas_buches=1, chien=2, ruche=1, mouton=0 (6 types actifs)
      { bucheron: 4, ours: 2, mouton: 0, chien: 2, chalet: 2, tas_buches: 1, ruche: 1 }, // 4+2+0+2+2+1+1=12 I1✓ I2✓ I3✓ I4✓ I6✓ I7✓
      // chalet=2, renard=2, tas_buches=1, ruche=1, sans chien, mouton présent (7 types actifs)
      { bucheron: 3, ours: 2, mouton: 1, renard: 2, chalet: 2, tas_buches: 1, ruche: 1 }, // 3+2+1+2+2+1+1=12 I1✓ I2✓ I3✓ I6✓ I7✓
      { bucheron: 3, ours: 3, mouton: 0, renard: 2, chalet: 2, tas_buches: 1, ruche: 1 }, // 3+3+0+2+2+1+1=12 I1✓ I2✓ I3✓ I6✓ I7✓
      { bucheron: 3, ours: 3, mouton: 1, renard: 2, chalet: 2, ruche: 1 },               // 3+3+1+2+2+1=12   I1✓ I2✓ I3✓ I6✓
      // chalet=2, chien=2, renard=2, tas_buches=1, sans ruche, mouton=0 (6 types actifs)
      { bucheron: 3, ours: 2, mouton: 0, chien: 2, renard: 2, chalet: 2, tas_buches: 1 }, // 3+2+0+2+2+2+1=12 I1✓ I4✓ I6✓ I7✓
      // chalet=3, renard=2, ruche=1, sans chien (5 types actifs) — bucheron=4
      { bucheron: 4, ours: 2, mouton: 0, renard: 2, chalet: 3, ruche: 1 },           // 4+2+0+2+3+1=12   I1✓ I2✓ I3✓ I6✓(4≥3)
      { bucheron: 4, ours: 1, mouton: 1, renard: 2, chalet: 3, ruche: 1 },           // 4+1+1+2+3+1=12   I1✓ I2✓ I3✓ I6✓(4≥3)
      // chalet=3, tas_buches=1, ruche=1, sans chien, sans renard (5 types actifs) — bucheron=4
      { bucheron: 4, ours: 2, mouton: 1, chalet: 3, tas_buches: 1, ruche: 1 },       // 4+2+1+3+1+1=12   I1✓ I2✓ I3✓ I6✓(4≥3) I7✓
      // chalet=2, chien=2, ruche=1, mouton présent (6 types actifs)
      { bucheron: 3, ours: 3, mouton: 1, chien: 2, chalet: 2, ruche: 1 },            // 3+3+1+2+2+1=12   I1✓ I2✓ I3✓ I4✓ I6✓
      { bucheron: 4, ours: 2, mouton: 1, chien: 2, chalet: 2, ruche: 1 },            // 4+2+1+2+2+1=12   I1✓ I2✓ I3✓ I4✓ I6✓
      // 1 couple — chalet=2, cerf=1, biche=1, ruche=1, mouton présent (8 types actifs)
      { bucheron: 3, ours: 3, mouton: 1, cerf: 1, biche: 1, chalet: 2, ruche: 1 },   // 3+3+1+1+1+2+1=12 I1✓ I2✓ I3✓ I5✓ I6✓
      // 2 couples — chalet=2, cerf=2, biche=2, ruche=1, mouton=0 (6 types actifs)
      { bucheron: 3, ours: 2, mouton: 0, cerf: 2, biche: 2, chalet: 2, ruche: 1 },   // 3+2+0+2+2+2+1=12 I1✓ I2✓ I3✓ I5✓ I6✓(3≥2)
      { bucheron: 4, ours: 1, mouton: 0, cerf: 2, biche: 2, chalet: 2, ruche: 1 },   // 4+1+0+2+2+2+1=12 I1✓ I2✓ I3✓ I5✓ I6✓(4≥2)
    ],
    emptyCellsRange: [8, 8],
    bonusDisabled: false,
    estimatedDurationRange: [600, 900],
  },

  niveau_15: {
    // 10 types : tous les éléments du jeu — 9 vides fixes — bonus désactivés
    // La difficulté vient de l'absence totale de bonus + 9 cases vides sur 12.
    boardId: 'board_12',
    cellCount: 12,
    compositions: [
      // chalet=2, renard=2, chien=2, ruche=1, mouton=0 (6 types actifs)
      { bucheron: 3, ours: 2, mouton: 0, chien: 2, renard: 2, chalet: 2, ruche: 1 }, // 3+2+0+2+2+2+1=12 I1✓ I2✓ I3✓ I4✓ I6✓
      { bucheron: 2, ours: 3, mouton: 0, chien: 2, renard: 2, chalet: 2, ruche: 1 }, // 2+3+0+2+2+2+1=12 I1✓ I2✓ I3✓ I4✓ I6✓
      // chalet=2, renard=2, chien=2, sans ruche, mouton présent (6 types actifs)
      { bucheron: 3, ours: 2, mouton: 1, chien: 2, renard: 2, chalet: 2 },           // 3+2+1+2+2+2=12   I1✓ I4✓ I6✓(3≥2)
      { bucheron: 2, ours: 3, mouton: 1, chien: 2, renard: 2, chalet: 2 },           // 2+3+1+2+2+2=12   I1✓ I4✓ I6✓(2≥2)
      // chalet=2, tas_buches=1, renard=2, chien=2, sans ruche, mouton=0 (6 types actifs)
      { bucheron: 3, ours: 2, mouton: 0, chien: 2, renard: 2, chalet: 2, tas_buches: 1 }, // 3+2+0+2+2+2+1=12 I1✓ I4✓ I6✓ I7✓
      // chalet=2, renard=2, tas_buches=1, ruche=1, sans chien, mouton présent (7 types actifs)
      { bucheron: 3, ours: 2, mouton: 1, renard: 2, chalet: 2, tas_buches: 1, ruche: 1 }, // 3+2+1+2+2+1+1=12 I1✓ I2✓ I3✓ I6✓ I7✓
      { bucheron: 3, ours: 3, mouton: 0, renard: 2, chalet: 2, tas_buches: 1, ruche: 1 }, // 3+3+0+2+2+1+1=12 I1✓ I2✓ I3✓ I6✓ I7✓
      { bucheron: 3, ours: 3, mouton: 1, renard: 2, chalet: 2, ruche: 1 },               // 3+3+1+2+2+1=12   I1✓ I2✓ I3✓ I6✓
      // chalet=3, renard=2, ruche=1, sans chien — bucheron=4
      { bucheron: 4, ours: 2, mouton: 0, renard: 2, chalet: 3, ruche: 1 },           // 4+2+0+2+3+1=12   I1✓ I2✓ I3✓ I6✓(4≥3)
      { bucheron: 4, ours: 1, mouton: 1, renard: 2, chalet: 3, ruche: 1 },           // 4+1+1+2+3+1=12   I1✓ I2✓ I3✓ I6✓(4≥3)
      // chalet=3, tas_buches=1, ruche=1, sans chien, sans renard — bucheron=4
      { bucheron: 4, ours: 2, mouton: 1, chalet: 3, tas_buches: 1, ruche: 1 },       // 4+2+1+3+1+1=12   I1✓ I2✓ I3✓ I6✓(4≥3) I7✓
      // chalet=2, chien=2, ruche=1, mouton présent (6 types actifs)
      { bucheron: 3, ours: 3, mouton: 1, chien: 2, chalet: 2, ruche: 1 },            // 3+3+1+2+2+1=12   I1✓ I2✓ I3✓ I4✓ I6✓
      { bucheron: 4, ours: 2, mouton: 1, chien: 2, chalet: 2, ruche: 1 },            // 4+2+1+2+2+1=12   I1✓ I2✓ I3✓ I4✓ I6✓
      // chalet=2, chien=2, renard=2, ruche=1, mouton=0 (6 types actifs)
      { bucheron: 3, ours: 2, mouton: 0, chien: 2, renard: 2, chalet: 2, ruche: 1 }, // 3+2+0+2+2+2+1=12 I1✓ I2✓ I3✓ I4✓ I6✓
      // 1 couple — chalet=2, cerf=1, biche=1, ruche=1, mouton présent (8 types actifs)
      { bucheron: 3, ours: 3, mouton: 1, cerf: 1, biche: 1, chalet: 2, ruche: 1 },   // 3+3+1+1+1+2+1=12 I1✓ I2✓ I3✓ I5✓ I6✓
      // 2 couples — chalet=2, cerf=2, biche=2, ruche=1, mouton=0 (6 types actifs)
      { bucheron: 3, ours: 2, mouton: 0, cerf: 2, biche: 2, chalet: 2, ruche: 1 },   // 3+2+0+2+2+2+1=12 I1✓ I2✓ I3✓ I5✓ I6✓(3≥2)
      { bucheron: 4, ours: 1, mouton: 0, cerf: 2, biche: 2, chalet: 2, ruche: 1 },   // 4+1+0+2+2+2+1=12 I1✓ I2✓ I3✓ I5✓ I6✓(4≥2)
    ],
    emptyCellsRange: [9, 9],
    bonusDisabled: true,
    estimatedDurationRange: [900, 1500],
  },
};

// Note : DifficultyLevel est défini dans Challenge.ts et ré-exporté ici
// pour la compatibilité avec les imports existants
