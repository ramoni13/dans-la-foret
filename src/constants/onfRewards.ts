// ============================================================
// RÉCOMPENSES DU DÉFI DE LA FORÊT — progression par grilles résolues
// ============================================================

export const ONF_REWARD_BASE_SEEDS = 10;
export const ONF_REWARD_STEP_EVERY = 10;
export const ONF_REWARD_STEP_SEEDS = 5;
export const ONF_SPEED_BONUS_SEEDS = 2;
export const ONF_SPEED_BONUS_MAX_MS = 120_000;

export interface OnfRewardProgress {
  baseSeeds: number;
  nextMilestone: number;
  nextBaseSeeds: number;
}

function normalizeSolvedCount(solvedCount: number): number {
  return Number.isFinite(solvedCount) ? Math.max(0, Math.floor(solvedCount)) : 0;
}

export function getOnfRewardProgress(solvedCount: number): OnfRewardProgress {
  const completed = normalizeSolvedCount(solvedCount);
  const currentStep = Math.floor(completed / ONF_REWARD_STEP_EVERY);
  return {
    baseSeeds: ONF_REWARD_BASE_SEEDS + currentStep * ONF_REWARD_STEP_SEEDS,
    nextMilestone: (currentStep + 1) * ONF_REWARD_STEP_EVERY,
    nextBaseSeeds: ONF_REWARD_BASE_SEEDS + (currentStep + 1) * ONF_REWARD_STEP_SEEDS,
  };
}

export function calculateOnfReward(elapsedMs: number, solvedCount: number): number {
  const { baseSeeds } = getOnfRewardProgress(solvedCount);
  const speedBonus = elapsedMs >= 0 && elapsedMs < ONF_SPEED_BONUS_MAX_MS
    ? ONF_SPEED_BONUS_SEEDS
    : 0;
  return baseSeeds + speedBonus;
}
