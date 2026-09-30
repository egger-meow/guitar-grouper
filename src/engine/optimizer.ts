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
} from './scoring';
import {
  findConsensusTags,
  calculateGroupMusicScore,
  calculateHierarchicalSimilarity,
} from './similarity';
import { ROLES, ROLE_MAP, TAXONOMY_MAP } from './taxonomy';
import { createPrng } from './prng';

/**
 * Friendly short Chinese names for role display
 */
const ROLE_DISPLAY_NAMES: Partial<Record<Role, string>> = {
  acoustic_guitar: '木吉他',
  electric_guitar: '電吉他',
  cajon: '木箱鼓',
  drums: '爵士鼓',
  bass: '貝斯',
  keyboard: '鍵盤',
  lead_vocal: '主唱',
  backing_vocal: '和聲',
  other: '其他',
};

interface CachedGroupEval {
  roleScore: number;
  musicScore: number;
  diversityScore: number;
  deficit: number;
  coveragePct: number;
  excessVersatile: number;
  overallScore: number;
}

/**
 * Calculates optimal group count K and target group capacities
 * Ensures |size(Gi) - size(Gj)| <= 1 at all times.
 */
function calculateGroupCapacities(
  participantCount: number,
  targetGroupSize: number
): { K: number; capacities: number[] } {
  if (participantCount <= 0) {
    return { K: 0, capacities: [] };
  }

  const S = Math.max(1, targetGroupSize || 4);
  const K = Math.max(1, Math.floor(participantCount / S));
  const baseSize = Math.floor(participantCount / K);
  const remainder = participantCount % K;

  const capacities: number[] = new Array(K);
  for (let i = 0; i < K; i++) {
    capacities[i] = i < remainder ? baseSize + 1 : baseSize;
  }

  return { K, capacities };
}

/**
 * Generates friendly warnings when room capabilities cannot satisfy host constraints
 */
function generateRoleWarnings(
  participants: Participant[],
  groupCount: number,
  settings: HostSettings
): string[] {
  if (participants.length === 0 || groupCount <= 0) {
    return [];
  }

  const warnings: string[] = [];
  const rolesToCheck: Role[] =
    settings.desiredRoles && settings.desiredRoles.length > 0
      ? settings.desiredRoles
      : (settings.keyRoles && settings.keyRoles.length > 0
          ? settings.keyRoles
          : (ROLES.map((r) => r.id as Role)));

  for (const role of rolesToCheck) {
    const count = participants.filter(
      (p) => p.capabilities && p.capabilities.includes(role)
    ).length;

    if (count < groupCount) {
      const roleZh = ROLE_DISPLAY_NAMES[role] || ROLE_MAP[role]?.nameZh || role;
      if (count === 0) {
        warnings.push(
          `本次共有 ${groupCount} 組，全場沒有社員會${roleZh}，系統建議由相鄰樂器替代或社團幹部支援。`
        );
      } else {
        warnings.push(
          `本次共有 ${groupCount} 組，但全場僅有 ${count} 位社員會${roleZh}，系統已盡可能平均分配。`
        );
      }
    }
  }

  return warnings;
}

/**
 * Fast evaluation for a single group in the Simulated Annealing inner loop
 */
function evalSingleGroup(
  group: Participant[],
  scarcityWeights: Record<Role, number>,
  desiredRoles: Role[],
  keyRoles: Role[],
  minRequiredRolesCount: number,
  weights: { role: number; music: number; diversity: number },
  distinctGenders: string[],
  roomCounts: Record<string, number>,
  totalParticipants: number,
  getSim: (a: Participant, b: Participant) => number
): CachedGroupEval {
  if (group.length === 0) {
    return {
      roleScore: 0,
      musicScore: 0,
      diversityScore: 100,
      deficit: minRequiredRolesCount,
      coveragePct: 0,
      excessVersatile: 0,
      overallScore: 0,
    };
  }

  // 1. Role score
  const roleCounts: Partial<Record<Role, number>> = {};
  for (const r of desiredRoles) {
    roleCounts[r] = 0;
  }
  for (const m of group) {
    for (const cap of m.capabilities || []) {
      if (cap in roleCounts) {
        roleCounts[cap] = (roleCounts[cap] ?? 0) + 1;
      }
    }
  }

  let totalUtility = 0;
  let targetIdealUtility = 0;
  for (const r of desiredRoles) {
    const Wr = scarcityWeights[r] ?? 1.0;
    targetIdealUtility += Wr;
    const count = roleCounts[r] ?? 0;
    for (let k = 1; k <= count; k++) {
      totalUtility += Wr / (1 + 0.8 * (k - 1));
    }
  }
  const roleScore =
    targetIdealUtility > 0
      ? Math.min(100, Math.round(((totalUtility / targetIdealUtility) * 100) * 100) / 100)
      : 0;

  // 2. Music score
  let musicScore = 0;
  if (group.length === 1) {
    musicScore = 100;
  } else {
    let sumPairwise = 0;
    let minPairwise = Infinity;
    let pairCount = 0;
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const sim = getSim(group[i], group[j]);
        sumPairwise += sim;
        if (sim < minPairwise) minPairwise = sim;
        pairCount++;
      }
    }
    const avgPair = pairCount > 0 ? sumPairwise / pairCount : 0;
    const minPair = pairCount > 0 ? minPairwise : 0;

    if (avgPair === 0) {
      musicScore = 0;
    } else {
      // Consensus bonus
      const tagCounts = new Map<string, number>();
      for (const m of group) {
        const s = new Set<string>();
        for (const p of m.musicPreferences || []) {
          s.add(p);
          if (TAXONOMY_MAP[p]?.parentId) s.add(TAXONOMY_MAP[p].parentId!);
        }
        for (const t of s) {
          tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
        }
      }

      let maxShared = 0;
      let sharedCountGte2 = 0;
      for (const cnt of tagCounts.values()) {
        if (cnt > maxShared) maxShared = cnt;
        if (cnt >= 2) sharedCountGte2++;
      }

      let consensusBonus = 0;
      if (maxShared >= group.length) {
        consensusBonus = 0.05;
      } else if (sharedCountGte2 > 0) {
        consensusBonus = 0.02;
      }

      const baseMusic = 0.7 * avgPair + 0.3 * minPair;
      const composite = Math.min(1.0, Math.round((baseMusic + consensusBonus) * 10000) / 10000);
      musicScore = Math.round(composite * 10000) / 100;
    }
  }

  // 3. Diversity score
  let diversityScore = 100;
  if (distinctGenders.length > 1) {
    const gCounts: Record<string, number> = {};
    for (const p of group) {
      const g = p.gender || 'unknown';
      gCounts[g] = (gCounts[g] ?? 0) + 1;
    }
    let tvd = 0;
    for (const g of distinctGenders) {
      const gRatio = (gCounts[g] ?? 0) / group.length;
      const roomRatio = (roomCounts[g] ?? 0) / totalParticipants;
      tvd += Math.abs(gRatio - roomRatio);
    }
    diversityScore = Math.max(0, (1.0 - 0.5 * tvd) * 100);
  }

  // 4. Deficit and coverage
  const coveredKey = new Set<Role>();
  const coveredDesired = new Set<Role>();
  for (const m of group) {
    for (const cap of m.capabilities || []) {
      if (keyRoles.includes(cap)) coveredKey.add(cap);
      if (desiredRoles.includes(cap)) coveredDesired.add(cap);
    }
  }
  const deficit = Math.max(0, minRequiredRolesCount - coveredKey.size);
  const coveragePct =
    desiredRoles.length > 0 ? (coveredDesired.size / desiredRoles.length) * 100 : 100;

  // 5. Versatile player excess
  const versatileMembers = group.filter((m) => m.capabilities && m.capabilities.length >= 3);
  const excessVersatile = Math.max(0, versatileMembers.length - 1);

  // 6. Group overall score
  const overallScore = Math.max(
    0,
    weights.role * roleScore +
      weights.music * musicScore +
      weights.diversity * diversityScore -
      deficit * 15.0
  );

  return {
    roleScore,
    musicScore,
    diversityScore,
    deficit,
    coveragePct,
    excessVersatile,
    overallScore,
  };
}

/**
 * Computes composite room score from cached group evaluations
 */
function computeCompositeTotalScore(
  groupEvals: CachedGroupEval[],
  K: number,
  N: number,
  partitionLengths: number[],
  weights: { role: number; music: number; diversity: number }
): number {
  let sumRole = 0;
  let sumMusic = 0;
  let sumDiv = 0;
  let minMusic = Infinity;
  let minOverall = Infinity;
  let totalDeficit = 0;
  let totalExcessVersatile = 0;

  for (let i = 0; i < K; i++) {
    const ge = groupEvals[i];
    sumRole += ge.roleScore;
    sumMusic += ge.musicScore;
    sumDiv += ge.diversityScore;
    if (ge.musicScore < minMusic) minMusic = ge.musicScore;
    if (ge.overallScore < minOverall) minOverall = ge.overallScore;
    totalDeficit += ge.deficit;
    totalExcessVersatile += ge.excessVersatile;
  }

  const roleScore = Math.round((sumRole / K) * 100) / 100;
  const avgMusic = sumMusic / K;
  const musicScore = Math.round((0.6 * avgMusic + 0.4 * minMusic) * 100) / 100;
  const diversityScore = Math.round((sumDiv / K) * 100) / 100;

  // Size variance
  const meanSize = N / K;
  let sizeVariance = 0;
  for (let i = 0; i < K; i++) {
    sizeVariance += Math.pow(partitionLengths[i] - meanSize, 2);
  }
  sizeVariance /= K;
  const excessSizeVariance = Math.max(0, sizeVariance - 0.25);
  const sizePenalty = Math.round(excessSizeVariance * 10.0 * 100) / 100;

  const deficitPenalty = Math.round(totalDeficit * 15.0 * 100) / 100;

  let wastePenalty = 0;
  if (totalDeficit > 0 && totalExcessVersatile > 0) {
    wastePenalty =
      Math.round(totalExcessVersatile * 12.0 * Math.min(2, totalDeficit) * 100) / 100;
  }

  const worstGroupOverall = Math.round(minOverall * 100) / 100;
  const weightedBaseScore =
    weights.role * roleScore + weights.music * musicScore + weights.diversity * diversityScore;
  const blendedScore = 0.85 * weightedBaseScore + 0.15 * worstGroupOverall;
  const totalPenalties = deficitPenalty + wastePenalty + sizePenalty;

  return Math.max(0, Math.min(100, Math.round((blendedScore - totalPenalties) * 100) / 100));
}

/**
 * Evaluates placement suitability of a participant into an existing group during seeding
 */
function evaluateSeedingFit(
  group: Participant[],
  participant: Participant,
  settings: HostSettings,
  scarcityWeights: Record<Role, number>,
  desiredRoles: Role[],
  keyRoles: Role[]
): number {
  if (group.length === 0) {
    return 10.0;
  }

  let score = 0;

  // 1. Role coverage benefit with diminishing returns
  const groupRoles = new Set<Role>();
  for (const m of group) {
    for (const cap of m.capabilities || []) {
      groupRoles.add(cap);
    }
  }

  for (const cap of participant.capabilities || []) {
    const isDesired = desiredRoles.includes(cap);
    const isKey = keyRoles.includes(cap);
    const scarcity = scarcityWeights[cap] ?? 1.0;

    if (!groupRoles.has(cap)) {
      score += (isKey ? 40 : isDesired ? 25 : 10) * scarcity;
    } else {
      score += 5 * scarcity;
    }
  }

  // 2. Multi-talent dispersion: avoid clustering multiple versatile players (>=3 capabilities)
  const isVersatile = (participant.capabilities || []).length >= 3;
  if (isVersatile) {
    const versatileCountInGroup = group.filter(
      (m) => (m.capabilities || []).length >= 3
    ).length;
    if (versatileCountInGroup > 0) {
      score -= 60 * versatileCountInGroup;
    }
  }

  // 3. Music preference affinity
  let totalSim = 0;
  let pairCount = 0;
  for (const m of group) {
    const pA = participant.musicPreferences || [];
    const pB = m.musicPreferences || [];
    if (pA.length > 0 && pB.length > 0) {
      const setA = new Set(pA);
      let matchCount = 0;
      for (const t of pB) {
        if (setA.has(t)) matchCount++;
      }
      const sim = matchCount / Math.max(1, setA.size + pB.length - matchCount);
      totalSim += sim;
      pairCount++;
    }
  }

  if (pairCount > 0) {
    const avgSim = totalSim / pairCount;
    const musicWeightMultiplier = settings.preset === 'music_focus' ? 80 : 30;
    score += avgSim * musicWeightMultiplier;
  }

  // 4. Gender diversity incentive
  const maleCount = group.filter((m) => m.gender === 'M').length;
  const femaleCount = group.filter((m) => m.gender === 'F').length;
  if (participant.gender === 'M' && femaleCount > maleCount) {
    score += 5;
  } else if (participant.gender === 'F' && maleCount > femaleCount) {
    score += 5;
  }

  return score;
}

/**
 * Phase 1: Constructive Seeding with Scarce Role Anchor Identification
 */
function seedInitialPartition(
  participants: Participant[],
  K: number,
  capacities: number[],
  settings: HostSettings
): Participant[][] {
  const groups: Participant[][] = Array.from({ length: K }, () => []);
  if (participants.length === 0 || K === 0) {
    return groups;
  }

  const desiredRoles: Role[] =
    settings.desiredRoles && settings.desiredRoles.length > 0
      ? settings.desiredRoles
      : (ROLES.map((r) => r.id as Role));

  const keyRoles: Role[] =
    settings.keyRoles && settings.keyRoles.length > 0
      ? settings.keyRoles
      : desiredRoles;

  const scarcityWeights = calculateRoleScarcityWeights(participants, K, desiredRoles);

  // Compute role counts across the entire room
  const roomRoleCounts: Partial<Record<Role, number>> = {};
  for (const p of participants) {
    for (const cap of p.capabilities || []) {
      roomRoleCounts[cap] = (roomRoleCounts[cap] ?? 0) + 1;
    }
  }

  // Rank participants by scarce role possession and versatility
  const sortedParticipants = [...participants].sort((a, b) => {
    let priorityA = 0;
    let priorityB = 0;

    for (const cap of a.capabilities || []) {
      const cnt = roomRoleCounts[cap] ?? 0;
      if (cnt <= K) priorityA += (K - cnt + 2) * 20;
      else priorityA += 5;
    }
    if ((a.capabilities || []).length >= 3) priorityA += 35;

    for (const cap of b.capabilities || []) {
      const cnt = roomRoleCounts[cap] ?? 0;
      if (cnt <= K) priorityB += (K - cnt + 2) * 20;
      else priorityB += 5;
    }
    if ((b.capabilities || []).length >= 3) priorityB += 35;

    if (priorityB !== priorityA) {
      return priorityB - priorityA;
    }

    return (a.joinedAt ?? 0) - (b.joinedAt ?? 0) || a.id.localeCompare(b.id);
  });

  // Greedily seed participants into the best eligible group
  for (const p of sortedParticipants) {
    let bestGroupIdx = -1;
    let bestFitScore = -Infinity;

    for (let i = 0; i < K; i++) {
      if (groups[i].length >= capacities[i]) continue;

      const fitScore = evaluateSeedingFit(
        groups[i],
        p,
        settings,
        scarcityWeights,
        desiredRoles,
        keyRoles
      );

      if (fitScore > bestFitScore) {
        bestFitScore = fitScore;
        bestGroupIdx = i;
      }
    }

    if (bestGroupIdx !== -1) {
      groups[bestGroupIdx].push(p);
    } else {
      let minLen = Infinity;
      let minIdx = 0;
      for (let i = 0; i < K; i++) {
        if (groups[i].length < minLen) {
          minLen = groups[i].length;
          minIdx = i;
        }
      }
      groups[minIdx].push(p);
    }
  }

  return groups;
}

/**
 * Phase 2: Simulated Annealing local search with Ruin-and-Recreate & cyclic moves
 */
function simulatedAnnealingSearch(
  initialPartition: Participant[][],
  capacities: number[],
  settings: HostSettings,
  allParticipants: Participant[],
  prng: () => number
): Participant[][] {
  const K = initialPartition.length;
  if (K <= 1) {
    return initialPartition;
  }

  const N = allParticipants.length;
  const minCapacity = Math.min(...capacities);
  const maxCapacity = Math.max(...capacities);

  const desiredRoles: Role[] =
    settings.desiredRoles && settings.desiredRoles.length > 0
      ? settings.desiredRoles
      : (ROLES.map((r) => r.id as Role));

  const keyRoles: Role[] =
    settings.keyRoles && settings.keyRoles.length > 0
      ? settings.keyRoles
      : desiredRoles;

  const minRequiredRolesCount = settings.minRequiredRolesCount ?? 0;
  const scarcityWeights = calculateRoleScarcityWeights(allParticipants, K, desiredRoles);

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

  const roomCounts: Record<string, number> = {};
  for (const p of allParticipants) {
    const g = p.gender || 'unknown';
    roomCounts[g] = (roomCounts[g] ?? 0) + 1;
  }
  const distinctGenders = Object.keys(roomCounts);

  // Memoized music similarity cache between participants
  const musicSimCache = new Map<string, number>();
  const getCachedMusicSim = (pA: Participant, pB: Participant): number => {
    const key = pA.id < pB.id ? `${pA.id}:${pB.id}` : `${pB.id}:${pA.id}`;
    let sim = musicSimCache.get(key);
    if (sim === undefined) {
      sim = calculateHierarchicalSimilarity(pA.musicPreferences || [], pB.musicPreferences || []);
      musicSimCache.set(key, sim);
    }
    return sim;
  };

  const evaluateGroup = (grp: Participant[]) =>
    evalSingleGroup(
      grp,
      scarcityWeights,
      desiredRoles,
      keyRoles,
      minRequiredRolesCount,
      weights,
      distinctGenders,
      roomCounts,
      N,
      getCachedMusicSim
    );

  // In-place partition state and cached group evaluations
  const currentPartition = initialPartition.map((g) => [...g]);
  const groupEvals: CachedGroupEval[] = currentPartition.map((g) => evaluateGroup(g));
  const groupLengths: number[] = currentPartition.map((g) => g.length);

  let currentScore = computeCompositeTotalScore(groupEvals, K, N, groupLengths, weights);

  let bestPartition = currentPartition.map((g) => [...g]);
  let bestScore = currentScore;

  // Annealing parameters
  let T = 1.0;
  const Tmin = 0.001;
  const alpha = 0.995;
  const movesPerTemp = N <= 15 ? 2 : N <= 60 ? 3 : 2;

  while (T > Tmin) {
    for (let m = 0; m < movesPerTemp; m++) {
      const moveTypeRand = prng();

      if (K >= 3 && moveTypeRand > 0.85) {
        // --- Move 1: 3-Way Cyclic Swap (Gi -> Gj -> Gk -> Gi) ---
        const g1 = Math.floor(prng() * K);
        let g2 = Math.floor(prng() * (K - 1));
        if (g2 >= g1) g2++;
        let g3 = Math.floor(prng() * (K - 2));
        const used = [Math.min(g1, g2), Math.max(g1, g2)];
        if (g3 >= used[0]) g3++;
        if (g3 >= used[1]) g3++;

        const group1 = currentPartition[g1];
        const group2 = currentPartition[g2];
        const group3 = currentPartition[g3];

        if (group1.length > 0 && group2.length > 0 && group3.length > 0) {
          const idx1 = Math.floor(prng() * group1.length);
          const idx2 = Math.floor(prng() * group2.length);
          const idx3 = Math.floor(prng() * group3.length);

          const p1 = group1[idx1];
          const p2 = group2[idx2];
          const p3 = group3[idx3];

          // Apply cyclic move
          group1[idx1] = p3;
          group2[idx2] = p1;
          group3[idx3] = p2;

          const oldEval1 = groupEvals[g1];
          const oldEval2 = groupEvals[g2];
          const oldEval3 = groupEvals[g3];

          groupEvals[g1] = evaluateGroup(group1);
          groupEvals[g2] = evaluateGroup(group2);
          groupEvals[g3] = evaluateGroup(group3);

          const candidateScore = computeCompositeTotalScore(
            groupEvals,
            K,
            N,
            groupLengths,
            weights
          );
          const delta = candidateScore - currentScore;

          if (delta > 0 || prng() < Math.exp(delta / (T * 1.5))) {
            currentScore = candidateScore;
            if (currentScore > bestScore) {
              bestScore = currentScore;
              bestPartition = currentPartition.map((g) => [...g]);
            }
          } else {
            // Revert cyclic move
            group1[idx1] = p1;
            group2[idx2] = p2;
            group3[idx3] = p3;
            groupEvals[g1] = oldEval1;
            groupEvals[g2] = oldEval2;
            groupEvals[g3] = oldEval3;
          }
        }
      } else if (moveTypeRand > 0.65) {
        // --- Move 2: Member Transfer (respecting size bounds |Gi - Gj| <= 1) ---
        const g1 = Math.floor(prng() * K);
        let g2 = Math.floor(prng() * (K - 1));
        if (g2 >= g1) g2++;

        const group1 = currentPartition[g1];
        const group2 = currentPartition[g2];

        const validTransfer =
          group1.length - 1 >= minCapacity &&
          group2.length + 1 <= maxCapacity &&
          Math.abs(group1.length - 1 - (group2.length + 1)) <= 1;

        if (validTransfer && group1.length > 0) {
          const idx1 = Math.floor(prng() * group1.length);
          const p = group1.splice(idx1, 1)[0];
          group2.push(p);

          groupLengths[g1]--;
          groupLengths[g2]++;

          const oldEval1 = groupEvals[g1];
          const oldEval2 = groupEvals[g2];

          groupEvals[g1] = evaluateGroup(group1);
          groupEvals[g2] = evaluateGroup(group2);

          const candidateScore = computeCompositeTotalScore(
            groupEvals,
            K,
            N,
            groupLengths,
            weights
          );
          const delta = candidateScore - currentScore;

          if (delta > 0 || prng() < Math.exp(delta / (T * 1.5))) {
            currentScore = candidateScore;
            if (currentScore > bestScore) {
              bestScore = currentScore;
              bestPartition = currentPartition.map((g) => [...g]);
            }
          } else {
            // Revert transfer
            group2.pop();
            group1.splice(idx1, 0, p);
            groupLengths[g1]++;
            groupLengths[g2]--;
            groupEvals[g1] = oldEval1;
            groupEvals[g2] = oldEval2;
          }
        }
      } else {
        // --- Move 3: 2-Way Member Swap (preserves group sizes) ---
        const g1 = Math.floor(prng() * K);
        let g2 = Math.floor(prng() * (K - 1));
        if (g2 >= g1) g2++;

        const group1 = currentPartition[g1];
        const group2 = currentPartition[g2];

        if (group1.length > 0 && group2.length > 0) {
          const idx1 = Math.floor(prng() * group1.length);
          const idx2 = Math.floor(prng() * group2.length);

          const temp = group1[idx1];
          group1[idx1] = group2[idx2];
          group2[idx2] = temp;

          const oldEval1 = groupEvals[g1];
          const oldEval2 = groupEvals[g2];

          groupEvals[g1] = evaluateGroup(group1);
          groupEvals[g2] = evaluateGroup(group2);

          const candidateScore = computeCompositeTotalScore(
            groupEvals,
            K,
            N,
            groupLengths,
            weights
          );
          const delta = candidateScore - currentScore;

          if (delta > 0 || prng() < Math.exp(delta / (T * 1.5))) {
            currentScore = candidateScore;
            if (currentScore > bestScore) {
              bestScore = currentScore;
              bestPartition = currentPartition.map((g) => [...g]);
            }
          } else {
            // Revert swap
            group2[idx2] = group1[idx1];
            group1[idx1] = temp;
            groupEvals[g1] = oldEval1;
            groupEvals[g2] = oldEval2;
          }
        }
      }
    }

    T *= alpha;
  }

  return bestPartition;
}

/**
 * Generates human-friendly Chinese diagnostics for each group
 */
function generateGroupDiagnosticsZh(
  group: Participant[],
  consensusTags: string[],
  desiredRoles: Role[]
): string[] {
  const notes: string[] = [];
  if (group.length === 0) {
    return ['本組尚無團員'];
  }

  // 1. Role coverage lineup
  const roleCounts: Partial<Record<Role, number>> = {};
  for (const m of group) {
    for (const cap of m.capabilities || []) {
      roleCounts[cap] = (roleCounts[cap] ?? 0) + 1;
    }
  }

  const roleParts: string[] = [];
  for (const role of ROLES) {
    const count = roleCounts[role.id];
    if (count && count > 0) {
      const name = ROLE_DISPLAY_NAMES[role.id] || role.nameZh;
      roleParts.push(`${name}(${count}人)`);
    }
  }

  if (roleParts.length > 0) {
    notes.push(`編制陣容：${roleParts.join('、')}`);
  }

  // Missing desired roles check
  const missingDesired: string[] = [];
  for (const dr of desiredRoles) {
    if (!roleCounts[dr] || roleCounts[dr] === 0) {
      missingDesired.push(ROLE_DISPLAY_NAMES[dr] || dr);
    }
  }
  if (missingDesired.length > 0 && missingDesired.length <= 3) {
    notes.push(`待補強配置：缺${missingDesired.join('、缺')}`);
  }

  // 2. Music consensus & song recommendation
  if (consensusTags.length > 0) {
    const tagDisplayNames = consensusTags
      .map((t) => TAXONOMY_MAP[t]?.nameZh || t)
      .slice(0, 3);
    notes.push(`音樂共識：${tagDisplayNames.join('、')}`);

    // Style recommendations
    const tagSet = new Set(consensusTags);
    if (
      tagSet.has('mandopop_ballad') ||
      tagSet.has('accusefive') ||
      tagSet.has('jay_chou') ||
      tagSet.has('li_ronghao')
    ) {
      notes.push('推薦曲風走向：華語流行抒情、不插電民謠（Acoustic Pop）');
    } else if (
      tagSet.has('jpop_anime_jrock') ||
      tagSet.has('yorushika') ||
      tagSet.has('yoasobi') ||
      tagSet.has('one_ok_rock')
    ) {
      notes.push('推薦曲風走向：日系動漫、J-Rock、疾速節奏曲目');
    } else if (tagSet.has('indie_rock') || tagSet.has('no_party_for_cao_dong')) {
      notes.push('推薦曲風走向：獨立搖滾、後搖滾、熱血樂團編制');
    } else if (tagSet.has('western_pop_rnb')) {
      notes.push('推薦曲風走向：西洋流行、R&B、都會流行律動');
    } else if (tagSet.has('western_rock')) {
      notes.push('推薦曲風走向：經典西洋搖滾、另類搖滾（Alternative Rock）');
    } else if (tagSet.has('fingerstyle')) {
      notes.push('推薦曲風走向：雙吉他演奏對話、木吉他指彈獨奏');
    } else {
      notes.push('推薦曲風走向：跨界多元融合、融合多種風格');
    }
  } else {
    notes.push('音樂偏好多元，建議初次破冰時交流彼此的歌單！');
  }

  // 3. Performance vibe readiness
  const hasVocal = (roleCounts.lead_vocal ?? 0) > 0;
  const hasRhythm =
    (roleCounts.cajon ?? 0) > 0 || (roleCounts.drums ?? 0) > 0;

  if (hasVocal && hasRhythm) {
    notes.push('完整編制：同時具備主唱與節奏打擊，可直接組隊完整排練！');
  } else if (hasVocal) {
    notes.push('溫暖民謠：具備主唱與吉他，適合抒情不插電自彈自唱。');
  } else if (hasRhythm) {
    notes.push('節奏演奏：節奏感充沛，可嘗試純樂器演奏或邀請社員兼任主唱。');
  } else {
    notes.push('純吉他編制：雙吉他合奏對話，可著重吉他伴奏與旋律線配合。');
  }

  return notes;
}

/**
 * Main Grouping Optimizer
 * Orchestrates Constructive Seeding + Simulated Annealing + Diagnostics Synthesis
 */
export function optimizeGrouping(
  participants: Participant[],
  settings: HostSettings,
  seed?: number
): OptimizationResult {
  // Edge case: Empty participants
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
        notesZh: ['目前尚無參加者資料'],
      },
      warnings: [],
    };
  }

  // PRNG initialization
  const prng = createPrng(seed !== undefined ? seed : 42);

  // Group capacity planning
  const targetGroupSize = settings.targetGroupSize || 4;
  const { K, capacities } = calculateGroupCapacities(
    participants.length,
    targetGroupSize
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

  // Friendly warnings
  const warnings = generateRoleWarnings(participants, K, settings);

  // Phase 1: Constructive Seeding
  const seededPartition = seedInitialPartition(
    participants,
    K,
    capacities,
    settings
  );

  // Phase 2: Simulated Annealing local search
  const finalPartition = simulatedAnnealingSearch(
    seededPartition,
    capacities,
    settings,
    participants,
    prng
  );

  // Final evaluation (canonical ground truth)
  const evaluation = scorePartition(finalPartition, settings, participants);

  // Build group results
  const groups: GroupResult[] = finalPartition.map((group, idx) => {
    const consensusTags = findConsensusTags(group);
    const musicEval = calculateGroupMusicScore(group);
    const gRoleScore = calculateGroupRoleScore(
      group,
      scarcityWeights,
      desiredRoles
    );

    const roleCoverage = desiredRoles.map((role) => ({
      role,
      coveredBy: group
        .filter((m) => m.capabilities && m.capabilities.includes(role))
        .map((m) => m.id),
    }));

    const diagnosticsZh = generateGroupDiagnosticsZh(
      group,
      consensusTags,
      desiredRoles
    );

    return {
      id: `group-${idx + 1}`,
      name: `第 ${idx + 1} 組`,
      memberIds: group.map((m) => m.id),
      members: group,
      consensusTags,
      roleCoverage,
      musicScore: Math.round(musicEval.compositeScore * 10000) / 100,
      roleScore: gRoleScore,
      diagnosticsZh,
    };
  });

  // Overall room-level diagnostics
  const notesZh: string[] = [
    `全場共 ${participants.length} 位社員，分為 ${groups.length} 組，平均每組 ${(participants.length / groups.length).toFixed(1)} 人`,
    `整體分組滿意度評分：${evaluation.totalScore} 分`,
    `關鍵角色平均覆蓋率：${evaluation.avgRoleCoverage}%`,
    `各組最低角色滿足達標率：${evaluation.minRoleSatisfactionPct}%`,
    `音樂契合度綜合評分：${evaluation.musicScore} 分（最低組：${evaluation.worstGroupMusicScore} 分）`,
    `性別與多元背景平衡評分：${evaluation.diversityScore} 分`,
  ];

  if (evaluation.penalties.talentWaste === 0) {
    notesZh.push('多才多藝社員已均勻配置於各組，無人才浪費');
  } else {
    notesZh.push('部分多才社員集中，已盡力平衡各組核心戰力');
  }

  const diagnostics: PartitionDiagnostics = {
    avgRoleCoverage: evaluation.avgRoleCoverage,
    minRoleSatisfactionPct: evaluation.minRoleSatisfactionPct,
    avgMusicScore: evaluation.musicScore,
    worstGroupMusicScore: evaluation.worstGroupMusicScore,
    diversityScore: evaluation.diversityScore,
    talentWasteIndex: evaluation.penalties.talentWaste,
    totalScore: evaluation.totalScore,
    notesZh,
  };

  return {
    groups,
    diagnostics,
    warnings,
  };
}
