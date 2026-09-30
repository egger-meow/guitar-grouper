import type {
  Participant,
  HostSettings,
  Role,
  OptimizationResult,
} from '../types/domain';
import { scorePartition } from '../engine/scoring';
import { optimizeGrouping } from '../engine/optimizer';
import { DEFAULT_HOST_SETTINGS } from '../engine/taxonomy';
import { generateSyntheticRoom, ScenarioType } from './generator';
import { runRandomBaseline, runNaiveGreedyBaseline } from './baselines';

export interface AlgorithmBenchmarkMetrics {
  totalScore: number;
  roleScore: number;
  musicScore: number;
  diversityScore: number;
  worstGroupScore: number;
  worstGroupMusicScore: number;
  avgRoleCoverage: number;
  minRoleSatisfactionPct: number;
  talentWastePenalty: number;
  scarceRoleDispersion: number;
  runtimeMs: number;
  result: OptimizationResult;
}

export interface BenchmarkComparisonResult {
  participantCount: number;
  scenario: ScenarioType;
  settings: HostSettings;
  optimizer: AlgorithmBenchmarkMetrics;
  random: AlgorithmBenchmarkMetrics;
  naiveGreedy: AlgorithmBenchmarkMetrics;
  dominance: {
    optimizerBeatsRandom: boolean;
    optimizerBeatsGreedy: boolean;
    scoreMarginOverRandom: number;
    scoreMarginOverGreedy: number;
    speedPassesLimit: boolean;
  };
}

export const DEFAULT_BENCHMARK_SETTINGS: HostSettings = DEFAULT_HOST_SETTINGS;

/**
 * Calculates scarce role dispersion:
 * Ratio of distinct groups covering scarce roles vs theoretical maximum possible dispersion.
 */
export function calculateScarceRoleDispersion(
  partition: Participant[][],
  rolesToCheck: Role[]
): number {
  if (!rolesToCheck || rolesToCheck.length === 0 || partition.length === 0) {
    return 1.0;
  }

  const K = partition.length;
  let totalAchieved = 0;
  let totalPossible = 0;

  for (const role of rolesToCheck) {
    const roleHolders = partition
      .flat()
      .filter((p) => p.capabilities && p.capabilities.includes(role)).length;

    if (roleHolders > 0) {
      const possible = Math.min(roleHolders, K);
      const coveredGroups = partition.filter((group) =>
        group.some((p) => p.capabilities && p.capabilities.includes(role))
      ).length;

      totalAchieved += coveredGroups;
      totalPossible += possible;
    }
  }

  return totalPossible > 0 ? Math.round((totalAchieved / totalPossible) * 1000) / 1000 : 1.0;
}

/**
 * Extracts comprehensive metrics for a given algorithm result
 */
function extractMetrics(
  result: OptimizationResult,
  settings: HostSettings,
  participants: Participant[],
  runtimeMs: number
): AlgorithmBenchmarkMetrics {
  const partition = result.groups.map((g) => g.members);
  const evaluation = scorePartition(partition, settings, participants);
  const rolesToCheck =
    settings.keyRoles && settings.keyRoles.length > 0
      ? settings.keyRoles
      : settings.desiredRoles;

  const scarceRoleDispersion = calculateScarceRoleDispersion(partition, rolesToCheck);

  return {
    totalScore: evaluation.totalScore,
    roleScore: evaluation.roleScore,
    musicScore: evaluation.musicScore,
    diversityScore: evaluation.diversityScore,
    worstGroupScore: evaluation.worstGroupScore,
    worstGroupMusicScore: evaluation.worstGroupMusicScore,
    avgRoleCoverage: evaluation.avgRoleCoverage,
    minRoleSatisfactionPct: evaluation.minRoleSatisfactionPct,
    talentWastePenalty: evaluation.penalties.talentWaste,
    scarceRoleDispersion,
    runtimeMs: Math.round(runtimeMs * 100) / 100,
    result,
  };
}

/**
 * Runs a side-by-side benchmark comparing:
 * 1. Proposed Optimizer (Constructive Seeding + Simulated Annealing)
 * 2. Uniform Random Baseline
 * 3. Naive Greedy Baseline
 */
export function runBenchmarkComparison(
  count: number,
  scenario: ScenarioType = 'realistic',
  settings: HostSettings = DEFAULT_BENCHMARK_SETTINGS,
  seed: number = 42
): BenchmarkComparisonResult {
  const participants = generateSyntheticRoom(count, scenario, seed);

  // 1. Run Optimizer
  const startOpt = performance.now();
  const optResult = optimizeGrouping(participants, settings, seed);
  const optRuntime = performance.now() - startOpt;
  const optimizerMetrics = extractMetrics(optResult, settings, participants, optRuntime);

  // 2. Run Random Baseline
  const startRand = performance.now();
  const randResult = runRandomBaseline(participants, settings, seed);
  const randRuntime = performance.now() - startRand;
  const randomMetrics = extractMetrics(randResult, settings, participants, randRuntime);

  // 3. Run Naive Greedy Baseline
  const startGreedy = performance.now();
  const greedyResult = runNaiveGreedyBaseline(participants, settings, seed);
  const greedyRuntime = performance.now() - startGreedy;
  const greedyMetrics = extractMetrics(greedyResult, settings, participants, greedyRuntime);

  // Check speed budget: <= 30 participants in < 50ms; <= 300 participants in < 500ms
  const speedLimit = count <= 30 ? 50 : 500;
  const speedPassesLimit = optRuntime < speedLimit;

  const scoreMarginOverRandom =
    Math.round((optimizerMetrics.totalScore - randomMetrics.totalScore) * 100) / 100;
  const scoreMarginOverGreedy =
    Math.round((optimizerMetrics.totalScore - greedyMetrics.totalScore) * 100) / 100;

  return {
    participantCount: participants.length,
    scenario,
    settings,
    optimizer: optimizerMetrics,
    random: randomMetrics,
    naiveGreedy: greedyMetrics,
    dominance: {
      optimizerBeatsRandom: optimizerMetrics.totalScore > randomMetrics.totalScore,
      optimizerBeatsGreedy: optimizerMetrics.totalScore >= greedyMetrics.totalScore,
      scoreMarginOverRandom,
      scoreMarginOverGreedy,
      speedPassesLimit,
    },
  };
}
