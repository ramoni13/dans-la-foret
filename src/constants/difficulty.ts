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
//   Niv 6  : 9 cases,  4 vides  ★ NOUVEAU
//   Niv 7  : 10 cases, 4 vides  (ex niv 6)
//   Niv 8  : 10 cases, 5 vides  (ex niv 7)
//   Niv 9  : 10 cases, 6 vides  (ex niv 8)
//   Niv 10 : 11 cases, 5 vides  ★ NOUVEAU
//   Niv 11 : 12 cases, 5 vides  (ex niv 9)
//   Niv 12 : 12 cases, 6 vides  (ex niv 10)
//   Niv 13 : 12 cases, 7 vides  (ex niv 11)
//   Niv 14 : 12 cases, 8 vides  (ex niv 12)
//   Niv 15 : 12 cases, 9 vides  (ex niv 13) — bonus désactivés
//
// Nouveaux éléments introduits progressivement :
//   Niv 1-2  : Mouton, Bucheron, Ours, Ruche (max 1, voisin Ours obligatoire)
//   Niv 3-4  : + Chien (meute connexe, chien >= 2 toujours)
//   Niv 5-6  : + Cerf + Biche (couples 1-pour-1, cerf = biche en quantité)
//   Niv 7-9  : + Renard (répulsion Renard/Mouton)
//   Niv 11-12: + Tas de bûches (voisin Bucheron, + voisin Chalet si présent)
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
  | 'niveau_6'   // 9 cases — Lisière Étendue (NOUVEAU)
  | 'niveau_7' | 'niveau_8' | 'niveau_9'   // ex niv 6, 7, 8 (10 cases)
  | 'niveau_10'  // 11 cases — Sous-bois Profond (NOUVEAU)
  | 'niveau_11' | 'niveau_12' | 'niveau_13' | 'niveau_14' | 'niveau_15'; // ex niv 9–13 (12 cases)

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
    // 5 types : Bucheron, Ours, Mouton, Ruche, Chien - 3 vides
    // Introduction du Chien (regle meute connexe). chien=2 toujours (I4).
    // ruche optionnelle (I2). ours >= 1 si ruche = 1 (I3).
    // board_8_v2 v2 : connexion 6-7 ajoutee, symétrie brisée — compositions libres.
    boardId: 'board_8_v2',
    cellCount: 8,
    compositions: [
      // chien=2 + ruche=1 (5 types)
      { bucheron: 2, ours: 2, mouton: 1, chien: 2, ruche: 1 }, // total=8 I1 I2 I3 I4
      { bucheron: 2, ours: 1, mouton: 2, chien: 2, ruche: 1 }, // total=8 I1 I2 I3 I4
      { bucheron: 1, ours: 2, mouton: 2, chien: 2, ruche: 1 }, // total=8 I1 I2 I3 I4
      { bucheron: 3, ours: 1, mouton: 1, chien: 2, ruche: 1 }, // total=8 I1 I2 I3 I4
      { bucheron: 1, ours: 3, mouton: 1, chien: 2, ruche: 1 }, // total=8 I1 I2 I3 I4
      { bucheron: 1, ours: 1, mouton: 3, chien: 2, ruche: 1 }, // total=8 I1 I2 I3 I4
      { bucheron: 3, ours: 2, mouton: 0, chien: 2, ruche: 1 }, // total=8 I1 I2 I3 I4
      { bucheron: 0, ours: 3, mouton: 2, chien: 2, ruche: 1 }, // total=8 I1 I2 I3 I4
      { bucheron: 2, ours: 3, mouton: 0, chien: 2, ruche: 1 }, // total=8 I1 I2 I3 I4
      { bucheron: 0, ours: 2, mouton: 3, chien: 2, ruche: 1 }, // total=8 I1 I2 I3 I4
      // chien=2 sans ruche (4 types)
      { bucheron: 3, ours: 2, mouton: 1, chien: 2 },           // total=8 I1 I4
      { bucheron: 2, ours: 3, mouton: 1, chien: 2 },           // total=8 I1 I4
      { bucheron: 2, ours: 2, mouton: 2, chien: 2 },           // total=8 I1 I4
      { bucheron: 3, ours: 1, mouton: 2, chien: 2 },           // total=8 I1 I4
      { bucheron: 1, ours: 3, mouton: 2, chien: 2 },           // total=8 I1 I4
      { bucheron: 1, ours: 2, mouton: 3, chien: 2 },           // total=8 I1 I4
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
    // 2 couples cerf/biche possibles (cerf=2, biche=2) sur 8 cases.
    boardId: 'board_8_v2',
    cellCount: 8,
    compositions: [
      // 1 couple — Sans chien, ruche=1 (5 types actifs)
      { bucheron: 2, ours: 2, mouton: 1, cerf: 1, biche: 1, ruche: 1 }, // total=8 I1✓ I2✓ I3✓ I5✓
      { bucheron: 3, ours: 1, mouton: 1, cerf: 1, biche: 1, ruche: 1 }, // total=8 I1✓ I2✓ I3✓ I5✓
      { bucheron: 1, ours: 3, mouton: 1, cerf: 1, biche: 1, ruche: 1 }, // total=8 I1✓ I2✓ I3✓ I5✓
      { bucheron: 2, ours: 1, mouton: 2, cerf: 1, biche: 1, ruche: 1 }, // total=8 I1✓ I2✓ I3✓ I5✓
      // 1 couple — Avec chien=2, ruche=1 (6 types actifs)
      { bucheron: 1, ours: 2, mouton: 0, chien: 2, cerf: 1, biche: 1, ruche: 1 }, // total=8 I1✓ I2✓ I3✓ I4✓ I5✓
      { bucheron: 2, ours: 1, mouton: 0, chien: 2, cerf: 1, biche: 1, ruche: 1 }, // total=8 I1✓ I2✓ I3✓ I4✓ I5✓
      { bucheron: 0, ours: 2, mouton: 1, chien: 2, cerf: 1, biche: 1, ruche: 1 }, // total=8 I1✓ I2✓ I3✓ I4✓ I5✓
      { bucheron: 1, ours: 1, mouton: 1, chien: 2, cerf: 1, biche: 1, ruche: 1 }, // total=8 I1✓ I2✓ I3✓ I4✓ I5✓
      // 1 couple — Avec chien=2, sans ruche (5 types actifs)
      { bucheron: 2, ours: 2, mouton: 0, chien: 2, cerf: 1, biche: 1 },           // total=8 I1✓ I4✓ I5✓
      { bucheron: 3, ours: 1, mouton: 0, chien: 2, cerf: 1, biche: 1 },           // total=8 I1✓ I4✓ I5✓
      // 2 couples — Sans chien, sans ruche (3 types actifs)
      { bucheron: 2, ours: 2, mouton: 0, cerf: 2, biche: 2 },                     // total=8 I1✓ I5✓
      { bucheron: 3, ours: 1, mouton: 0, cerf: 2, biche: 2 },                     // total=8 I1✓ I5✓
      { bucheron: 1, ours: 3, mouton: 0, cerf: 2, biche: 2 },                     // total=8 I1✓ I5✓
      // 2 couples — Avec chien=2, sans ruche (4 types actifs)
      { bucheron: 2, ours: 0, mouton: 0, chien: 2, cerf: 2, biche: 2 },           // total=8 I1✓ I4✓ I5✓
      { bucheron: 0, ours: 2, mouton: 0, chien: 2, cerf: 2, biche: 2 },           // total=8 I1✓ I4✓ I5✓
    ],
    emptyCellsRange: [5, 5],
    bonusDisabled: false,
    estimatedDurationRange: [300, 480],
  },

  // ────────────────────────────────────────────────────────────────
  // PLATEAU 9 CASES — niveau 6 (NOUVEAU)
  // ────────────────────────────────────────────────────────────────

  niveau_6: {
    // 7 types : Bucheron, Ours, Mouton, Ruche, Chien, Cerf, Biche — 4 vides fixes
    // Nouveau plateau 9 cases (board_9_v1). Meme palette que niv 5, une case de plus.
    // cerf = biche toujours (I5). chien >= 2 si present (I4). ours >= 1 si ruche = 1 (I3).
    // Objectif diversité : chien présent dans ≥7 compos, ruche dans ≥7 compos.
    boardId: 'board_9_v1',
    cellCount: 9,
    compositions: [
      // 1 couple — chien=2, ruche=1 (7 types actifs) — sur 9 cases : chien+cerf+biche+ruche=5, reste 4 pour buch+ours+mouton
      { bucheron: 2, ours: 1, mouton: 1, chien: 2, cerf: 1, biche: 1, ruche: 1 }, // 2+1+1+2+1+1+1=9 I1✓ I2✓ I3✓ I4✓ I5✓
      { bucheron: 1, ours: 2, mouton: 1, chien: 2, cerf: 1, biche: 1, ruche: 1 }, // 1+2+1+2+1+1+1=9 I1✓ I2✓ I3✓ I4✓ I5✓
      { bucheron: 1, ours: 1, mouton: 2, chien: 2, cerf: 1, biche: 1, ruche: 1 }, // 1+1+2+2+1+1+1=9 I1✓ I2✓ I3✓ I4✓ I5✓
      { bucheron: 2, ours: 2, mouton: 0, chien: 2, cerf: 1, biche: 1, ruche: 1 }, // 2+2+0+2+1+1+1=9 I1✓ I2✓ I3✓ I4✓ I5✓
      // 1 couple — chien=2, sans ruche (5 types actifs) — chien+cerf+biche=4, reste 5 pour buch+ours+mouton
      { bucheron: 2, ours: 2, mouton: 1, chien: 2, cerf: 1, biche: 1 },           // 2+2+1+2+1+1=9   I1✓ I4✓ I5✓
      { bucheron: 2, ours: 1, mouton: 2, chien: 2, cerf: 1, biche: 1 },           // 2+1+2+2+1+1=9   I1✓ I4✓ I5✓
      { bucheron: 1, ours: 2, mouton: 2, chien: 2, cerf: 1, biche: 1 },           // 1+2+2+2+1+1=9   I1✓ I4✓ I5✓
      { bucheron: 3, ours: 1, mouton: 1, chien: 2, cerf: 1, biche: 1 },           // 3+1+1+2+1+1=9   I1✓ I4✓ I5✓
      // 1 couple — ruche=1, sans chien (5 types actifs) — cerf+biche+ruche=3, reste 6 pour buch+ours+mouton
      { bucheron: 2, ours: 2, mouton: 2, cerf: 1, biche: 1, ruche: 1 },           // 2+2+2+1+1+1=9   I1✓ I2✓ I3✓ I5✓
      { bucheron: 3, ours: 2, mouton: 1, cerf: 1, biche: 1, ruche: 1 },           // 3+2+1+1+1+1=9   I1✓ I2✓ I3✓ I5✓
      { bucheron: 2, ours: 3, mouton: 1, cerf: 1, biche: 1, ruche: 1 },           // 2+3+1+1+1+1=9   I1✓ I2✓ I3✓ I5✓
      { bucheron: 1, ours: 3, mouton: 2, cerf: 1, biche: 1, ruche: 1 },           // 1+3+2+1+1+1=9   I1✓ I2✓ I3✓ I5✓
      // 2 couples — chien=2, sans ruche (4 types actifs) — chien+cerf*2+biche*2=6, reste 3 pour buch+ours+mouton
      { bucheron: 2, ours: 1, mouton: 0, chien: 2, cerf: 2, biche: 2 },           // 2+1+0+2+2+2=9   I1✓ I4✓ I5✓
      { bucheron: 1, ours: 2, mouton: 0, chien: 2, cerf: 2, biche: 2 },           // 1+2+0+2+2+2=9   I1✓ I4✓ I5✓
      // 1 couple — sans chien, sans ruche (4 types actifs) — cerf+biche=2, reste 7 pour buch+ours+mouton
      { bucheron: 3, ours: 2, mouton: 2, cerf: 1, biche: 1 },                     // 3+2+2+1+1=9     I1✓ I5✓
    ],
    emptyCellsRange: [4, 4],
    bonusDisabled: false,
    estimatedDurationRange: [270, 420],
  },

  // ────────────────────────────────────────────────────────────────
  // PLATEAU 10 CASES — niveaux 7, 8, 9 (ex 6, 7, 8)
  // ────────────────────────────────────────────────────────────────

  niveau_7: {
    // 7 types : Bucheron, Ours, Mouton, Ruche, Chien, Cerf, Biche — 4 vides fixes
    // Nouveau plateau 10 cases. Meme palette que niv 5, plus d'espace.
    // cerf = biche toujours (I5). chien >= 2 si present (I4). ours >= 1 si ruche = 1 (I3).
    // Objectif diversité : chien dans ≥8 compos, ruche dans ≥8 compos.
    // bucheron <= 3 max (bucheron=4 sur 10 cases laisse trop peu de solutions valides)
    boardId: 'board_10_v3',
    cellCount: 10,
    compositions: [
      // 1 couple — ruche=1, chien=2, mouton présent (7 types actifs) — variété max
      { bucheron: 2, ours: 2, mouton: 1, chien: 2, cerf: 1, biche: 1, ruche: 1 }, // total=10 I1✓ I2✓ I3✓ I4✓ I5✓
      { bucheron: 2, ours: 1, mouton: 2, chien: 2, cerf: 1, biche: 1, ruche: 1 }, // total=10 I1✓ I2✓ I3✓ I4✓ I5✓
      { bucheron: 1, ours: 2, mouton: 2, chien: 2, cerf: 1, biche: 1, ruche: 1 }, // total=10 I1✓ I2✓ I3✓ I4✓ I5✓
      { bucheron: 3, ours: 1, mouton: 1, chien: 2, cerf: 1, biche: 1, ruche: 1 }, // total=10 I1✓ I2✓ I3✓ I4✓ I5✓
      { bucheron: 1, ours: 3, mouton: 1, chien: 2, cerf: 1, biche: 1, ruche: 1 }, // total=10 I1✓ I2✓ I3✓ I4✓ I5✓
      // 1 couple — ruche=1, sans chien, mouton présent (6 types actifs)
      // cerf+biche+ruche=3, reste 7 pour buch+ours+mouton: 3+2+2=7 ✓, 2+3+2=7 ✓, 4+2+1=7 ✓
      { bucheron: 3, ours: 2, mouton: 2, cerf: 1, biche: 1, ruche: 1 },           // 3+2+2+1+1+1=10 I1✓ I2✓ I3✓ I5✓
      { bucheron: 2, ours: 3, mouton: 2, cerf: 1, biche: 1, ruche: 1 },           // 2+3+2+1+1+1=10 I1✓ I2✓ I3✓ I5✓
      { bucheron: 4, ours: 2, mouton: 1, cerf: 1, biche: 1, ruche: 1 },           // 4+2+1+1+1+1=10 I1✓ I2✓ I3✓ I5✓
      // 1 couple — chien=2, ruche=1, mouton=0 (6 types actifs)
      // chien+cerf+biche+ruche=5, reste 5 pour buch+ours: 3+2=5 ✓, 2+3=5 ✓
      { bucheron: 3, ours: 2, mouton: 0, chien: 2, cerf: 1, biche: 1, ruche: 1 }, // 3+2+0+2+1+1+1=10 I1✓ I2✓ I3✓ I4✓ I5✓
      { bucheron: 2, ours: 3, mouton: 0, chien: 2, cerf: 1, biche: 1, ruche: 1 }, // 2+3+0+2+1+1+1=10 I1✓ I2✓ I3✓ I4✓ I5✓
      // 1 couple — chien=2, sans ruche (5 types actifs)
      // chien+cerf+biche=4, reste 6 pour buch+ours+mouton: 2+2+2=6 ✓, 3+2+1=6 ✓
      { bucheron: 2, ours: 2, mouton: 2, chien: 2, cerf: 1, biche: 1 },           // 2+2+2+2+1+1=10 I1✓ I4✓ I5✓
      { bucheron: 3, ours: 2, mouton: 1, chien: 2, cerf: 1, biche: 1 },           // 3+2+1+2+1+1=10 I1✓ I4✓ I5✓
      // 2 couples — chien=2, sans ruche (4 types actifs)
      // chien+cerf*2+biche*2=6, reste 4 pour buch+ours+mouton: 2+2+0=4 ✓, 3+1+0=4 ✓
      { bucheron: 2, ours: 2, mouton: 0, chien: 2, cerf: 2, biche: 2 },           // 2+2+0+2+2+2=10 I1✓ I4✓ I5✓
      { bucheron: 3, ours: 1, mouton: 0, chien: 2, cerf: 2, biche: 2 },           // 3+1+0+2+2+2=10 I1✓ I4✓ I5✓
      // 2 couples — sans chien, sans ruche (3 types actifs)
      // cerf*2+biche*2=4, reste 6 pour buch+ours+mouton: 3+1+2=6 ✓
      { bucheron: 3, ours: 1, mouton: 2, cerf: 2, biche: 2 },                     // 3+1+2+2+2=10   I1✓ I5✓
      // 1 couple — sans chien, sans ruche (4 types actifs)
      // cerf+biche=2, reste 8 pour buch+ours+mouton: 3+2+3=8 ✓, 2+3+3=8 ✓
      { bucheron: 3, ours: 2, mouton: 3, cerf: 1, biche: 1 },                     // 3+2+3+1+1=10   I1✓ I5✓
      { bucheron: 2, ours: 3, mouton: 3, cerf: 1, biche: 1 },                     // 2+3+3+1+1=10   I1✓ I5✓
    ],
    emptyCellsRange: [4, 4],
    bonusDisabled: false,
    estimatedDurationRange: [270, 420],
  },

  niveau_8: {
    // 8 types : Bucheron, Ours, Mouton, Ruche, Chien, Cerf, Biche, Renard — 5 vides fixes
    // Introduction du Renard (repulsion Renard/Mouton).
    // renard >= 1 toujours. chien >= 2 si present (I4). ours >= 1 si ruche = 1 (I3).
    // cerf = biche si presents (I5).
    // Objectif diversité : ruche dans ≥7 compos, chien dans ≥7 compos, mouton dans ≥12 compos.
    // bucheron=4 limité à 2 compos max. Moutons présents même avec renard (tension narrative).
    boardId: 'board_10_v3',
    cellCount: 10,
    compositions: [
      // renard=2, chien=2, ruche=1, mouton présent (6 types actifs) — diversité max
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
      // renard=2, sans chien, sans ruche, mouton dominant (4 types)
      { bucheron: 3, ours: 2, mouton: 3, renard: 2 },                     // 3+2+3+2=10     I1✓
      // renard=2, chien=2, ruche=1, mouton=0 (tension renard/chien) (5 types actifs)
      { bucheron: 3, ours: 2, mouton: 0, chien: 2, renard: 2, ruche: 1 }, // 3+2+0+2+2+1=10 I1✓ I2✓ I3✓ I4✓
      { bucheron: 2, ours: 3, mouton: 0, chien: 2, renard: 2, ruche: 1 }, // 2+3+0+2+2+1=10 I1✓ I2✓ I3✓ I4✓
      // renard=3, chien=2, ruche=1, mouton présent (6 types actifs) — renard dominant
      { bucheron: 2, ours: 1, mouton: 1, chien: 2, renard: 3, ruche: 1 }, // 2+1+1+2+3+1=10 I1✓ I2✓ I3✓ I4✓
      { bucheron: 1, ours: 2, mouton: 1, chien: 2, renard: 3, ruche: 1 }, // 1+2+1+2+3+1=10 I1✓ I2✓ I3✓ I4✓
      // renard=3, sans chien, ruche=1, mouton présent (5 types actifs)
      { bucheron: 3, ours: 2, mouton: 1, renard: 3, ruche: 1 },           // 3+2+1+3+1=10   I1✓ I2✓ I3✓
      { bucheron: 2, ours: 3, mouton: 1, renard: 3, ruche: 1 },           // 2+3+1+3+1=10   I1✓ I2✓ I3✓
      // renard=3, sans chien, sans ruche, mouton présent (4 types)
      { bucheron: 3, ours: 2, mouton: 2, renard: 3 },                     // 3+2+2+3=10     I1✓
      { bucheron: 2, ours: 3, mouton: 2, renard: 3 },                     // 2+3+2+3=10     I1✓
      // 1 couple — renard=2, sans chien, sans ruche (5 types actifs) cerf+biche=2 cases
      { bucheron: 3, ours: 2, mouton: 1, renard: 2, cerf: 1, biche: 1 },  // 3+2+1+2+1+1=10 I1✓ I5✓
      { bucheron: 2, ours: 3, mouton: 1, renard: 2, cerf: 1, biche: 1 },  // 2+3+1+2+1+1=10 I1✓ I5✓
    ],
    emptyCellsRange: [5, 5],
    bonusDisabled: false,
    estimatedDurationRange: [360, 540],
  },

  niveau_9: {
    // 8 types : Bucheron, Ours, Mouton, Ruche, Chien, Cerf, Biche, Renard — 6 vides fixes
    // Meme palette que niv 8, plus de cases vides = plus difficile.
    // renard >= 1 toujours. chien >= 2 si present (I4). ours >= 1 si ruche = 1 (I3). cerf = biche si presents (I5).
    // Objectif diversité : mouton dans ≥8 compos, chien dans ≥8 compos, cerf/biche dans ≥4 compos.
    // renard dominant mais mouton toujours représenté sauf compos de type "tension extrême".
    boardId: 'board_10_v3',
    cellCount: 10,
    compositions: [
      // renard=2, chien=2, ruche=1, mouton présent (6 types actifs) — tension modérée
      { bucheron: 2, ours: 1, mouton: 1, chien: 2, renard: 3, ruche: 1 }, // 2+1+1+2+3+1=10 I1✓ I2✓ I3✓ I4✓
      { bucheron: 1, ours: 2, mouton: 1, chien: 2, renard: 3, ruche: 1 }, // 1+2+1+2+3+1=10 I1✓ I2✓ I3✓ I4✓
      { bucheron: 1, ours: 1, mouton: 2, chien: 2, renard: 3, ruche: 1 }, // 1+1+2+2+3+1=10 I1✓ I2✓ I3✓ I4✓
      // renard=3, chien=2, sans ruche, mouton présent (5 types actifs)
      { bucheron: 2, ours: 2, mouton: 1, chien: 2, renard: 3 },           // 2+2+1+2+3=10   I1✓ I4✓
      { bucheron: 3, ours: 1, mouton: 1, chien: 2, renard: 3 },           // 3+1+1+2+3=10   I1✓ I4✓
      { bucheron: 1, ours: 3, mouton: 1, chien: 2, renard: 3 },           // 1+3+1+2+3=10   I1✓ I4✓
      // renard=3, sans chien, ruche=1, mouton présent (5 types actifs)
      { bucheron: 3, ours: 2, mouton: 1, renard: 3, ruche: 1 },           // 3+2+1+3+1=10   I1✓ I2✓ I3✓
      { bucheron: 2, ours: 3, mouton: 1, renard: 3, ruche: 1 },           // 2+3+1+3+1=10   I1✓ I2✓ I3✓
      // renard=2, sans chien, ruche=1, mouton présent (5 types actifs)
      { bucheron: 3, ours: 2, mouton: 2, renard: 2, ruche: 1 },           // 3+2+2+2+1=10   I1✓ I2✓ I3✓
      { bucheron: 2, ours: 3, mouton: 2, renard: 2, ruche: 1 },           // 2+3+2+2+1=10   I1✓ I2✓ I3✓
      // renard=3, chien=2, mouton=0, ruche=1 (5 types actifs) — tension max
      { bucheron: 2, ours: 2, mouton: 0, chien: 2, renard: 3, ruche: 1 }, // 2+2+0+2+3+1=10 I1✓ I2✓ I3✓ I4✓
      { bucheron: 3, ours: 1, mouton: 0, chien: 2, renard: 3, ruche: 1 }, // 3+1+0+2+3+1=10 I1✓ I2✓ I3✓ I4✓
      // 1 couple — renard=2, chien=2, ruche=1 (8 types actifs)
      { bucheron: 2, ours: 1, mouton: 0, chien: 2, renard: 2, cerf: 1, biche: 1, ruche: 1 }, // 2+1+0+2+2+1+1+1=10 I1✓ I2✓ I3✓ I4✓ I5✓
      { bucheron: 1, ours: 2, mouton: 0, chien: 2, renard: 2, cerf: 1, biche: 1, ruche: 1 }, // 1+2+0+2+2+1+1+1=10 I1✓ I2✓ I3✓ I4✓ I5✓
      // 1 couple — renard=2, chien=2, sans ruche (7 types actifs) — mouton présent
      { bucheron: 2, ours: 1, mouton: 1, chien: 2, renard: 2, cerf: 1, biche: 1 }, // 2+1+1+2+2+1+1=10 I1✓ I4✓ I5✓
      { bucheron: 1, ours: 2, mouton: 1, chien: 2, renard: 2, cerf: 1, biche: 1 }, // 1+2+1+2+2+1+1=10 I1✓ I4✓ I5✓
    ],
    emptyCellsRange: [6, 6],
    bonusDisabled: false,
    estimatedDurationRange: [480, 660],
  },

  // ────────────────────────────────────────────────────────────────
  // PLATEAU 11 CASES — niveau 10 (NOUVEAU)
  // ────────────────────────────────────────────────────────────────

  niveau_10: {
    // 8 types : Bucheron, Ours, Mouton, Ruche, Chien, Cerf, Biche, Renard — 5 vides fixes
    // Nouveau plateau 11 cases (board_11_v1). Transition entre 10 et 12 cases.
    // renard present dans la plupart des compositions.
    // chien >= 2 si present (I4). ours >= 1 si ruche = 1 (I3). cerf = biche si presents (I5).
    // Objectif diversité : chien dans ≥6 compos, ruche dans ≥6 compos, mouton dans ≥10 compos.
    // Toutes les compos doivent être différentes (problème N10 actuel : 10/10 identiques).
    boardId: 'board_11_v1',
    cellCount: 11,
    compositions: [
      // renard=2, chien=2, ruche=1, mouton présent (6 types actifs)
      { bucheron: 2, ours: 2, mouton: 2, chien: 2, renard: 2, ruche: 1 },     // 2+2+2+2+2+1=11 I1✓ I2✓ I3✓ I4✓
      { bucheron: 3, ours: 2, mouton: 1, chien: 2, renard: 2, ruche: 1 },     // 3+2+1+2+2+1=11 I1✓ I2✓ I3✓ I4✓
      { bucheron: 2, ours: 3, mouton: 1, chien: 2, renard: 2, ruche: 1 },     // 2+3+1+2+2+1=11 I1✓ I2✓ I3✓ I4✓
      { bucheron: 2, ours: 2, mouton: 3, chien: 2, renard: 2, ruche: 0 },     // 2+2+3+2+2=11   I1✓ I4✓ (mouton dominant)
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
      // renard=3, sans chien, sans ruche, mouton présent (4 types actifs)
      { bucheron: 3, ours: 2, mouton: 3, renard: 3 },                         // 3+2+3+3=11     I1✓
      { bucheron: 3, ours: 3, mouton: 2, renard: 3 },                         // 3+3+2+3=11     I1✓
      // 1 couple — renard=2, chien=2, sans ruche (7 types actifs)
      { bucheron: 2, ours: 2, mouton: 1, chien: 2, renard: 2, cerf: 1, biche: 1 }, // 2+2+1+2+2+1+1=11 I1✓ I4✓ I5✓
      // 2 couples — renard=2, sans chien, ruche=1 (6 types actifs)
      { bucheron: 2, ours: 2, mouton: 1, renard: 2, cerf: 2, biche: 2 },      // 2+2+1+2+2+2=11 I1✓ I5✓
      { bucheron: 3, ours: 1, mouton: 1, renard: 2, cerf: 2, biche: 2 },      // 3+1+1+2+2+2=11 I1✓ I5✓
    ],
    emptyCellsRange: [5, 5],
    bonusDisabled: false,
    estimatedDurationRange: [420, 600],
  },

  // ────────────────────────────────────────────────────────────────
  // PLATEAU 12 CASES — niveaux 11 à 15 (ex 9 à 13)
  // ────────────────────────────────────────────────────────────────

  niveau_11: {
    // 9 types : tous sauf Chalet — 5 vides fixes
    // Nouveau plateau 12 cases. Introduction du Tas de buches (voisin Bucheron).
    // tas_buches >= 1 toujours. bucheron >= 1 si tas_buches > 0 (I7).
    // chien >= 2 si present (I4). ours >= 1 si ruche = 1 (I3). cerf = biche si presents (I5).
    // Objectif diversité : ruche dans ≥7 compos, chien dans ≥6 compos, mouton dans ≥10 compos.
    boardId: 'board_12',
    cellCount: 12,
    compositions: [
      // tas=1, renard=2, chien=2, ruche=1, mouton présent (7 types actifs)
      { bucheron: 3, ours: 2, mouton: 1, chien: 2, renard: 2, tas_buches: 1, ruche: 1 }, // 3+2+1+2+2+1+1=12 I1✓ I2✓ I3✓ I4✓ I7✓
      { bucheron: 2, ours: 3, mouton: 1, chien: 2, renard: 2, tas_buches: 1, ruche: 1 }, // 2+3+1+2+2+1+1=12 I1✓ I2✓ I3✓ I4✓ I7✓
      { bucheron: 2, ours: 2, mouton: 2, chien: 2, renard: 2, tas_buches: 1, ruche: 1 }, // 2+2+2+2+2+1+1=12 I1✓ I2✓ I3✓ I4✓ I7✓
      // tas=1, renard=2, chien=2, sans ruche, mouton présent (6 types actifs)
      { bucheron: 3, ours: 2, mouton: 2, chien: 2, renard: 2, tas_buches: 1 },           // 3+2+2+2+2+1=12  I1✓ I4✓ I7✓
      { bucheron: 2, ours: 3, mouton: 2, chien: 2, renard: 2, tas_buches: 1 },           // 2+3+2+2+2+1=12  I1✓ I4✓ I7✓
      { bucheron: 3, ours: 3, mouton: 1, chien: 2, renard: 2, tas_buches: 1 },           // 3+3+1+2+2+1=12  I1✓ I4✓ I7✓
      // tas=1, renard=2, sans chien, ruche=1, mouton présent (6 types actifs)
      { bucheron: 3, ours: 3, mouton: 2, renard: 2, tas_buches: 1, ruche: 1 },           // 3+3+2+2+1+1=12  I1✓ I2✓ I3✓ I7✓
      { bucheron: 4, ours: 2, mouton: 2, renard: 2, tas_buches: 1, ruche: 1 },           // 4+2+2+2+1+1=12  I1✓ I2✓ I3✓ I7✓
      { bucheron: 3, ours: 2, mouton: 3, renard: 2, tas_buches: 1, ruche: 1 },           // 3+2+3+2+1+1=12  I1✓ I2✓ I3✓ I7✓
      // 1 couple — tas=1, cerf=1, biche=1, renard=2, chien=2, ruche=1 (9 types actifs)
      { bucheron: 2, ours: 1, mouton: 1, chien: 2, renard: 2, cerf: 1, biche: 1, tas_buches: 1, ruche: 1 }, // 2+1+1+2+2+1+1+1+1=12 I1✓ I2✓ I3✓ I4✓ I5✓ I7✓
      { bucheron: 1, ours: 2, mouton: 1, chien: 2, renard: 2, cerf: 1, biche: 1, tas_buches: 1, ruche: 1 }, // 1+2+1+2+2+1+1+1+1=12 I1✓ I2✓ I3✓ I4✓ I5✓ I7✓
      // 2 couples — tas=1, cerf=2, biche=2, renard=2, sans chien, ruche=1 (7 types actifs)
      { bucheron: 2, ours: 2, mouton: 0, renard: 2, cerf: 2, biche: 2, tas_buches: 1, ruche: 1 }, // 2+2+0+2+2+2+1+1=12 I1✓ I2✓ I3✓ I5✓ I7✓
      { bucheron: 2, ours: 1, mouton: 1, renard: 2, cerf: 2, biche: 2, tas_buches: 1, ruche: 1 }, // 2+1+1+2+2+2+1+1=12 I1✓ I2✓ I3✓ I5✓ I7✓
      // tas=2, renard=2, sans chien, ruche=1, mouton présent (6 types actifs)
      { bucheron: 3, ours: 2, mouton: 2, renard: 2, tas_buches: 2, ruche: 1 },           // 3+2+2+2+2+1=12  I1✓ I2✓ I3✓ I7✓
    ],
    emptyCellsRange: [5, 5],
    bonusDisabled: false,
    estimatedDurationRange: [360, 540],
  },

  niveau_12: {
    // 9 types : tous sauf Chalet — 6 vides fixes
    // Meme palette que niv 11, plus de cases vides = plus difficile.
    // tas_buches >= 1 toujours. bucheron >= 1 si tas_buches > 0 (I7).
    // chien >= 2 si present (I4). ours >= 1 si ruche = 1 (I3). cerf = biche si presents (I5).
    // Objectif diversité : ruche dans ≥8 compos, chien dans ≥8 compos, mouton dans ≥12 compos.
    boardId: 'board_12',
    cellCount: 12,
    compositions: [
      // tas=1, renard=2, chien=2, ruche=1, mouton présent (7 types actifs)
      { bucheron: 2, ours: 2, mouton: 2, chien: 2, renard: 2, tas_buches: 1, ruche: 1 }, // 2+2+2+2+2+1+1=12 I1✓ I2✓ I3✓ I4✓ I7✓
      { bucheron: 3, ours: 2, mouton: 1, chien: 2, renard: 2, tas_buches: 1, ruche: 1 }, // 3+2+1+2+2+1+1=12 I1✓ I2✓ I3✓ I4✓ I7✓
      { bucheron: 2, ours: 3, mouton: 1, chien: 2, renard: 2, tas_buches: 1, ruche: 1 }, // 2+3+1+2+2+1+1=12 I1✓ I2✓ I3✓ I4✓ I7✓
      // tas=1, renard=2, chien=2, sans ruche, mouton présent (6 types actifs)
      { bucheron: 3, ours: 2, mouton: 2, chien: 2, renard: 2, tas_buches: 1 },           // 3+2+2+2+2+1=12  I1✓ I4✓ I7✓
      { bucheron: 2, ours: 3, mouton: 2, chien: 2, renard: 2, tas_buches: 1 },           // 2+3+2+2+2+1=12  I1✓ I4✓ I7✓
      { bucheron: 3, ours: 3, mouton: 1, chien: 2, renard: 2, tas_buches: 1 },           // 3+3+1+2+2+1=12  I1✓ I4✓ I7✓
      // tas=2, renard=2, chien=2, ruche=1, mouton présent (7 types actifs)
      { bucheron: 2, ours: 2, mouton: 1, chien: 2, renard: 2, tas_buches: 2, ruche: 1 }, // 2+2+1+2+2+2+1=12 I1✓ I2✓ I3✓ I4✓ I7✓
      { bucheron: 3, ours: 1, mouton: 1, chien: 2, renard: 2, tas_buches: 2, ruche: 1 }, // 3+1+1+2+2+2+1=12 I1✓ I2✓ I3✓ I4✓ I7✓
      // tas=1, renard=2, sans chien, ruche=1, mouton présent (6 types actifs)
      { bucheron: 3, ours: 3, mouton: 2, renard: 2, tas_buches: 1, ruche: 1 },           // 3+3+2+2+1+1=12  I1✓ I2✓ I3✓ I7✓
      { bucheron: 3, ours: 2, mouton: 3, renard: 2, tas_buches: 1, ruche: 1 },           // 3+2+3+2+1+1=12  I1✓ I2✓ I3✓ I7✓
      { bucheron: 4, ours: 2, mouton: 2, renard: 2, tas_buches: 1, ruche: 1 },           // 4+2+2+2+1+1=12  I1✓ I2✓ I3✓ I7✓
      // 1 couple — tas=1, cerf=1, biche=1, chien=2, ruche=1, mouton présent (9 types actifs)
      { bucheron: 2, ours: 1, mouton: 1, chien: 2, renard: 2, cerf: 1, biche: 1, tas_buches: 1, ruche: 1 }, // 2+1+1+2+2+1+1+1+1=12 I1✓ I2✓ I3✓ I4✓ I5✓ I7✓
      { bucheron: 1, ours: 2, mouton: 1, chien: 2, renard: 2, cerf: 1, biche: 1, tas_buches: 1, ruche: 1 }, // 1+2+1+2+2+1+1+1+1=12 I1✓ I2✓ I3✓ I4✓ I5✓ I7✓
      // 2 couples — tas=1, cerf=2, biche=2, renard=2, chien=2, ruche=1 (8 types actifs)
      { bucheron: 1, ours: 1, mouton: 0, chien: 2, renard: 2, cerf: 2, biche: 2, tas_buches: 1, ruche: 1 }, // 1+1+0+2+2+2+2+1+1=12 I1✓ I2✓ I3✓ I4✓ I5✓ I7✓
      // tas=2, renard=2, sans chien, ruche=1, mouton présent (6 types actifs)
      { bucheron: 3, ours: 2, mouton: 2, renard: 2, tas_buches: 2, ruche: 1 },           // 3+2+2+2+2+1=12  I1✓ I2✓ I3✓ I7✓
      { bucheron: 4, ours: 2, mouton: 1, renard: 2, tas_buches: 2, ruche: 1 },           // 4+2+1+2+2+1=12  I1✓ I2✓ I3✓ I7✓
    ],
    emptyCellsRange: [6, 6],
    bonusDisabled: false,
    estimatedDurationRange: [480, 720],
  },

  niveau_13: {
    // 10 types : tous les elements du jeu — 7 vides fixes
    // Introduction du Chalet (voisin Bucheron obligatoire).
    // bucheron >= chalet toujours (I6). bucheron >= 1 si tas_buches > 0 (I7).
    // chien >= 2 si present (I4). ours >= 1 si ruche = 1 (I3). cerf = biche si presents (I5).
    // Transition douce : chalet=2 majoritaire, quelques chalet=3.
    // Ajout de tas_buches dans plusieurs compositions (I7 respecté).
    // bucheron max 3 pour la plupart (sauf quand chalet >= 3 oblige I6).
    boardId: 'board_12',
    cellCount: 12,
    compositions: [
      // chalet=2, renard=2, ruche=1, sans chien (6 types actifs) — bucheron=3
      { bucheron: 3, ours: 2, mouton: 2, renard: 2, chalet: 2, ruche: 1 },           // total=12 I1✓ I3✓ I6✓(3≥2)
      { bucheron: 3, ours: 3, mouton: 1, renard: 2, chalet: 2, ruche: 1 },           // total=12 I1✓ I3✓ I6✓(3≥2)
      // chalet=2, renard=2, ruche=0, chien=2 (6 types actifs) — bucheron=3
      { bucheron: 3, ours: 2, mouton: 1, chien: 2, renard: 2, chalet: 2 },           // total=12 I1✓ I4✓ I6✓(3≥2)
      { bucheron: 3, ours: 3, mouton: 0, chien: 2, renard: 2, chalet: 2 },           // total=12 I1✓ I4✓ I6✓(3≥2)
      // chalet=2, tas_buches=1, renard=2, ruche=1, sans chien (7 types actifs) — bucheron=3
      { bucheron: 3, ours: 2, mouton: 1, renard: 2, chalet: 2, tas_buches: 1, ruche: 1 }, // total=12 I1✓ I3✓ I6✓ I7✓
      { bucheron: 3, ours: 3, mouton: 0, renard: 2, chalet: 2, tas_buches: 1, ruche: 1 }, // total=12 I1✓ I3✓ I6✓ I7✓
      // chalet=2, tas_buches=1, chien=2, ruche=0, mouton présent (6 types actifs) — bucheron=3
      // buch+ours+mouton = 12-2-1-2=7: 3+3+1=7 ✓
      { bucheron: 3, ours: 3, mouton: 1, chien: 2, chalet: 2, tas_buches: 1 },       // 3+3+1+2+2+1=12 I1✓ I4✓ I6✓ I7✓
      { bucheron: 3, ours: 2, mouton: 0, chien: 2, renard: 2, chalet: 2, tas_buches: 1 }, // total=12 I1✓ I4✓ I6✓ I7✓
      // chalet=3, renard=2, ruche=1, sans chien (6 types actifs) — bucheron=4 obligatoire I6
      { bucheron: 4, ours: 2, mouton: 0, renard: 2, chalet: 3, ruche: 1 },           // total=12 I1✓ I3✓ I6✓(4≥3)
      { bucheron: 4, ours: 1, mouton: 1, renard: 2, chalet: 3, ruche: 1 },           // total=12 I1✓ I3✓ I6✓(4≥3)
      // chalet=2, renard=2, chien=2, ruche=1 (7 types actifs) — bucheron=3
      { bucheron: 3, ours: 2, mouton: 2, chien: 2, renard: 2, chalet: 1, ruche: 0 }, // total=12 I1✓ I4✓ I6✓(3≥1)
      // 2 couples — chalet=2, cerf=2, biche=2, sans chien, ruche=1 (6 types actifs)
      // buch+ours = 12-2-2-2-1=5: 4+1=5 ✓ ou 3+2=5 ✓
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
    // 10 types : tous les elements du jeu — 8 vides fixes
    // Meme palette que niv 13, plus de cases vides = plus difficile.
    // bucheron >= chalet toujours (I6). bucheron >= 1 si tas_buches > 0 (I7).
    // chien >= 2 si present (I4). ours >= 1 si ruche = 1 (I3). cerf = biche si presents (I5).
    // Objectif diversité : chien dans ≥5 compos, mouton dans ≥8 compos.
    boardId: 'board_12',
    cellCount: 12,
    compositions: [
      // chalet=2, renard=2, chien=2, ruche=1, mouton=0 (6 types actifs)
      // buch+ours+mouton = 12-2-2-2-1=5, mouton=0 => buch+ours=5
      { bucheron: 3, ours: 2, mouton: 0, chien: 2, renard: 2, chalet: 2, ruche: 1 }, // 3+2+0+2+2+2+1=12 I1✓ I2✓ I3✓ I4✓ I6✓
      { bucheron: 2, ours: 3, mouton: 0, chien: 2, renard: 2, chalet: 2, ruche: 1 }, // 2+3+0+2+2+2+1=12 I1✓ I2✓ I3✓ I4✓ I6✓
      // chalet=2, renard=2, chien=2, sans ruche, mouton présent (6 types actifs)
      // buch+ours+mouton = 12-2-2-2=6, ex 3+2+1=6 ✓
      { bucheron: 3, ours: 2, mouton: 1, chien: 2, renard: 2, chalet: 2 },           // 3+2+1+2+2+2=12   I1✓ I4✓ I6✓(3≥2)
      { bucheron: 2, ours: 3, mouton: 1, chien: 2, renard: 2, chalet: 2 },           // 2+3+1+2+2+2=12   I1✓ I4✓ I6✓(2≥2)
      // chalet=2, tas_buches=1, chien=2, ruche=1, mouton=0 (6 types actifs)
      // buch+ours = 12-2-1-2-1=6, buch≥2: 4+2=6 ✓
      { bucheron: 4, ours: 2, mouton: 0, chien: 2, chalet: 2, tas_buches: 1, ruche: 1 }, // 4+2+0+2+2+1+1=12 I1✓ I2✓ I3✓ I4✓ I6✓ I7✓
      // chalet=2, renard=2, tas_buches=1, ruche=1, sans chien, mouton présent (7 types actifs)
      // buch+ours+mouton = 12-2-2-1-1=6, ex 3+2+1=6 ✓
      { bucheron: 3, ours: 2, mouton: 1, renard: 2, chalet: 2, tas_buches: 1, ruche: 1 }, // 3+2+1+2+2+1+1=12 I1✓ I2✓ I3✓ I6✓ I7✓
      { bucheron: 3, ours: 3, mouton: 0, renard: 2, chalet: 2, tas_buches: 1, ruche: 1 }, // 3+3+0+2+2+1+1=12 I1✓ I2✓ I3✓ I6✓ I7✓
      { bucheron: 3, ours: 3, mouton: 1, renard: 2, chalet: 2, ruche: 1 },               // 3+3+1+2+2+1=12   I1✓ I2✓ I3✓ I6✓
      // chalet=2, chien=2, renard=2, tas_buches=1, sans ruche, mouton=0 (6 types actifs)
      // buch+ours = 12-2-2-2-1=5, buch≥2: 3+2=5 ✓
      { bucheron: 3, ours: 2, mouton: 0, chien: 2, renard: 2, chalet: 2, tas_buches: 1 }, // 3+2+0+2+2+2+1=12 I1✓ I4✓ I6✓ I7✓
      // chalet=3, renard=2, ruche=1, sans chien (5 types actifs) — bucheron=4 obligatoire I6
      // buch+ours+mouton = 12-3-2-1=6, buch≥3: 4+2+0=6 ✓, 4+1+1=6 ✓
      { bucheron: 4, ours: 2, mouton: 0, renard: 2, chalet: 3, ruche: 1 },           // 4+2+0+2+3+1=12   I1✓ I2✓ I3✓ I6✓(4≥3)
      { bucheron: 4, ours: 1, mouton: 1, renard: 2, chalet: 3, ruche: 1 },           // 4+1+1+2+3+1=12   I1✓ I2✓ I3✓ I6✓(4≥3)
      // chalet=3, tas_buches=1, ruche=1, sans chien, sans renard (5 types actifs) — bucheron=4
      // buch+ours+mouton = 12-3-1-1=7, buch≥3: 4+2+1=7 ✓
      { bucheron: 4, ours: 2, mouton: 1, chalet: 3, tas_buches: 1, ruche: 1 },       // 4+2+1+3+1+1=12   I1✓ I2✓ I3✓ I6✓(4≥3) I7✓
      // chalet=2, chien=2, ruche=1, mouton présent (6 types actifs) — CHIEN nécessaire pour diversité
      // buch+ours+mouton = 12-2-2-1=7, buch≥2: 3+3+1=7 ✓, 4+2+1=7 ✓
      { bucheron: 3, ours: 3, mouton: 1, chien: 2, chalet: 2, ruche: 1 },            // 3+3+1+2+2+1=12   I1✓ I2✓ I3✓ I4✓ I6✓
      { bucheron: 4, ours: 2, mouton: 1, chien: 2, chalet: 2, ruche: 1 },            // 4+2+1+2+2+1=12   I1✓ I2✓ I3✓ I4✓ I6✓
      // 1 couple — chalet=2, cerf=1, biche=1, ruche=1, mouton présent (8 types actifs)
      // buch+ours+mouton = 12-1-1-2-1=7, ex 3+3+1=7 ✓
      { bucheron: 3, ours: 3, mouton: 1, cerf: 1, biche: 1, chalet: 2, ruche: 1 },   // 3+3+1+1+1+2+1=12 I1✓ I2✓ I3✓ I5✓ I6✓
      // 2 couples — chalet=2, cerf=2, biche=2, ruche=1, mouton=0 (6 types actifs)
      // buch+ours = 12-2-2-2-1=5, buch≥2: 3+2=5 ✓, 4+1=5 ✓
      { bucheron: 3, ours: 2, mouton: 0, cerf: 2, biche: 2, chalet: 2, ruche: 1 },   // 3+2+0+2+2+2+1=12 I1✓ I2✓ I3✓ I5✓ I6✓(3≥2)
      { bucheron: 4, ours: 1, mouton: 0, cerf: 2, biche: 2, chalet: 2, ruche: 1 },   // 4+1+0+2+2+2+1=12 I1✓ I2✓ I3✓ I5✓ I6✓(4≥2)
    ],
    emptyCellsRange: [8, 8],
    bonusDisabled: false,
    estimatedDurationRange: [600, 900],
  },

  niveau_15: {
    // 10 types : tous les elements du jeu — 9 vides fixes — bonus desactives
    // La difficulte vient de l'absence totale de bonus + 9 cases vides sur 12.
    // bucheron >= chalet (I6). bucheron >= 1 si tas_buches > 0 (I7).
    // Objectif diversité : chien dans ≥5 compos, mouton dans ≥7 compos, compositions toutes différentes.
    boardId: 'board_12',
    cellCount: 12,
    compositions: [
      // chalet=2, renard=2, chien=2, ruche=1, mouton=0 (6 types actifs)
      // buch+ours = 12-2-2-2-1=5: 3+2=5 ✓
      { bucheron: 3, ours: 2, mouton: 0, chien: 2, renard: 2, chalet: 2, ruche: 1 }, // 3+2+0+2+2+2+1=12 I1✓ I2✓ I3✓ I4✓ I6✓
      { bucheron: 2, ours: 3, mouton: 0, chien: 2, renard: 2, chalet: 2, ruche: 1 }, // 2+3+0+2+2+2+1=12 I1✓ I2✓ I3✓ I4✓ I6✓
      // chalet=2, renard=2, chien=2, sans ruche, mouton présent (6 types actifs)
      // buch+ours+mouton = 12-2-2-2=6: 3+2+1=6 ✓
      { bucheron: 3, ours: 2, mouton: 1, chien: 2, renard: 2, chalet: 2 },           // 3+2+1+2+2+2=12   I1✓ I4✓ I6✓(3≥2)
      { bucheron: 2, ours: 3, mouton: 1, chien: 2, renard: 2, chalet: 2 },           // 2+3+1+2+2+2=12   I1✓ I4✓ I6✓(2≥2)
      // chalet=2, tas_buches=1, renard=2, chien=2, ruche=0, mouton=0 (6 types actifs)
      // buch+ours = 12-2-1-2-2=5: 3+2=5 ✓
      { bucheron: 3, ours: 2, mouton: 0, chien: 2, renard: 2, chalet: 2, tas_buches: 1 }, // 3+2+0+2+2+2+1=12 I1✓ I4✓ I6✓ I7✓
      // chalet=2, renard=2, tas_buches=1, ruche=1, sans chien, mouton présent (7 types actifs)
      // buch+ours+mouton = 12-2-2-1-1=6: 3+2+1=6 ✓
      { bucheron: 3, ours: 2, mouton: 1, renard: 2, chalet: 2, tas_buches: 1, ruche: 1 }, // 3+2+1+2+2+1+1=12 I1✓ I2✓ I3✓ I6✓ I7✓
      { bucheron: 3, ours: 3, mouton: 0, renard: 2, chalet: 2, tas_buches: 1, ruche: 1 }, // 3+3+0+2+2+1+1=12 I1✓ I2✓ I3✓ I6✓ I7✓
      { bucheron: 3, ours: 3, mouton: 1, renard: 2, chalet: 2, ruche: 1 },               // 3+3+1+2+2+1=12   I1✓ I2✓ I3✓ I6✓
      // chalet=3, renard=2, ruche=1, sans chien — buch+ours+mouton=6, buch≥3
      { bucheron: 4, ours: 2, mouton: 0, renard: 2, chalet: 3, ruche: 1 },           // 4+2+0+2+3+1=12   I1✓ I2✓ I3✓ I6✓(4≥3)
      { bucheron: 4, ours: 1, mouton: 1, renard: 2, chalet: 3, ruche: 1 },           // 4+1+1+2+3+1=12   I1✓ I2✓ I3✓ I6✓(4≥3)
      // chalet=3, tas_buches=1, ruche=1, sans chien, sans renard — buch+ours+mouton=7, buch≥3
      { bucheron: 4, ours: 2, mouton: 1, chalet: 3, tas_buches: 1, ruche: 1 },       // 4+2+1+3+1+1=12   I1✓ I2✓ I3✓ I6✓(4≥3) I7✓
      // chalet=2, chien=2, ruche=1, mouton présent (6 types actifs) — CHIEN nécessaire pour diversité
      // buch+ours+mouton = 12-2-2-1=7: 3+3+1=7 ✓, 4+2+1=7 ✓
      { bucheron: 3, ours: 3, mouton: 1, chien: 2, chalet: 2, ruche: 1 },            // 3+3+1+2+2+1=12   I1✓ I2✓ I3✓ I4✓ I6✓
      { bucheron: 4, ours: 2, mouton: 1, chien: 2, chalet: 2, ruche: 1 },            // 4+2+1+2+2+1=12   I1✓ I2✓ I3✓ I4✓ I6✓
      // chalet=2, chien=2, renard=2, ruche=1, mouton=0 (6 types actifs)
      // buch+ours = 12-2-2-2-1=5: 3+2=5 ✓
      { bucheron: 3, ours: 2, mouton: 0, chien: 2, renard: 2, chalet: 2, ruche: 1 }, // 3+2+0+2+2+2+1=12 I1✓ I2✓ I3✓ I4✓ I6✓
      // 1 couple — chalet=2, cerf=1, biche=1, ruche=1, mouton présent (8 types actifs)
      // buch+ours+mouton = 12-1-1-2-1=7: 3+3+1=7 ✓
      { bucheron: 3, ours: 3, mouton: 1, cerf: 1, biche: 1, chalet: 2, ruche: 1 },   // 3+3+1+1+1+2+1=12 I1✓ I2✓ I3✓ I5✓ I6✓
      // 2 couples — chalet=2, cerf=2, biche=2, ruche=1, mouton=0 (6 types actifs)
      // buch+ours = 12-2-2-2-1=5: 3+2=5 ✓
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
