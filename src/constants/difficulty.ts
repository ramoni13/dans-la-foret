// ============================================================
// PARAMÈTRES DE DIFFICULTÉ — 13 niveaux
//
// 3 leviers combinés :
//   1. Plateau : 6 → 7 → 8 → 10 → 12 cases
//   2. Composition : nombre et types d'éléments
//   3. Cases vides : valeur FIXE et unique par niveau (pas de plage)
//
// Progression des cases vides :
//   Niv 1  : 6 cases,  3 vides
//   Niv 2  : 7 cases,  4 vides
//   Niv 3  : 8 cases,  3 vides
//   Niv 4  : 8 cases,  4 vides
//   Niv 5  : 8 cases,  5 vides
//   Niv 6  : 10 cases, 4 vides
//   Niv 7  : 10 cases, 5 vides
//   Niv 8  : 10 cases, 6 vides
//   Niv 9  : 12 cases, 5 vides
//   Niv 10 : 12 cases, 6 vides
//   Niv 11 : 12 cases, 7 vides
//   Niv 12 : 12 cases, 8 vides
//   Niv 13 : 12 cases, 9 vides
//
// Nouveaux éléments introduits progressivement :
//   Niv 1-2  : Mouton, Bucheron, Ours, Ruche (max 1, voisin Ours obligatoire)
//   Niv 3-4  : + Chien (meute connexe, chien >= 2 toujours)
//   Niv 5-6  : + Cerf + Biche (couples 1-pour-1, cerf = biche en quantité)
//   Niv 7-8  : + Renard (répulsion Renard/Mouton)
//   Niv 9-10 : + Tas de bûches (voisin Bucheron, + voisin Chalet si présent)
//   Niv 11-13: + Chalet (voisin Bucheron obligatoire, bucheron >= chalet)
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
  | 'niveau_6' | 'niveau_7' | 'niveau_8' | 'niveau_9' | 'niveau_10'
  | 'niveau_11' | 'niveau_12' | 'niveau_13';

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
  // ── Introduits niv 7+ ───────────────────────────────────────
  renard?: number;     // ≠ voisin mouton, ≠ voisin renard
  // ── Introduits niv 9+ ───────────────────────────────────────
  tas_buches?: number; // = voisin bucheron · = voisin chalet si chalet présent (I7)
  // ── Introduits niv 11+ ──────────────────────────────────────
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
    // Pas de mouton=0 : le joueur doit voir les 3 elements de base
    boardId: 'board_6_v1',
    cellCount: 6,
    compositions: [
      // Symetriques (2-2-1-1) — equilibre parfait
      { bucheron: 2, ours: 2, mouton: 1, ruche: 1 }, // total=6 I1✓ I2✓ I3✓
      { bucheron: 2, ours: 1, mouton: 2, ruche: 1 }, // total=6 I1✓ I2✓ I3✓
      { bucheron: 1, ours: 2, mouton: 2, ruche: 1 }, // total=6 I1✓ I2✓ I3✓
      // Asymetriques (3-1-1-1)
      { bucheron: 3, ours: 1, mouton: 1, ruche: 1 }, // total=6 I1✓ I2✓ I3✓
      { bucheron: 1, ours: 3, mouton: 1, ruche: 1 }, // total=6 I1✓ I2✓ I3✓
      { bucheron: 1, ours: 1, mouton: 3, ruche: 1 }, // total=6 I1✓ I2✓ I3✓
      // Asymetriques (3-2-0-1) — un element absent
      { bucheron: 3, ours: 2, mouton: 0, ruche: 1 }, // total=6 I1✓ I2✓ I3✓
      { bucheron: 2, ours: 3, mouton: 0, ruche: 1 }, // total=6 I1✓ I2✓ I3✓
      { bucheron: 0, ours: 3, mouton: 2, ruche: 1 }, // total=6 I1✓ I2✓ I3✓
      // Tres asymetriques (4-1-0-1)
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
    // Meme palette que niv 1, plateau plus grand (7 cases)
    // ruche = 1 toujours (I2), ours >= 1 toujours (I3)
    // Pas de Chien : la regle meute est introduite au niveau 3
    boardId: 'board_7_v1',
    cellCount: 7,
    compositions: [
      // Equilibrees (2-2-2-1)
      { bucheron: 2, ours: 2, mouton: 2, ruche: 1 }, // total=7 I1✓ I2✓ I3✓
      { bucheron: 3, ours: 2, mouton: 1, ruche: 1 }, // total=7 I1✓ I2✓ I3✓
      { bucheron: 2, ours: 3, mouton: 1, ruche: 1 }, // total=7 I1✓ I2✓ I3✓
      { bucheron: 1, ours: 2, mouton: 3, ruche: 1 }, // total=7 I1✓ I2✓ I3✓
      { bucheron: 3, ours: 1, mouton: 2, ruche: 1 }, // total=7 I1✓ I2✓ I3✓
      { bucheron: 1, ours: 3, mouton: 2, ruche: 1 }, // total=7 I1✓ I2✓ I3✓
      // Asymetriques (4-x-0-1) — un element absent
      { bucheron: 4, ours: 2, mouton: 0, ruche: 1 }, // total=7 I1✓ I2✓ I3✓
      { bucheron: 4, ours: 1, mouton: 1, ruche: 1 }, // total=7 I1✓ I2✓ I3✓
      { bucheron: 2, ours: 4, mouton: 0, ruche: 1 }, // total=7 I1✓ I2✓ I3✓
      { bucheron: 1, ours: 4, mouton: 1, ruche: 1 }, // total=7 I1✓ I2✓ I3✓
      // Tres asymetriques (0-4-x-1)
      { bucheron: 0, ours: 4, mouton: 2, ruche: 1 }, // total=7 I1✓ I2✓ I3✓
      { bucheron: 0, ours: 3, mouton: 3, ruche: 1 }, // total=7 I1✓ I2✓ I3✓
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
    // Nouveau plateau 8 cases. Introduction du Chien (regle meute connexe).
    // chien >= 2 toujours (I4). ruche = 1 toujours (I2). ours >= 1 si ruche = 1 (I3).
    // Transition douce : chien=2 majoritaire, quelques chien=3
    boardId: 'board_8_v2',
    cellCount: 8,
    compositions: [
      // chien=2 + ruche=1 (5 types presents) — equilibres
      { bucheron: 2, ours: 2, mouton: 1, chien: 2, ruche: 1 }, // total=8 I1✓ I2✓ I3✓ I4✓
      { bucheron: 2, ours: 1, mouton: 2, chien: 2, ruche: 1 }, // total=8 I1✓ I2✓ I3✓ I4✓
      { bucheron: 1, ours: 2, mouton: 2, chien: 2, ruche: 1 }, // total=8 I1✓ I2✓ I3✓ I4✓
      { bucheron: 3, ours: 1, mouton: 1, chien: 2, ruche: 1 }, // total=8 I1✓ I2✓ I3✓ I4✓
      { bucheron: 1, ours: 3, mouton: 1, chien: 2, ruche: 1 }, // total=8 I1✓ I2✓ I3✓ I4✓
      { bucheron: 1, ours: 1, mouton: 3, chien: 2, ruche: 1 }, // total=8 I1✓ I2✓ I3✓ I4✓
      // chien=2 + ruche=1 — un element absent
      { bucheron: 3, ours: 2, mouton: 0, chien: 2, ruche: 1 }, // total=8 I1✓ I2✓ I3✓ I4✓
      { bucheron: 0, ours: 3, mouton: 2, chien: 2, ruche: 1 }, // total=8 I1✓ I2✓ I3✓ I4✓
      // chien=3 + ruche=1 — meute plus grande
      { bucheron: 2, ours: 2, mouton: 0, chien: 3, ruche: 1 }, // total=8 I1✓ I2✓ I3✓ I4✓
      { bucheron: 0, ours: 2, mouton: 2, chien: 3, ruche: 1 }, // total=8 I1✓ I2✓ I3✓ I4✓
      { bucheron: 3, ours: 1, mouton: 0, chien: 3, ruche: 1 }, // total=8 I1✓ I2✓ I3✓ I4✓
      { bucheron: 1, ours: 3, mouton: 0, chien: 3, ruche: 1 }, // total=8 I1✓ I2✓ I3✓ I4✓
    ],
    emptyCellsRange: [3, 3],
    bonusDisabled: false,
    estimatedDurationRange: [150, 270],
  },

  niveau_4: {
    // 5 types : Bucheron, Ours, Mouton, Ruche, Chien — 4 vides fixes
    // Meme palette que niv 3, plus de cases vides = plus difficile.
    // chien >= 2 toujours (I4). ruche = 1 toujours (I2). ours >= 1 si ruche = 1 (I3).
    // Compositions plus asymetriques : chien=3 et chien=4 plus frequents
    boardId: 'board_8_v2',
    cellCount: 8,
    compositions: [
      // chien=2 + ruche=1 — equilibres
      { bucheron: 2, ours: 2, mouton: 1, chien: 2, ruche: 1 }, // total=8 I1✓ I2✓ I3✓ I4✓
      { bucheron: 3, ours: 1, mouton: 1, chien: 2, ruche: 1 }, // total=8 I1✓ I2✓ I3✓ I4✓
      { bucheron: 1, ours: 3, mouton: 1, chien: 2, ruche: 1 }, // total=8 I1✓ I2✓ I3✓ I4✓
      // chien=3 + ruche=1 — meute dominante
      { bucheron: 1, ours: 2, mouton: 1, chien: 3, ruche: 1 }, // total=8 I1✓ I2✓ I3✓ I4✓
      { bucheron: 2, ours: 1, mouton: 1, chien: 3, ruche: 1 }, // total=8 I1✓ I2✓ I3✓ I4✓
      { bucheron: 1, ours: 1, mouton: 2, chien: 3, ruche: 1 }, // total=8 I1✓ I2✓ I3✓ I4✓
      { bucheron: 3, ours: 1, mouton: 0, chien: 3, ruche: 1 }, // total=8 I1✓ I2✓ I3✓ I4✓
      { bucheron: 0, ours: 3, mouton: 1, chien: 3, ruche: 1 }, // total=8 I1✓ I2✓ I3✓ I4✓
      { bucheron: 1, ours: 3, mouton: 0, chien: 3, ruche: 1 }, // total=8 I1✓ I2✓ I3✓ I4✓
      // chien=4 + ruche=1 — meute tres dominante
      { bucheron: 1, ours: 2, mouton: 0, chien: 4, ruche: 1 }, // total=8 I1✓ I2✓ I3✓ I4✓
      { bucheron: 2, ours: 1, mouton: 0, chien: 4, ruche: 1 }, // total=8 I1✓ I2✓ I3✓ I4✓
      { bucheron: 0, ours: 2, mouton: 1, chien: 4, ruche: 1 }, // total=8 I1✓ I2✓ I3✓ I4✓
    ],
    emptyCellsRange: [4, 4],
    bonusDisabled: false,
    estimatedDurationRange: [210, 360],
  },

  niveau_5: {
    // 7 types : Bucheron, Ours, Mouton, Ruche, Chien, Cerf, Biche — 5 vides fixes
    // Introduction du Cerf et de la Biche (couples 1-pour-1).
    // cerf = biche en quantite toujours (I5). ruche optionnelle (I2). ours >= 1 si ruche = 1 (I3).
    // chien >= 2 si present (I4). Sur 8 cases : cerf+biche = 2 cases, reste 6 a repartir.
    boardId: 'board_8_v2',
    cellCount: 8,
    compositions: [
      // Sans chien — cerf=1, biche=1, ruche=1 (5 types actifs)
      { bucheron: 2, ours: 2, mouton: 1, cerf: 1, biche: 1, ruche: 1 }, // total=8 I1✓ I2✓ I3✓ I5✓
      { bucheron: 3, ours: 1, mouton: 1, cerf: 1, biche: 1, ruche: 1 }, // total=8 I1✓ I2✓ I3✓ I5✓
      { bucheron: 1, ours: 3, mouton: 1, cerf: 1, biche: 1, ruche: 1 }, // total=8 I1✓ I2✓ I3✓ I5✓
      { bucheron: 2, ours: 1, mouton: 2, cerf: 1, biche: 1, ruche: 1 }, // total=8 I1✓ I2✓ I3✓ I5✓
      // Avec chien=2 — cerf=1, biche=1, ruche=1 (6 types actifs)
      { bucheron: 1, ours: 2, mouton: 0, chien: 2, cerf: 1, biche: 1, ruche: 1 }, // total=8 I1✓ I2✓ I3✓ I4✓ I5✓
      { bucheron: 2, ours: 1, mouton: 0, chien: 2, cerf: 1, biche: 1, ruche: 1 }, // total=8 I1✓ I2✓ I3✓ I4✓ I5✓
      { bucheron: 0, ours: 2, mouton: 1, chien: 2, cerf: 1, biche: 1, ruche: 1 }, // total=8 I1✓ I2✓ I3✓ I4✓ I5✓
      { bucheron: 1, ours: 1, mouton: 1, chien: 2, cerf: 1, biche: 1, ruche: 1 }, // total=8 I1✓ I2✓ I3✓ I4✓ I5✓
      // Avec chien=2 — cerf=1, biche=1, sans ruche (5 types actifs)
      { bucheron: 2, ours: 2, mouton: 0, chien: 2, cerf: 1, biche: 1 },           // total=8 I1✓ I4✓ I5✓
      { bucheron: 3, ours: 1, mouton: 0, chien: 2, cerf: 1, biche: 1 },           // total=8 I1✓ I4✓ I5✓
    ],
    emptyCellsRange: [5, 5],
    bonusDisabled: false,
    estimatedDurationRange: [300, 480],
  },

  // ────────────────────────────────────────────────────────────────
  // PLATEAU 10 CASES — niveaux 6, 7, 8
  // ────────────────────────────────────────────────────────────────

  niveau_6: {
    // 7 types : Bucheron, Ours, Mouton, Ruche, Chien, Cerf, Biche — 4 vides fixes
    // Nouveau plateau 10 cases. Meme palette que niv 5, plus d'espace.
    // cerf = biche toujours (I5). chien >= 2 si present (I4). ours >= 1 si ruche = 1 (I3).
    // Groupes : cerf=biche=1 avec ruche, cerf=biche=2 sans ruche, mixtes
    boardId: 'board_10_v3',
    cellCount: 10,
    compositions: [
      // cerf=1, biche=1, ruche=1, chien=2 (7 types actifs)
      { bucheron: 2, ours: 2, mouton: 1, chien: 2, cerf: 1, biche: 1, ruche: 1 }, // total=10 I1✓ I2✓ I3✓ I4✓ I5✓
      { bucheron: 2, ours: 1, mouton: 2, chien: 2, cerf: 1, biche: 1, ruche: 1 }, // total=10 I1✓ I2✓ I3✓ I4✓ I5✓
      { bucheron: 1, ours: 2, mouton: 2, chien: 2, cerf: 1, biche: 1, ruche: 1 }, // total=10 I1✓ I2✓ I3✓ I4✓ I5✓
      { bucheron: 3, ours: 1, mouton: 1, chien: 2, cerf: 1, biche: 1, ruche: 1 }, // total=10 I1✓ I2✓ I3✓ I4✓ I5✓
      { bucheron: 1, ours: 3, mouton: 1, chien: 2, cerf: 1, biche: 1, ruche: 1 }, // total=10 I1✓ I2✓ I3✓ I4✓ I5✓
      // cerf=1, biche=1, ruche=1, sans chien (6 types actifs)
      { bucheron: 3, ours: 2, mouton: 2, cerf: 1, biche: 1, ruche: 1 },           // total=10 I1✓ I2✓ I3✓ I5✓
      { bucheron: 4, ours: 2, mouton: 1, cerf: 1, biche: 1, ruche: 1 },           // total=10 I1✓ I2✓ I3✓ I5✓
      { bucheron: 3, ours: 2, mouton: 0, chien: 2, cerf: 1, biche: 1, ruche: 1 }, // total=10 I1✓ I2✓ I3✓ I4✓ I5✓
      { bucheron: 2, ours: 3, mouton: 0, chien: 2, cerf: 1, biche: 1, ruche: 1 }, // total=10 I1✓ I2✓ I3✓ I4✓ I5✓
      // cerf=2, biche=2, sans ruche, chien=2 (5 types actifs, couples doubles)
      { bucheron: 2, ours: 2, mouton: 0, chien: 2, cerf: 2, biche: 2 },           // total=10 I1✓ I4✓ I5✓
      { bucheron: 3, ours: 1, mouton: 0, chien: 2, cerf: 2, biche: 2 },           // total=10 I1✓ I4✓ I5✓
      { bucheron: 1, ours: 3, mouton: 0, chien: 2, cerf: 2, biche: 2 },           // total=10 I1✓ I4✓ I5✓
    ],
    emptyCellsRange: [4, 4],
    bonusDisabled: false,
    estimatedDurationRange: [270, 420],
  },

  niveau_7: {
    // 8 types : Bucheron, Ours, Mouton, Ruche, Chien, Cerf, Biche, Renard — 5 vides fixes
    // Introduction du Renard (repulsion Renard/Mouton).
    // renard >= 1 toujours. chien >= 2 si present (I4). ours >= 1 si ruche = 1 (I3).
    // cerf = biche si presents (I5). ruche optionnelle.
    // Groupes : avec chien+ruche, sans chien+ruche, avec cerf/biche
    boardId: 'board_10_v3',
    cellCount: 10,
    compositions: [
      // renard=2, chien=2, ruche=1 (6 types actifs)
      { bucheron: 2, ours: 2, mouton: 1, chien: 2, renard: 2, ruche: 1 }, // total=10 I1✓ I2✓ I3✓ I4✓
      { bucheron: 2, ours: 1, mouton: 2, chien: 2, renard: 2, ruche: 1 }, // total=10 I1✓ I2✓ I3✓ I4✓
      { bucheron: 1, ours: 2, mouton: 2, chien: 2, renard: 2, ruche: 1 }, // total=10 I1✓ I2✓ I3✓ I4✓
      { bucheron: 3, ours: 1, mouton: 1, chien: 2, renard: 2, ruche: 1 }, // total=10 I1✓ I2✓ I3✓ I4✓
      { bucheron: 2, ours: 1, mouton: 1, chien: 2, renard: 3, ruche: 1 }, // total=10 I1✓ I2✓ I3✓ I4✓
      // renard=2, chien=2, mouton=0, ruche=1 (5 types actifs)
      { bucheron: 2, ours: 2, mouton: 0, chien: 2, renard: 3, ruche: 1 }, // total=10 I1✓ I2✓ I3✓ I4✓
      { bucheron: 3, ours: 2, mouton: 0, chien: 2, renard: 2, ruche: 1 }, // total=10 I1✓ I2✓ I3✓ I4✓
      { bucheron: 2, ours: 3, mouton: 0, chien: 2, renard: 2, ruche: 1 }, // total=10 I1✓ I2✓ I3✓ I4✓
      // renard=2, sans chien, ruche=1 (5 types actifs)
      { bucheron: 3, ours: 2, mouton: 2, renard: 2, ruche: 1 },           // total=10 I1✓ I2✓ I3✓
      { bucheron: 4, ours: 2, mouton: 1, renard: 2, ruche: 1 },           // total=10 I1✓ I2✓ I3✓
      { bucheron: 2, ours: 3, mouton: 2, renard: 2, ruche: 1 },           // total=10 I1✓ I2✓ I3✓
      // renard=2, cerf=1, biche=1, ruche=1, chien=2 (8 types actifs)
      { bucheron: 2, ours: 2, mouton: 0, chien: 2, renard: 2, cerf: 1, biche: 1 }, // total=10 I1✓ I4✓ I5✓
    ],
    emptyCellsRange: [5, 5],
    bonusDisabled: false,
    estimatedDurationRange: [360, 540],
  },

  niveau_8: {
    // 8 types : Bucheron, Ours, Mouton, Ruche, Chien, Cerf, Biche, Renard — 6 vides fixes
    // Meme palette que niv 7, plus de cases vides = plus difficile.
    // renard >= 1 toujours. renard=3 plus frequent (renard dominant).
    // chien >= 2 si present (I4). ours >= 1 si ruche = 1 (I3). cerf = biche si presents (I5).
    boardId: 'board_10_v3',
    cellCount: 10,
    compositions: [
      // renard=3, chien=2, ruche=1 (6 types actifs) — renard dominant
      { bucheron: 2, ours: 1, mouton: 1, chien: 2, renard: 3, ruche: 1 }, // total=10 I1✓ I2✓ I3✓ I4✓
      { bucheron: 1, ours: 2, mouton: 1, chien: 2, renard: 3, ruche: 1 }, // total=10 I1✓ I2✓ I3✓ I4✓
      { bucheron: 1, ours: 1, mouton: 2, chien: 2, renard: 3, ruche: 1 }, // total=10 I1✓ I2✓ I3✓ I4✓
      // renard=3, chien=2, mouton=0, ruche=1 (5 types actifs)
      { bucheron: 2, ours: 2, mouton: 0, chien: 2, renard: 3, ruche: 1 }, // total=10 I1✓ I2✓ I3✓ I4✓
      { bucheron: 3, ours: 1, mouton: 0, chien: 2, renard: 3, ruche: 1 }, // total=10 I1✓ I2✓ I3✓ I4✓
      { bucheron: 1, ours: 3, mouton: 0, chien: 2, renard: 3, ruche: 1 }, // total=10 I1✓ I2✓ I3✓ I4✓
      // renard=3, chien=3, mouton=0, ruche=1 (5 types actifs)
      { bucheron: 1, ours: 2, mouton: 0, chien: 3, renard: 3, ruche: 1 }, // total=10 I1✓ I2✓ I3✓ I4✓
      { bucheron: 2, ours: 1, mouton: 0, chien: 3, renard: 3, ruche: 1 }, // total=10 I1✓ I2✓ I3✓ I4✓
      // renard=3, sans chien, ruche=1 (5 types actifs)
      { bucheron: 3, ours: 2, mouton: 1, renard: 3, ruche: 1 },           // total=10 I1✓ I2✓ I3✓
      { bucheron: 2, ours: 3, mouton: 1, renard: 3, ruche: 1 },           // total=10 I1✓ I2✓ I3✓
      { bucheron: 4, ours: 2, mouton: 0, renard: 3, ruche: 1 },           // total=10 I1✓ I2✓ I3✓
      // renard=2, cerf=1, biche=1, chien=2, ruche=1 (8 types actifs)
      { bucheron: 2, ours: 1, mouton: 0, chien: 2, renard: 2, cerf: 1, biche: 1, ruche: 1 }, // total=10 I1✓ I2✓ I3✓ I4✓ I5✓
      { bucheron: 1, ours: 2, mouton: 0, chien: 2, renard: 2, cerf: 1, biche: 1, ruche: 1 }, // total=10 I1✓ I2✓ I3✓ I4✓ I5✓
    ],
    emptyCellsRange: [6, 6],
    bonusDisabled: false,
    estimatedDurationRange: [480, 660],
  },

  // ────────────────────────────────────────────────────────────────
  // PLATEAU 12 CASES — niveaux 9 à 13
  // ────────────────────────────────────────────────────────────────

  niveau_9: {
    // 9 types : tous sauf Chalet — 5 vides fixes
    // Nouveau plateau 12 cases. Introduction du Tas de buches (voisin Bucheron).
    // tas_buches >= 1 toujours. bucheron >= 1 si tas_buches > 0 (I7).
    // chien >= 2 si present (I4). ours >= 1 si ruche = 1 (I3). cerf = biche si presents (I5).
    // Transition douce : tas=1 majoritaire, quelques tas=2. Renard present dans la plupart.
    boardId: 'board_12',
    cellCount: 12,
    compositions: [
      // tas=1, renard=2, chien=2, ruche=1 (7 types actifs)
      { bucheron: 3, ours: 2, mouton: 1, chien: 2, renard: 2, tas_buches: 1, ruche: 1 }, // total=12 I1✓ I3✓ I4✓ I7✓
      { bucheron: 2, ours: 3, mouton: 1, chien: 2, renard: 2, tas_buches: 1, ruche: 1 }, // total=12 I1✓ I3✓ I4✓ I7✓
      { bucheron: 3, ours: 2, mouton: 2, chien: 2, renard: 2, tas_buches: 1, ruche: 0 }, // total=12 I1✓ I4✓ I7✓
      { bucheron: 2, ours: 3, mouton: 2, chien: 2, renard: 2, tas_buches: 1, ruche: 0 }, // total=12 I1✓ I4✓ I7✓
      { bucheron: 3, ours: 3, mouton: 1, chien: 2, renard: 2, tas_buches: 1, ruche: 0 }, // total=12 I1✓ I4✓ I7✓
      // tas=1, renard=2, sans chien, ruche=1 (6 types actifs)
      { bucheron: 3, ours: 3, mouton: 2, renard: 2, tas_buches: 1, ruche: 1 },           // total=12 I1✓ I3✓ I7✓
      { bucheron: 4, ours: 2, mouton: 2, renard: 2, tas_buches: 1, ruche: 1 },           // total=12 I1✓ I3✓ I7✓
      { bucheron: 3, ours: 2, mouton: 3, renard: 2, tas_buches: 1, ruche: 1 },           // total=12 I1✓ I3✓ I7✓
      // tas=1, avec cerf=1, biche=1, renard=2, chien=2, ruche=1 (9 types actifs)
      { bucheron: 2, ours: 1, mouton: 1, chien: 2, renard: 2, cerf: 1, biche: 1, tas_buches: 1, ruche: 1 }, // total=12 I1✓ I3✓ I4✓ I5✓ I7✓
      { bucheron: 1, ours: 2, mouton: 1, chien: 2, renard: 2, cerf: 1, biche: 1, tas_buches: 1, ruche: 1 }, // total=12 I1✓ I3✓ I4✓ I5✓ I7✓
      // tas=2, renard=2, sans chien, ruche=0 (5 types actifs)
      { bucheron: 3, ours: 3, mouton: 2, renard: 2, tas_buches: 2, ruche: 0 },           // total=12 I1✓ I7✓
      { bucheron: 4, ours: 2, mouton: 2, renard: 2, tas_buches: 2, ruche: 0 },           // total=12 I1✓ I7✓
    ],
    emptyCellsRange: [5, 5],
    bonusDisabled: false,
    estimatedDurationRange: [360, 540],
  },

  niveau_10: {
    // 9 types : tous sauf Chalet — 6 vides fixes
    // Meme palette que niv 9, plus de cases vides = plus difficile.
    // tas_buches >= 1 toujours. bucheron >= 1 si tas_buches > 0 (I7).
    // chien >= 2 si present (I4). ours >= 1 si ruche = 1 (I3). cerf = biche si presents (I5).
    // Tas=2 plus frequent. Compositions plus asymetriques.
    boardId: 'board_12',
    cellCount: 12,
    compositions: [
      // tas=1, renard=2, chien=2, ruche=0 (6 types actifs)
      { bucheron: 3, ours: 2, mouton: 2, chien: 2, renard: 2, tas_buches: 1, ruche: 0 }, // total=12 I1✓ I4✓ I7✓
      { bucheron: 2, ours: 3, mouton: 2, chien: 2, renard: 2, tas_buches: 1, ruche: 0 }, // total=12 I1✓ I4✓ I7✓
      { bucheron: 3, ours: 3, mouton: 1, chien: 2, renard: 2, tas_buches: 1, ruche: 0 }, // total=12 I1✓ I4✓ I7✓
      // tas=2, renard=2, chien=2, ruche=0 (6 types actifs)
      { bucheron: 3, ours: 2, mouton: 1, chien: 2, renard: 2, tas_buches: 2, ruche: 0 }, // total=12 I1✓ I4✓ I7✓
      { bucheron: 2, ours: 2, mouton: 2, chien: 2, renard: 2, tas_buches: 2, ruche: 0 }, // total=12 I1✓ I4✓ I7✓
      // tas=1, renard=2, chien=2, ruche=1 (7 types actifs)
      { bucheron: 2, ours: 2, mouton: 2, chien: 2, renard: 2, tas_buches: 1, ruche: 1 }, // total=12 I1✓ I3✓ I4✓ I7✓
      { bucheron: 3, ours: 2, mouton: 1, chien: 2, renard: 2, tas_buches: 1, ruche: 1 }, // total=12 I1✓ I3✓ I4✓ I7✓
      // tas=2, renard=2, sans chien, ruche=1 (6 types actifs)
      { bucheron: 3, ours: 2, mouton: 2, renard: 2, tas_buches: 2, ruche: 1 },           // total=12 I1✓ I3✓ I7✓
      { bucheron: 4, ours: 2, mouton: 1, renard: 2, tas_buches: 2, ruche: 1 },           // total=12 I1✓ I3✓ I7✓
      { bucheron: 3, ours: 3, mouton: 0, renard: 2, tas_buches: 2, ruche: 1 },           // total=12 I1✓ I3✓ I7✓
      // tas=1, cerf=1, biche=1, chien=2, ruche=1 (9 types actifs)
      { bucheron: 2, ours: 1, mouton: 1, chien: 2, renard: 2, cerf: 1, biche: 1, tas_buches: 1, ruche: 1 }, // total=12 I1✓ I3✓ I4✓ I5✓ I7✓
      { bucheron: 1, ours: 2, mouton: 1, chien: 2, renard: 2, cerf: 1, biche: 1, tas_buches: 1, ruche: 1 }, // total=12 I1✓ I3✓ I4✓ I5✓ I7✓
      // tas=2, renard=2, sans chien, ruche=0 (5 types actifs)
      { bucheron: 3, ours: 3, mouton: 2, renard: 2, tas_buches: 2, ruche: 0 },           // total=12 I1✓ I7✓
    ],
    emptyCellsRange: [6, 6],
    bonusDisabled: false,
    estimatedDurationRange: [480, 720],
  },

  niveau_11: {
    // 10 types : tous les elements du jeu — 7 vides fixes
    // Introduction du Chalet (voisin Bucheron obligatoire).
    // bucheron >= chalet toujours (I6). bucheron >= 1 si tas_buches > 0 (I7).
    // chien >= 2 si present (I4). ours >= 1 si ruche = 1 (I3). cerf = biche si presents (I5).
    // Transition douce : chalet=2 majoritaire, quelques chalet=3. Renard present dans la plupart.
    boardId: 'board_12',
    cellCount: 12,
    compositions: [
      // chalet=2, renard=2, ruche=1, sans chien (6 types actifs)
      { bucheron: 3, ours: 2, mouton: 2, renard: 2, chalet: 2, ruche: 1 },           // total=12 I1✓ I3✓ I6✓(3≥2)
      { bucheron: 4, ours: 2, mouton: 1, renard: 2, chalet: 2, ruche: 1 },           // total=12 I1✓ I3✓ I6✓(4≥2)
      { bucheron: 3, ours: 3, mouton: 1, renard: 2, chalet: 2, ruche: 1 },           // total=12 I1✓ I3✓ I6✓(3≥2)
      // chalet=2, renard=2, ruche=0, chien=2 (6 types actifs)
      { bucheron: 3, ours: 2, mouton: 1, chien: 2, renard: 2, chalet: 2 },           // total=12 I1✓ I4✓ I6✓(3≥2)
      { bucheron: 4, ours: 2, mouton: 0, chien: 2, renard: 2, chalet: 2 },           // total=12 I1✓ I4✓ I6✓(4≥2)
      { bucheron: 3, ours: 3, mouton: 0, chien: 2, renard: 2, chalet: 2 },           // total=12 I1✓ I4✓ I6✓(3≥2)
      // chalet=3, renard=2, ruche=1, sans chien (6 types actifs)
      { bucheron: 4, ours: 2, mouton: 0, renard: 2, chalet: 3, ruche: 1 },           // total=12 I1✓ I3✓ I6✓(4≥3)
      { bucheron: 4, ours: 1, mouton: 1, renard: 2, chalet: 3, ruche: 1 },           // total=12 I1✓ I3✓ I6✓(4≥3)
      // chalet=2, tas_buches=1, renard=2, ruche=1, sans chien (7 types actifs)
      { bucheron: 3, ours: 2, mouton: 1, renard: 2, chalet: 2, tas_buches: 1, ruche: 1 }, // total=12 I1✓ I3✓ I6✓ I7✓
      { bucheron: 4, ours: 2, mouton: 0, renard: 2, chalet: 2, tas_buches: 1, ruche: 1 }, // total=12 I1✓ I3✓ I6✓ I7✓
      // chalet=3, tas_buches=1, ruche=1, sans chien (7 types actifs)
      { bucheron: 4, ours: 2, mouton: 1, chalet: 3, tas_buches: 1, ruche: 1 },       // total=12 I1✓ I3✓ I6✓(4≥3) I7✓
      // chalet=2, renard=2, chien=2, ruche=1 (7 types actifs)
      { bucheron: 3, ours: 2, mouton: 2, chien: 2, renard: 2, chalet: 1, ruche: 0 }, // total=12 I1✓ I4✓ I6✓(3≥1)
    ],
    emptyCellsRange: [7, 7],
    bonusDisabled: false,
    estimatedDurationRange: [600, 900],
  },

  niveau_12: {
    // 10 types : tous les elements du jeu — 8 vides fixes
    // Meme palette que niv 11, plus de cases vides = plus difficile.
    // bucheron >= chalet toujours (I6). bucheron >= 1 si tas_buches > 0 (I7).
    // chien >= 2 si present (I4). ours >= 1 si ruche = 1 (I3). cerf = biche si presents (I5).
    // Compositions plus complexes : plus de types actifs simultanement.
    boardId: 'board_12',
    cellCount: 12,
    compositions: [
      // chalet=2, renard=2, tas_buches=1, ruche=1, sans chien (7 types actifs)
      { bucheron: 3, ours: 2, mouton: 1, renard: 2, chalet: 2, tas_buches: 1, ruche: 1 }, // total=12 I1✓ I3✓ I6✓ I7✓
      { bucheron: 4, ours: 2, mouton: 0, renard: 2, chalet: 2, tas_buches: 1, ruche: 1 }, // total=12 I1✓ I3✓ I6✓ I7✓
      { bucheron: 3, ours: 3, mouton: 0, renard: 2, chalet: 2, tas_buches: 1, ruche: 1 }, // total=12 I1✓ I3✓ I6✓ I7✓
      // chalet=2, renard=2, chien=2, ruche=0 (6 types actifs)
      { bucheron: 3, ours: 2, mouton: 1, chien: 2, renard: 2, chalet: 2 },           // total=12 I1✓ I4✓ I6✓(3≥2)
      { bucheron: 4, ours: 2, mouton: 0, chien: 2, renard: 2, chalet: 2 },           // total=12 I1✓ I4✓ I6✓(4≥2)
      // chalet=3, renard=2, ruche=1, sans chien (6 types actifs)
      { bucheron: 4, ours: 2, mouton: 0, renard: 2, chalet: 3, ruche: 1 },           // total=12 I1✓ I3✓ I6✓(4≥3)
      { bucheron: 4, ours: 1, mouton: 1, renard: 2, chalet: 3, ruche: 1 },           // total=12 I1✓ I3✓ I6✓(4≥3)
      // chalet=2, cerf=1, biche=1, ruche=1, sans chien (7 types actifs)
      { bucheron: 3, ours: 2, mouton: 1, cerf: 1, biche: 1, chalet: 2, ruche: 1 },   // total=12 I1✓ I3✓ I5✓ I6✓
      { bucheron: 4, ours: 2, mouton: 0, cerf: 1, biche: 1, chalet: 3, ruche: 1 },   // total=12 I1✓ I3✓ I5✓ I6✓(4≥3)
      // chalet=2, renard=2, chien=2, ruche=1 (7 types actifs)
      { bucheron: 4, ours: 2, mouton: 1, chien: 2, renard: 2, chalet: 1, ruche: 0 }, // total=12 I1✓ I4✓ I6✓(4≥1)
      { bucheron: 3, ours: 2, mouton: 0, chien: 2, renard: 2, chalet: 2, ruche: 1 }, // total=12 I1✓ I3✓ I4✓ I6✓
      // chalet=2, tas_buches=1, renard=2, chien=2, ruche=0 (7 types actifs)
      { bucheron: 3, ours: 2, mouton: 1, chien: 2, renard: 2, chalet: 1, tas_buches: 1 }, // total=12 I1✓ I4✓ I6✓ I7✓
      // chalet=3, tas_buches=1, renard=2, ruche=1, sans chien (7 types actifs)
      { bucheron: 4, ours: 3, mouton: 0, renard: 2, chalet: 2, ruche: 1 },           // total=12 I1✓ I3✓ I6✓(4≥2)
      // chalet=2, renard=2, ruche=1, sans chien (6 types actifs)
      { bucheron: 4, ours: 2, mouton: 2, renard: 2, chalet: 2, ruche: 0 },           // total=12 I1✓ I6✓(4≥2)
      { bucheron: 3, ours: 3, mouton: 1, renard: 2, chalet: 2, ruche: 1 },           // total=12 I1✓ I3✓ I6✓(3≥2)
    ],
    emptyCellsRange: [8, 8],
    bonusDisabled: false,
    estimatedDurationRange: [600, 900],
  },

  niveau_13: {
    // 10 types : tous les elements du jeu — 8 vides fixes — bonus desactives
    // Meme compositions et meme nombre de vides que niv 12.
    // La difficulte vient uniquement de l'absence totale de bonus.
    // bucheron >= chalet (I6). bucheron >= 1 si tas_buches > 0 (I7).
    boardId: 'board_12',
    cellCount: 12,
    compositions: [
      // chalet=2, renard=2, tas_buches=1, ruche=1, sans chien (7 types actifs)
      { bucheron: 3, ours: 2, mouton: 1, renard: 2, chalet: 2, tas_buches: 1, ruche: 1 }, // total=12 I1✓ I3✓ I6✓ I7✓
      { bucheron: 4, ours: 2, mouton: 0, renard: 2, chalet: 2, tas_buches: 1, ruche: 1 }, // total=12 I1✓ I3✓ I6✓ I7✓
      { bucheron: 3, ours: 3, mouton: 0, renard: 2, chalet: 2, tas_buches: 1, ruche: 1 }, // total=12 I1✓ I3✓ I6✓ I7✓
      // chalet=2, renard=2, chien=2, ruche=0 (6 types actifs)
      { bucheron: 3, ours: 2, mouton: 1, chien: 2, renard: 2, chalet: 2 },           // total=12 I1✓ I4✓ I6✓(3≥2)
      { bucheron: 4, ours: 2, mouton: 0, chien: 2, renard: 2, chalet: 2 },           // total=12 I1✓ I4✓ I6✓(4≥2)
      // chalet=3, renard=2, ruche=1, sans chien (6 types actifs)
      { bucheron: 4, ours: 2, mouton: 0, renard: 2, chalet: 3, ruche: 1 },           // total=12 I1✓ I3✓ I6✓(4≥3)
      { bucheron: 4, ours: 1, mouton: 1, renard: 2, chalet: 3, ruche: 1 },           // total=12 I1✓ I3✓ I6✓(4≥3)
      // chalet=2, cerf=1, biche=1, ruche=1, sans chien (7 types actifs)
      { bucheron: 3, ours: 2, mouton: 1, cerf: 1, biche: 1, chalet: 2, ruche: 1 },   // total=12 I1✓ I3✓ I5✓ I6✓
      { bucheron: 4, ours: 2, mouton: 0, cerf: 1, biche: 1, chalet: 3, ruche: 1 },   // total=12 I1✓ I3✓ I5✓ I6✓(4≥3)
      // chalet=2, renard=2, chien=2, ruche=1 (7 types actifs)
      { bucheron: 4, ours: 2, mouton: 1, chien: 2, renard: 2, chalet: 1, ruche: 0 }, // total=12 I1✓ I4✓ I6✓(4≥1)
      { bucheron: 3, ours: 2, mouton: 0, chien: 2, renard: 2, chalet: 2, ruche: 1 }, // total=12 I1✓ I3✓ I4✓ I6✓
      // chalet=2, tas_buches=1, renard=2, chien=2, ruche=0 (7 types actifs)
      { bucheron: 3, ours: 2, mouton: 1, chien: 2, renard: 2, chalet: 1, tas_buches: 1 }, // total=12 I1✓ I4✓ I6✓ I7✓
      // chalet=2, renard=2, ruche=1, sans chien (6 types actifs)
      { bucheron: 4, ours: 3, mouton: 0, renard: 2, chalet: 2, ruche: 1 },           // total=12 I1✓ I3✓ I6✓(4≥2)
      { bucheron: 4, ours: 2, mouton: 2, renard: 2, chalet: 2, ruche: 0 },           // total=12 I1✓ I6✓(4≥2)
      { bucheron: 3, ours: 3, mouton: 1, renard: 2, chalet: 2, ruche: 1 },           // total=12 I1✓ I3✓ I6✓(3≥2)
    ],
    emptyCellsRange: [8, 8],
    bonusDisabled: true,
    estimatedDurationRange: [900, 1500],
  },
};

// Note : DifficultyLevel est défini dans Challenge.ts et ré-exporté ici
// pour la compatibilité avec les imports existants
