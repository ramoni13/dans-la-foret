import {
  calculateOnfReward,
  getOnfRewardProgress,
} from '../src/constants/onfRewards';

describe('Forest Challenge seed rewards', () => {
  it.each([
    [0, 10, 10, 15],
    [9, 10, 10, 15],
    [10, 15, 20, 20],
    [19, 15, 20, 20],
    [20, 20, 30, 25],
  ])('uses the right reward tier after %i solved grids', (solved, base, milestone, next) => {
    expect(getOnfRewardProgress(solved)).toEqual({
      baseSeeds: base,
      nextMilestone: milestone,
      nextBaseSeeds: next,
    });
  });

  it('adds the express bonus only below two minutes', () => {
    expect(calculateOnfReward(119_999, 10)).toBe(17);
    expect(calculateOnfReward(120_000, 10)).toBe(15);
  });

  it('normalizes invalid and negative solved counts', () => {
    expect(getOnfRewardProgress(-1).baseSeeds).toBe(10);
    expect(getOnfRewardProgress(Number.NaN).baseSeeds).toBe(10);
  });
});
