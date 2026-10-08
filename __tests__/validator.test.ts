// ============================================================
// TESTS DU VALIDATEUR
// ============================================================

import { validateBoard, checkVictory, isPlacementValid } from '../src/core/engine/validator';
import { board12cells } from '../src/boards/board_12cells';
import { ElementRegistry } from '../src/elements/ElementRegistry';

describe('Validator - checkVictory', () => {
  it('retourne true quand le plateau correspond à la solution', () => {
    const solution = ['bucheron', 'mouton', 'ours', 'chalet',
      'chalet', 'chalet', 'loup', 'loup',
      'chien', 'chien', 'ours', 'mouton'];
    expect(checkVictory(solution, solution)).toBe(true);
  });

  it('retourne false si une case diffère', () => {
    const solution = ['bucheron', 'mouton', 'ours', 'chalet',
      'chalet', 'chalet', 'loup', 'loup',
      'chien', 'chien', 'ours', 'mouton'];
    const wrong = [...solution];
    wrong[3] = 'ours'; // Mauvaise réponse
    expect(checkVictory(wrong, solution)).toBe(false);
  });

  it('retourne false si le plateau est incomplet', () => {
    const solution = ['bucheron', 'mouton', 'ours', 'chalet',
      'chalet', 'chalet', 'loup', 'loup',
      'chien', 'chien', 'ours', 'mouton'];
    const incomplete = [...solution];
    incomplete[5] = '';
    expect(checkVictory(incomplete, solution)).toBe(false);
  });
});

describe('Validator - isPlacementValid', () => {
  it('refuse de placer un bucheron voisin d\'un autre bucheron', () => {
    const board: (string | null)[] = Array(12).fill(null);
    board[1] = 'bucheron'; // case 1 est voisine de case 0

    const valid = isPlacementValid(0, 'bucheron', board, board12cells, ElementRegistry);
    expect(valid).toBe(false);
  });

  it('refuse de placer un Loup voisin d\'un mouton', () => {
    const board: (string | null)[] = Array(12).fill(null);
    board[1] = 'mouton'; // case 1 est voisine de case 0

    const valid = isPlacementValid(0, 'loup', board, board12cells, ElementRegistry);
    expect(valid).toBe(false);
  });

  it('accepte un chien voisin d\'un autre chien', () => {
    const board: (string | null)[] = Array(12).fill(null);
    board[1] = 'chien'; // case 1 est voisine de case 0

    const valid = isPlacementValid(0, 'chien', board, board12cells, ElementRegistry);
    expect(valid).toBe(true);
  });

  it('accepte un bucheron sur une case vide sans voisin bucheron', () => {
    const board: (string | null)[] = Array(12).fill(null);
    board[2] = 'ours'; // voisin différent

    const valid = isPlacementValid(0, 'bucheron', board, board12cells, ElementRegistry);
    expect(valid).toBe(true);
  });
});
