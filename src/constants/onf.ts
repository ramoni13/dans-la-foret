// ============================================================
// CONSTANTES MODE ONF — Grille Forestière (Sudoku Forestier)
// Seuils de débloquage facilement modifiables avant publication.
// ============================================================

/** currentLevel >= ONF_UNLOCK_LEVEL → le mode 3×3 est accessible */
export const ONF_UNLOCK_LEVEL = 5;

/** onf3x3SolvedCount >= ONF_4X4_UNLOCK_COUNT → le mode 4×4 est accessible */
export const ONF_4X4_UNLOCK_COUNT = 10;

/** currentLevel >= ONF_4X4_LEVEL_UNLOCK → le mode 4×4 est accessible via la progression solo. */
export const ONF_4X4_LEVEL_UNLOCK = 14;
