import type {
  Participant,
  Role,
  HostSettings,
  PartitionEvaluation,
  PresetType,
} from '../types/domain';
import { calculateGroupMusicScore } from './similarity';
import { assignRoles } from './roles';
import { ROLES } from './taxonomy';

/**
 * Standard preset weight mappings:
 * - music_focus: prioritizes musical compatibility and consensus
 * - role_focus: prioritizes instrument and band role coverage
 * - balanced: balances musical affinity and role completeness
 * - custom: uses host-defined weights
 */
export const PRESET_WEIGHTS: Record<PresetType, { role: number; music: number; diversity: number }> = {
  music_focus: { role: 0.25, music: 0.60, diversity: 0.15 },
  role_focus: { role: 0.65, music: 0.20, diversity: 0.15 },
  balanced: { role: 0.45, music: 0.40, diversity: 0.15 },
  custom: { role: 0.45, music: 0.40, diversity: 0.15 },
};

/**
 * Calculates global role scarcity weights based on participant frequency:
 * W_r = 1.0 + max(0, (K - count(r)) / K) * 2.0
 */
export function calculateRoleScarcityWeights(
  participants: Participant[],
  groupCount: number,
  desiredRoles?: Role[]
): Record<Role, number> {
  const K = Math.max(1, groupCount);
  const rolesToEvaluate: Role[] =
    desiredRoles && desiredRoles.length > 0
      ? desiredRoles
      : (ROLES.map((r) => r.id as Role));

  const roleCounts: Record<Role, number> = {} as Record<Role, number>;
  for (const r of rolesToEvaluate) {
    roleCounts[r] = 0;
  }

  for (const p of participants) {
    if (!p.capabilities) continue;
    for (const cap of p.capabilities) {
      if (cap in roleCounts) {
        roleCounts[cap]++;
      }
    }
  }

  const weights: Record<Role, number> = {} as Record<Role, number>;
  for (const r of rolesToEvaluate) {
    const count = roleCounts[r] ?? 0;
    const scarcityBonus = Math.max(0, (K - count) / K) * 2.0;
    weights[r] = Math.round((1.0 + scarcityBonus) * 1000) / 1000;
  }

  return weights;
}

/**
 * Scarcity-weighted coverage of roles that can actually be assigned.
 * Each role contributes at most once; duplicate capabilities cannot fill gaps.
 */
export function calculateGroupRoleScore(
  group: Participant[],
  scarcityWeights: Record<Role, number>,
  desiredRoles: Role[],
  assignments = assignRoles(group, desiredRoles, scarcityWeights)
): number {
  if (!group || group.length === 0 || !desiredRoles || desiredRoles.length === 0) {
    return 0;
  }

  const roles = [...new Set(desiredRoles)];
  const assigned = new Set(assignments.map(a => a.role));
  const ideal = roles.reduce((sum, r) => sum + (scarcityWeights[r] ?? 1), 0);
  const covered = roles.reduce((sum, r) => sum + (assigned.has(r) ? scarcityWeights[r] ?? 1 : 0), 0);
  return ideal > 0 ? Math.round(covered / ideal * 10000) / 100 : 0;
}

/**
 * Calculates demographic/gender diversity balance relative to the room's overall demographic ratio
 * Uses Total Variation Distance (TVD) from room ratio.
 */
export function calculatePartitionDiversityScore(
  partition: Participant[][],
  allParticipants?: Participant[]
): number {
  const all = allParticipants ?? partition.flat();
  if (all.length <= 1) return 100;

  // Compute room demographic distribution
  const roomCounts: Record<string, number> = {};
  for (const p of all) {
    const g = p.gender || 'unknown';
    roomCounts[g] = (roomCounts[g] ?? 0) + 1;
  }

  const distinctGenders = Object.keys(roomCounts);
  if (distinctGenders.length <= 1) {
    return 100;
  }

  const roomRatios: Record<string, number> = {};
  for (const g of distinctGenders) {
    roomRatios[g] = roomCounts[g] / all.length;
  }

  // Calculate TVD for each non-empty group
  let sumGroupDiversity = 0;
  let validGroupCount = 0;

  for (const group of partition) {
    if (group.length === 0) continue;
    validGroupCount++;

    const groupCounts: Record<string, number> = {};
    for (const p of group) {
      const g = p.gender || 'unknown';
      groupCounts[g] = (groupCounts[g] ?? 0) + 1;
    }

    let tvd = 0;
    for (const g of distinctGenders) {
      const groupRatio = (groupCounts[g] ?? 0) / group.length;
      tvd += Math.abs(groupRatio - roomRatios[g]);
    }
    tvd = 0.5 * tvd; // Total Variation Distance in [0, 1]

    const groupScore = Math.max(0, (1.0 - tvd) * 100);
    sumGroupDiversity += groupScore;
  }

  if (validGroupCount === 0) return 0;
  return Math.round((sumGroupDiversity / validGroupCount) * 100) / 100;
}

/**
 * Evaluates a global partition under host settings and multi-objective fitness
 */
export function scorePartition(
  partition: Participant[][],
  settings: HostSettings,
  allParticipants?: Participant[]
): PartitionEvaluation {
  // Empty or invalid partition check
  if (!partition || partition.length === 0 || partition.every((g) => g.length === 0)) {
    return {
      totalScore: 0,
      roleScore: 0,
      musicScore: 0,
      diversityScore: 0,
      penalties: {
        talentWaste: 0,
        minRoleDeficit: 0,
        sizeVariance: 0,
        deficitPenalty: 0,
        wastePenalty: 0,
        sizePenalty: 0,
      },
      worstGroupScore: 0,
      worstGroupMusicScore: 0,
      worstGroupOverallScore: 0,
      avgRoleCoverage: 0,
      minRoleSatisfactionPct: 0,
    };
  }

  const all = allParticipants ?? partition.flat();
  const K = partition.length;
  const N = all.length;

  const desiredRoles: Role[] =
    settings.desiredRoles && settings.desiredRoles.length > 0
      ? settings.desiredRoles
      : (ROLES.map((r) => r.id as Role));

  const minRequiredRolesCount = Math.min(desiredRoles.length, Math.max(0, settings.minRequiredRolesCount ?? 0));

  // 1. Role Scarcity Weights
  const scarcityWeights = calculateRoleScarcityWeights(all, K, desiredRoles);

  // 2. Weights Mapping
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

  // 3. Room demographic distribution for group-level diversity
  const roomCounts: Record<string, number> = {};
  for (const p of all) {
    const g = p.gender || 'unknown';
    roomCounts[g] = (roomCounts[g] ?? 0) + 1;
  }
  const distinctGenders = Object.keys(roomCounts);

  // Group metrics collection
  const groupRoleScores: number[] = [];
  const groupMusicScores: number[] = [];
  const groupDiversityScores: number[] = [];
  const groupOverallScores: number[] = [];
  const groupCoveragePcts: number[] = [];

  let totalDeficit = 0;
  let satisfiedGroupCount = 0;

  for (const group of partition) {
    // Role score for this group
    const assignments = assignRoles(group, desiredRoles, scarcityWeights);
    const gRoleScore = calculateGroupRoleScore(group, scarcityWeights, desiredRoles, assignments);
    groupRoleScores.push(gRoleScore);

    // Music evaluation
    const musicEval = calculateGroupMusicScore(group);
    const gMusicScore = Math.round(musicEval.compositeScore * 10000) / 100;
    groupMusicScores.push(gMusicScore);

    // Group demographic diversity score
    let gDivScore = 100;
    if (distinctGenders.length > 1 && group.length > 0) {
      const gCounts: Record<string, number> = {};
      for (const p of group) {
        const g = p.gender || 'unknown';
        gCounts[g] = (gCounts[g] ?? 0) + 1;
      }
      let tvd = 0;
      for (const g of distinctGenders) {
        const gRatio = (gCounts[g] ?? 0) / group.length;
        const roomRatio = roomCounts[g] / (all.length || 1);
        tvd += Math.abs(gRatio - roomRatio);
      }
      gDivScore = Math.max(0, (1.0 - 0.5 * tvd) * 100);
    }
    groupDiversityScores.push(gDivScore);

    // Minimum is measured against selected, assignable roles only.
    const assignedCount = assignments.length;
    const gDeficit = Math.max(0, minRequiredRolesCount - assignedCount);
    totalDeficit += gDeficit;
    if (gDeficit === 0) {
      satisfiedGroupCount++;
    }

    const covPct = desiredRoles.length > 0 ? (assignedCount / desiredRoles.length) * 100 : 100;
    groupCoveragePcts.push(covPct);

    // Individual group overall score (including deficit penalty)
    const gOverall = Math.max(
      0,
      weights.role * gRoleScore +
        weights.music * gMusicScore +
        weights.diversity * gDivScore -
        gDeficit * 15.0
    );
    groupOverallScores.push(gOverall);
  }

  // Aggregated scores
  const avgRoleCoverage =
    groupCoveragePcts.length > 0
      ? Math.round((groupCoveragePcts.reduce((a, b) => a + b, 0) / groupCoveragePcts.length) * 100) / 100
      : 0;

  const roleScore =
    groupRoleScores.length > 0
      ? Math.round((groupRoleScores.reduce((a, b) => a + b, 0) / groupRoleScores.length) * 100) / 100
      : 0;

  const minRoleSatisfactionPct =
    partition.length > 0
      ? Math.round((satisfiedGroupCount / partition.length) * 10000) / 100
      : 0;

  const worstGroupMusicScore =
    groupMusicScores.length > 0 ? Math.min(...groupMusicScores) : 0;
  const avgMusicScore =
    groupMusicScores.length > 0
      ? groupMusicScores.reduce((a, b) => a + b, 0) / groupMusicScores.length
      : 0;

  // Worst-group music protection (Min-Max fairness in music)
  const musicScore =
    Math.round((0.6 * avgMusicScore + 0.4 * worstGroupMusicScore) * 100) / 100;

  const diversityScore = calculatePartitionDiversityScore(partition, all);

  // Group size variance penalty
  const meanSize = N / K;
  let sizeVariance = 0;
  for (const group of partition) {
    sizeVariance += Math.pow(group.length - meanSize, 2);
  }
  sizeVariance /= K;
  const excessSizeVariance = Math.max(0, sizeVariance - 0.25);
  const sizePenalty = Math.round(excessSizeVariance * 10.0 * 100) / 100;

  // Key role deficit penalty
  const deficitPenalty = Math.round((totalDeficit / K) * 15.0 * 100) / 100;

  // Usable role assignments already capture talent; versatility is not waste.
  const wastePenalty = 0;

  const worstGroupOverallScore =
    groupOverallScores.length > 0
      ? Math.round(Math.min(...groupOverallScores) * 100) / 100
      : 0;

  // Composite fitness score with worst-group protection
  const weightedBaseScore =
    weights.role * roleScore +
    weights.music * musicScore +
    weights.diversity * diversityScore;

  const blendedScore = 0.85 * weightedBaseScore + 0.15 * worstGroupOverallScore;
  const totalPenalties = deficitPenalty + wastePenalty + sizePenalty;
  const totalScore = Math.max(
    0,
    Math.min(100, Math.round((blendedScore - totalPenalties) * 100) / 100)
  );

  return {
    totalScore,
    roleScore,
    musicScore,
    diversityScore,
    penalties: {
      talentWaste: wastePenalty,
      minRoleDeficit: deficitPenalty,
      sizeVariance: sizePenalty,
      deficitPenalty,
      wastePenalty,
      sizePenalty,
    },
    worstGroupScore: worstGroupOverallScore,
    worstGroupMusicScore,
    worstGroupOverallScore,
    avgRoleCoverage,
    minRoleSatisfactionPct,
  };
}
