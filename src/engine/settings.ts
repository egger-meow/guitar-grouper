import type { HostSettings, Role } from '../types/domain';
import { DEFAULT_HOST_SETTINGS, ROLES } from './taxonomy';
import { PRESET_WEIGHTS } from './scoring';

/** Shared migration/validation for HTTP, WebSocket and historical room settings. */
export function normalizeHostSettings(input: Partial<HostSettings>): HostSettings {
  const finite = (value: unknown, fallback: number) => typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  const min = Math.max(2, Math.min(8, Math.round(finite(input.minGroupSize, 3))));
  const max = Math.max(min, Math.min(8, Math.round(finite(input.maxGroupSize, 5))));
  const validRoles = new Set(ROLES.map(r => r.id));
  const roles = [...new Set((Array.isArray(input.desiredRoles) ? input.desiredRoles : DEFAULT_HOST_SETTINGS.desiredRoles).filter(r => validRoles.has(r)))];
  const desiredRoles: Role[] = roles.length ? roles : [...DEFAULT_HOST_SETTINGS.desiredRoles];
  const preset = input.preset && Object.hasOwn(PRESET_WEIGHTS, input.preset) ? input.preset : 'balanced';
  const raw = input.weightRatios ?? input.weights ?? PRESET_WEIGHTS[preset];
  let role = Math.max(0, finite(raw.role, 0));
  let music = Math.max(0, finite(raw.music, 0));
  let diversity = Math.max(0, finite(raw.diversity, 0));
  let sum = role + music + diversity;
  const weightRatios = input.weightRatios ? { role, music, diversity } : undefined;
  if (!sum) { ({ role, music, diversity } = PRESET_WEIGHTS.balanced); sum = 1; }
  return {
    ...DEFAULT_HOST_SETTINGS, ...input,
    minGroupSize: input.minGroupSize === undefined && input.maxGroupSize === undefined ? undefined : min,
    maxGroupSize: input.minGroupSize === undefined && input.maxGroupSize === undefined ? undefined : max,
    targetGroupSize: Math.max(2, Math.min(8, Math.round(finite(input.targetGroupSize, 4)))),
    preset, weightRatios, weights: { role: role / sum, music: music / sum, diversity: diversity / sum },
    desiredRoles, keyRoles: desiredRoles,
    minRequiredRolesCount: Math.max(0, Math.min(desiredRoles.length, Math.round(finite(input.minRequiredRolesCount, 1)))),
    groupSizePreference: ['larger', 'smaller', 'any'].includes(input.groupSizePreference ?? '') ? input.groupSizePreference : 'any',
    groupSizePreferenceWeight: Math.max(0, Math.min(1, finite(input.groupSizePreferenceWeight, 0.25))),
    genreGranularity: input.genreGranularity === 'coarse' ? 'coarse' : 'fine',
  };
}
