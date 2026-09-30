import { describe, it, expect } from 'vitest';
import { optimizeGrouping } from '../../src/engine/optimizer';
import { calculateGroupRoleScore, scorePartition } from '../../src/engine/scoring';
import { calculateGroupMusicScore, findConsensusTags } from '../../src/engine/similarity';
import { assignRoles } from '../../src/engine/roles';
import { normalizeHostSettings } from '../../src/engine/settings';
import { DEFAULT_HOST_SETTINGS } from '../../src/engine/taxonomy';
import type { Participant, Role } from '../../src/types/domain';

// Reconstruction of the user's supplied 24-person capabilities; no live room data.
const codes = ['v','a','a','av','vka','vc','vca','ac','vao','ae','va','va','av','vak','vac','ab','va','aebkv','a','bkvo','a','a','a','avc'];
const map: Record<string, Role> = { a: 'acoustic_guitar', e: 'electric_guitar', c: 'cajon', b: 'bass', k: 'keyboard', v: 'lead_vocal', o: 'other' };
const genders = 'F M F F F M F M M M M M M M M F F M F M F F M M'.split(' ');
const room: Participant[] = codes.map((c, i) => ({ id: String(i + 1), name: `Member ${i + 1}`, gender: genders[i], capabilities: [...c].map(c => map[c]), musicPreferences: i === 23 ? ['keshi', 'western_pop_rnb'] : ['any_genre'], joinedAt: i }));
const settings = { ...DEFAULT_HOST_SETTINGS, preset: 'custom' as const, desiredRoles: ['acoustic_guitar', 'cajon', 'lead_vocal'] as Role[], minRequiredRolesCount: 3, weights: { role: .39, music: .35, diversity: .26 } };

describe('Host constraints and supplied room regression', () => {
  it('never awards 100 for duplicated guitars with a missing selected cajon', () => {
    const group = [10, 3, 13, 4].map(i => room[i - 1]);
    expect(calculateGroupRoleScore(group, {} as Record<Role, number>, settings.desiredRoles)).toBeCloseTo(66.67);
    const evaluation = scorePartition([group], settings);
    expect(evaluation.minRoleSatisfactionPct).toBe(0);
    expect(evaluation.penalties.deficitPenalty).toBe(15);
  });
  it('requires distinct instrument players but allows guitar plus singing', () => {
    expect(assignRoles([room[17]], ['acoustic_guitar', 'bass', 'keyboard', 'lead_vocal'])).toHaveLength(2);
    expect(assignRoles([room[17], room[15]], ['acoustic_guitar', 'bass', 'lead_vocal'])).toHaveLength(3);
  });
  it('does not invent consensus or perfect affinity from wildcard preferences', () => {
    expect(calculateGroupMusicScore(room.slice(0, 4)).compositeScore).toBe(.5);
    expect(findConsensusTags(room.slice(0, 4))).toEqual([]);
  });
  it('compares feasible group counts and covers all three duties in five bands', () => {
    const result = optimizeGrouping(room, settings, 42);
    expect(result.groups).toHaveLength(5);
    expect(result.groups.map(g => g.members.length).sort()).toEqual([4, 5, 5, 5, 5]);
    expect(new Set(result.groups.flatMap(g => g.memberIds)).size).toBe(24);
    for (const group of result.groups) {
      expect(group.roleAssignments?.map(a => a.role).sort()).toEqual([...settings.desiredRoles].sort());
      expect(group.roleScore).toBe(100);
    }
  });
  it('spreads five percussionists across five of six forced groups over multiple seeds', () => {
    for (const seed of [1, 8, 42]) {
      const result = optimizeGrouping(room, { ...settings, minGroupSize: 4, maxGroupSize: 4 }, seed);
      expect(result.groups).toHaveLength(6);
      expect(result.groups.filter(g => g.roleAssignments?.some(a => a.role === 'cajon'))).toHaveLength(5);
      expect(result.groups.filter(g => g.roleScore < 100)).toHaveLength(1);
      expect(result.warnings.some(w => w.includes('至少有 1 組'))).toBe(true);
    }
  });
  it('uses host size preferences at full strength after satisfying required roles', () => {
    const flexible = room.map(p => ({ ...p, capabilities: ['acoustic_guitar'] as Role[] }));
    const base = { ...settings, desiredRoles: ['acoustic_guitar'] as Role[], minRequiredRolesCount: 1, groupSizePreferenceWeight: 1 };
    expect(optimizeGrouping(flexible, { ...base, groupSizePreference: 'larger' }, 42).groups).toHaveLength(5);
    expect(optimizeGrouping(flexible, { ...base, groupSizePreference: 'smaller' }, 42).groups).toHaveLength(8);
    // Required-role feasibility takes precedence even at full size weight.
    expect(optimizeGrouping(room, { ...settings, groupSizePreference: 'smaller', groupSizePreferenceWeight: 1 }, 42).groups).toHaveLength(5);
  });
  it('migrates stale role keys and clamps invalid thresholds and weights', () => {
    const result = normalizeHostSettings({ ...settings, minRequiredRolesCount: 99, weights: { role: -1, music: NaN, diversity: 0 }, groupSizePreferenceWeight: 9 });
    expect(result.keyRoles).toEqual(settings.desiredRoles);
    expect(result.minRequiredRolesCount).toBe(3);
    expect(result.weights.role + result.weights.music + result.weights.diversity).toBeCloseTo(1);
    expect(result.groupSizePreferenceWeight).toBe(1);
  });
});
