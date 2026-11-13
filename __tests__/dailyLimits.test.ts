import {
  FREE_DAILY_CHALLENGE_LIMIT,
  createFreshDailyLimits,
  getDailyChallengeQuota,
  getDailyChallengesRemaining,
  mergeDailyLimits,
  sanitizeDailyLimits,
} from '../src/constants/dailyLimits';

describe('shared daily challenge quota', () => {
  it('starts with ten challenges shared across modes', () => {
    expect(createFreshDailyLimits('2026-11-13').challengeCountToday).toBe(0);
    expect(getDailyChallengeQuota()).toBe(FREE_DAILY_CHALLENGE_LIMIT);
    expect(getDailyChallengesRemaining({ challengeCountToday: 4, exempt: false })).toBe(6);
  });

  it('adds three challenges after the optional rewarded video', () => {
    expect(getDailyChallengeQuota(1)).toBe(13);
    expect(getDailyChallengesRemaining({
      challengeCountToday: 10,
      exempt: false,
      recharges: 1,
    })).toBe(3);
  });

  it('keeps Premium exempt from the quota', () => {
    expect(getDailyChallengesRemaining({ challengeCountToday: 100, exempt: true })).toBe(Infinity);
  });

  it('migrates legacy Forestier, Duel, and started Daily counts', () => {
    const limits = sanitizeDailyLimits({
      lastBonusResetDate: '2026-11-13',
      onfDailyCount: 2,
      friendChallengeTokens: 1,
      dailyChallengeStatus: 'in_progress',
      lastDailyChallengeDate: '2026-11-13',
    });

    expect(limits?.challengeCountToday).toBe(5);
  });

  it('prefers the new count when present and merges devices by the maximum', () => {
    const local = createFreshDailyLimits('2026-11-13');
    const cloud = createFreshDailyLimits('2026-11-13');
    local.challengeCountToday = 4;
    cloud.challengeCountToday = 7;

    const sanitizedLegacy = sanitizeDailyLimits({
      lastBonusResetDate: '2026-11-13',
      challengeCountToday: 1,
      onfDailyCount: 9,
      friendChallengeTokens: 0,
    });

    expect(sanitizedLegacy?.challengeCountToday).toBe(1);
    expect(mergeDailyLimits(local, cloud, '2026-11-13').challengeCountToday).toBe(7);
  });
});
