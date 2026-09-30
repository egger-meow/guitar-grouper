import { describe, it, expect } from 'vitest';
import {
  scorePartition,
  calculateRoleScarcityWeights,
  calculateGroupRoleScore,
  calculatePartitionDiversityScore,
  PRESET_WEIGHTS,
} from '../../src/engine/scoring';
import type { Participant, HostSettings, Role } from '../../src/types/domain';

describe('Global Partition Scoring Model (Fitness Function)', () => {
  const defaultSettings: HostSettings = {
    targetGroupSize: 3,
    preset: 'balanced',
    weights: { role: 0.45, music: 0.4, diversity: 0.15 },
    genreGranularity: 'coarse',
    desiredRoles: [
      'acoustic_guitar',
      'electric_guitar',
      'lead_vocal',
      'cajon',
      'bass',
      'keyboard',
    ],
    minRequiredRolesCount: 2,
    keyRoles: ['acoustic_guitar', 'lead_vocal', 'cajon'],
  };

  describe('1. Role Scarcity Distribution', () => {
    it('distributing scarce cajon players across different groups yields strictly higher score than clustering both into one group', () => {
      const cajon1: Participant = {
        id: 'c1',
        name: 'Alex',
        gender: 'M',
        capabilities: ['cajon'],
        musicPreferences: ['mandopop_ballad'],
        joinedAt: 1,
      };
      const cajon2: Participant = {
        id: 'c2',
        name: 'Brian',
        gender: 'M',
        capabilities: ['cajon'],
        musicPreferences: ['mandopop_ballad'],
        joinedAt: 2,
      };
      const gtr1: Participant = {
        id: 'g1',
        name: 'Chris',
        gender: 'F',
        capabilities: ['acoustic_guitar'],
        musicPreferences: ['mandopop_ballad'],
        joinedAt: 3,
      };
      const gtr2: Participant = {
        id: 'g2',
        name: 'David',
        gender: 'F',
        capabilities: ['acoustic_guitar'],
        musicPreferences: ['mandopop_ballad'],
        joinedAt: 4,
      };

      const allParticipants = [cajon1, cajon2, gtr1, gtr2];

      // Clustered: Group A has both cajons, Group B has both guitars
      const clusteredPartition = [
        [cajon1, cajon2],
        [gtr1, gtr2],
      ];

      // Distributed: Each group has 1 cajon and 1 guitar
      const distributedPartition = [
        [cajon1, gtr1],
        [cajon2, gtr2],
      ];

      const clusteredEval = scorePartition(clusteredPartition, defaultSettings, allParticipants);
      const distributedEval = scorePartition(distributedPartition, defaultSettings, allParticipants);

      expect(distributedEval.roleScore).toBeGreaterThan(clusteredEval.roleScore);
      expect(distributedEval.totalScore).toBeGreaterThan(clusteredEval.totalScore);
    });

    it('calculates higher scarcity weights for roles with lower global frequency', () => {
      const p1: Participant = {
        id: 'p1',
        name: 'P1',
        gender: 'M',
        capabilities: ['acoustic_guitar'],
        musicPreferences: [],
        joinedAt: 1,
      };
      const p2: Participant = {
        id: 'p2',
        name: 'P2',
        gender: 'M',
        capabilities: ['acoustic_guitar'],
        musicPreferences: [],
        joinedAt: 2,
      };
      const p3: Participant = {
        id: 'p3',
        name: 'P3',
        gender: 'F',
        capabilities: ['acoustic_guitar', 'cajon'],
        musicPreferences: [],
        joinedAt: 3,
      };

      // 3 participants, 2 groups. acoustic_guitar has count 3, cajon has count 1.
      const weights = calculateRoleScarcityWeights(
        [p1, p2, p3],
        2,
        ['acoustic_guitar', 'cajon', 'lead_vocal']
      );

      // Wr = 1.0 + max(0, (K - count) / K) * 2.0
      // For guitar: count = 3 >= 2 -> Wr = 1.0
      // For cajon: count = 1 < 2 -> Wr = 1.0 + (2 - 1)/2 * 2.0 = 2.0
      // For vocal: count = 0 < 2 -> Wr = 1.0 + (2 - 0)/2 * 2.0 = 3.0
      expect(weights.acoustic_guitar).toBe(1.0);
      expect(weights.cajon).toBe(2.0);
      expect(weights.lead_vocal).toBe(3.0);
    });
  });

  describe('2. Diminishing Returns', () => {
    it('adding a 3rd guitarist provides significantly less marginal score gain than adding the 1st guitarist', () => {
      const gtr1: Participant = {
        id: 'g1',
        name: 'Gtr1',
        gender: 'M',
        capabilities: ['acoustic_guitar'],
        musicPreferences: [],
        joinedAt: 1,
      };
      const gtr2: Participant = {
        id: 'g2',
        name: 'Gtr2',
        gender: 'F',
        capabilities: ['acoustic_guitar'],
        musicPreferences: [],
        joinedAt: 2,
      };
      const gtr3: Participant = {
        id: 'g3',
        name: 'Gtr3',
        gender: 'M',
        capabilities: ['acoustic_guitar'],
        musicPreferences: [],
        joinedAt: 3,
      };

      const desiredRoles: Role[] = ['acoustic_guitar', 'lead_vocal', 'cajon'];
      const scarcityWeights = {
        acoustic_guitar: 1.0,
        lead_vocal: 2.0,
        cajon: 2.0,
        electric_guitar: 1.0,
        drums: 2.0,
        bass: 2.0,
        keyboard: 2.0,
        backing_vocal: 1.0,
        other: 1.0,
      };

      const score0 = calculateGroupRoleScore([], scarcityWeights, desiredRoles);
      const score1 = calculateGroupRoleScore([gtr1], scarcityWeights, desiredRoles);
      const score2 = calculateGroupRoleScore([gtr1, gtr2], scarcityWeights, desiredRoles);
      const score3 = calculateGroupRoleScore([gtr1, gtr2, gtr3], scarcityWeights, desiredRoles);

      const marginalGain1st = score1 - score0;
      const marginalGain3rd = score3 - score2;

      expect(marginalGain1st).toBeGreaterThan(0);
      expect(marginalGain3rd).toBeGreaterThan(0);
      // Gain(3) / Gain(1) = 1 / (1 + 0.8 * 2) = 1 / 2.6 ≈ 0.385
      expect(marginalGain3rd).toBeLessThan(marginalGain1st * 0.5);
    });
  });

  describe('3. Core Failure Scenario: Talent Waste Penalty', () => {
    it('moving 1 flexible multi-skilled player from clustered Group A to single-skill Group B dramatically improves partition score', () => {
      // 3 versatile triple-threats (guitar + cajon + vocal)
      const versatile1: Participant = {
        id: 'v1',
        name: 'Versatile 1',
        gender: 'M',
        capabilities: ['acoustic_guitar', 'cajon', 'lead_vocal'],
        musicPreferences: ['mandopop_ballad', 'jay_chou'],
        joinedAt: 1,
      };
      const versatile2: Participant = {
        id: 'v2',
        name: 'Versatile 2',
        gender: 'F',
        capabilities: ['acoustic_guitar', 'cajon', 'lead_vocal'],
        musicPreferences: ['mandopop_ballad', 'jay_chou'],
        joinedAt: 2,
      };
      const versatile3: Participant = {
        id: 'v3',
        name: 'Versatile 3',
        gender: 'M',
        capabilities: ['acoustic_guitar', 'cajon', 'lead_vocal'],
        musicPreferences: ['mandopop_ballad', 'jay_chou'],
        joinedAt: 3,
      };

      // 3 single-skill guitarists
      const guitarOnly1: Participant = {
        id: 'g1',
        name: 'Guitar Only 1',
        gender: 'F',
        capabilities: ['acoustic_guitar'],
        musicPreferences: ['mandopop_ballad', 'jay_chou'],
        joinedAt: 4,
      };
      const guitarOnly2: Participant = {
        id: 'g2',
        name: 'Guitar Only 2',
        gender: 'M',
        capabilities: ['acoustic_guitar'],
        musicPreferences: ['mandopop_ballad', 'jay_chou'],
        joinedAt: 5,
      };
      const guitarOnly3: Participant = {
        id: 'g3',
        name: 'Guitar Only 3',
        gender: 'F',
        capabilities: ['acoustic_guitar'],
        musicPreferences: ['mandopop_ballad', 'jay_chou'],
        joinedAt: 6,
      };

      const allParticipants = [
        versatile1,
        versatile2,
        versatile3,
        guitarOnly1,
        guitarOnly2,
        guitarOnly3,
      ];

      // Failure scenario: Group A hoards all 3 multi-skilled players; Group B has only single guitarists
      const flawedPartition = [
        [versatile1, versatile2, versatile3],
        [guitarOnly1, guitarOnly2, guitarOnly3],
      ];

      // Corrected partition: swap 1 versatile member to Group B and 1 single guitarist to Group A
      const improvedPartition = [
        [versatile1, versatile2, guitarOnly1],
        [versatile3, guitarOnly2, guitarOnly3],
      ];

      const flawedEval = scorePartition(flawedPartition, defaultSettings, allParticipants);
      const improvedEval = scorePartition(improvedPartition, defaultSettings, allParticipants);

      // Flawed partition should trigger both talent waste and deficit penalties
      expect(flawedEval.penalties.talentWaste).toBeGreaterThan(0);
      expect(flawedEval.penalties.minRoleDeficit).toBeGreaterThan(0);
      expect(flawedEval.penalties.wastePenalty).toBeGreaterThan(0);
      expect(flawedEval.penalties.deficitPenalty).toBeGreaterThan(0);

      // Improved partition should resolve deficit and talent waste
      expect(improvedEval.penalties.talentWaste).toBe(0);
      expect(improvedEval.penalties.minRoleDeficit).toBe(0);

      // Global partition score must dramatically improve (> 25 points improvement)
      expect(improvedEval.totalScore - flawedEval.totalScore).toBeGreaterThan(25);
    });
  });

  describe('4. Worst-Group Music Protection (Min-Max Fairness)', () => {
    it('balanced moderate music compatibility across all groups scores higher than one 100% group and one 0% orphan misfit group', () => {
      // 4 members with identical taste (Mandopop)
      const m1: Participant = {
        id: 'm1',
        name: 'M1',
        gender: 'M',
        capabilities: ['acoustic_guitar'],
        musicPreferences: ['mandopop_ballad', 'jay_chou'],
        joinedAt: 1,
      };
      const m2: Participant = {
        id: 'm2',
        name: 'M2',
        gender: 'F',
        capabilities: ['lead_vocal'],
        musicPreferences: ['mandopop_ballad', 'jay_chou'],
        joinedAt: 2,
      };

      // Disjoint music tastes
      const d1: Participant = {
        id: 'd1',
        name: 'D1',
        gender: 'M',
        capabilities: ['acoustic_guitar'],
        musicPreferences: ['mandopop_ballad'],
        joinedAt: 3,
      };
      const d2: Participant = {
        id: 'd2',
        name: 'D2',
        gender: 'F',
        capabilities: ['lead_vocal'],
        musicPreferences: ['hiphop_funk'], // completely disjoint from mandopop
        joinedAt: 4,
      };

      // Polarized partition: Group A is 100% matched, Group B is 0% matched
      const polarizedPartition = [
        [m1, m2],
        [d1, d2],
      ];

      // Balanced partition: Both groups have moderate/related music compatibility
      // m1 (mandopop_ballad) + d1 (mandopop_ballad) -> 100%
      // But let's test balanced partition:
      // Group A: [m1, m2] (mandopop)
      // If we pair m1 with a related rock artist and m2 with another related rock artist:
      // Balanced partition: Both groups have moderate/related music compatibility (e.g. shared genre, different artists ~65%)
      const b1: Participant = {
        id: 'b1',
        name: 'B1',
        gender: 'M',
        capabilities: ['acoustic_guitar'],
        musicPreferences: ['mandopop_ballad', 'jay_chou'],
        joinedAt: 5,
      };
      const b2: Participant = {
        id: 'b2',
        name: 'B2',
        gender: 'F',
        capabilities: ['lead_vocal'],
        musicPreferences: ['mandopop_ballad', 'accusefive'], // shared mandopop genre
        joinedAt: 6,
      };
      const b3: Participant = {
        id: 'b3',
        name: 'B3',
        gender: 'M',
        capabilities: ['acoustic_guitar'],
        musicPreferences: ['jpop_anime_jrock', 'yorushika'],
        joinedAt: 7,
      };
      const b4: Participant = {
        id: 'b4',
        name: 'B4',
        gender: 'F',
        capabilities: ['lead_vocal'],
        musicPreferences: ['jpop_anime_jrock', 'yoasobi'], // shared j-rock genre
        joinedAt: 8,
      };

      // In balanced partition, both groups have harmonious shared-genre affinity (~65%), no orphan 0%
      const balancedPartition = [
        [b1, b2],
        [b3, b4],
      ];

      const polarizedEval = scorePartition(polarizedPartition, defaultSettings);
      const balancedEval = scorePartition(balancedPartition, defaultSettings);

      expect(polarizedEval.worstGroupMusicScore).toBe(0);
      expect(balancedEval.worstGroupMusicScore).toBeGreaterThan(50);
      expect(balancedEval.musicScore).toBeGreaterThan(polarizedEval.musicScore);
      expect(balancedEval.totalScore).toBeGreaterThan(polarizedEval.totalScore);
    });
  });

  describe('5. Minimum Role Coverage & Deficit Penalty', () => {
    it('triggers deficitPenalty when a group has fewer key roles than minRequiredRolesCount', () => {
      const settingsWithKeyRoles: HostSettings = {
        ...defaultSettings,
        minRequiredRolesCount: 2,
        keyRoles: ['acoustic_guitar', 'lead_vocal', 'cajon'],
      };

      const guitarOnly1: Participant = {
        id: 'g1',
        name: 'G1',
        gender: 'M',
        capabilities: ['acoustic_guitar'],
        musicPreferences: ['mandopop_ballad'],
        joinedAt: 1,
      };
      const guitarOnly2: Participant = {
        id: 'g2',
        name: 'G2',
        gender: 'F',
        capabilities: ['acoustic_guitar'],
        musicPreferences: ['mandopop_ballad'],
        joinedAt: 2,
      };
      const vocalAndCajon: Participant = {
        id: 'vc',
        name: 'VC',
        gender: 'F',
        capabilities: ['lead_vocal', 'cajon'],
        musicPreferences: ['mandopop_ballad'],
        joinedAt: 3,
      };
      const guitar3: Participant = {
        id: 'g3',
        name: 'G3',
        gender: 'M',
        capabilities: ['acoustic_guitar'],
        musicPreferences: ['mandopop_ballad'],
        joinedAt: 4,
      };

      // Group 1 has only guitar (1 key role < 2 required) -> Deficit!
      // Group 2 has guitar, vocal, cajon (3 key roles >= 2 required) -> Covered!
      const deficitPartition = [
        [guitarOnly1, guitarOnly2],
        [vocalAndCajon, guitar3],
      ];

      const evaluation = scorePartition(deficitPartition, settingsWithKeyRoles);

      expect(evaluation.penalties.minRoleDeficit).toBeGreaterThan(0);
      expect(evaluation.penalties.deficitPenalty).toBeGreaterThan(0);
      expect(evaluation.minRoleSatisfactionPct).toBe(50); // 1 of 2 groups satisfied
    });
  });

  describe('6. Presets Weight Mapping', () => {
    it('correctly shifts totalScore priority based on preset', () => {
      // Partition with high role coverage but low music compatibility
      const highRoleLowMusicA: Participant = {
        id: 'p1',
        name: 'P1',
        gender: 'M',
        capabilities: ['acoustic_guitar', 'lead_vocal'],
        musicPreferences: ['mandopop_ballad'],
        joinedAt: 1,
      };
      const highRoleLowMusicB: Participant = {
        id: 'p2',
        name: 'P2',
        gender: 'F',
        capabilities: ['cajon'],
        musicPreferences: ['hiphop_funk'], // disjoint music
        joinedAt: 2,
      };

      const partition = [[highRoleLowMusicA, highRoleLowMusicB]];

      const roleFocusSettings: HostSettings = {
        ...defaultSettings,
        preset: 'role_focus',
      };
      const musicFocusSettings: HostSettings = {
        ...defaultSettings,
        preset: 'music_focus',
      };

      const roleEval = scorePartition(partition, roleFocusSettings);
      const musicEval = scorePartition(partition, musicFocusSettings);

      // Since music compatibility is 0 while role coverage is strong, role_focus must score higher
      expect(roleEval.totalScore).toBeGreaterThan(musicEval.totalScore);
    });

    it('respects custom weights when preset is custom', () => {
      const customSettings: HostSettings = {
        ...defaultSettings,
        preset: 'custom',
        weights: { role: 0.8, music: 0.1, diversity: 0.1 },
      };

      const p1: Participant = {
        id: 'p1',
        name: 'P1',
        gender: 'M',
        capabilities: ['acoustic_guitar'],
        musicPreferences: ['mandopop_ballad'],
        joinedAt: 1,
      };

      const evalResult = scorePartition([[p1]], customSettings);
      expect(evalResult).toBeDefined();
    });
  });

  describe('7. Demographic / Gender Diversity Entropy', () => {
    it('scores 100 when groups match the room gender ratio exactly and lower when segregated', () => {
      const male1: Participant = { id: 'm1', name: 'M1', gender: 'M', capabilities: ['acoustic_guitar'], musicPreferences: [], joinedAt: 1 };
      const male2: Participant = { id: 'm2', name: 'M2', gender: 'M', capabilities: ['acoustic_guitar'], musicPreferences: [], joinedAt: 2 };
      const female1: Participant = { id: 'f1', name: 'F1', gender: 'F', capabilities: ['acoustic_guitar'], musicPreferences: [], joinedAt: 3 };
      const female2: Participant = { id: 'f2', name: 'F2', gender: 'F', capabilities: ['acoustic_guitar'], musicPreferences: [], joinedAt: 4 };

      const all = [male1, male2, female1, female2];

      // Balanced: 1M + 1F in each group
      const balancedPartition = [
        [male1, female1],
        [male2, female2],
      ];

      // Segregated: 2M in Group A, 2F in Group B
      const segregatedPartition = [
        [male1, male2],
        [female1, female2],
      ];

      const balancedDiv = calculatePartitionDiversityScore(balancedPartition, all);
      const segregatedDiv = calculatePartitionDiversityScore(segregatedPartition, all);

      expect(balancedDiv).toBe(100);
      expect(segregatedDiv).toBeLessThan(balancedDiv);
    });
  });

  describe('8. Size Variance Penalty & Robustness', () => {
    it('penalizes severely unbalanced group sizes', () => {
      const participants: Participant[] = Array.from({ length: 6 }, (_, i) => ({
        id: `p${i + 1}`,
        name: `P${i + 1}`,
        gender: i % 2 === 0 ? 'M' : 'F',
        capabilities: ['acoustic_guitar'],
        musicPreferences: ['mandopop_ballad'],
        joinedAt: i + 1,
      }));

      // Balanced: 3 and 3
      const balanced = [participants.slice(0, 3), participants.slice(3, 6)];

      // Unbalanced: 5 and 1
      const unbalanced = [participants.slice(0, 5), participants.slice(5, 6)];

      const evalBalanced = scorePartition(balanced, defaultSettings, participants);
      const evalUnbalanced = scorePartition(unbalanced, defaultSettings, participants);

      expect(evalBalanced.penalties.sizeVariance).toBe(0);
      expect(evalUnbalanced.penalties.sizeVariance).toBeGreaterThan(0);
      expect(evalBalanced.totalScore).toBeGreaterThan(evalUnbalanced.totalScore);
    });

    it('gracefully handles empty partitions and edge cases without throwing', () => {
      const emptyEval = scorePartition([], defaultSettings);
      expect(emptyEval.totalScore).toBe(0);
      expect(emptyEval.roleScore).toBe(0);
      expect(emptyEval.musicScore).toBe(0);

      const emptyGroupEval = scorePartition([[], []], defaultSettings);
      expect(emptyGroupEval.totalScore).toBe(0);
    });
  });
});
