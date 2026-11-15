import { canUseBonusInAttempt } from '../src/constants/bonus';

describe('bonus limit per attempt', () => {
  it('allows one use of each bonus and blocks a second use in the same attempt', () => {
    expect(canUseBonusInAttempt([], 'reveal_cell')).toBe(true);
    expect(canUseBonusInAttempt(['reveal_cell'], 'reveal_cell')).toBe(false);
    expect(canUseBonusInAttempt(['reveal_cell'], 'instinct')).toBe(true);
    expect(canUseBonusInAttempt(['reveal_cell', 'instinct'], 'instinct')).toBe(false);
  });
});
