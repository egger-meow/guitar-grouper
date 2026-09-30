import type {
  Participant,
  HostSettings,
  Role,
  GroupResult,
  PartitionDiagnostics,
  OptimizationResult,
} from '../types/domain';
import {
  scorePartition,
  calculateRoleScarcityWeights,
  calculateGroupRoleScore,
  PRESET_WEIGHTS,
} from '../engine/scoring';
import {
  findConsensusTags,
  calculateGroupMusicScore,
} from '../engine/similarity';
import { ROLES, ROLE_MAP } from '../engine/taxonomy';
import { createPrng } from '../engine/prng';
export { calculateGroupCapacities } from '../engine/optimizer';
import { calculateGroupCapacities } from '../engine/optimizer';

/**
 * Builds standard OptimizationResult from any partition of participants
 */
export function buildOptimizationResultFromPartition(
  partition: Participant[][],
  settings: HostSettings,
  allParticipants: Participant[]
): OptimizationResult {
  const desiredRoles: Role[] =
    settings.desiredRoles && settings.desiredRoles.length > 0
      ? settings.desiredRoles
      : (ROLES.map((r) => r.id as Role));

  const scarcityWeights = calculateRoleScarcityWeights(
    allParticipants,
    partition.length,
    desiredRoles
  );

  const evaluation = scorePartition(partition, settings, allParticipants);

  const groups: GroupResult[] = partition.map((group, idx) => {
    const consensusTags = findConsensusTags(group);
    const musicEval = calculateGroupMusicScore(group);
    const gRoleScore = calculateGroupRoleScore(group, scarcityWeights, desiredRoles);

    const roleCoverage = desiredRoles.map((role) => ({
      role,
      coveredBy: group
        .filter((m) => m.capabilities && m.capabilities.includes(role))
        .map((m) => m.id),
    }));

    return {
      id: `group-${idx + 1}`,
      name: `第 ${idx + 1} 組`,
      memberIds: group.map((m) => m.id),
      members: group,
      consensusTags,
      roleCoverage,
      musicScore: Math.round(musicEval.compositeScore * 10000) / 100,
      roleScore: gRoleScore,
      diagnosticsZh: [`成員人數：${group.length} 人`],
    };
  });

  const diagnostics: PartitionDiagnostics = {
    avgRoleCoverage: evaluation.avgRoleCoverage,
    minRoleSatisfactionPct: evaluation.minRoleSatisfactionPct,
    avgMusicScore: evaluation.musicScore,
    worstGroupMusicScore: evaluation.worstGroupMusicScore,
    diversityScore: evaluation.diversityScore,
    talentWasteIndex: evaluation.penalties.talentWaste,
    totalScore: evaluation.totalScore,
    notesZh: [
      `全場共 ${allParticipants.length} 位社員，分為 ${groups.length} 組`,
      `分組滿意度總評分：${evaluation.totalScore} 分`,
    ],
  };

  return {
    groups,
    diagnostics,
    warnings: [],
  };
}

/**
 * Random Baseline:
 * Uniform random assignment into balanced group capacities.
 */
export function runRandomBaseline(
  participants: Participant[],
  settings: HostSettings,
  seed: number = 42
): OptimizationResult {
  if (!participants || participants.length === 0) {
    return {
      groups: [],
      diagnostics: {
        avgRoleCoverage: 0,
        minRoleSatisfactionPct: 0,
        avgMusicScore: 0,
        worstGroupMusicScore: 0,
        diversityScore: 0,
        talentWasteIndex: 0,
        totalScore: 0,
        notesZh: [],
      },
      warnings: [],
    };
  }

  const { K, capacities } = calculateGroupCapacities(
    participants.length,
    settings
  );

  const prng = createPrng(seed);
  const shuffled = [...participants];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(prng() * (i + 1));
    const temp = shuffled[i];
    shuffled[i] = shuffled[j];
    shuffled[j] = temp;
  }

  const partition: Participant[][] = [];
  let offset = 0;
  for (let i = 0; i < K; i++) {
    const cap = capacities[i];
    partition.push(shuffled.slice(offset, offset + cap));
    offset += cap;
  }

  return buildOptimizationResultFromPartition(partition, settings, participants);
}

/**
 * Naive Greedy Baseline:
 * Fills groups sequentially, greedily grabbing the best candidate for the active group
 * without global marginal reasoning.
 */
export function runNaiveGreedyBaseline(
  participants: Participant[],
  settings: HostSettings,
  seed: number = 42
): OptimizationResult {
  if (!participants || participants.length === 0) {
    return {
      groups: [],
      diagnostics: {
        avgRoleCoverage: 0,
        minRoleSatisfactionPct: 0,
        avgMusicScore: 0,
        worstGroupMusicScore: 0,
        diversityScore: 0,
        talentWasteIndex: 0,
        totalScore: 0,
        notesZh: [],
      },
      warnings: [],
    };
  }

  const { K, capacities } = calculateGroupCapacities(
    participants.length,
    settings
  );

  const desiredRoles: Role[] =
    settings.desiredRoles && settings.desiredRoles.length > 0
      ? settings.desiredRoles
      : (ROLES.map((r) => r.id as Role));

  const scarcityWeights = calculateRoleScarcityWeights(
    participants,
    K,
    desiredRoles
  );

  let weights: { role: number; music: number; diversity: number };
  if (settings.preset === 'custom' && settings.weights) {
    const rawW = settings.weights;
    const sumW = (rawW.role || 0) + (rawW.music || 0) + (rawW.diversity || 0) || 1.0;
    weights = {
      role: rawW.role / sumW,
      music: rawW.music / sumW,
      diversity: rawW.diversity / sumW,
    };
  } else {
    weights = PRESET_WEIGHTS[settings.preset] ?? PRESET_WEIGHTS.balanced;
  }

  const unassigned = [...participants];
  const partition: Participant[][] = [];

  for (let gIdx = 0; gIdx < K; gIdx++) {
    const targetCap = capacities[gIdx];
    const group: Participant[] = [];

    while (group.length < targetCap && unassigned.length > 0) {
      let bestCandidateIdx = -1;
      let bestScore = -Infinity;

      for (let cIdx = 0; cIdx < unassigned.length; cIdx++) {
        const candidate = unassigned[cIdx];
        const trialGroup = [...group, candidate];

        // Evaluate candidate's immediate contribution to this group
        const rScore = calculateGroupRoleScore(trialGroup, scarcityWeights, desiredRoles);
        const mScore = calculateGroupMusicScore(trialGroup).compositeScore * 100;
        const candidateScore = weights.role * rScore + weights.music * mScore;

        if (candidateScore > bestScore) {
          bestScore = candidateScore;
          bestCandidateIdx = cIdx;
        }
      }

      if (bestCandidateIdx !== -1) {
        group.push(unassigned[bestCandidateIdx]);
        unassigned.splice(bestCandidateIdx, 1);
      } else {
        // Fallback: take first available
        group.push(unassigned.shift()!);
      }
    }

    partition.push(group);
  }

  return buildOptimizationResultFromPartition(partition, settings, participants);
}
