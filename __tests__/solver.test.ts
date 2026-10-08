// ============================================================
// TESTS DU SOLVEUR
// ============================================================

import { solve } from '../src/core/engine/solver';
import { board12cells } from '../src/boards/board_12cells';
import { ElementRegistry } from '../src/elements/ElementRegistry';

describe('Solver', () => {
  it('trouve au moins une solution sur un plateau vide avec des jetons suffisants', () => {
    const result = solve({
      boardDef: board12cells,
      fixedPlacements: [],
      availableTokens: [
        { elementId: 'bucheron', count: 2 },
        { elementId: 'ours',     count: 2 },
        { elementId: 'mouton',   count: 2 },
        { elementId: 'chien',    count: 2 },
        { elementId: 'chalet',   count: 2 },
        { elementId: 'loup',   count: 2 },
      ],
      elementDefs: ElementRegistry,
    });

    expect(result.solutionCount).toBeGreaterThan(0);
  });

  it('retourne une solution unique pour un défi bien formé', () => {
    const result = solve({
      boardDef: board12cells,
      fixedPlacements: [
        { cellIndex: 0,  elementId: 'bucheron' },
        { cellIndex: 1,  elementId: 'mouton'   },
        { cellIndex: 5,  elementId: 'chalet'   },
        { cellIndex: 6,  elementId: 'loup'   },
        { cellIndex: 7,  elementId: 'loup'   },
        { cellIndex: 8,  elementId: 'chien'    },
        { cellIndex: 9,  elementId: 'chien'    },
        { cellIndex: 10, elementId: 'ours'     },
        { cellIndex: 11, elementId: 'mouton'   },
      ],
      availableTokens: [
        { elementId: 'bucheron', count: 1 },
        { elementId: 'ours',     count: 1 },
        { elementId: 'chalet',   count: 1 },
      ],
      elementDefs: ElementRegistry,
    });

    expect(result.isUnique).toBe(true);
    expect(result.solutionCount).toBe(1);
  });

  it('ne retourne aucune solution pour une configuration impossible', () => {
    // Deux bucheron voisins → impossible
    const result = solve({
      boardDef: board12cells,
      fixedPlacements: [
        { cellIndex: 0, elementId: 'bucheron' },
        { cellIndex: 1, elementId: 'bucheron' }, // voisin de 0 → violation
      ],
      availableTokens: [
        { elementId: 'ours',   count: 4 },
        { elementId: 'mouton', count: 4 },
        { elementId: 'chien',  count: 2 },
        { elementId: 'chalet', count: 1 },
        { elementId: 'loup', count: 1 },
      ],
      elementDefs: ElementRegistry,
    });

    expect(result.solutionCount).toBe(0);
  });
});
