/**
 * Domain types for Guitar Group (吉他社分組神器)
 */

export type Role =
  | 'acoustic_guitar'
  | 'electric_guitar'
  | 'cajon'
  | 'drums'
  | 'bass'
  | 'keyboard'
  | 'lead_vocal'
  | 'backing_vocal'
  | 'other';

export interface Participant {
  id: string;
  name: string;
  gender: string;
  capabilities: Role[];
  musicPreferences: string[];
  joinedAt: number;
}

export interface RoleDefinition {
  id: Role;
  nameZh: string;
  icon: string;
  isRhythmOrHarmony?: boolean;
}

export interface MusicItem {
  id: string;
  nameZh: string;
  parentId?: string;
  category: 'genre' | 'artist';
  subtext?: string;
}

export type PresetType = 'music_focus' | 'role_focus' | 'balanced' | 'custom';
export type GenreGranularity = 'coarse' | 'fine';

export interface HostSettings {
  targetGroupSize: number;
  minGroupSize?: number;
  maxGroupSize?: number;
  preset: PresetType;
  weights: {
    role: number;
    music: number;
    diversity: number;
  };
  genreGranularity: GenreGranularity;
  desiredRoles: Role[];
  minRequiredRolesCount: number;
  keyRoles: Role[];
}

export interface GroupResult {
  id: string;
  name: string;
  memberIds: string[];
  members: Participant[];
  consensusTags: string[];
  roleCoverage: { role: Role; coveredBy: string[] }[];
  musicScore: number;
  roleScore: number;
  diagnosticsZh: string[];
}

export interface PartitionDiagnostics {
  avgRoleCoverage: number;
  minRoleSatisfactionPct: number;
  avgMusicScore: number;
  worstGroupMusicScore: number;
  diversityScore: number;
  talentWasteIndex: number;
  totalScore: number;
  notesZh: string[];
}

export interface GroupMusicEvaluation {
  avgPairwise: number;
  minPairwise: number;
  consensusTags: string[];
  compositeScore: number;
}

export interface PartitionEvaluation {
  totalScore: number;
  roleScore: number;
  musicScore: number;
  diversityScore: number;
  penalties: {
    talentWaste: number;
    minRoleDeficit: number;
    sizeVariance: number;
    deficitPenalty: number;
    wastePenalty: number;
    sizePenalty: number;
  };
  worstGroupScore: number;
  worstGroupMusicScore: number;
  worstGroupOverallScore: number;
  avgRoleCoverage: number;
  minRoleSatisfactionPct: number;
}

export interface OptimizationResult {
  groups: GroupResult[];
  diagnostics: PartitionDiagnostics;
  warnings: string[];
}
