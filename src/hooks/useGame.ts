// ============================================================
// HOOK useGame
// Logique de jeu centralisée — connecte le store au gameplay
//
// Bonus one-shot temporaires (indépendants, peuvent coexister) :
// - reveal_cell : MODE RÉVÉLATION — le joueur sélectionne une case,
//   la solution est affichée 10s puis la case est vidée.
//   Durant les 10s, le jeu reprend normalement.
// - instinct : snapshot figé 5s des cases en erreur
//   → une case vidée perd son halo rouge (géré dans le store)
// ============================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { usePlayerStore } from '../store/playerStore';
import { BoardRegistry } from '../boards/BoardRegistry';
import { ElementRegistry } from '../elements/ElementRegistry';
import {
  getValidCellsForElement,
  getErrorCells,
} from '../core/engine/hintEngine';
import { BonusId } from '../constants/bonus';
import { Colors } from '../constants/colors';

/** Durée d'affichage du bonus reveal (ms) */
const REVEAL_DURATION_MS   = 5_000;
const INSTINCT_DURATION_MS = 5_000;

export function useGame() {
  const game = useGameStore();
  const player = usePlayerStore();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Timers indépendants pour chaque bonus ──────────────────
  const revealTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const instinctTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Deadlines exposées à HintOverlay pour le countdown ─────
  const [revealDeadline, setRevealDeadline]     = useState<number | null>(null);
  const [instinctDeadline, setInstinctDeadline] = useState<number | null>(null);

  const boardDef = game.currentChallenge
    ? BoardRegistry[game.currentChallenge.boardId]
    : null;

  // ── Chronomètre de la partie ──────────────────────────────
  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (game.startTime && !game.isVictory) {
      timerRef.current = setInterval(() => {
        game.tick(Date.now() - (game.startTime ?? 0));
      }, 1000);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [game.currentChallenge?.id, game.startTime, game.isVictory]);

  useEffect(() => {
    if (game.isVictory) {
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }, [game.isVictory]);

  // ── Cleanup des timers bonus au démontage ou reset ────────
  useEffect(() => {
    return () => {
      if (revealTimerRef.current)   clearTimeout(revealTimerRef.current);
      if (instinctTimerRef.current) clearTimeout(instinctTimerRef.current);
    };
  }, [game.currentChallenge?.id]);

  // ── Place un élément sur une case ─────────────────────────
  const tryPlaceElement = (cellIndex: number, elementId: string): boolean => {
    if (!game.currentChallenge) return false;

    const isFixed = game.currentChallenge.fixedPlacements.some(
      fp => fp.cellIndex === cellIndex
    );
    if (isFixed) return false;

    game.placeElement(cellIndex, elementId);
    return true;
  };

  // ── Place ET désélectionne en un seul set() atomique ──────
  const placeAndDeselect = (cellIndex: number, elementId: string): boolean => {
    if (!game.currentChallenge) return false;
    game.placeAndDeselect(cellIndex, elementId);
    return true;
  };

  // ── Couleur d'une case selon son état ─────────────────────
  const getCellColor = (cellIndex: number): string => {
    // Priorité : erreur (rouge) > révélation (or) > valide (vert) > fixe > vide
    if (game.errorHintCells.includes(cellIndex)) {
      return Colors.cell.wrong;
    }
    // Case révélée par le bonus reveal_cell — fond doré distinctif
    if (game.revealCellIndex === cellIndex) {
      return '#F59E0B'; // Amber-500
    }
    if (game.validHintCells.includes(cellIndex)) {
      return Colors.cell.valid;
    }

    const isFixed = game.currentChallenge?.fixedPlacements.some(
      fp => fp.cellIndex === cellIndex
    );
    if (isFixed) return Colors.cell.fixed;

    return Colors.cell.empty;
  };

  // ── Activer le mode révélation — chrono démarre immédiatement ──
  // Phase 1 (10s) : attente de sélection d'une case.
  //   → Si le joueur ne tape rien → revealActive=false, fin du bonus.
  // Phase 2 (10s) : affichage de la solution sur la case sélectionnée.
  //   → La case se vide automatiquement à l'issue.
  const startRevealMode = useCallback(() => {
    // Désélectionner l'élément actif
    game.selectElement(null);
    // Passer en mode attente de sélection
    game.setRevealActive(true);

    // Démarrer le chrono dès "Activer !" — phase 1 : sélection de case
    const deadline = Date.now() + REVEAL_DURATION_MS;
    setRevealDeadline(deadline);

    if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
    revealTimerRef.current = setTimeout(() => {
      // Timeout phase 1 : le joueur n'a pas tapé de case → annuler
      const state = useGameStore.getState();
      if (state.revealActive) {
        game.clearReveal();
      }
      revealTimerRef.current = null;
      setRevealDeadline(null);
    }, REVEAL_DURATION_MS);
  }, []);

  // ── Appelé par handleCellPress quand revealActive=true ──────
  // Renvoie true si la révélation a été prise en charge.
  const handleRevealCellPress = useCallback((cellIndex: number): boolean => {
    if (!game.revealActive || !game.currentChallenge) return false;

    const isFixed = game.currentChallenge.fixedPlacements.some(
      fp => fp.cellIndex === cellIndex
    );
    if (isFixed) return true; // Case fixe — on absorbe le clic mais on ne révèle rien

    const solutionElement = game.currentChallenge.solution[cellIndex];
    if (!solutionElement) return true;

    // Annuler le timer phase 1 (attente de sélection)
    if (revealTimerRef.current) clearTimeout(revealTimerRef.current);

    // Marquer la case comme révélée dans le store (passe revealActive à false)
    game.revealSolution(cellIndex, solutionElement);

    // Démarrer le timer phase 2 : 10s d'affichage de la solution
    const deadline = Date.now() + REVEAL_DURATION_MS;
    setRevealDeadline(deadline);

    revealTimerRef.current = setTimeout(() => {
      // À l'issue des 10s : vider la case révélée
      const state = useGameStore.getState();
      if (state.revealCellIndex === cellIndex) {
        game.removeElement(cellIndex);
        game.clearReveal();
      }
      revealTimerRef.current = null;
      setRevealDeadline(null);
    }, REVEAL_DURATION_MS);

    return true;
  }, [game.revealActive, game.currentChallenge]);

  // ── Activation d'un bonus ─────────────────────────────────
  const activateBonus = (bonusId: BonusId): boolean => {
    if (!game.currentChallenge) return false;
    if (game.bonusDisabled) return false;

    const spent = player.spendBonus(bonusId);
    if (!spent) return false;

    game.useBonus(bonusId);

    if (bonusId === 'reveal_cell') {
      startRevealMode();
    }

    if (bonusId === 'instinct') {
      const fixedSet = new Set(
        game.currentChallenge.fixedPlacements.map(fp => fp.cellIndex)
      );
      const errors = getErrorCells(
        game.playerBoard,
        game.currentChallenge.solution,
        fixedSet
      );
      game.setErrorHintCells(errors);

      const deadline = Date.now() + INSTINCT_DURATION_MS;
      setInstinctDeadline(deadline);

      if (instinctTimerRef.current) clearTimeout(instinctTimerRef.current);
      instinctTimerRef.current = setTimeout(() => {
        game.clearErrorHint();
        instinctTimerRef.current = null;
        setInstinctDeadline(null);
      }, INSTINCT_DURATION_MS);
    }

    return true;
  };

  return {
    challenge: game.currentChallenge,
    playerBoard: game.playerBoard,
    selectedElement: game.selectedElement,
    elapsedTime: game.elapsedTime,
    isVictory: game.isVictory,
    bonusUsed: game.bonusUsed,
    validHintCells: game.validHintCells,
    errorHintCells: game.errorHintCells,
    highlightActive: game.highlightActive,
    validationResult: game.validationResult,
    revealDeadline,
    instinctDeadline,
    // Alias pour compatibilité avec HintOverlay (highlight → reveal)
    highlightDeadline: revealDeadline,
    revealActive: game.revealActive,
    revealCellIndex: game.revealCellIndex,
    revealElementId: game.revealElementId,
    boardDef,
    tryPlaceElement,
    placeAndDeselect,
    getCellColor,
    activateBonus,
    handleRevealCellPress,
    bonusDisabled: game.bonusDisabled,
    setBonusDisabled: game.setBonusDisabled,
    selectElement: game.selectElement,
    removeElement: game.removeElement,
    clearPlayerBoard: game.clearPlayerBoard,
    moveElement: game.moveElement,
    loadChallenge: game.loadChallenge,
    loadDailyChallenge: game.loadDailyChallenge,
    isDailyChallenge: game.isDailyChallenge,
    dailyValidationUsed: game.dailyValidationUsed,
    startTimer: game.startTimer,
    stopTimer: game.stopTimer,
    validateChallenge: game.validateChallenge,
    dismissValidation: game.dismissValidation,
    resetGame: game.resetGame,
    elementChangeCount: game.elementChangeCount,
  };
}
