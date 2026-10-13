// ============================================================
// PARAMÈTRES DE DIFFICULTÉ — 15 niveaux
//
// 3 leviers combinés :
//   1. Plateau : 6 → 7 → 8 → 9 → 10 → 11 → 12 cases
//   2. Composition : nombre et types d'éléments
//   3. Cases vides : valeur FIXE et unique par niveau (pas de plage)
//
// Progression des cases vides :
//   Niv 1  : 6 cases,  3 vides  — bucheron, ours, mouton
//   Niv 2  : 7 cases,  4 vides  — (mêmes éléments, nouveau board)
//   Niv 3  : 8 cases,  4 vides  — + chien (meute connexe)
//   Niv 4  : 8 cases,  5 vides  — consolidation
//   Niv 5  : 9 cases,  5 vides  — + Loup (antagonisme mouton)
//   Niv 6  : 9 cases,  6 vides  — consolidation
//   Niv 7  : 10 cases, 6 vides  — + ruche (tous ours voisins si ruche)
//   Niv 8  : 10 cases, 7 vides  — consolidation
//   Niv 9  : 11 cases, 7 vides  — + cerf, biche (couples 1-pour-1)
//   Niv 10 : 11 cases, 7 vides  — consolidation (même vides que niv 9)
//   Niv 11 : 11 cases, 7 vides  — + bûches (même vides, complexité contrainte)
//   Niv 12 : 12 cases, 7 vides  — + chalet (respiration franche, 5 fixés)
//   Niv 13 : 12 cases, 7 vides  — consolidation (5 fixés)
//   Niv 14 : 12 cases, 8 vides  — accélération (4 fixés)
//   Niv 15 : 12 cases, 8 vides  — bonus désactivés (4 fixés)
//
// Nouveaux éléments introduits progressivement :
//   Niv 1    : Bucheron, Ours, Mouton
//   Niv 3    : + Chien (meute connexe, chien >= 2 toujours)
//   Niv 5    : + Loup (répulsion Loup/Mouton)
//   Niv 7    : + Ruche (singleton, tous les ours voisins si présente)
//   Niv 9    : + Cerf + Biche (couples 1-pour-1)
//   Niv 11   : + Bûches (voisin Bucheron, + voisin Chalet si présent)
//   Niv 12   : + Chalet (voisin Bucheron obligatoire, bucheron >= chalet)
//
// Invariants à respecter dans chaque composition :
//   I1  : Σ éléments = cellCount
//   I2  : ruche <= 1 (maxPerBoard = 1)
//   I3  : ours >= 1 si ruche = 1
//   I3b : si ruche = 1, ours ≤ 3 (limité par topologie)
//   I4  : chien >= 2 si chien > 0
//   I5  : cerf = biche en quantité
//   I6  : bucheron >= chalet si les deux présents
//   I7  : bucheron >= 1 si tas_buches > 0
// ============================================================

export type DifficultyLevel =
  | 'niveau_1' | 'niveau_2' | 'niveau_3' | 'niveau_4' | 'niveau_5'
  | 'niveau_6' | 'niveau_7' | 'niveau_8'
  | 'niveau_9' | 'niveau_10'
  | 'niveau_11' | 'niveau_12'
  | 'niveau_13' | 'niveau_14' | 'niveau_15'
  | 'niveau_16' | 'niveau_17' | 'niveau_18'
  | 'niveau_19' | 'niveau_20' | 'niveau_21'; // 14 cases — Cœur Profond (+ Arbre)

export interface Composition {
  // ── Éléments de base (niv 1+) ──────────────────────────────
  bucheron?: number;   // ≠ voisin bucheron
  ours?: number;       // ≠ voisin ours · si ruche présente, doit être voisin ruche
  mouton?: number;     // ≠ voisin mouton, ≠ voisin Loup
  // ── Introduits niv 3+ ───────────────────────────────────────
  chien?: number;      // = voisin chien (meute connexe) · TOUJOURS >= 2 si > 0 (I4)
  // ── Introduits niv 5+ ───────────────────────────────────────
  loup?: number;     // ≠ voisin mouton, ≠ voisin loup
  // ── Introduits niv 7+ ───────────────────────────────────────
  ruche?: number;      // MAX 1 PAR DÉFI (I2) · tous les ours doivent en être voisins
  // ── Introduits niv 9+ ───────────────────────────────────────
  cerf?: number;       // ≠ voisin cerf · = voisin 1 biche · TOUJOURS = biche (I5)
  biche?: number;      // ≠ voisin biche · = voisin 1 cerf · TOUJOURS = cerf (I5)
  // ── Introduits niv 11+ ──────────────────────────────────────
  tas_buches?: number; // = voisin bucheron · = voisin chalet si chalet présent (I7)
  // ── Introduits niv 12+ ──────────────────────────────────────
  chalet?: number;     // = voisin bucheron · ≠ voisin chalet · bucheron >= chalet (I6)
  // ── Défi journalier uniquement ────────────────────────────
  champignon?: number; // center_only · ≠ voisin champignon · max 3 (I8)
  // ── Introduits niv 19+ ──────────────────────────────────────
  arbre?: number;      // connected_group_with tas_buches (forêt connexe) · TOUJOURS >= 2 si > 0
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
  // Onboarding : 1 mécanique (repulsion) × 3 types
  // ────────────────────────────────────────────────────────────────

  niveau_1: {
    // 3 types : Bucheron, Ours, Mouton — 3 vides, 3 fixés
    boardId: 'board_6_v1',
    cellCount: 6,
    compositions: [
      { bucheron: 2, ours: 2, mouton: 2 },           // total=6 I1✓
      { bucheron: 3, ours: 2, mouton: 1 },           // total=6 I1✓
      { bucheron: 2, ours: 3, mouton: 1 },           // total=6 I1✓
      { bucheron: 1, ours: 2, mouton: 3 },           // total=6 I1✓
      { bucheron: 3, ours: 1, mouton: 2 },           // total=6 I1✓
      { bucheron: 1, ours: 3, mouton: 2 },           // total=6 I1✓
      { bucheron: 4, ours: 1, mouton: 1 },           // total=6 I1✓
      { bucheron: 1, ours: 1, mouton: 4 },           // total=6 I1✓
    ],
    emptyCellsRange: [3, 3],
    bonusDisabled: false,
    estimatedDurationRange: [10, 30],
  },

  // ────────────────────────────────────────────────────────────────
  // PLATEAU 7 CASES — niveau 2
  // Respiration — nouveau board, mêmes 3 éléments, +1 vide
  // ────────────────────────────────────────────────────────────────

  niveau_2: {
    // 3 types : Bucheron, Ours, Mouton — 4 vides, 3 fixés
    boardId: 'board_7_v1',
    cellCount: 7,
    compositions: [
      { bucheron: 3, ours: 2, mouton: 2 },           // total=7 I1✓
      { bucheron: 2, ours: 3, mouton: 2 },           // total=7 I1✓
      { bucheron: 2, ours: 2, mouton: 3 },           // total=7 I1✓
      { bucheron: 4, ours: 2, mouton: 1 },           // total=7 I1✓
      { bucheron: 1, ours: 4, mouton: 2 },           // total=7 I1✓
      { bucheron: 3, ours: 3, mouton: 1 },           // total=7 I1✓
      { bucheron: 1, ours: 3, mouton: 3 },           // total=7 I1✓
      { bucheron: 3, ours: 1, mouton: 3 },           // total=7 I1✓
    ],
    emptyCellsRange: [4, 4],
    bonusDisabled: false,
    estimatedDurationRange: [15, 45],
  },

  // ────────────────────────────────────────────────────────────────
  // PLATEAU 8 CASES — niveaux 3, 4
  // ────────────────────────────────────────────────────────────────

  niveau_3: {
    // 4 types : Bucheron, Ours, Mouton, Chien — 4 vides, 4 fixés
    // Respiration (nouveau board) — chien (meute connexe). 4 fixés = accueil doux
    boardId: 'board_8_v2',
    cellCount: 8,
    compositions: [
      { bucheron: 2, ours: 2, mouton: 2, chien: 2 },             // total=8 I1✓ I4✓
      { bucheron: 3, ours: 1, mouton: 2, chien: 2 },             // total=8 I1✓ I4✓
      { bucheron: 2, ours: 3, mouton: 1, chien: 2 },             // total=8 I1✓ I4✓
      { bucheron: 1, ours: 2, mouton: 3, chien: 2 },             // total=8 I1✓ I4✓
      { bucheron: 3, ours: 2, mouton: 1, chien: 2 },             // total=8 I1✓ I4✓
      { bucheron: 1, ours: 3, mouton: 2, chien: 2 },             // total=8 I1✓ I4✓
      { bucheron: 2, ours: 1, mouton: 2, chien: 3 },             // total=8 I1✓ I4✓
      { bucheron: 1, ours: 2, mouton: 1, chien: 4 },             // total=8 I1✓ I4✓
      { bucheron: 2, ours: 2, mouton: 0, chien: 4 },             // total=8 I1✓ I4✓
      { bucheron: 2, ours: 1, mouton: 1, chien: 4 },             // total=8 I1✓ I4✓
    ],
    emptyCellsRange: [4, 4],
    bonusDisabled: false,
    estimatedDurationRange: [20, 60],
  },

  niveau_4: {
    // 4 types : Bucheron, Ours, Mouton, Chien — 5 vides, 3 fixés
    // Accélération — même board, +1 vide, -1 fixé
    boardId: 'board_8_v2',
    cellCount: 8,
    compositions: [
      { bucheron: 2, ours: 2, mouton: 2, chien: 2 },             // total=8 I1✓ I4✓
      { bucheron: 3, ours: 2, mouton: 1, chien: 2 },             // total=8 I1✓ I4✓
      { bucheron: 1, ours: 3, mouton: 2, chien: 2 },             // total=8 I1✓ I4✓
      { bucheron: 2, ours: 1, mouton: 2, chien: 3 },             // total=8 I1✓ I4✓
      { bucheron: 1, ours: 2, mouton: 1, chien: 4 },             // total=8 I1✓ I4✓
      { bucheron: 3, ours: 1, mouton: 2, chien: 2 },             // total=8 I1✓ I4✓
      { bucheron: 2, ours: 3, mouton: 1, chien: 2 },             // total=8 I1✓ I4✓
      { bucheron: 1, ours: 1, mouton: 2, chien: 4 },             // total=8 I1✓ I4✓
      { bucheron: 2, ours: 2, mouton: 0, chien: 4 },             // total=8 I1✓ I4✓
      { bucheron: 3, ours: 1, mouton: 1, chien: 3 },             // total=8 I1✓ I4✓
    ],
    emptyCellsRange: [5, 5],
    bonusDisabled: false,
    estimatedDurationRange: [30, 90],
  },

  // ────────────────────────────────────────────────────────────────
  // PLATEAU 9 CASES — niveaux 5, 6
  // ────────────────────────────────────────────────────────────────

  niveau_5: {
    // 5 types : Bucheron, Ours, Mouton, Chien, Loup — 5 vides, 4 fixés
    // Respiration (nouveau board) — Loup↔mouton antagonisme. 4 fixés
    boardId: 'board_9_v1',
    cellCount: 9,
    compositions: [
      { bucheron: 2, ours: 2, mouton: 2, loup: 1, chien: 2 },  // 9 I1✓ I4✓
      { bucheron: 3, ours: 2, mouton: 1, loup: 1, chien: 2 },  // 9 I1✓ I4✓
      { bucheron: 2, ours: 3, mouton: 1, loup: 1, chien: 2 },  // 9 I1✓ I4✓
      { bucheron: 3, ours: 1, mouton: 2, loup: 1, chien: 2 },  // 9 I1✓ I4✓
      { bucheron: 3, ours: 2, mouton: 2, loup: 2 },            // 9 I1✓ (sans chien)
      { bucheron: 2, ours: 3, mouton: 2, loup: 2 },            // 9 I1✓
      { bucheron: 2, ours: 2, mouton: 3, loup: 2 },            // 9 I1✓
      { bucheron: 3, ours: 2, mouton: 1, loup: 3 },            // 9 I1✓ Loup dominant
      { bucheron: 2, ours: 1, mouton: 2, loup: 2, chien: 2 },  // 9 I1✓ I4✓
      { bucheron: 1, ours: 2, mouton: 2, loup: 2, chien: 2 },  // 9 I1✓ I4✓
    ],
    emptyCellsRange: [5, 5],
    bonusDisabled: false,
    estimatedDurationRange: [45, 120],
  },

  niveau_6: {
    // 5 types : Bucheron, Ours, Mouton, Chien, Loup — 6 vides, 3 fixés
    // Accélération — même board, +1 vide, -1 fixé
    boardId: 'board_9_v1',
    cellCount: 9,
    compositions: [
      { bucheron: 2, ours: 2, mouton: 2, loup: 1, chien: 2 },  // 9 I1✓ I4✓
      { bucheron: 3, ours: 2, mouton: 1, loup: 1, chien: 2 },  // 9 I1✓ I4✓
      { bucheron: 3, ours: 2, mouton: 2, loup: 2 },            // 9 I1✓ (sans chien)
      { bucheron: 2, ours: 3, mouton: 2, loup: 2 },            // 9 I1✓
      { bucheron: 2, ours: 2, mouton: 2, loup: 3 },            // 9 I1✓ Loup dominant
      { bucheron: 3, ours: 1, mouton: 2, loup: 1, chien: 2 },  // 9 I1✓ I4✓
      { bucheron: 1, ours: 3, mouton: 2, loup: 1, chien: 2 },  // 9 I1✓ I4✓
      { bucheron: 2, ours: 1, mouton: 2, loup: 2, chien: 2 },  // 9 I1✓ I4✓
      { bucheron: 3, ours: 2, mouton: 1, loup: 3 },            // 9 I1✓ Loup dominant
      { bucheron: 2, ours: 3, mouton: 1, loup: 3 },            // 9 I1✓
    ],
    emptyCellsRange: [6, 6],
    bonusDisabled: false,
    estimatedDurationRange: [60, 150],
  },

  // ────────────────────────────────────────────────────────────────
  // PLATEAU 10 CASES — niveaux 7, 8
  // ────────────────────────────────────────────────────────────────

  niveau_7: {
    // 6 types : Bucheron, Ours, Mouton, Chien, Loup, Ruche — 6 vides, 4 fixés
    // Respiration (nouveau board) — ruche singleton + tous ours voisins. 4 fixés
    // ruche=1, ours ≤ 3 (I3b). Compos avec et sans ruche pour variété.
    boardId: 'board_10_v3',
    cellCount: 10,
    compositions: [
      { bucheron: 2, ours: 2, mouton: 1, chien: 2, loup: 2, ruche: 1 },  // 10 I1✓ I2✓ I3✓ I4✓
      { bucheron: 2, ours: 1, mouton: 2, chien: 2, loup: 2, ruche: 1 },  // 10 I1✓ I2✓ I3✓ I4✓
      { bucheron: 3, ours: 1, mouton: 1, chien: 2, loup: 2, ruche: 1 },  // 10 I1✓ I2✓ I3✓ I4✓
      { bucheron: 3, ours: 2, mouton: 2, loup: 2, ruche: 1 },            // 10 I1✓ I2✓ I3✓ (sans chien)
      { bucheron: 2, ours: 3, mouton: 2, loup: 2, ruche: 1 },            // 10 I1✓ I2✓ I3✓
      { bucheron: 3, ours: 2, mouton: 1, loup: 3, ruche: 1 },            // 10 I1✓ I2✓ I3✓ Loup dominant
      { bucheron: 2, ours: 2, mouton: 2, loup: 3, ruche: 1 },            // 10 I1✓ I2✓ I3✓
      { bucheron: 3, ours: 3, mouton: 1, loup: 2, ruche: 1 },            // 10 I1✓ I2✓ I3✓ ours=3
      // Sans ruche — variété
      { bucheron: 3, ours: 2, mouton: 2, chien: 2, loup: 1 },            // 10 I1✓ I4✓
      { bucheron: 2, ours: 2, mouton: 2, chien: 2, loup: 2 },            // 10 I1✓ I4✓
    ],
    emptyCellsRange: [6, 6],
    bonusDisabled: false,
    estimatedDurationRange: [60, 180],
  },

  niveau_8: {
    // 6 types : mêmes que niv 7 — 7 vides, 3 fixés
    // Accélération — même board, +1 vide, -1 fixé
    boardId: 'board_10_v3',
    cellCount: 10,
    compositions: [
      { bucheron: 2, ours: 2, mouton: 1, chien: 2, loup: 2, ruche: 1 },  // 10 I1✓ I2✓ I3✓ I4✓
      { bucheron: 3, ours: 1, mouton: 1, chien: 2, loup: 2, ruche: 1 },  // 10 I1✓ I2✓ I3✓ I4✓
      { bucheron: 2, ours: 1, mouton: 2, chien: 2, loup: 2, ruche: 1 },  // 10 I1✓ I2✓ I3✓ I4✓
      { bucheron: 3, ours: 2, mouton: 2, loup: 2, ruche: 1 },            // 10 I1✓ I2✓ I3✓
      { bucheron: 2, ours: 3, mouton: 2, loup: 2, ruche: 1 },            // 10 I1✓ I2✓ I3✓
      { bucheron: 3, ours: 2, mouton: 1, loup: 3, ruche: 1 },            // 10 I1✓ I2✓ I3✓
      { bucheron: 2, ours: 2, mouton: 2, loup: 3, ruche: 1 },            // 10 I1✓ I2✓ I3✓
      { bucheron: 3, ours: 3, mouton: 1, loup: 2, ruche: 1 },            // 10 I1✓ I2✓ I3✓
      // Sans ruche
      { bucheron: 3, ours: 2, mouton: 2, chien: 2, loup: 1 },            // 10 I1✓ I4✓
      { bucheron: 2, ours: 3, mouton: 2, chien: 2, loup: 1 },            // 10 I1✓ I4✓
    ],
    emptyCellsRange: [7, 7],
    bonusDisabled: false,
    estimatedDurationRange: [90, 240],
  },

  // ────────────────────────────────────────────────────────────────
  // PLATEAU 11 CASES (board_11_v2) — niveaux 9, 10, 11
  // ────────────────────────────────────────────────────────────────

  niveau_9: {
    // 8 types : + Cerf, Biche — 7 vides, 4 fixés
    // Respiration (nouveau board) — paires couplées. 4 fixés
    // cerf = biche (I5). chien >= 2 si présent (I4).
    boardId: 'board_11_v2',
    cellCount: 11,
    compositions: [
      // 1 couple — ruche=1, chien=2
      { bucheron: 2, ours: 2, mouton: 1, chien: 2, loup: 1, cerf: 1, biche: 1, ruche: 1 },  // 11 I1✓ I2✓ I3✓ I4✓ I5✓
      { bucheron: 2, ours: 1, mouton: 2, chien: 2, loup: 1, cerf: 1, biche: 1, ruche: 1 },  // 11 I1✓ I2✓ I3✓ I4✓ I5✓
      { bucheron: 3, ours: 1, mouton: 1, chien: 2, loup: 1, cerf: 1, biche: 1, ruche: 1 },  // 11 I1✓ I2✓ I3✓ I4✓ I5✓
      // 1 couple — ruche=1, sans chien
      { bucheron: 3, ours: 2, mouton: 2, loup: 1, cerf: 1, biche: 1, ruche: 1 },            // 11 I1✓ I2✓ I3✓ I5✓
      { bucheron: 2, ours: 3, mouton: 2, loup: 1, cerf: 1, biche: 1, ruche: 1 },            // 11 I1✓ I2✓ I3✓ I5✓
      // 1 couple — chien=2, sans ruche
      { bucheron: 2, ours: 2, mouton: 2, chien: 2, loup: 1, cerf: 1, biche: 1 },            // 11 I1✓ I4✓ I5✓
      { bucheron: 3, ours: 2, mouton: 1, chien: 2, loup: 1, cerf: 1, biche: 1 },            // 11 I1✓ I4✓ I5✓
      // 2 couples — sans chien, sans ruche
      { bucheron: 2, ours: 2, mouton: 1, loup: 2, cerf: 2, biche: 2 },                      // 11 I1✓ I5✓
      { bucheron: 3, ours: 1, mouton: 1, loup: 2, cerf: 2, biche: 2 },                      // 11 I1✓ I5✓
      // 2 couples — chien=2, sans ruche
      { bucheron: 1, ours: 2, mouton: 0, chien: 2, loup: 2, cerf: 2, biche: 2 },            // 11 I1✓ I4✓ I5✓
    ],
    emptyCellsRange: [7, 7],
    bonusDisabled: false,
    estimatedDurationRange: [120, 300],
  },

  niveau_10: {
    // 8 types : mêmes que niv 9 + plus de diversité (cerf/biche) — 7 vides, 4 fixés
    // Accélération — même board, même difficulté structurelle que niv 9
    // cerf = biche (I5). chien >= 2 si présent (I4). ours voisin ruche si ruche présente.
    boardId: 'board_11_v2',
    cellCount: 11,
    compositions: [
      // 1 couple — ruche=1, chien=2
      { bucheron: 2, ours: 1, mouton: 1, chien: 2, loup: 2, cerf: 1, biche: 1, ruche: 1 },  // 11 I1✓ I2✓ I3✓ I4✓ I5✓
      { bucheron: 2, ours: 2, mouton: 1, chien: 2, loup: 1, cerf: 1, biche: 1, ruche: 1 },  // 11 I1✓ I2✓ I3✓ I4✓ I5✓
      { bucheron: 3, ours: 1, mouton: 1, chien: 2, loup: 1, cerf: 1, biche: 1, ruche: 1 },  // 11 I1✓ I2✓ I3✓ I4✓ I5✓
      // 1 couple — chien=2, sans ruche
      { bucheron: 2, ours: 2, mouton: 1, chien: 2, loup: 2, cerf: 1, biche: 1 },            // 11 I1✓ I4✓ I5✓
      { bucheron: 3, ours: 2, mouton: 1, chien: 2, loup: 1, cerf: 1, biche: 1 },            // 11 I1✓ I4✓ I5✓
      { bucheron: 2, ours: 2, mouton: 2, chien: 2, loup: 1, cerf: 1, biche: 1 },            // 11 I1✓ I4✓ I5✓
      // 1 couple — ruche=1, sans chien
      { bucheron: 3, ours: 2, mouton: 2, loup: 1, cerf: 1, biche: 1, ruche: 1 },            // 11 I1✓ I2✓ I3✓ I5✓
      { bucheron: 2, ours: 2, mouton: 2, loup: 2, cerf: 1, biche: 1, ruche: 1 },            // 11 I1✓ I2✓ I3✓ I5✓
      // 2 couples — sans chien, sans ruche
      { bucheron: 2, ours: 2, mouton: 1, loup: 2, cerf: 2, biche: 2 },                      // 11 I1✓ I5✓
      { bucheron: 3, ours: 1, mouton: 1, loup: 2, cerf: 2, biche: 2 },                      // 11 I1✓ I5✓
      // 2 couples — chien=2, sans ruche
      { bucheron: 1, ours: 2, mouton: 0, chien: 2, loup: 2, cerf: 2, biche: 2 },            // 11 I1✓ I4✓ I5✓
      // Loup=2, chien=2, ruche=1 (sans couple — 6 types)
      { bucheron: 2, ours: 2, mouton: 2, chien: 2, loup: 2, ruche: 1 },                     // 11 I1✓ I2✓ I3✓ I4✓
    ],
    emptyCellsRange: [7, 7],
    bonusDisabled: false,
    estimatedDurationRange: [150, 360],
  },

  niveau_11: {
    // 9 types : + Bûches — 7 vides, 4 fixés
    // Même vides que niv 10 — nouvel élément (chaînage bucheron→bûches)
    // tas_buches >= 1 toujours. bucheron >= 1 si tas_buches > 0 (I7).
    boardId: 'board_11_v2',
    cellCount: 11,
    compositions: [
      // tas=1, Loup=2, chien=2, ruche=1
      { bucheron: 2, ours: 2, mouton: 1, chien: 2, loup: 2, tas_buches: 1, ruche: 1 },       // 11 I1✓ I2✓ I3✓ I4✓ I7✓
      { bucheron: 3, ours: 1, mouton: 1, chien: 2, loup: 2, tas_buches: 1, ruche: 1 },       // 11 I1✓ I2✓ I3✓ I4✓ I7✓
      { bucheron: 2, ours: 1, mouton: 2, chien: 2, loup: 2, tas_buches: 1, ruche: 1 },       // 11 I1✓ I2✓ I3✓ I4✓ I7✓
      // tas=1, Loup=2, chien=2, sans ruche
      { bucheron: 2, ours: 2, mouton: 2, chien: 2, loup: 2, tas_buches: 1 },                 // 11 I1✓ I4✓ I7✓
      { bucheron: 3, ours: 2, mouton: 1, chien: 2, loup: 2, tas_buches: 1 },                 // 11 I1✓ I4✓ I7✓
      { bucheron: 2, ours: 3, mouton: 1, chien: 2, loup: 2, tas_buches: 1 },                 // 11 I1✓ I4✓ I7✓
      // tas=1, Loup=2, sans chien, ruche=1
      { bucheron: 3, ours: 2, mouton: 2, loup: 2, tas_buches: 1, ruche: 1 },                 // 11 I1✓ I2✓ I3✓ I7✓
      { bucheron: 3, ours: 3, mouton: 1, loup: 2, tas_buches: 1, ruche: 1 },                 // 11 I1✓ I2✓ I3✓ I7✓
      // tas=1, Loup=3, sans chien, ruche=1
      { bucheron: 3, ours: 2, mouton: 1, loup: 3, tas_buches: 1, ruche: 1 },                 // 11 I1✓ I2✓ I3✓ I7✓
      // 1 couple — tas=1, cerf=1, biche=1, chien=2
      { bucheron: 2, ours: 1, mouton: 1, chien: 2, loup: 2, cerf: 1, biche: 1, tas_buches: 1 },  // 11 I1✓ I4✓ I5✓ I7✓
    ],
    emptyCellsRange: [7, 7],
    bonusDisabled: false,
    estimatedDurationRange: [150, 360],
  },

  // ────────────────────────────────────────────────────────────────
  // PLATEAU 12 CASES — niveaux 12 à 15
  // ────────────────────────────────────────────────────────────────

  niveau_12: {
    // 10 types : + Chalet — 7 vides, 5 fixés
    // ★ Respiration franche (nouveau board 12 + chalet).
    // Vides ↓ de 8→7, mais 12 cases × 10 types × chaîne complète = cognitif lourd. 5 fixés.
    // bucheron >= chalet (I6). bucheron >= 1 si tas_buches > 0 (I7).
    boardId: 'board_12',
    cellCount: 12,
    compositions: [
      // chalet=2, Loup=2, ruche=1, sans chien — bucheron=3
      { bucheron: 3, ours: 2, mouton: 2, loup: 2, chalet: 2, ruche: 1 },                     // 12 I1✓ I2✓ I3✓ I6✓(3≥2)
      { bucheron: 3, ours: 3, mouton: 1, loup: 2, chalet: 2, ruche: 1 },                     // 12 I1✓ I2✓ I3✓ I6✓(3≥2)
      // chalet=2, Loup=2, chien=2, sans ruche — bucheron=3
      { bucheron: 3, ours: 2, mouton: 1, chien: 2, loup: 2, chalet: 2 },                     // 12 I1✓ I4✓ I6✓(3≥2)
      { bucheron: 3, ours: 3, mouton: 0, chien: 2, loup: 2, chalet: 2 },                     // 12 I1✓ I4✓ I6✓(3≥2)
      // chalet=2, tas_buches=1, Loup=2, ruche=1, sans chien — bucheron=3
      { bucheron: 3, ours: 2, mouton: 1, loup: 2, chalet: 2, tas_buches: 1, ruche: 1 },      // 12 I1✓ I2✓ I3✓ I6✓ I7✓
      { bucheron: 3, ours: 3, mouton: 0, loup: 2, chalet: 2, tas_buches: 1, ruche: 1 },      // 12 I1✓ I2✓ I3✓ I6✓ I7✓
      // chalet=2, tas_buches=1, chien=2, sans ruche — bucheron=3
      { bucheron: 3, ours: 3, mouton: 1, chien: 2, chalet: 2, tas_buches: 1 },                 // 12 I1✓ I4✓ I6✓ I7✓
      { bucheron: 3, ours: 2, mouton: 0, chien: 2, loup: 2, chalet: 2, tas_buches: 1 },      // 12 I1✓ I4✓ I6✓ I7✓
      // chalet=1, Loup=2, chien=2 — bucheron=3
      { bucheron: 3, ours: 2, mouton: 2, chien: 2, loup: 2, chalet: 1 },                     // 12 I1✓ I4✓ I6✓(3≥1)
      // chalet=3, Loup=2, ruche=1, sans chien — bucheron=4
      { bucheron: 4, ours: 2, mouton: 0, loup: 2, chalet: 3, ruche: 1 },                     // 12 I1✓ I2✓ I3✓ I6✓(4≥3)
    ],
    emptyCellsRange: [7, 7],
    bonusDisabled: false,
    estimatedDurationRange: [180, 420],
  },

  niveau_13: {
    // 10 types : tous les éléments — 7 vides, 5 fixés
    // Consolidation — même vides, compositions variées avec tous les 10 types
    boardId: 'board_12',
    cellCount: 12,
    compositions: [
      { bucheron: 3, ours: 2, mouton: 2, loup: 2, chalet: 2, ruche: 1 },                     // 12 I1✓ I2✓ I3✓ I6✓
      { bucheron: 3, ours: 3, mouton: 1, loup: 2, chalet: 2, ruche: 1 },                     // 12 I1✓ I2✓ I3✓ I6✓
      { bucheron: 3, ours: 2, mouton: 1, chien: 2, loup: 2, chalet: 2 },                     // 12 I1✓ I4✓ I6✓
      { bucheron: 3, ours: 2, mouton: 1, loup: 2, chalet: 2, tas_buches: 1, ruche: 1 },      // 12 I1✓ I2✓ I3✓ I6✓ I7✓
      { bucheron: 3, ours: 3, mouton: 0, loup: 2, chalet: 2, tas_buches: 1, ruche: 1 },      // 12 I1✓ I2✓ I3✓ I6✓ I7✓
      { bucheron: 3, ours: 3, mouton: 1, chien: 2, chalet: 2, tas_buches: 1 },                 // 12 I1✓ I4✓ I6✓ I7✓
      { bucheron: 4, ours: 1, mouton: 1, loup: 2, chalet: 3, ruche: 1 },                     // 12 I1✓ I2✓ I3✓ I6✓(4≥3)
      { bucheron: 3, ours: 2, mouton: 0, cerf: 2, biche: 2, chalet: 2, ruche: 1 },             // 12 I1✓ I2✓ I3✓ I5✓ I6✓
      { bucheron: 4, ours: 1, mouton: 0, cerf: 2, biche: 2, chalet: 2, ruche: 1 },             // 12 I1✓ I2✓ I3✓ I5✓ I6✓
      { bucheron: 3, ours: 2, mouton: 0, loup: 2, chalet: 2, tas_buches: 2, ruche: 1 },      // 12 I1✓ I2✓ I3✓ I6✓ I7✓
    ],
    emptyCellsRange: [7, 7],
    bonusDisabled: false,
    estimatedDurationRange: [180, 420],
  },

  niveau_14: {
    // 10 types : tous les éléments — 8 vides, 4 fixés
    // Même types qu'au niveau 13. Variété maximale : loup+mouton, chien, cerf/biche, tas_buches.
    // Tous les totaux = 12 (I1). Invariants I2-I7 respectés.
    boardId: 'board_12',
    cellCount: 12,
    compositions: [
      // Famille A — loup + mouton + chalet + ruche (tension loup/mouton + chaîne chalet)
      { bucheron: 3, ours: 2, mouton: 2, loup: 2, chalet: 2, ruche: 1 },                     // 3+2+2+2+2+1=12 I1✓ I2✓ I3✓ I6✓
      { bucheron: 3, ours: 2, mouton: 1, loup: 2, chalet: 2, ruche: 1, tas_buches: 1 },      // 3+2+1+2+2+1+1=12 I1✓ I2✓ I3✓ I6✓ I7✓
      // Famille B — loup + mouton + chien + chalet (toutes tensions actives)
      { bucheron: 3, ours: 2, mouton: 1, chien: 2, loup: 2, chalet: 2 },                     // 3+2+1+2+2+2=12 I1✓ I4✓ I6✓
      { bucheron: 2, ours: 2, mouton: 1, chien: 2, loup: 2, chalet: 2, ruche: 1 },           // 2+2+1+2+2+2+1=12 I1✓ I2✓ I3✓ I4✓ I6✓
      // Famille C — loup + mouton + chien + ruche + tas_buches
      { bucheron: 3, ours: 2, mouton: 1, chien: 2, loup: 2, chalet: 1, ruche: 1 },           // 3+2+1+2+2+1+1=12 I1✓ I2✓ I3✓ I4✓ I6✓
      { bucheron: 3, ours: 2, mouton: 1, chien: 2, loup: 2, tas_buches: 1, ruche: 1 },       // 3+2+1+2+2+1+1=12 I1✓ I2✓ I3✓ I4✓ I7✓
      // Famille D — loup + chien + chalet + tas_buches (sans mouton)
      { bucheron: 3, ours: 2, mouton: 0, chien: 2, loup: 2, chalet: 2, tas_buches: 1 },      // 3+2+2+2+2+1=12 I1✓ I4✓ I6✓ I7✓
      { bucheron: 3, ours: 3, mouton: 0, chien: 2, loup: 2, chalet: 1, ruche: 1 },           // 3+3+2+2+1+1=12 I1✓ I2✓ I3✓ I4✓ I6✓
      // Famille E — cerf + biche + loup + chalet (antagonisme croisé)
      { bucheron: 3, ours: 2, mouton: 1, loup: 1, cerf: 1, biche: 1, chalet: 2, ruche: 1 }, // 3+2+1+1+1+1+2+1=12 I1✓ I2✓ I3✓ I5✓ I6✓
      // Famille F — cerf + biche + chalet + ruche (sans loup, complexité paires)
      { bucheron: 3, ours: 2, mouton: 0, cerf: 2, biche: 2, chalet: 2, ruche: 1 },           // 3+2+2+2+2+1=12 I1✓ I2✓ I3✓ I5✓ I6✓
    ],
    emptyCellsRange: [8, 8],
    bonusDisabled: false,
    estimatedDurationRange: [240, 600],
  },

  niveau_15: {
    // 10 types : tous les éléments — 8 vides, 4 fixés — BONUS DÉSACTIVÉS
    // Maximum de complexité : toutes les tensions actives, joueur sans aide.
    // Tous les totaux = 12 (I1). Invariants I2-I7 respectés.
    boardId: 'board_12',
    cellCount: 12,
    compositions: [
      // Famille A — loup + mouton + chien + chalet + ruche (tous types actifs)
      { bucheron: 3, ours: 2, mouton: 1, chien: 2, loup: 2, chalet: 2 },                     // 3+2+1+2+2+2=12 I1✓ I4✓ I6✓
      { bucheron: 2, ours: 2, mouton: 1, chien: 2, loup: 2, chalet: 2, ruche: 1 },           // 2+2+1+2+2+2+1=12 I1✓ I2✓ I3✓ I4✓ I6✓
      { bucheron: 2, ours: 3, mouton: 1, chien: 2, loup: 2, chalet: 2 },                     // 2+3+1+2+2+2=12 I1✓ I4✓ I6✓
      // Famille B — loup + mouton + chalet + ruche + tas_buches (chaîne complète)
      { bucheron: 3, ours: 2, mouton: 1, loup: 2, chalet: 2, ruche: 1, tas_buches: 1 },      // 3+2+1+2+2+1+1=12 I1✓ I2✓ I3✓ I6✓ I7✓
      { bucheron: 3, ours: 3, mouton: 0, loup: 2, chalet: 2, ruche: 1, tas_buches: 1 },      // 3+3+2+2+1+1=12 I1✓ I2✓ I3✓ I6✓ I7✓
      { bucheron: 3, ours: 2, mouton: 2, loup: 2, chalet: 2, ruche: 1 },                     // 3+2+2+2+2+1=12 I1✓ I2✓ I3✓ I6✓
      // Famille C — loup + chien + tas_buches + chalet (sans mouton — difficulté max)
      { bucheron: 3, ours: 2, mouton: 0, chien: 2, loup: 2, chalet: 2, tas_buches: 1 },      // 3+2+2+2+2+1=12 I1✓ I4✓ I6✓ I7✓
      { bucheron: 3, ours: 3, mouton: 0, chien: 2, loup: 2, chalet: 1, ruche: 1 },           // 3+3+2+2+1+1=12 I1✓ I2✓ I3✓ I4✓ I6✓
      // Famille D — cerf + biche + loup + mouton + chalet (le plus complexe)
      { bucheron: 3, ours: 2, mouton: 1, loup: 1, cerf: 1, biche: 1, chalet: 2, ruche: 1 }, // 3+2+1+1+1+1+2+1=12 I1✓ I2✓ I3✓ I5✓ I6✓
      // Famille E — 2 couples cerf/biche + chalet + loup (contraintes paires max)
      { bucheron: 3, ours: 2, mouton: 0, loup: 2, cerf: 1, biche: 1, chalet: 2, ruche: 1 }, // 3+2+2+1+1+2+1=12 I1✓ I2✓ I3✓ I5✓ I6✓
    ],
    emptyCellsRange: [8, 8],
    bonusDisabled: true,
    estimatedDurationRange: [240, 600],
  },
  // ────────────────────────────────────────────────────────────────
  // PLATEAU 13 CASES (board_13_v1) — niveaux 16, 17, 18
  // ────────────────────────────────────────────────────────────────

  niveau_16: {
    // 10 types : tous les éléments standard — 8 vides, 5 fixés
    // ★ Respiration (nouveau board 13 cases) — densité + difficulté structurelle élevée
    // Toutes les tensions actives. Totaux = 13 (I1). Invariants I2-I7 respectés.
    boardId: 'board_13_v1',
    cellCount: 13,
    compositions: [
      // Famille A — loup + mouton + chalet + ruche (chaîne complète)
      { bucheron: 3, ours: 2, mouton: 2, loup: 2, chalet: 2, ruche: 1, tas_buches: 1 },       // 3+2+2+2+2+1+1=13 I1✓ I2✓ I3✓ I6✓ I7✓
      { bucheron: 4, ours: 2, mouton: 1, loup: 2, chalet: 3, ruche: 1 },                       // 4+2+1+2+3+1=13 I1✓ I2✓ I3✓ I6✓(4≥3)
      // Famille B — loup + mouton + chien + chalet (toutes tensions)
      { bucheron: 3, ours: 2, mouton: 2, chien: 2, loup: 2, chalet: 2 },                       // 3+2+2+2+2+2=13 I1✓ I4✓ I6✓
      { bucheron: 3, ours: 2, mouton: 1, chien: 2, loup: 2, chalet: 2, ruche: 1 },             // 3+2+1+2+2+2+1=13 I1✓ I2✓ I3✓ I4✓ I6✓
      // Famille C — chalet + tas_buches + chien + ruche (chaîne complète)
      { bucheron: 3, ours: 2, mouton: 1, chien: 2, loup: 2, chalet: 2, tas_buches: 1 },        // 3+2+1+2+2+2+1=13 I1✓ I4✓ I6✓ I7✓
      { bucheron: 3, ours: 3, mouton: 1, chien: 2, loup: 2, chalet: 2 },                       // 3+3+1+2+2+2=13 I1✓ I4✓ I6✓
      // Famille D — cerf + biche + chalet + ruche (paires + chaîne)
      { bucheron: 3, ours: 2, mouton: 1, loup: 2, cerf: 1, biche: 1, chalet: 2, ruche: 1 },   // 3+2+1+2+1+1+2+1=13 I1✓ I2✓ I3✓ I5✓ I6✓
      { bucheron: 4, ours: 2, mouton: 0, loup: 2, cerf: 1, biche: 1, chalet: 2, ruche: 1 },   // 4+2+2+1+1+2+1=13 I1✓ I2✓ I3✓ I5✓ I6✓
      // Famille E — cerf + biche + loup + chalet (antagonisme croisé max)
      { bucheron: 3, ours: 2, mouton: 0, loup: 3, cerf: 2, biche: 2, chalet: 1 },             // 3+2+3+2+2+1=13 I1✓ I5✓ I6✓
      // Famille F — loup dominant + chalet + ruche
      { bucheron: 4, ours: 2, mouton: 0, loup: 3, chalet: 3, ruche: 1 },                       // 4+2+3+3+1=13 I1✓ I2✓ I3✓ I6✓(4≥3)
    ],
    emptyCellsRange: [8, 8],
    bonusDisabled: false,
    estimatedDurationRange: [240, 600],
  },

  niveau_17: {
    // 11 types : tous les éléments + champignon — 8 vides, 5 fixés
    // 5 cases centrales (2,5,8,11,12) → champignon 1-3 (≠ voisin champignon)
    // Totaux = 13 (I1). Invariants I2-I7 respectés.
    boardId: 'board_13_v1',
    cellCount: 13,
    compositions: [
      // ── champignon=1 ──────────────────────────────────────────────
      // Mouton dominant
      { bucheron: 2, ours: 2, mouton: 4, loup: 2, chien: 2, champignon: 1 },                                        // 13 I1✓ I4✓
      { bucheron: 3, ours: 2, mouton: 3, loup: 2, chalet: 2, champignon: 1 },                                       // 13 I1✓ I6✓
      // Chien dominant
      { bucheron: 2, ours: 2, mouton: 2, chien: 4, loup: 2, champignon: 1 },                                        // 13 I1✓ I4✓
      { bucheron: 3, ours: 2, mouton: 1, chien: 4, loup: 2, champignon: 1 },                                        // 13 I1✓ I4✓
      // Mix tous types
      { bucheron: 2, ours: 1, mouton: 2, chien: 2, loup: 1, cerf: 1, biche: 1, ruche: 1, chalet: 1, champignon: 1 }, // 13 I1✓ I2✓ I3✓ I4✓ I5✓ I6✓
      { bucheron: 3, ours: 1, mouton: 2, chien: 2, loup: 1, cerf: 1, biche: 1, champignon: 1, tas_buches: 1 },       // 13 I1✓ I4✓ I5✓ I7✓
      { bucheron: 3, ours: 2, mouton: 1, loup: 2, cerf: 1, biche: 1, chalet: 1, ruche: 1, champignon: 1 },           // 13 I1✓ I2✓ I3✓ I5✓ I6✓
      // ── champignon=2 ──────────────────────────────────────────────
      // Mouton dominant
      { bucheron: 2, ours: 2, mouton: 4, loup: 1, chien: 2, champignon: 2 },                                        // 13 I1✓ I4✓
      { bucheron: 3, ours: 2, mouton: 3, loup: 2, chalet: 1, champignon: 2 },                                       // 13 I1✓ I6✓
      // Chien dominant
      { bucheron: 2, ours: 2, mouton: 1, chien: 4, loup: 2, champignon: 2 },                                        // 13 I1✓ I4✓
      { bucheron: 3, ours: 1, mouton: 2, chien: 4, loup: 1, champignon: 2 },                                        // 13 I1✓ I4✓
      // Mix tous types
      { bucheron: 2, ours: 1, mouton: 2, chien: 2, loup: 1, cerf: 1, biche: 1, ruche: 1, champignon: 2 },           // 13 I1✓ I2✓ I3✓ I4✓ I5✓
      { bucheron: 3, ours: 2, mouton: 1, chien: 2, loup: 1, cerf: 1, biche: 1, champignon: 2 },                     // 13 I1✓ I4✓ I5✓
      { bucheron: 3, ours: 2, mouton: 1, loup: 2, chalet: 1, ruche: 1, tas_buches: 1, champignon: 2 },              // 13 I1✓ I2✓ I3✓ I6✓ I7✓
      // ── champignon=3 ──────────────────────────────────────────────
      // Mouton dominant
      { bucheron: 2, ours: 2, mouton: 4, loup: 2, champignon: 3 },                                                  // 13 I1✓ (mouton x4, loup répulsion max)
      // Chien dominant
      { bucheron: 2, ours: 2, mouton: 2, chien: 4, champignon: 3 },                                                 // 13 I1✓ I4✓
      // Mix tous types
      { bucheron: 2, ours: 1, mouton: 2, chien: 2, loup: 1, cerf: 1, biche: 1, champignon: 3 },                    // 13 I1✓ I4✓ I5✓
      { bucheron: 3, ours: 2, mouton: 2, loup: 2, chalet: 1, champignon: 3 },                                       // 13 I1✓ I6✓
    ],
    emptyCellsRange: [8, 8],
    bonusDisabled: false,
    estimatedDurationRange: [300, 720],
  },

  niveau_18: {
    // 11 types : tous les éléments + champignon — 9 vides, 4 fixés — BONUS DÉSACTIVÉS
    // 5 cases centrales → champignon 1-3. Maximum de complexité. Joueur sans aide.
    // Totaux = 13 (I1). Invariants I2-I7 respectés.
    boardId: 'board_13_v1',
    cellCount: 13,
    compositions: [
      // ── champignon=1 ──────────────────────────────────────────────
      // Mouton dominant
      { bucheron: 2, ours: 2, mouton: 4, loup: 2, chien: 2, champignon: 1 },                                        // 13 I1✓ I4✓
      { bucheron: 3, ours: 2, mouton: 3, loup: 2, chalet: 2, champignon: 1 },                                       // 13 I1✓ I6✓
      // Chien dominant
      { bucheron: 2, ours: 2, mouton: 2, chien: 4, loup: 2, champignon: 1 },                                        // 13 I1✓ I4✓
      { bucheron: 2, ours: 2, mouton: 1, chien: 4, loup: 2, chalet: 1, champignon: 1 },                             // 13 I1✓ I4✓ I6✓
      // Mix tous types
      { bucheron: 2, ours: 1, mouton: 2, chien: 2, loup: 1, cerf: 1, biche: 1, ruche: 1, chalet: 1, champignon: 1 }, // 13 I1✓ I2✓ I3✓ I4✓ I5✓ I6✓
      { bucheron: 3, ours: 2, mouton: 1, loup: 2, cerf: 1, biche: 1, chalet: 1, ruche: 1, champignon: 1 },           // 13 I1✓ I2✓ I3✓ I5✓ I6✓
      { bucheron: 3, ours: 1, mouton: 2, chien: 2, loup: 1, cerf: 1, biche: 1, tas_buches: 1, champignon: 1 },       // 13 I1✓ I4✓ I5✓ I7✓
      // ── champignon=2 ──────────────────────────────────────────────
      // Mouton dominant
      { bucheron: 2, ours: 2, mouton: 4, loup: 1, chien: 2, champignon: 2 },                                        // 13 I1✓ I4✓
      { bucheron: 3, ours: 2, mouton: 3, loup: 2, chalet: 1, champignon: 2 },                                       // 13 I1✓ I6✓
      // Chien dominant
      { bucheron: 2, ours: 2, mouton: 1, chien: 4, loup: 2, champignon: 2 },                                        // 13 I1✓ I4✓
      { bucheron: 3, ours: 1, mouton: 2, chien: 4, loup: 1, champignon: 2 },                                        // 13 I1✓ I4✓
      // Mix tous types
      { bucheron: 2, ours: 1, mouton: 2, chien: 2, loup: 1, cerf: 1, biche: 1, ruche: 1, champignon: 2 },           // 13 I1✓ I2✓ I3✓ I4✓ I5✓
      { bucheron: 3, ours: 2, mouton: 1, chien: 2, loup: 1, cerf: 1, biche: 1, champignon: 2 },                     // 13 I1✓ I4✓ I5✓
      { bucheron: 3, ours: 2, mouton: 1, loup: 2, chalet: 1, ruche: 1, tas_buches: 1, champignon: 2 },              // 13 I1✓ I2✓ I3✓ I6✓ I7✓
      // ── champignon=3 ──────────────────────────────────────────────
      // Mouton dominant
      { bucheron: 2, ours: 2, mouton: 4, loup: 2, champignon: 3 },                                                  // 13 I1✓
      { bucheron: 3, ours: 2, mouton: 3, loup: 2, champignon: 3 },                                                  // 13 I1✓
      // Chien dominant
      { bucheron: 2, ours: 2, mouton: 2, chien: 4, champignon: 3 },                                                 // 13 I1✓ I4✓
      // Mix tous types
      { bucheron: 2, ours: 1, mouton: 2, chien: 2, loup: 1, cerf: 1, biche: 1, champignon: 3 },                    // 13 I1✓ I4✓ I5✓
      { bucheron: 3, ours: 2, mouton: 2, loup: 2, chalet: 1, champignon: 3 },                                       // 13 I1✓ I6✓
    ],
    emptyCellsRange: [8, 8],
    bonusDisabled: true,
    estimatedDurationRange: [360, 900],
  },
  // ────────────────────────────────────────────────────────────────
  // PLATEAU 14 CASES (board_14_v1) — niveaux 19, 20, 21
  // Apothéose : tous les acteurs du jeu + Arbre (roi de la forêt)
  // Arbre privilégié sur bucheron — forêt connexe obligatoire.
  // Invariants : I1 (Σ=14), I2 (ruche≤1), I3 (ours≥1 si ruche),
  //              I4 (chien≥2), I5 (cerf=biche), I6 (bucheron≥chalet),
  //              I7 (bucheron≥1 si tas_buches), I9 (arbre≥2 si arbre>0)
  // ────────────────────────────────────────────────────────────────

  niveau_19: {
    // 12 types : tous les éléments + Arbre — 9 vides, 5 fixés
    // Introduction de l'Arbre. Compositions riches avec max de diversité.
    // Arbres rois : arbre >= bucheron dans chaque composition.
    boardId: 'board_14_v1',
    cellCount: 14,
    compositions: [
      // ── Famille A — Arbre + tous les grands antagonismes ─────────
      { arbre: 3, bucheron: 2, ours: 2, mouton: 1, loup: 2, cerf: 1, biche: 1, ruche: 1, chalet: 1 },         // 14 I1✓ I2✓ I3✓ I5✓ I6✓ I9✓
      { arbre: 3, bucheron: 2, ours: 2, mouton: 2, loup: 2, chien: 2, cerf: 0, biche: 0, chalet: 1 },         // 14 I1✓ I4✓ I6✓ I9✓
      { arbre: 4, bucheron: 2, ours: 2, mouton: 2, loup: 2, chien: 2 },                                        // 14 I1✓ I4✓ I9✓
      // ── Famille B — Arbre + cerf/biche + chalet ──────────────────
      { arbre: 3, bucheron: 2, ours: 2, mouton: 1, cerf: 2, biche: 2, chalet: 1, ruche: 1 },                   // 14 I1✓ I2✓ I3✓ I5✓ I6✓ I9✓
      { arbre: 4, bucheron: 2, ours: 1, mouton: 1, loup: 2, cerf: 2, biche: 2 },                               // 14 I1✓ I5✓ I9✓
      // ── Famille C — Arbre + bûches + chalet (chaîne complète) ───
      { arbre: 3, bucheron: 2, ours: 2, mouton: 1, loup: 2, chalet: 2, tas_buches: 1, ruche: 1 },              // 14 I1✓ I2✓ I3✓ I6✓ I7✓ I9✓
      { arbre: 3, bucheron: 2, ours: 2, mouton: 2, loup: 1, chien: 2, tas_buches: 1, chalet: 1 },              // 14 I1✓ I4✓ I6✓ I7✓ I9✓
      // ── Famille D — Arbre dominant + chien + antagonismes ───────
      { arbre: 4, bucheron: 2, ours: 2, mouton: 2, loup: 2, chalet: 2 },                                       // 14 I1✓ I6✓ I9✓
      { arbre: 4, bucheron: 2, ours: 2, mouton: 2, chien: 2, loup: 2 },                                        // 14 I1✓ I4✓ I9✓
      // ── Famille E — Grand mix : tout le monde ────────────────────
      { arbre: 2, bucheron: 2, ours: 1, mouton: 1, chien: 2, loup: 2, cerf: 1, biche: 1, chalet: 1, ruche: 1 }, // 14 I1✓ I2✓ I3✓ I4✓ I5✓ I6✓ I9✓
    ],
    emptyCellsRange: [9, 9],
    bonusDisabled: false,
    estimatedDurationRange: [300, 720],
  },

  niveau_20: {
    // 12 types : tous les éléments + Arbre — 8 vides, 6 fixés
    // Densité augmentée. Arbre ≥ bucheron toujours. Max diversité.
    boardId: 'board_14_v1',
    cellCount: 14,
    compositions: [
      // ── Famille A — Arbre + tous antagonismes croisés ────────────
      { arbre: 3, bucheron: 2, ours: 2, mouton: 1, loup: 2, cerf: 1, biche: 1, chalet: 1, ruche: 1 },         // 14 I1✓ I2✓ I3✓ I5✓ I6✓ I9✓
      { arbre: 3, bucheron: 2, ours: 2, mouton: 2, chien: 2, loup: 2, chalet: 1 },                             // 14 I1✓ I4✓ I6✓ I9✓
      { arbre: 4, bucheron: 2, ours: 2, mouton: 2, chien: 2, loup: 2 },                                        // 14 I1✓ I4✓ I9✓
      // ── Famille B — Arbre + cerf/biche + chalet + loup ──────────
      { arbre: 3, bucheron: 2, ours: 2, mouton: 1, loup: 1, cerf: 2, biche: 2, chalet: 1 },                   // 14 I1✓ I5✓ I6✓ I9✓
      { arbre: 4, bucheron: 2, ours: 1, loup: 2, cerf: 2, biche: 2, ruche: 1 },                               // 14 I1✓ I2✓ I3✓ I5✓ I9✓
      // ── Famille C — Arbre + bûches + chaîne complète ────────────
      { arbre: 3, bucheron: 2, ours: 2, mouton: 2, loup: 2, chalet: 1, tas_buches: 1, ruche: 1 },              // 14 I1✓ I2✓ I3✓ I6✓ I7✓ I9✓
      { arbre: 3, bucheron: 2, ours: 2, mouton: 1, chien: 2, loup: 2, chalet: 1, tas_buches: 1 },              // 14 I1✓ I4✓ I6✓ I7✓ I9✓
      // ── Famille D — Arbre dominant + grand mix ───────────────────
      { arbre: 4, bucheron: 2, ours: 2, mouton: 0, loup: 2, cerf: 2, biche: 2 },                               // 14 I1✓ I5✓ I9✓
      { arbre: 4, bucheron: 2, ours: 2, mouton: 2, loup: 2, chalet: 2 },                                       // 14 I1✓ I6✓ I9✓
      // ── Famille E — Apothéose : tous présents ─────────────────────
      { arbre: 2, bucheron: 2, ours: 1, mouton: 1, chien: 2, loup: 2, cerf: 1, biche: 1, chalet: 1, ruche: 1 }, // 14 I1✓ I2✓ I3✓ I4✓ I5✓ I6✓ I9✓
    ],
    emptyCellsRange: [8, 8],
    bonusDisabled: false,
    estimatedDurationRange: [360, 840],
  },

  niveau_21: {
    // 12 types : tous les éléments + Arbre — 8 vides, 6 fixés — BONUS DÉSACTIVÉS
    // Maximum absolu. Feu d'artifice final. Joueur sans aide.
    boardId: 'board_14_v1',
    cellCount: 14,
    compositions: [
      // ── Famille A — Tous les acteurs, tension maximale ────────────
      { arbre: 3, bucheron: 2, ours: 2, mouton: 1, loup: 2, cerf: 1, biche: 1, chalet: 1, ruche: 1 },         // 14 I1✓ I2✓ I3✓ I5✓ I6✓ I9✓
      { arbre: 3, bucheron: 2, ours: 2, mouton: 2, chien: 2, loup: 2, chalet: 1 },                             // 14 I1✓ I4✓ I6✓ I9✓
      { arbre: 4, bucheron: 2, ours: 2, mouton: 2, chien: 2, loup: 2 },                                        // 14 I1✓ I4✓ I9✓
      // ── Famille B — Cerf/biche + chalet + loup + arbre ──────────
      { arbre: 3, bucheron: 2, ours: 2, mouton: 1, loup: 1, cerf: 2, biche: 2, chalet: 1 },                   // 14 I1✓ I5✓ I6✓ I9✓
      { arbre: 4, bucheron: 2, ours: 1, loup: 2, cerf: 2, biche: 2, ruche: 1 },                               // 14 I1✓ I2✓ I3✓ I5✓ I9✓
      // ── Famille C — Bûches + chaîne + arbre ─────────────────────
      { arbre: 3, bucheron: 2, ours: 2, mouton: 2, loup: 2, chalet: 1, tas_buches: 1, ruche: 1 },              // 14 I1✓ I2✓ I3✓ I6✓ I7✓ I9✓
      { arbre: 3, bucheron: 2, ours: 2, mouton: 1, chien: 2, loup: 2, chalet: 1, tas_buches: 1 },              // 14 I1✓ I4✓ I6✓ I7✓ I9✓
      // ── Famille D — Arbre très dominant ──────────────────────────
      { arbre: 5, bucheron: 2, ours: 2, mouton: 1, loup: 2, cerf: 1, biche: 1 },                               // 14 I1✓ I5✓ I9✓
      { arbre: 5, bucheron: 2, ours: 2, mouton: 2, loup: 2, chalet: 1 },                                       // 14 I1✓ I6✓ I9✓
      // ── Famille E — Grand feu d'artifice : tout le monde ─────────
      { arbre: 2, bucheron: 2, ours: 1, mouton: 1, chien: 2, loup: 2, cerf: 1, biche: 1, chalet: 1, ruche: 1 }, // 14 I1✓ I2✓ I3✓ I4✓ I5✓ I6✓ I9✓
    ],
    emptyCellsRange: [8, 8],
    bonusDisabled: true,
    estimatedDurationRange: [420, 1200],
  },
};

// Note : DifficultyLevel est défini dans Challenge.ts et ré-exporté ici
// pour la compatibilité avec les imports existants
