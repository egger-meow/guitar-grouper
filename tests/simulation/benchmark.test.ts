import { describe, it, expect } from 'vitest';
import {
  generateSyntheticRoom,
  ScenarioType,
  SCENARIO_TYPES,
} from '../../src/simulation/generator';
import {
  runRandomBaseline,
  runNaiveGreedyBaseline,
} from '../../src/simulation/baselines';
import {
  runBenchmarkComparison,
  DEFAULT_BENCHMARK_SETTINGS,
  BenchmarkComparisonResult,
} from '../../src/simulation/benchmark';
import { optimizeGrouping } from '../../src/engine/optimizer';
import type { HostSettings, Role } from '../../src/types/domain';
import { ROLES, GENRES, ARTISTS } from '../../src/engine/taxonomy';

describe('Task 5: Simulation Suite & Baselines Benchmark', () => {
  describe('Synthetic Room Generator (generator.ts)', () => {
    it('generates deterministic participants with Mulberry32 PRNG seed', () => {
      const roomA = generateSyntheticRoom(20, 'realistic', 12345);
      const roomB = generateSyntheticRoom(20, 'realistic', 12345);
      const roomC = generateSyntheticRoom(20, 'realistic', 99999);

      expect(roomA).toHaveLength(20);
      expect(roomB).toHaveLength(20);
      expect(roomA).toEqual(roomB);
      expect(roomA[0].name).not.toBe(roomC[0].name);
    });

    it('generates authentic guitar-club profiles using real taxonomy roles and music items', () => {
      const room = generateSyntheticRoom(50, 'realistic', 42);
      const validRoleIds = new Set(ROLES.map((r) => r.id));
      const validMusicIds = new Set([
        ...GENRES.map((g) => g.id),
        ...ARTISTS.map((a) => a.id),
      ]);

      expect(room).toHaveLength(50);
      for (const p of room) {
        expect(p.id).toMatch(/^p-\d+$/);
        expect(p.name.length).toBeGreaterThanOrEqual(2);
        expect(['M', 'F']).toContain(p.gender);
        expect(p.capabilities.length).toBeGreaterThanOrEqual(1);
        for (const cap of p.capabilities) {
          expect(validRoleIds.has(cap)).toBe(true);
        }
        expect(p.musicPreferences.length).toBeGreaterThanOrEqual(1);
        for (const pref of p.musicPreferences) {
          expect(validMusicIds.has(pref)).toBe(true);
        }
      }
    });

    it('generates expected distribution for all scenario types', () => {
      for (const scenario of SCENARIO_TYPES) {
        const room = generateSyntheticRoom(30, scenario, 100);
        expect(room.length).toBeGreaterThanOrEqual(30);

        if (scenario === 'scarce_drums') {
          const drummers = room.filter(
            (p) =>
              p.capabilities.includes('cajon') ||
              p.capabilities.includes('drums')
          );
          // Drums/cajon must be scarce relative to 30 participants (around 1-4 players)
          expect(drummers.length).toBeLessThanOrEqual(4);
          expect(drummers.length).toBeGreaterThanOrEqual(1);
        }

        if (scenario === 'scarce_vocals') {
          const vocalists = room.filter((p) =>
            p.capabilities.includes('lead_vocal')
          );
          expect(vocalists.length).toBeLessThanOrEqual(4);
          expect(vocalists.length).toBeGreaterThanOrEqual(1);
        }

        if (scenario === 'high_versatility_cluster') {
          const versatile = room.filter((p) => p.capabilities.length >= 3);
          expect(versatile.length).toBeGreaterThanOrEqual(4);
        }

        if (scenario === 'imbalanced_gender') {
          const males = room.filter((p) => p.gender === 'M').length;
          const ratio = males / room.length;
          expect(ratio >= 0.75 || ratio <= 0.25).toBe(true);
        }

        if (scenario === 'odd_counts') {
          expect(room.length % 2).toBe(1);
        }
      }
    });
  });

  describe('Baseline Algorithms (baselines.ts)', () => {
    const testSettings: HostSettings = {
      targetGroupSize: 4,
      preset: 'balanced',
      weights: { role: 0.45, music: 0.4, diversity: 0.15 },
      genreGranularity: 'fine',
      desiredRoles: ['acoustic_guitar', 'electric_guitar', 'cajon', 'lead_vocal'],
      minRequiredRolesCount: 2,
      keyRoles: ['cajon', 'lead_vocal'],
    };

    it('runRandomBaseline partitions participants into balanced group sizes', () => {
      const room = generateSyntheticRoom(23, 'realistic', 42);
      const result = runRandomBaseline(room, testSettings, 42);

      expect(result.groups).toHaveLength(5);
      const sizes = result.groups.map((g) => g.members.length);
      expect(sizes.sort((a, b) => b - a)).toEqual([5, 5, 5, 4, 4]);
      expect(result.diagnostics.totalScore).toBeGreaterThanOrEqual(0);
      expect(result.diagnostics.totalScore).toBeLessThanOrEqual(100);
    });

    it('runNaiveGreedyBaseline fills groups sequentially with greedy choice', () => {
      const room = generateSyntheticRoom(20, 'realistic', 42);
      const result = runNaiveGreedyBaseline(room, testSettings, 42);

      expect(result.groups).toHaveLength(5);
      for (const g of result.groups) {
        expect(g.members.length).toBe(4);
      }
      expect(result.diagnostics.totalScore).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Benchmark Comparison & Room Scales (10, 20, 30, 50, 100, 300)', () => {
    const scales = [10, 20, 30, 50, 100, 300];

    for (const count of scales) {
      it(`Room scale ${count}: optimizeGrouping outperforms Random Baseline`, () => {
        const comparison = runBenchmarkComparison(count, 'realistic', undefined, 42);

        expect(comparison.participantCount).toBe(count);
        expect(comparison.optimizer.totalScore).toBeGreaterThan(
          comparison.random.totalScore
        );
        expect(comparison.dominance.optimizerBeatsRandom).toBe(true);
        expect(comparison.dominance.scoreMarginOverRandom).toBeGreaterThan(0);
      });
    }

    it('Naive Greedy creates severe first-vs-last group disparity', () => {
      const comparison = runBenchmarkComparison(30, 'realistic', undefined, 42);
      // Greedy favors early groups at the expense of later groups, giving optimizer higher overall score or worst-group score
      expect(comparison.optimizer.totalScore).toBeGreaterThanOrEqual(
        comparison.naiveGreedy.totalScore
      );
      expect(comparison.optimizer.worstGroupScore).toBeGreaterThanOrEqual(
        comparison.naiveGreedy.worstGroupScore
      );
    });
  });

  describe('Adversarial Scenario Dominance', () => {
    it('scarce_drums: optimizer distributes drummers, yielding superior min-role satisfaction & dispersion', () => {
      const settings: HostSettings = {
        targetGroupSize: 4,
        preset: 'role_focus',
        weights: { role: 0.65, music: 0.2, diversity: 0.15 },
        genreGranularity: 'fine',
        desiredRoles: ['acoustic_guitar', 'cajon', 'drums', 'lead_vocal'],
        minRequiredRolesCount: 1,
        keyRoles: ['cajon', 'drums'],
      };

      const comparison = runBenchmarkComparison(20, 'scarce_drums', settings, 42);

      // Optimizer achieves higher or equal minRoleSatisfactionPct and scarceRoleDispersion than random
      expect(comparison.optimizer.minRoleSatisfactionPct).toBeGreaterThanOrEqual(
        comparison.random.minRoleSatisfactionPct
      );
      expect(comparison.optimizer.scarceRoleDispersion).toBeGreaterThanOrEqual(
        comparison.random.scarceRoleDispersion
      );
      expect(comparison.optimizer.totalScore).toBeGreaterThan(
        comparison.random.totalScore
      );
    });

    it('high_versatility_cluster: optimizer avoids clustering multi-talent players, achieving zero talent waste penalty', () => {
      const settings: HostSettings = {
        targetGroupSize: 4,
        preset: 'balanced',
        weights: { role: 0.45, music: 0.4, diversity: 0.15 },
        genreGranularity: 'fine',
        desiredRoles: ['acoustic_guitar', 'cajon', 'lead_vocal'],
        minRequiredRolesCount: 2,
        keyRoles: ['cajon', 'lead_vocal'],
      };

      const comparison = runBenchmarkComparison(20, 'high_versatility_cluster', settings, 42);

      // Optimizer should have 0 or minimal talent waste penalty
      expect(comparison.optimizer.talentWastePenalty).toBe(0);
      expect(comparison.optimizer.totalScore).toBeGreaterThan(
        comparison.random.totalScore
      );
    });

    it('polarized_genres: optimizer achieves higher music harmony & worst-group music harmony than random', () => {
      const settings: HostSettings = {
        targetGroupSize: 4,
        preset: 'music_focus',
        weights: { role: 0.25, music: 0.6, diversity: 0.15 },
        genreGranularity: 'fine',
        desiredRoles: ['acoustic_guitar', 'lead_vocal'],
        minRequiredRolesCount: 1,
        keyRoles: ['acoustic_guitar'],
      };

      const comparison = runBenchmarkComparison(24, 'polarized_genres', settings, 42);

      expect(comparison.optimizer.musicScore).toBeGreaterThan(
        comparison.random.musicScore
      );
      expect(comparison.optimizer.worstGroupMusicScore).toBeGreaterThan(
        comparison.random.worstGroupMusicScore
      );
    });
  });

  describe('Execution Speed & Latency Limits', () => {
    it('optimizes 30 participants in under 50ms', () => {
      const room = generateSyntheticRoom(30, 'realistic', 42);
      const start = performance.now();
      const result = optimizeGrouping(room, DEFAULT_BENCHMARK_SETTINGS, 42);
      const elapsed = performance.now() - start;

      expect(result.groups).toHaveLength(7);
      expect(elapsed).toBeLessThan(50);
    });

    it('optimizes 300 participants in under 500ms (Cloudflare Worker CPU budget)', () => {
      const room = generateSyntheticRoom(300, 'realistic', 42);
      const start = performance.now();
      const result = optimizeGrouping(room, DEFAULT_BENCHMARK_SETTINGS, 42);
      const elapsed = performance.now() - start;

      expect(result.groups).toHaveLength(75);
      expect(elapsed).toBeLessThan(500);
    });
  });
});
