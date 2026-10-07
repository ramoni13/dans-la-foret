// ============================================================
// STORE DE JEU — Zustand
// État de la partie en cours
//
// Deux canaux de hint indépendants pour les bonus :
// - validHintCells : cases valides (bonus highlight, vert)
// - errorHintCells : cases en erreur (bonus instinct, rouge)
// Les deux peuvent être actifs simultanément.
// ============================================================

import { create } from 'zustand';
import { Challenge } from '../core/models/Challenge';
import { BonusId } from '../constants/bonus';

// Résultat de la validation manuelle (bouton "Valider")
export interface ValidationResult {
  status: 'success' | 'failure' | null;
  errorCount: number;
  errorCells: number[];
}

interface GameState {
  // État du jeu
  currentChallenge: Challenge | null;
  playerBoard: (string | null)[];
  selectedElement: string | null;
  startTime: number | null;
  elapsedTime: number;
  isVictory: boolean;
  bonusUsed: BonusId[];
  validationResult: ValidationResult;

  // ── Bonus highlights (2 canaux indépendants) ───────────────
  validHintCells: number[];    // cases valides (highlight) — vert
  errorHintCells: number[];    // cases en erreur (instinct) — rouge

  // ── Bonus « highlight_valid_cells » mode actif temporaire ────
  highlightActive: boolean;    // true = mode highlight actif (10s), recalcul dynamique

  // ── Défi journalier ────────────────────────────────────────────
  isDailyChallenge: boolean;        // true = mode défi journalier actif
  dailyValidationUsed: boolean;     // true = le joueur a déjà utilisé sa validation unique

  // Actions
  loadChallenge: (challenge: Challenge) => void;
  loadDailyChallenge: (challenge: Challenge) => void;
  placeElement: (cellIndex: number, elementId: string) => void;
  removeElement: (cellIndex: number) => void;
  moveElement: (fromCell: number, toCell: number) => void;
  selectElement: (elementId: string | null) => void;
  useBonus: (bonusId: BonusId) => void;
  setValidHintCells: (cells: number[]) => void;
  clearValidHint: () => void;
  setErrorHintCells: (cells: number[]) => void;
  clearErrorHint: () => void;
  setHighlightActive: (active: boolean) => void;
  tick: (elapsedMs: number) => void;
  validateChallenge: () => ValidationResult;
  dismissValidation: () => void;
  startTimer: (elapsedOffset?: number) => void;
  resetGame: () => void;
}

const EMPTY_VALIDATION: ValidationResult = { status: null, errorCount: 0, errorCells: [] };

export const useGameStore = create<GameState>((set, get) => ({
  currentChallenge: null,
  playerBoard: [],
  selectedElement: null,
  startTime: null,
  elapsedTime: 0,
  isVictory: false,
  bonusUsed: [],
  validationResult: EMPTY_VALIDATION,
  validHintCells: [],
  errorHintCells: [],
  highlightActive: false,
  isDailyChallenge: false,
  dailyValidationUsed: false,

  loadChallenge: (challenge) => {
    const board: (string | null)[] = Array(challenge.solution.length).fill(null);
    for (const fp of challenge.fixedPlacements) {
      board[fp.cellIndex] = fp.elementId;
    }
    set({
      currentChallenge: challenge,
      playerBoard: board,
      selectedElement: null,
      startTime: null,
      elapsedTime: 0,
      isVictory: false,
      bonusUsed: [],
      validationResult: EMPTY_VALIDATION,
      validHintCells: [],
      errorHintCells: [],
      highlightActive: false,
      isDailyChallenge: false,
      dailyValidationUsed: false,
    });
  },

  loadDailyChallenge: (challenge) => {
    const board: (string | null)[] = Array(challenge.solution.length).fill(null);
    for (const fp of challenge.fixedPlacements) {
      board[fp.cellIndex] = fp.elementId;
    }
    set({
      currentChallenge: challenge,
      playerBoard: board,
      selectedElement: null,
      startTime: null,
      elapsedTime: 0,
      isVictory: false,
      bonusUsed: [],
      validationResult: EMPTY_VALIDATION,
      validHintCells: [],
      errorHintCells: [],
      highlightActive: false,
      isDailyChallenge: true,
      dailyValidationUsed: false,
    });
  },

  placeElement: (cellIndex, elementId) => {
    const { currentChallenge, playerBoard } = get();
    if (!currentChallenge) return;

    const isFixed = currentChallenge.fixedPlacements.some(fp => fp.cellIndex === cellIndex);
    if (isFixed) return;

    const newBoard = [...playerBoard];
    newBoard[cellIndex] = elementId;
    set({ playerBoard: newBoard });
  },

  removeElement: (cellIndex) => {
    const { currentChallenge, playerBoard, errorHintCells } = get();
    if (!currentChallenge) return;

    const isFixed = currentChallenge.fixedPlacements.some(fp => fp.cellIndex === cellIndex);
    if (isFixed) return;

    const newBoard = [...playerBoard];
    newBoard[cellIndex] = null;

    // Bug fix : retirer le halo rouge de la case vidée (case vide ≠ erreur)
    const updates: Partial<GameState> = { playerBoard: newBoard };
    if (errorHintCells.includes(cellIndex)) {
      updates.errorHintCells = errorHintCells.filter(i => i !== cellIndex);
    }

    set(updates);
  },

  moveElement: (fromCell, toCell) => {
    const { currentChallenge, playerBoard } = get();
    if (!currentChallenge) return;
    if (fromCell === toCell) return;

    if (fromCell < 0 || fromCell >= playerBoard.length) return;
    if (toCell < 0 || toCell >= playerBoard.length) return;

    const isFromFixed = currentChallenge.fixedPlacements.some(fp => fp.cellIndex === fromCell);
    if (isFromFixed) return;

    const isToFixed = currentChallenge.fixedPlacements.some(fp => fp.cellIndex === toCell);
    if (isToFixed) return;

    if (playerBoard[fromCell] === null) return;

    const newBoard = [...playerBoard];
    const temp = newBoard[toCell];
    newBoard[toCell] = newBoard[fromCell];
    newBoard[fromCell] = temp ?? null;
    set({ playerBoard: newBoard });
  },

  selectElement: (elementId) => set({ selectedElement: elementId }),

  useBonus: (bonusId) => {
    set({ bonusUsed: [...get().bonusUsed, bonusId] });
  },

  // ── Canaux de hint indépendants ────────────────────────────
  setValidHintCells: (cells) => set({ validHintCells: cells }),
  clearValidHint: () => set({ validHintCells: [] }),
  setErrorHintCells: (cells) => set({ errorHintCells: cells }),
  clearErrorHint: () => set({ errorHintCells: [] }),
  setHighlightActive: (active) => set({ highlightActive: active }),

  tick: (elapsedMs) => set({ elapsedTime: elapsedMs }),
  startTimer: (elapsedOffset?: number) => set({ startTime: Date.now() - (elapsedOffset ?? 0) }),

  // ── Validation manuelle (bouton "Valider") ──────────────────
  validateChallenge: () => {
    const { currentChallenge, playerBoard, isDailyChallenge, dailyValidationUsed } = get();
    if (!currentChallenge) return EMPTY_VALIDATION;

    // Défi journalier : une seule validation autorisée
    if (isDailyChallenge && dailyValidationUsed) return EMPTY_VALIDATION;

    const solution = currentChallenge.solution;
    const errorCells: number[] = [];

    const allFilled = playerBoard.every(el => el !== null);
    if (!allFilled) {
      const result: ValidationResult = {
        status: 'failure',
        errorCount: playerBoard.filter(el => el === null).length,
        errorCells: playerBoard.reduce<number[]>((acc, el, i) => {
          if (el === null) acc.push(i);
          return acc;
        }, []),
      };
      set({ validationResult: result });
      return result;
    }

    for (let i = 0; i < playerBoard.length; i++) {
      if (playerBoard[i] !== solution[i]) errorCells.push(i);
    }

    if (errorCells.length > 0) {
      console.warn('[Validation] Échec — cases incorrectes:', errorCells.map(i =>
        `case${i}: joueur="${playerBoard[i]}" attendu="${solution[i]}"`
      ).join(', '));
    }

    const result: ValidationResult = {
      status: errorCells.length === 0 ? 'success' : 'failure',
      errorCount: errorCells.length,
      errorCells,
    };

    const updates: Partial<GameState> = {
      validationResult: result,
      isVictory: result.status === 'success',
    };

    // Défi journalier : marquer la validation comme utilisée
    if (isDailyChallenge) {
      updates.dailyValidationUsed = true;
    }

    set(updates);
    return result;
  },

  dismissValidation: () => set({ validationResult: EMPTY_VALIDATION }),

  resetGame: () => set({
    currentChallenge: null,
    playerBoard: [],
    selectedElement: null,
    startTime: null,
    elapsedTime: 0,
    isVictory: false,
    bonusUsed: [],
    validationResult: EMPTY_VALIDATION,
    validHintCells: [],
    errorHintCells: [],
    highlightActive: false,
    isDailyChallenge: false,
    dailyValidationUsed: false,
  }),
}));
