import { getLevelStatus } from '../src/constants/progression';

describe('Solo level progression thresholds', () => {
  it.each([
    [1, 6],
    [2, 4],
    [5, 6],
    [4, 4],
    [7, 7],
    [8, 5],
    [11, 7],
    [10, 5],
    [13, 6],
    [15, 8],
    [16, 6],
    [17, 8],
    [18, 8],
    [19, 9],
    [20, 7],
    [21, 9],
  ])('completes level %i at %i pinecones', (level, threshold) => {
    const makeProgress = (stars: number) => {
      const starsByLevel: Record<number, number> = {};
      for (let current = 1; current <= 21; current++) {
        starsByLevel[current] = current === level ? stars : 0;
      }
      return {
        currentLevel: level,
        levelsCompleted: level - 1,
        starsByLevel,
      };
    };

    const statusBelowThreshold = getLevelStatus(level, {}, makeProgress(threshold - 1));
    expect(statusBelowThreshold.isCompleted).toBe(false);
    expect(statusBelowThreshold.starsMissing).toBe(1);

    const statusAtThreshold = getLevelStatus(level, {}, makeProgress(threshold));
    expect(statusAtThreshold.threshold).toBe(threshold);
    expect(statusAtThreshold.isCompleted).toBe(true);
    expect(statusAtThreshold.starsMissing).toBe(0);
  });
});
