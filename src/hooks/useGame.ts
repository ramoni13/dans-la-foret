// ============================================================
// HOOK useGame
// Logique de jeu centralisée — connecte le store au gameplay
//
// Bonus one-shot temporaires (indépendants, peuvent coexister) :
// - highlight_valid_cells : MODE ACTIF 10s — recalcule dynamiquement
//   les cases valides à chaque changement de sélection ou de plateau.
//   Efface les cases quand aucun élément n'est sélectionné.
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
import { BONUS_DEFINITIONS, BonusId } from '../constants/bonus';
import { Colors } from '../constants/colors';

/** Durée d'affichage des bonus (ms) */
const HIGHLIGHT_DURATION_MS = 10_000;
const INSTINCT_DURATION_MS  =  5_000;

export function useGame() {
  const game = useGameStore();
  const player = usePlayerStore();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Timers indépendants pour chaque bonus ──────────────────
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const instinctTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Deadlines exposées à HintOverlay pour le countdown ─────
  const [highlightDeadline, setHighlightDeadline] = useState<number | null>(null);
  const [instinctDeadline, setInstinctDeadline]   = useState<number | null>(null);

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
      }, 100);
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
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
      if (instinctTimerRef.current)  clearTimeout(instinctTimerRef.current);
    };
  }, [game.currentChallenge?.id]);

  // ── Mode highlight actif : recalcul dynamique ─────────────
  // Quand highlightActive=true :
  //   - selectedElement change → recalculer les cases valides
  //   - selectedElement=null (placement fait) → effacer les cases valides
  //   - playerBoard change (= placement) → effacer (l'élément est désélectionné)
  //     le prochain selectElement déclenchera un nouveau calcul
  useEffect(() => {
    if (!game.highlightActive || !boardDef) return;

    if (game.selectedElement) {
      const state = useGameStore.getState();
      const validCells = getValidCellsForElement(
        game.selectedElement,
        state.playerBoard,
        boardDef,
        ElementRegistry
      );
      game.setValidHintCells(validCells);
    } else {
      // Pas d'élément sélectionné → effacer les cases valides
      game.clearValidHint();
    }
  }, [game.highlightActive, game.selectedElement, game.playerBoard, boardDef]);

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

  // ── Couleur d'une case selon son état ─────────────────────
  const getCellColor = (cellIndex: number): string => {
    // Priorité : erreur (rouge) > valide (vert) > fixe > vide
    if (game.errorHintCells.includes(cellIndex)) {
      return Colors.cell.wrong;
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

  // ── Démarrer le mode highlight (timer 10s) ────────────────
  const startHighlightMode = useCallback(() => {
    game.setHighlightActive(true);

    const deadline = Date.now() + HIGHLIGHT_DURATION_MS;
    setHighlightDeadline(deadline);

    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    highlightTimerRef.current = setTimeout(() => {
      game.setHighlightActive(false);
      game.clearValidHint();
      highlightTimerRef.current = null;
      setHighlightDeadline(null);
    }, HIGHLIGHT_DURATION_MS);
  }, []);

  // ── Activation d'un bonus ─────────────────────────────────
  const activateBonus = (bonusId: BonusId): boolean => {
    if (!game.currentChallenge) return false;

    const bonusDef = BONUS_DEFINITIONS[bonusId];
    const spent = player.spendSeeds(bonusDef.cost);
    if (!spent) return false;

    game.useBonus(bonusId);

    if (bonusId === 'highlight_valid_cells') {
      startHighlightMode();
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
    highlightDeadline,
    instinctDeadline,
    boardDef,
    tryPlaceElement,
    getCellColor,
    activateBonus,
    selectElement: game.selectElement,
    removeElement: game.removeElement,
    moveElement: game.moveElement,
    loadChallenge: game.loadChallenge,
    loadDailyChallenge: game.loadDailyChallenge,
    isDailyChallenge: game.isDailyChallenge,
    dailyValidationUsed: game.dailyValidationUsed,
    startTimer: game.startTimer,
    validateChallenge: game.validateChallenge,
    dismissValidation: game.dismissValidation,
    resetGame: game.resetGame,
  };
}
