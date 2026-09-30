import { describe, it, expect } from 'vitest';
import { optimizeGrouping, calculateGroupCapacities } from '../../src/engine/optimizer';
import { createPrng } from '../../src/engine/prng';
import type { Participant, HostSettings, Role } from '../../src/types/domain';

describe('Deterministic PRNG (Mulberry32)', () => {
  it('generates reproducible float sequences with identical seeds', () => {
    const rng1 = createPrng(12345);
    const rng2 = createPrng(12345);

    const seq1 = [rng1(), rng1(), rng1(), rng1(), rng1()];
    const seq2 = [rng2(), rng2(), rng2(), rng2(), rng2()];

    expect(seq1).toEqual(seq2);
    for (const val of seq1) {
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThan(1);
    }
  });

  it('generates different sequences with different seeds', () => {
    const rng1 = createPrng(111);
    const rng2 = createPrng(999);

    const seq1 = [rng1(), rng1(), rng1()];
    const seq2 = [rng2(), rng2(), rng2()];

    expect(seq1).not.toEqual(seq2);
  });
});

describe('Grouping Optimizer (Constructive Seeding + Simulated Annealing + Diagnostics)', () => {
  const baseSettings: HostSettings = {
    targetGroupSize: 4,
    preset: 'balanced',
    weights: { role: 0.45, music: 0.4, diversity: 0.15 },
    genreGranularity: 'coarse',
    desiredRoles: [
      'acoustic_guitar',
      'electric_guitar',
      'cajon',
      'bass',
      'keyboard',
      'lead_vocal',
    ],
    minRequiredRolesCount: 2,
    keyRoles: ['acoustic_guitar', 'lead_vocal', 'cajon'],
  };

  describe('1. Deterministic Output', () => {
    it('generates 100% identical group assignments across multiple runs with the same seed', () => {
      const participants: Participant[] = [
        {
          id: 'p1',
          name: '林宥嘉',
          gender: 'M',
          capabilities: ['lead_vocal', 'acoustic_guitar'],
          musicPreferences: ['mandopop_ballad', 'yoga_lin'],
          joinedAt: 1,
        },
        {
          id: 'p2',
          name: '李榮浩',
          gender: 'M',
          capabilities: ['acoustic_guitar', 'electric_guitar', 'bass'],
          musicPreferences: ['mandopop_ballad', 'li_ronghao'],
          joinedAt: 2,
        },
        {
          id: 'p3',
          name: '魏如萱',
          gender: 'F',
          capabilities: ['lead_vocal'],
          musicPreferences: ['indie_rock', 'waa_wei'],
          joinedAt: 3,
        },
        {
          id: 'p4',
          name: '陳綺貞',
          gender: 'F',
          capabilities: ['acoustic_guitar', 'lead_vocal'],
          musicPreferences: ['mandopop_ballad', 'cheer_chen'],
          joinedAt: 4,
        },
        {
          id: 'p5',
          name: '張震嶽',
          gender: 'M',
          capabilities: ['acoustic_guitar', 'cajon'],
          musicPreferences: ['indie_rock', 'chang_chen_yue'],
          joinedAt: 5,
        },
        {
          id: 'p6',
          name: '盧廣仲',
          gender: 'M',
          capabilities: ['acoustic_guitar', 'lead_vocal'],
          musicPreferences: ['mandopop_ballad', 'crowd_lu'],
          joinedAt: 6,
        },
      ];

      const settings: HostSettings = {
        ...baseSettings,
        targetGroupSize: 3,
      };

      const run1 = optimizeGrouping(participants, settings, 42);
      const run2 = optimizeGrouping(participants, settings, 42);

      expect(run1.groups.length).toBe(run2.groups.length);
      for (let i = 0; i < run1.groups.length; i++) {
        expect(run1.groups[i].memberIds.sort()).toEqual(run2.groups[i].memberIds.sort());
      }
      expect(run1.diagnostics.totalScore).toBe(run2.diagnostics.totalScore);
    });
  });

  describe('2. Balanced Group Sizing', () => {
    it('23 participants with target size 4 outputs 5 groups of sizes [5, 5, 5, 4, 4]', () => {
      const participants: Participant[] = Array.from({ length: 23 }, (_, i) => ({
        id: `p-${i + 1}`,
        name: `社員${i + 1}`,
        gender: i % 2 === 0 ? 'M' : 'F',
        capabilities: ['acoustic_guitar'],
        musicPreferences: ['mandopop_ballad'],
        joinedAt: i + 1,
      }));

      const settings: HostSettings = {
        ...baseSettings,
        targetGroupSize: 4,
      };

      const result = optimizeGrouping(participants, settings, 42);
      expect(result.groups.length).toBe(5);

      const sizes = result.groups.map((g) => g.members.length).sort((a, b) => b - a);
      expect(sizes).toEqual([5, 5, 5, 4, 4]);

      // All participants unique and accounted for
      const allAssignedIds = result.groups.flatMap((g) => g.memberIds);
      expect(allAssignedIds.length).toBe(23);
      expect(new Set(allAssignedIds).size).toBe(23);
    });

    it('10 participants with target size 3 outputs 3 groups of sizes [4, 3, 3]', () => {
      const participants: Participant[] = Array.from({ length: 10 }, (_, i) => ({
        id: `p-${i + 1}`,
        name: `社員${i + 1}`,
        gender: i % 2 === 0 ? 'M' : 'F',
        capabilities: ['acoustic_guitar'],
        musicPreferences: ['mandopop_ballad'],
        joinedAt: i + 1,
      }));

      const settings: HostSettings = {
        ...baseSettings,
        targetGroupSize: 3,
      };

      const result = optimizeGrouping(participants, settings, 42);
      expect(result.groups.length).toBe(3);

      const sizes = result.groups.map((g) => g.members.length).sort((a, b) => b - a);
      expect(sizes).toEqual([4, 3, 3]);
    });

    it('12 participants with target size 4 outputs 3 groups of sizes [4, 4, 4]', () => {
      const participants: Participant[] = Array.from({ length: 12 }, (_, i) => ({
        id: `p-${i + 1}`,
        name: `社員${i + 1}`,
        gender: i % 2 === 0 ? 'M' : 'F',
        capabilities: ['acoustic_guitar'],
        musicPreferences: ['mandopop_ballad'],
        joinedAt: i + 1,
      }));

      const settings: HostSettings = {
        ...baseSettings,
        targetGroupSize: 4,
      };

      const result = optimizeGrouping(participants, settings, 42);
      expect(result.groups.length).toBe(3);

      const sizes = result.groups.map((g) => g.members.length);
      expect(sizes).toEqual([4, 4, 4]);
    });

    it('chooses a balanced feasible partition for 23 participants within [3, 5]', () => {
      const participants: Participant[] = Array.from({ length: 23 }, (_, i) => ({
        id: `p-${i + 1}`,
        name: `社員${i + 1}`,
        gender: i % 2 === 0 ? 'M' : 'F',
        capabilities: ['acoustic_guitar'],
        musicPreferences: ['mandopop_ballad'],
        joinedAt: i + 1,
      }));

      const settings: HostSettings = {
        ...baseSettings,
        minGroupSize: 3,
        maxGroupSize: 5,
        targetGroupSize: 4,
      };

      const result = optimizeGrouping(participants, settings, 42);
      expect(result.groups.length).toBeGreaterThanOrEqual(5);
      expect(result.groups.length).toBeLessThanOrEqual(7);

      const sizes = result.groups.map((g) => g.members.length).sort((a, b) => b - a);
      expect(sizes.reduce((sum, size) => sum + size, 0)).toBe(23);
      expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
      for (const size of sizes) {
        expect(size).toBeGreaterThanOrEqual(3);
        expect(size).toBeLessThanOrEqual(5);
      }
    });

    it('supports custom leader ranges such as [4, 6] and [2, 4] via calculateGroupCapacities', () => {
      // 17 participants with range [4, 6]
      const cap46 = calculateGroupCapacities(17, { minGroupSize: 4, maxGroupSize: 6, targetGroupSize: 5 });
      expect(cap46.K).toBe(3);
      expect(cap46.capacities).toEqual([6, 6, 5]);

      // 10 participants with range [2, 4]
      const cap24 = calculateGroupCapacities(10, { minGroupSize: 2, maxGroupSize: 4, targetGroupSize: 3 });
      expect(cap24.K).toBe(3);
      expect(cap24.capacities).toEqual([4, 3, 3]);

      // 7 participants with range [3, 4]
      const cap34 = calculateGroupCapacities(7, { minGroupSize: 3, maxGroupSize: 4, targetGroupSize: 3 });
      expect(cap34.K).toBe(2);
      expect(cap34.capacities).toEqual([4, 3]);
    });
  });

  describe('3. Scarce Role Distribution', () => {
    it('distributes 3 cajon players across 3 groups so that every group receives exactly 1 cajon player', () => {
      const cajonPlayers: Participant[] = [
        {
          id: 'cajon-1',
          name: '鼓手阿翔',
          gender: 'M',
          capabilities: ['cajon'],
          musicPreferences: ['mandopop_ballad'],
          joinedAt: 1,
        },
        {
          id: 'cajon-2',
          name: '鼓手小明',
          gender: 'M',
          capabilities: ['cajon'],
          musicPreferences: ['mandopop_ballad'],
          joinedAt: 2,
        },
        {
          id: 'cajon-3',
          name: '鼓手大華',
          gender: 'F',
          capabilities: ['cajon'],
          musicPreferences: ['mandopop_ballad'],
          joinedAt: 3,
        },
      ];

      const guitarists: Participant[] = Array.from({ length: 9 }, (_, i) => ({
        id: `gtr-${i + 1}`,
        name: `吉他手${i + 1}`,
        gender: i % 2 === 0 ? 'M' : 'F',
        capabilities: ['acoustic_guitar'] as Role[],
        musicPreferences: ['mandopop_ballad'],
        joinedAt: i + 4,
      }));

      const participants = [...cajonPlayers, ...guitarists];
      const settings: HostSettings = {
        ...baseSettings,
        targetGroupSize: 4, // 12 participants / 4 = 3 groups
        desiredRoles: ['acoustic_guitar', 'cajon'],
        keyRoles: ['cajon'],
      };

      const result = optimizeGrouping(participants, settings, 123);
      expect(result.groups.length).toBe(3);

      // Verify each group has exactly 1 cajon player
      for (const group of result.groups) {
        const cajonCount = group.members.filter((m) => m.capabilities.includes('cajon')).length;
        expect(cajonCount).toBe(1);
      }
    });
  });

  describe('4. User Core Scenario Optimization (Triple-threat vs Guitar-only)', () => {
    it('distributes 3 triple-threats across 2 groups so both groups have vocal and cajon coverage', () => {
      const tripleThreats: Participant[] = [
        {
          id: 'multi-1',
          name: '全能社長',
          gender: 'M',
          capabilities: ['acoustic_guitar', 'cajon', 'lead_vocal'],
          musicPreferences: ['mandopop_ballad'],
          joinedAt: 1,
        },
        {
          id: 'multi-2',
          name: '全能副社',
          gender: 'F',
          capabilities: ['acoustic_guitar', 'cajon', 'lead_vocal'],
          musicPreferences: ['mandopop_ballad'],
          joinedAt: 2,
        },
        {
          id: 'multi-3',
          name: '全能教學',
          gender: 'M',
          capabilities: ['acoustic_guitar', 'cajon', 'lead_vocal'],
          musicPreferences: ['mandopop_ballad'],
          joinedAt: 3,
        },
      ];

      const guitarists: Participant[] = [
        {
          id: 'gtr-1',
          name: '新手小美',
          gender: 'F',
          capabilities: ['acoustic_guitar'],
          musicPreferences: ['mandopop_ballad'],
          joinedAt: 4,
        },
        {
          id: 'gtr-2',
          name: '新手阿強',
          gender: 'M',
          capabilities: ['acoustic_guitar'],
          musicPreferences: ['mandopop_ballad'],
          joinedAt: 5,
        },
        {
          id: 'gtr-3',
          name: '新手小志',
          gender: 'M',
          capabilities: ['acoustic_guitar'],
          musicPreferences: ['mandopop_ballad'],
          joinedAt: 6,
        },
      ];

      const participants = [...tripleThreats, ...guitarists];
      const settings: HostSettings = {
        ...baseSettings,
        targetGroupSize: 3, // 6 participants / 3 = 2 groups
        desiredRoles: ['acoustic_guitar', 'cajon', 'lead_vocal'],
        keyRoles: ['cajon', 'lead_vocal'],
        minRequiredRolesCount: 2,
      };

      const result = optimizeGrouping(participants, settings, 777);
      expect(result.groups.length).toBe(2);

      // Verify that NEITHER group has 0 triple-threats (they should NOT be clustered 3-0)
      const g0Multi = result.groups[0].members.filter((m) => m.capabilities.length >= 3).length;
      const g1Multi = result.groups[1].members.filter((m) => m.capabilities.length >= 3).length;

      expect(g0Multi).toBeGreaterThanOrEqual(1);
      expect(g1Multi).toBeGreaterThanOrEqual(1);

      // Both groups must have vocal and cajon covered
      for (const group of result.groups) {
        const hasVocal = group.members.some((m) => m.capabilities.includes('lead_vocal'));
        const hasCajon = group.members.some((m) => m.capabilities.includes('cajon'));
        expect(hasVocal).toBe(true);
        expect(hasCajon).toBe(true);
      }
    });
  });

  describe('5. Music Preference Clumping', () => {
    it('groups Yorushika & J-Rock fans together and Mandopop fans together', () => {
      const jrockFans: Participant[] = [
        {
          id: 'jr-1',
          name: 'Suis',
          gender: 'F',
          capabilities: ['lead_vocal'],
          musicPreferences: ['jpop_anime_jrock', 'yorushika'],
          joinedAt: 1,
        },
        {
          id: 'jr-2',
          name: 'N-buna',
          gender: 'M',
          capabilities: ['acoustic_guitar'],
          musicPreferences: ['jpop_anime_jrock', 'yorushika'],
          joinedAt: 2,
        },
        {
          id: 'jr-3',
          name: 'Ikura',
          gender: 'F',
          capabilities: ['lead_vocal'],
          musicPreferences: ['jpop_anime_jrock', 'yoasobi'],
          joinedAt: 3,
        },
        {
          id: 'jr-4',
          name: 'Ayase',
          gender: 'M',
          capabilities: ['keyboard'],
          musicPreferences: ['jpop_anime_jrock', 'yoasobi'],
          joinedAt: 4,
        },
      ];

      const mpopFans: Participant[] = [
        {
          id: 'mp-1',
          name: '周董',
          gender: 'M',
          capabilities: ['keyboard'],
          musicPreferences: ['mandopop_ballad', 'jay_chou'],
          joinedAt: 5,
        },
        {
          id: 'mp-2',
          name: '阿潘',
          gender: 'F',
          capabilities: ['lead_vocal'],
          musicPreferences: ['mandopop_ballad', 'accusefive'],
          joinedAt: 6,
        },
        {
          id: 'mp-3',
          name: '犬青',
          gender: 'F',
          capabilities: ['lead_vocal'],
          musicPreferences: ['mandopop_ballad', 'accusefive'],
          joinedAt: 7,
        },
        {
          id: 'mp-4',
          name: '雲安',
          gender: 'M',
          capabilities: ['acoustic_guitar'],
          musicPreferences: ['mandopop_ballad', 'accusefive'],
          joinedAt: 8,
        },
      ];

      const participants = [...jrockFans, ...mpopFans];
      const settings: HostSettings = {
        ...baseSettings,
        targetGroupSize: 4, // 8 participants / 4 = 2 groups
        preset: 'music_focus',
      };

      const result = optimizeGrouping(participants, settings, 999);
      expect(result.groups.length).toBe(2);

      // Check that J-Rock fans are in one group and Mandopop fans are in the other
      const jrMemberIds = new Set(jrockFans.map((p) => p.id));
      const group0JrCount = result.groups[0].memberIds.filter((id) => jrMemberIds.has(id)).length;

      // Group 0 should either be all 4 J-Rock fans or 0 (meaning Group 1 is all 4)
      expect(group0JrCount === 4 || group0JrCount === 0).toBe(true);

      // Verify consensus tags reflect the genre clustering
      for (const group of result.groups) {
        expect(group.consensusTags.length).toBeGreaterThan(0);
      }
    });
  });

  describe('6. Diagnostics and Warnings', () => {
    it('generates friendly warning when desired role count is strictly less than group count', () => {
      // 20 participants, target size 4 -> 5 groups
      // Only 2 cajon players in the entire room
      const cajon1: Participant = {
        id: 'c-1',
        name: '小木',
        gender: 'M',
        capabilities: ['cajon'],
        musicPreferences: ['mandopop_ballad'],
        joinedAt: 1,
      };
      const cajon2: Participant = {
        id: 'c-2',
        name: '大木',
        gender: 'F',
        capabilities: ['cajon'],
        musicPreferences: ['mandopop_ballad'],
        joinedAt: 2,
      };
      const others: Participant[] = Array.from({ length: 18 }, (_, i) => ({
        id: `o-${i + 1}`,
        name: `社員${i + 1}`,
        gender: i % 2 === 0 ? 'M' : 'F',
        capabilities: ['acoustic_guitar'] as Role[],
        musicPreferences: ['mandopop_ballad'],
        joinedAt: i + 3,
      }));

      const participants = [cajon1, cajon2, ...others];
      const settings: HostSettings = {
        ...baseSettings,
        targetGroupSize: 4,
        desiredRoles: ['acoustic_guitar', 'cajon'],
      };

      const result = optimizeGrouping(participants, settings, 42);
      expect(result.groups.length).toBe(5);

      // Check warnings
      expect(result.warnings.length).toBeGreaterThan(0);
      const cajonWarning = result.warnings.find((w) => w.includes('木箱鼓'));
      expect(cajonWarning).toBeDefined();
      expect(cajonWarning).toContain('5');
      expect(cajonWarning).toContain('2');
      expect(cajonWarning).toContain('木箱鼓');
    });

    it('generates comprehensive group diagnostics, consensus tags, and band recommendations', () => {
      const participants: Participant[] = [
        {
          id: 'p1',
          name: '主唱阿信',
          gender: 'M',
          capabilities: ['lead_vocal'],
          musicPreferences: ['mandopop_ballad', 'jay_chou', 'accusefive'],
          joinedAt: 1,
        },
        {
          id: 'p2',
          name: '吉他手怪獸',
          gender: 'M',
          capabilities: ['acoustic_guitar', 'electric_guitar'],
          musicPreferences: ['mandopop_ballad', 'accusefive'],
          joinedAt: 2,
        },
        {
          id: 'p3',
          name: '鼓手冠佑',
          gender: 'M',
          capabilities: ['cajon'],
          musicPreferences: ['mandopop_ballad', 'accusefive'],
          joinedAt: 3,
        },
      ];

      const settings: HostSettings = {
        ...baseSettings,
        targetGroupSize: 3,
      };

      const result = optimizeGrouping(participants, settings, 42);
      expect(result.groups.length).toBe(1);

      const group = result.groups[0];
      expect(group.consensusTags).toContain('accusefive');
      expect(group.diagnosticsZh.length).toBeGreaterThan(0);
      expect(group.roleCoverage.length).toBeGreaterThan(0);

      expect(result.diagnostics.totalScore).toBeGreaterThan(0);
      expect(result.diagnostics.notesZh.length).toBeGreaterThan(0);
    });

    it('handles empty participants gracefully', () => {
      const result = optimizeGrouping([], baseSettings, 42);
      expect(result.groups).toEqual([]);
      expect(result.warnings).toEqual([]);
      expect(result.diagnostics.totalScore).toBe(0);
    });
  });

  describe('7. Performance & Scalability', () => {
    it('optimizes 30 participants within reasonable runtime limit', () => {
      const participants: Participant[] = Array.from({ length: 30 }, (_, i) => ({
        id: `p-${i + 1}`,
        name: `社員${i + 1}`,
        gender: i % 2 === 0 ? 'M' : 'F',
        capabilities: [i % 5 === 0 ? 'cajon' : i % 3 === 0 ? 'lead_vocal' : 'acoustic_guitar'] as Role[],
        musicPreferences: i % 2 === 0 ? ['mandopop_ballad', 'jay_chou'] : ['jpop_anime_jrock', 'yorushika'],
        joinedAt: i + 1,
      }));

      const start = performance.now();
      const result = optimizeGrouping(participants, baseSettings, 42);
      const elapsed = performance.now() - start;

      expect(result.groups.length).toBe(7);
      expect(elapsed).toBeLessThan(150);
    });
  });
});

