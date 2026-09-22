// ============================================================
// STORE DE JEU — Zustand
// État de la partie en cours
// ============================================================

import { create } from 'zustand';
import { Challenge } from '../core/models/Challenge';
import { BonusId } from '../constants/bonus';

// Résultat de la validation manuelle (bouton "Valider")
export interface ValidationResult {
  status: 'success' | 'failure' | null;
  errorCount: number;   // 0 = succès, >0 = nombre de cases incorrectes
  errorCells: number[]; // indices des cases incorrectes (pour le bonus count_errors)
}

interface GameState {
  // État du jeu
  currentChallenge: Challenge | null;
  playerBoard: (string | null)[];   // État actuel du plateau joueur
  selectedElement: string | null;   // Élément sélectionné dans la palette
  startTime: number | null;         // Timestamp début de partie (ms)
  elapsedTime: number;              // Temps écoulé en ms
  isVictory: boolean;               // Vrai après validation réussie
  bonusUsed: BonusId[];             // Bonus utilisés dans cette partie
  validationResult: ValidationResult; // Résultat du dernier appui sur "Valider"
  highlightValidCellsActive: boolean; // Bonus survol actif

  // Overlay bonus actif
  hintCells: number[];              // Cases surlignées par un bonus
  hintType: 'valid' | 'invalid' | 'correct' | 'wrong' | null;

  // Actions
  loadChallenge: (challenge: Challenge) => void;
  placeElement: (cellIndex: number, elementId: string) => void;
  removeElement: (cellIndex: number) => void;
  moveElement: (fromCell: number, toCell: number) => void;
  selectElement: (elementId: string | null) => void;
  useBonus: (bonusId: BonusId) => void;
  setHintCells: (cells: number[], type: GameState['hintType']) => void;
  clearHint: () => void;
  tick: (elapsedMs: number) => void;
  validateChallenge: () => ValidationResult; // Appelé par le bouton "Valider"
  dismissValidation: () => void;             // Ferme le modal échec
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
  highlightValidCellsActive: false,
  hintCells: [],
  hintType: null,

  loadChallenge: (challenge) => {
    const board: (string | null)[] = Array(challenge.solution.length).fill(null);
    for (const fp of challenge.fixedPlacements) {
      board[fp.cellIndex] = fp.elementId;
    }
    set({
      currentChallenge: challenge,
      playerBoard: board,
      selectedElement: null,
      startTime: Date.now(),
      elapsedTime: 0,
      isVictory: false,
      bonusUsed: [],
      validationResult: EMPTY_VALIDATION,
      highlightValidCellsActive: false,
      hintCells: [],
      hintType: null,
    });
  },

  placeElement: (cellIndex, elementId) => {
    const { currentChallenge, playerBoard } = get();
    if (!currentChallenge) return;

    const isFixed = currentChallenge.fixedPlacements.some(fp => fp.cellIndex === cellIndex);
    if (isFixed) return;

    const newBoard = [...playerBoard];
    newBoard[cellIndex] = elementId;
    // Pas de victoire automatique — le joueur doit appuyer sur "Valider"
    set({ playerBoard: newBoard });
  },

  removeElement: (cellIndex) => {
    const { currentChallenge, playerBoard } = get();
    if (!currentChallenge) return;

    const isFixed = currentChallenge.fixedPlacements.some(fp => fp.cellIndex === cellIndex);
    if (isFixed) return;

    const newBoard = [...playerBoard];
    newBoard[cellIndex] = null;
    set({ playerBoard: newBoard });
  },

  moveElement: (fromCell, toCell) => {
    const { currentChallenge, playerBoard } = get();
    if (!currentChallenge) return;
    if (fromCell === toCell) return;

    // Gardes défensives : indices valides dans le tableau (protège contre
    // un offset de plateau périmé qui produirait un index hors limites)
    if (fromCell < 0 || fromCell >= playerBoard.length) return;
    if (toCell < 0 || toCell >= playerBoard.length) return;

    // La case source doit contenir un élément posé par le joueur (non fixe)
    const isFromFixed = currentChallenge.fixedPlacements.some(fp => fp.cellIndex === fromCell);
    if (isFromFixed) return;

    // La case cible ne peut pas être une case fixe
    const isToFixed = currentChallenge.fixedPlacements.some(fp => fp.cellIndex === toCell);
    if (isToFixed) return;

    // La case source doit contenir un élément (sinon rien à déplacer)
    if (playerBoard[fromCell] === null) return;

    const newBoard = [...playerBoard];
    // Permutation : l'élément cible (null ou un jeton posé) prend la place source
    const temp = newBoard[toCell];
    newBoard[toCell] = newBoard[fromCell];
    newBoard[fromCell] = temp ?? null;
    set({ playerBoard: newBoard });
  },

  selectElement: (elementId) => set({ selectedElement: elementId }),

  useBonus: (bonusId) => {
    const updates: Partial<GameState> = {
      bonusUsed: [...get().bonusUsed, bonusId],
    };
    if (bonusId === 'highlight_valid_cells') {
      updates.highlightValidCellsActive = true;
    }
    set(updates);
  },

  setHintCells: (cells, type) => set({ hintCells: cells, hintType: type }),
  clearHint: () => set({ hintCells: [], hintType: null }),
  tick: (elapsedMs) => set({ elapsedTime: elapsedMs }),

  // ── Validation manuelle (bouton "Valider") ──────────────────────
  validateChallenge: () => {
    const { currentChallenge, playerBoard } = get();
    if (!currentChallenge) return EMPTY_VALIDATION;

    const solution = currentChallenge.solution;
    const errorCells: number[] = [];

    // Vérifier que toutes les cases sont remplies
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

    // Comparer avec la solution
    for (let i = 0; i < playerBoard.length; i++) {
      if (playerBoard[i] !== solution[i]) errorCells.push(i);
    }

    const result: ValidationResult = {
      status: errorCells.length === 0 ? 'success' : 'failure',
      errorCount: errorCells.length,
      errorCells,
    };

    set({
      validationResult: result,
      isVictory: result.status === 'success',
    });
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
    highlightValidCellsActive: false,
    hintCells: [],
    hintType: null,
  }),
}));
