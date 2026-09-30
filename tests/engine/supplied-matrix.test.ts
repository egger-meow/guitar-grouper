import { describe, it, expect } from 'vitest';
import rows from '../fixtures/supplied-members.json';
import { optimizeGrouping } from '../../src/engine/optimizer';
import { DEFAULT_HOST_SETTINGS } from '../../src/engine/taxonomy';
import type { HostSettings, Participant, Role } from '../../src/types/domain';

const roles: Record<string, Role> = { a: 'acoustic_guitar', e: 'electric_guitar', c: 'cajon', b: 'bass', k: 'keyboard', v: 'lead_vocal', o: 'other' };
const members: Participant[] = rows.map(([name, gender, code], i) => ({ id: String(i + 1), name, gender, capabilities: [...code].map(c => roles[c]), musicPreferences: ['any_genre'], joinedAt: i + 1 }));
const base: HostSettings = { ...DEFAULT_HOST_SETTINGS, preset: 'custom', desiredRoles: ['acoustic_guitar', 'cajon', 'lead_vocal'], minRequiredRolesCount: 3, weights: { role: .39, music: .35, diversity: .26 } };

describe('Supplied 23-member combination matrix', () => {
  for (const preference of ['any', 'larger', 'smaller'] as const) {
    for (const weight of [0, .25, 1]) {
      for (const preset of ['custom', 'balanced', 'role_focus', 'music_focus'] as const) {
        it(`${preference}, size weight ${weight}, ${preset}: spreads four percussionists honestly across seeds`, () => {
          for (const seed of [1, 8, 42]) {
            const result = optimizeGrouping(members, { ...base, preset, groupSizePreference: preference, groupSizePreferenceWeight: weight }, seed);
            expect(result.groups).toHaveLength(5);
            expect(result.groups.map(g => g.members.length).sort()).toEqual([4, 4, 5, 5, 5]);
            expect(result.groups.flatMap(g => g.memberIds).sort()).toEqual(members.map(p => p.id).sort());
            expect(result.groups.filter(g => g.roleAssignments?.some(a => a.role === 'cajon'))).toHaveLength(4);
            expect(result.groups.filter(g => g.roleScore < 100)).toHaveLength(1);
            expect(result.warnings.length).toBeGreaterThan(0);
            for (const g of result.groups) {
              if (g.roleAssignments?.some(a => a.role === 'cajon')) expect(g.roleScore).toBe(100);
              else expect(g.roleScore).toBeLessThan(100);
              expect(g.musicScore).toBe(50);
              expect(g.consensusTags).toEqual([]);
              expect(g.roleAssignments?.some(a => a.role === 'acoustic_guitar')).toBe(true);
              expect(g.roleAssignments?.some(a => a.role === 'lead_vocal')).toBe(true);
              for (const a of g.roleAssignments ?? []) expect(g.members.find(p => p.id === a.participantId)?.capabilities).toContain(a.role);
            }
          }
        });
      }
    }
  }
  it('forced 3–4 people produces six bands and honestly reports two missing percussionists', () => {
    for (const seed of [1, 8, 42]) {
      const result = optimizeGrouping(members, { ...base, maxGroupSize: 4 }, seed);
      expect(result.groups).toHaveLength(6);
      expect(result.groups.filter(g => g.roleAssignments?.some(a => a.role === 'cajon'))).toHaveLength(4);
      expect(result.groups.filter(g => g.roleScore < 100)).toHaveLength(2);
      expect(result.warnings.length).toBeGreaterThan(0);
    }
  });
  it('impossible drum requirement never yields a perfect role score', () => {
    const result = optimizeGrouping(members, { ...base, desiredRoles: ['acoustic_guitar', 'drums', 'lead_vocal'] }, 42);
    expect(result.groups.every(g => g.roleScore < 100)).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
  for (const preference of ['larger', 'smaller'] as const) {
    it(`relaxed guitar-only requirement follows ${preference} preference`, () => {
      const result = optimizeGrouping(members, { ...base, desiredRoles: ['acoustic_guitar'], minRequiredRolesCount: 1, groupSizePreference: preference, groupSizePreferenceWeight: 1 }, 42);
      expect(result.groups).toHaveLength(preference === 'larger' ? 5 : 7);
    });
  }
});

