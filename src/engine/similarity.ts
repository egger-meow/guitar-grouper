import type { Participant, GroupMusicEvaluation } from '../types/domain';
import { TAXONOMY_MAP, getGenreNeighborhoodWeight } from './taxonomy';

/**
 * Calculates similarity between two single music item IDs (0.0 ~ 1.0)
 */
export function calculateItemSimilarity(idA: string, idB: string): number {
  if (!idA || !idB) return 0.0;
  if (idA === idB) return 1.0;

  const itemA = TAXONOMY_MAP[idA];
  const itemB = TAXONOMY_MAP[idB];

  if (!itemA || !itemB) return 0.0;

  const genreA = itemA.category === 'genre' ? itemA.id : itemA.parentId;
  const genreB = itemB.category === 'genre' ? itemB.id : itemB.parentId;

  if (!genreA || !genreB) return 0.0;

  // Same genre category
  if (genreA === genreB) {
    // One is genre, one is artist under it
    if (itemA.category !== itemB.category) {
      return 0.8;
    }
    // Both are different artists under the exact same genre
    return 0.6;
  }

  // Cross-genre neighborhood soft affinity
  const neighborhoodWeight = getGenreNeighborhoodWeight(genreA, genreB);
  if (neighborhoodWeight <= 0) return 0.0;

  // If both are genres directly
  if (itemA.category === 'genre' && itemB.category === 'genre') {
    return neighborhoodWeight;
  }

  // If one is genre, one is artist in neighboring genre
  if (itemA.category !== itemB.category) {
    return Math.round(neighborhoodWeight * 0.85 * 10000) / 10000;
  }

  // Both are artists in neighboring genres
  return Math.round(neighborhoodWeight * 0.6 * 10000) / 10000;
}

/**
 * Calculates hierarchical similarity between two participant preference sets (0.0 ~ 1.0)
 * Uses symmetric best-match soft Jaccard aggregation.
 */
export function calculateHierarchicalSimilarity(prefsA: string[], prefsB: string[]): number {
  if (!prefsA || !prefsB || prefsA.length === 0 || prefsB.length === 0) {
    return 0.0;
  }

  // Deduplicate and filter non-empty
  const setA = Array.from(new Set(prefsA.filter(Boolean)));
  const setB = Array.from(new Set(prefsB.filter(Boolean)));

  if (setA.length === 0 || setB.length === 0) {
    return 0.0;
  }

  // Calculate best match for each item in setA against setB
  let sumBestA = 0;
  for (const a of setA) {
    let maxSim = 0;
    for (const b of setB) {
      const sim = calculateItemSimilarity(a, b);
      if (sim > maxSim) maxSim = sim;
      if (maxSim === 1.0) break;
    }
    sumBestA += maxSim;
  }

  // Calculate best match for each item in setB against setA
  let sumBestB = 0;
  for (const b of setB) {
    let maxSim = 0;
    for (const a of setA) {
      const sim = calculateItemSimilarity(b, a);
      if (sim > maxSim) maxSim = sim;
      if (maxSim === 1.0) break;
    }
    sumBestB += maxSim;
  }

  const avgA = sumBestA / setA.length;
  const avgB = sumBestB / setB.length;
  const score = (avgA + avgB) / 2;

  return Math.round(score * 10000) / 10000;
}

/**
 * Discovers consensus tags (genres or artists) shared by group members.
 * Expands each member's preferences to include their parent genres.
 */
export function findConsensusTags(members: Participant[]): string[] {
  if (!members || members.length < 2) {
    return members?.[0]?.musicPreferences ?? [];
  }

  const tagCounts = new Map<string, number>();

  for (const member of members) {
    const memberTagSet = new Set<string>();
    for (const pref of member.musicPreferences) {
      if (!pref) continue;
      memberTagSet.add(pref);
      const item = TAXONOMY_MAP[pref];
      if (item?.parentId) {
        memberTagSet.add(item.parentId);
      }
    }

    for (const tag of memberTagSet) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
  }

  // Filter tags shared by 2 or more members
  const consensusCandidates = Array.from(tagCounts.entries())
    .filter(([_, count]) => count >= 2)
    .sort((a, b) => {
      // 1. Sort by count descending
      if (b[1] !== a[1]) {
        return b[1] - a[1];
      }
      // 2. Genres before artists
      const isGenreA = TAXONOMY_MAP[a[0]]?.category === 'genre';
      const isGenreB = TAXONOMY_MAP[b[0]]?.category === 'genre';
      if (isGenreA && !isGenreB) return -1;
      if (!isGenreA && isGenreB) return 1;
      // 3. Alphabetical tie-breaker
      return a[0].localeCompare(b[0]);
    });

  return consensusCandidates.map(([tag]) => tag);
}

/**
 * Evaluates the musical harmony of a group of participants
 */
export function calculateGroupMusicScore(members: Participant[]): GroupMusicEvaluation {
  if (!members || members.length === 0) {
    return {
      avgPairwise: 0,
      minPairwise: 0,
      consensusTags: [],
      compositeScore: 0,
    };
  }

  if (members.length === 1) {
    return {
      avgPairwise: 1.0,
      minPairwise: 1.0,
      consensusTags: [...(members[0].musicPreferences ?? [])],
      compositeScore: 1.0,
    };
  }

  const pairwiseScores: number[] = [];

  for (let i = 0; i < members.length; i++) {
    for (let j = i + 1; j < members.length; j++) {
      const sim = calculateHierarchicalSimilarity(
        members[i].musicPreferences,
        members[j].musicPreferences
      );
      pairwiseScores.push(sim);
    }
  }

  const avgPairwise =
    pairwiseScores.length > 0
      ? Math.round((pairwiseScores.reduce((sum, s) => sum + s, 0) / pairwiseScores.length) * 10000) /
        10000
      : 0;

  const minPairwise =
    pairwiseScores.length > 0
      ? Math.round(Math.min(...pairwiseScores) * 10000) / 10000
      : 0;

  const consensusTags = findConsensusTags(members);

  // If completely disjoint, composite score is 0
  if (avgPairwise === 0) {
    return {
      avgPairwise: 0,
      minPairwise: 0,
      consensusTags,
      compositeScore: 0,
    };
  }

  // Consensus core bonus:
  // If at least one tag is shared by ALL members, +0.05 bonus
  // Else if shared by 2+ members, +0.02 bonus
  let consensusBonus = 0;
  const tagCounts = new Map<string, number>();
  for (const m of members) {
    const s = new Set<string>();
    for (const p of m.musicPreferences) {
      s.add(p);
      if (TAXONOMY_MAP[p]?.parentId) s.add(TAXONOMY_MAP[p].parentId!);
    }
    for (const t of s) {
      tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
    }
  }

  const maxSharedCount = Math.max(0, ...Array.from(tagCounts.values()));
  if (maxSharedCount >= members.length) {
    consensusBonus = 0.05;
  } else if (consensusTags.length > 0) {
    consensusBonus = 0.02;
  }

  const baseScore = 0.7 * avgPairwise + 0.3 * minPairwise;
  const compositeScore =
    Math.min(1.0, Math.round((baseScore + consensusBonus) * 10000) / 10000);

  return {
    avgPairwise,
    minPairwise,
    consensusTags,
    compositeScore,
  };
}
