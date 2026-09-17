// ============================================================
// HOOK useGame
// Logique de jeu centralisée — connecte le store au gameplay
// ============================================================

import { useEffect, useRef } from 'react';
import { useGameStore } from '../store/gameStore';
import { usePlayerStore } from '../store/playerStore';
import { BoardRegistry } from '../boards/BoardRegistry';
import { ElementRegistry } from '../elements/ElementRegistry';
import {
  getValidCellsForElement,
  calculateSeedReward,
} from '../core/engine/hintEngine';
import { BoardDefinition } from '../core/models/Board';
import { BONUS_DEFINITIONS, BonusId } from '../constants/bonus';
import { Colors } from '../constants/colors';

export function useGame() {
  const game = useGameStore();
  const player = usePlayerStore();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const boardDef = game.currentChallenge
    ? BoardRegistry[game.currentChallenge.boardId]
    : null;

  // Démarrer le chronomètre quand une partie commence
  // On dépend de game.currentChallenge?.id pour redémarrer proprement
  // à chaque nouveau défi (même si startTime change peu)
  useEffect(() => {
    // Nettoyer l'ancien timer dans tous les cas
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (game.startTime && !game.isVictory) {
      timerRef.current = setInterval(() => {
        game.tick(Date.now() - (game.startTime ?? 0));
      }, 100);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [game.currentChallenge?.id, game.startTime, game.isVictory]);

  // Arrêter le chronomètre à la victoire
  // Note : markChallengeCompleted et addSeeds sont gérés dans [challengeId].tsx
  // pour éviter le double appel (useGame + écran)
  useEffect(() => {
    if (game.isVictory) {
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }, [game.isVictory]);

  /**
   * Place un élément sur une case sans validation de règle.
   * Le joueur est libre de placer où il veut — la validation
   * se fait uniquement au moment du bouton "Valider".
   */
  const tryPlaceElement = (cellIndex: number, elementId: string): boolean => {
    if (!game.currentChallenge) return false;

    const isFixed = game.currentChallenge.fixedPlacements.some(
      fp => fp.cellIndex === cellIndex
    );
    if (isFixed) return false;

    game.placeElement(cellIndex, elementId);
    return true;
  };

  /**
   * Retourne la couleur d'une case selon son état.
   * @param cellIndex  Index de la case
   * @param hoveredElementId  Élément survolé/sélectionné (pour le bonus highlight)
   */
  const getCellColor = (cellIndex: number, hoveredElementId?: string | null): string => {
    const { hintCells, hintType } = game;

    // Bonus highlight_valid_cells : cases où le placement est légalement possible
    // (basé sur les règles, PAS sur la solution)
    if (
      game.highlightValidCellsActive &&
      hoveredElementId &&
      boardDef
    ) {
      const possibleCells = getValidCellsForElement(
        hoveredElementId,
        game.playerBoard,
        boardDef,
        ElementRegistry
      );
      if (possibleCells.includes(cellIndex)) {
        return Colors.cell.valid;
      }
    }

    if (hintCells.includes(cellIndex)) {
      switch (hintType) {
        case 'valid': return Colors.cell.valid;
        case 'invalid': return Colors.cell.invalid;
        case 'correct': return Colors.cell.correct;
        case 'wrong': return Colors.cell.wrong;
        default: return Colors.cell.hint;
      }
    }

    const isFixed = game.currentChallenge?.fixedPlacements.some(
      fp => fp.cellIndex === cellIndex
    );
    if (isFixed) return Colors.cell.fixed;

    return Colors.cell.empty;
  };

  /**
   * Active un bonus si le joueur a assez de graines.
   * Bonus 1 : highlight_valid_cells — activé en permanence jusqu'à la fin de partie
   * Bonus 2 : count_errors — utilisé automatiquement lors de la validation
   */
  const activateBonus = (bonusId: BonusId): boolean => {
    if (!game.currentChallenge) return false;

    const bonusDef = BONUS_DEFINITIONS[bonusId];
    const spent = player.spendSeeds(bonusDef.cost);
    if (!spent) return false;

    game.useBonus(bonusId);
    // Les effets sont gérés dans le store et dans l'écran de jeu
    return true;
  };

  /**
   * Calcule les cases possibles pour un élément (bonus highlight).
   * Basé sur les règles de jeu, PAS sur la solution.
   */
  const getHighlightCells = (elementId: string): number[] => {
    if (!boardDef) return [];
    return getValidCellsForElement(
      elementId,
      game.playerBoard,
      boardDef,
      ElementRegistry
    );
  };

  return {
    challenge: game.currentChallenge,
    playerBoard: game.playerBoard,
    selectedElement: game.selectedElement,
    elapsedTime: game.elapsedTime,
    isVictory: game.isVictory,
    bonusUsed: game.bonusUsed,
    hintCells: game.hintCells,
    validationResult: game.validationResult,
    highlightValidCellsActive: game.highlightValidCellsActive,
    boardDef,
    tryPlaceElement,
    getCellColor,
    activateBonus,
    getHighlightCells,
    selectElement: game.selectElement,
    removeElement: game.removeElement,
    loadChallenge: game.loadChallenge,
    validateChallenge: game.validateChallenge,
    dismissValidation: game.dismissValidation,
    resetGame: game.resetGame,
  };
}
