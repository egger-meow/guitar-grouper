import { describe, it, expect } from 'vitest';
import {
  calculateHierarchicalSimilarity,
  calculateGroupMusicScore,
} from '../../src/engine/similarity';
import {
  ROLES,
  ROLE_MAP,
  GENRES,
  ARTISTS,
  TAXONOMY,
  TAXONOMY_MAP,
  getGenreNeighborhoodWeight,
} from '../../src/engine/taxonomy';
import type { Participant } from '../../src/types/domain';

describe('Domain Taxonomy & Real Data Verification', () => {
  it('should define all 9 real university guitar club roles', () => {
    expect(ROLES).toHaveLength(9);
    const roleIds = ROLES.map((r) => r.id);
    expect(roleIds).toContain('acoustic_guitar');
    expect(roleIds).toContain('electric_guitar');
    expect(roleIds).toContain('cajon');
    expect(roleIds).toContain('drums');
    expect(roleIds).toContain('bass');
    expect(roleIds).toContain('keyboard');
    expect(roleIds).toContain('lead_vocal');
    expect(roleIds).toContain('backing_vocal');
    expect(roleIds).toContain('other');

    expect(ROLE_MAP.acoustic_guitar.nameZh).toBe('木吉他');
    expect(ROLE_MAP.cajon.nameZh).toContain('木箱鼓');
    expect(ROLE_MAP.lead_vocal.nameZh).toBe('主唱');
  });

  it('should define all 12 real music genres including any_genre wildcard', () => {
    expect(GENRES).toHaveLength(12);
    const genreIds = GENRES.map((g) => g.id);
    expect(genreIds).toContain('any_genre');
    expect(genreIds).toContain('mandopop_ballad');
    expect(genreIds).toContain('indie_rock');
    expect(genreIds).toContain('campus_folk_acoustic');
    expect(genreIds).toContain('western_pop_rnb');
    expect(genreIds).toContain('western_rock');
    expect(genreIds).toContain('jpop_anime_jrock');
    expect(genreIds).toContain('kpop_kindie');
    expect(genreIds).toContain('hiphop_funk');
    expect(genreIds).toContain('cn_pop_indie');
    expect(genreIds).toContain('douyin_viral');
    expect(genreIds).toContain('heavy_metal_math');
  });

  it('should contain 150+ authentic artists with real parent genres (no fake data)', () => {
    expect(ARTISTS.length).toBeGreaterThanOrEqual(150);

    // Japanese music
    expect(TAXONOMY_MAP.yorushika).toBeDefined();
    expect(TAXONOMY_MAP.yorushika.parentId).toBe('jpop_anime_jrock');
    expect(TAXONOMY_MAP.yoasobi.parentId).toBe('jpop_anime_jrock');
    expect(TAXONOMY_MAP.kessoku.parentId).toBe('jpop_anime_jrock');

    // Korean Indie & Pop
    expect(TAXONOMY_MAP.wave_to_earth).toBeDefined();
    expect(TAXONOMY_MAP.wave_to_earth.parentId).toBe('kpop_kindie');
    expect(TAXONOMY_MAP.hyukoh.parentId).toBe('kpop_kindie');
    expect(TAXONOMY_MAP.day6.parentId).toBe('kpop_kindie');

    // Mandopop & Taiwanese Indie & Folk
    expect(TAXONOMY_MAP.jay_chou.parentId).toBe('mandopop_ballad');
    expect(TAXONOMY_MAP.mayday.parentId).toBe('mandopop_ballad');
    expect(TAXONOMY_MAP.nodarty.parentId).toBe('indie_rock');
    expect(TAXONOMY_MAP.accusefive.parentId).toBe('mandopop_ballad');
    expect(TAXONOMY_MAP.cheer_chen.parentId).toBe('campus_folk_acoustic');
    expect(TAXONOMY_MAP.katncandix2.parentId).toBe('campus_folk_acoustic');
    expect(TAXONOMY_MAP.who_cares.parentId).toBe('indie_rock');

    // Western Pop & Rock
    expect(TAXONOMY_MAP.justin_bieber.parentId).toBe('western_pop_rnb');
    expect(TAXONOMY_MAP.keshi.parentId).toBe('western_pop_rnb');
    expect(TAXONOMY_MAP.john_mayer.parentId).toBe('western_pop_rnb');
    expect(TAXONOMY_MAP.oasis.parentId).toBe('western_rock');
    expect(TAXONOMY_MAP.coldplay.parentId).toBe('western_rock');

    // Chinese Pop & Douyin Hits
    expect(TAXONOMY_MAP.bai_xiaobai.parentId).toBe('douyin_viral');
    expect(TAXONOMY_MAP.lb_libi.parentId).toBe('douyin_viral');
    expect(TAXONOMY_MAP.jing_long.parentId).toBe('douyin_viral');
    expect(TAXONOMY_MAP.li_ronghao.parentId).toBe('cn_pop_indie');

    // Heavy & Math Rock
    expect(TAXONOMY_MAP.polyphia.parentId).toBe('heavy_metal_math');
    expect(TAXONOMY_MAP.flesh_juicer.parentId).toBe('heavy_metal_math');
  });

  it('should verify genre neighborhood relations', () => {
    expect(getGenreNeighborhoodWeight('indie_rock', 'western_rock')).toBeCloseTo(0.25, 2);
    expect(getGenreNeighborhoodWeight('western_rock', 'indie_rock')).toBeCloseTo(0.25, 2);
    expect(getGenreNeighborhoodWeight('mandopop_ballad', 'cn_pop_indie')).toBeGreaterThan(0);
    expect(getGenreNeighborhoodWeight('any_genre', 'jpop_anime_jrock')).toBe(1.0);
  });
});

describe('Hierarchical Similarity Engine', () => {
  it('1. Exact artist match gives high score (1.0)', () => {
    const score = calculateHierarchicalSimilarity(['jay_chou'], ['jay_chou']);
    expect(score).toBe(1.0);

    const scoreYorushika = calculateHierarchicalSimilarity(['yorushika'], ['yorushika']);
    expect(scoreYorushika).toBe(1.0);
  });

  it('2. Fallback to parent category: justin_bieber and keshi under western_pop_rnb return score >= 0.5', () => {
    const score = calculateHierarchicalSimilarity(['justin_bieber'], ['keshi']);
    expect(score).toBeGreaterThanOrEqual(0.5);
    expect(score).toBeCloseTo(0.6, 2);
  });

  it('3. Shared parent category across Chinese pop / Douyin hits return score >= 0.5', () => {
    const scoreDouyin = calculateHierarchicalSimilarity(['bai_xiaobai'], ['lb_libi']);
    expect(scoreDouyin).toBeGreaterThanOrEqual(0.5);
    expect(scoreDouyin).toBeCloseTo(0.6, 2);

    const scoreDouyin2 = calculateHierarchicalSimilarity(['jing_long'], ['young_captain']);
    expect(scoreDouyin2).toBeGreaterThanOrEqual(0.5);
  });

  it('4. Japanese music with Yorushika and YOASOBI under jpop_anime_jrock returns score >= 0.5', () => {
    const score = calculateHierarchicalSimilarity(['yorushika'], ['yoasobi']);
    expect(score).toBeGreaterThanOrEqual(0.5);
    expect(score).toBeCloseTo(0.6, 2);
  });

  it('5. Cross-genre distance: Disjoint styles return 0, related rock styles return soft neighborhood weight (~0.25)', () => {
    // Disjoint
    const disjointScore = calculateHierarchicalSimilarity(['jpop_anime_jrock'], ['hiphop_funk']);
    expect(disjointScore).toBe(0);

    const disjointArtists = calculateHierarchicalSimilarity(['yorushika'], ['softlipa']);
    expect(disjointArtists).toBe(0);

    // Related rock styles
    const rockScore = calculateHierarchicalSimilarity(['indie_rock'], ['western_rock']);
    expect(rockScore).toBeCloseTo(0.25, 2);
  });

  it('6. Empty preferences or unknown items handled safely without NaN or crashes', () => {
    expect(calculateHierarchicalSimilarity([], [])).toBe(0);
    expect(calculateHierarchicalSimilarity(['jay_chou'], [])).toBe(0);
    expect(calculateHierarchicalSimilarity([], ['keshi'])).toBe(0);
    expect(calculateHierarchicalSimilarity(['unknown_item'], ['jay_chou'])).toBe(0);
    expect(calculateHierarchicalSimilarity(['unknown_a'], ['unknown_b'])).toBe(0);
  });

  it('7. Multi-label sets correctly aggregate similarities with exact matches and parent fallbacks', () => {
    // A: Jay Chou + Yorushika
    // B: Jay Chou + YOASOBI
    // Jay Chou matches Jay Chou (1.0), Yorushika matches YOASOBI (0.6)
    // Expected avg: (1.0 + 0.6) / 2 = 0.8
    const score = calculateHierarchicalSimilarity(
      ['jay_chou', 'yorushika'],
      ['jay_chou', 'yoasobi']
    );
    expect(score).toBeCloseTo(0.8, 2);

    // Multi-preference with completely distinct items but one shared parent
    const scoreMixed = calculateHierarchicalSimilarity(
      ['taylor_swift', 'keshi'],
      ['justin_bieber', 'ed_sheeran']
    );
    // All 4 are western_pop_rnb!
    expect(scoreMixed).toBeCloseTo(0.6, 2);
  });

  it('handles artist-to-genre direct preference match', () => {
    // Member A selected the broad genre 'western_pop_rnb'
    // Member B selected specific artist 'justin_bieber'
    const score = calculateHierarchicalSimilarity(['western_pop_rnb'], ['justin_bieber']);
    expect(score).toBeGreaterThanOrEqual(0.7);
  });

  it('any_genre wildcard yields 1.0 compatibility with any musical style', () => {
    // Member A has any_genre (open to anything)
    // Member B has specific niche artists (Yorushika, Wave to Earth, Polyphia)
    const score = calculateHierarchicalSimilarity(['any_genre'], ['yorushika', 'wave_to_earth', 'polyphia']);
    expect(score).toBe(1.0);

    const scoreReverse = calculateHierarchicalSimilarity(['nodarty'], ['any_genre']);
    expect(scoreReverse).toBe(1.0);
  });
});

describe('Group Music Score & Consensus Discovery', () => {
  const p1: Participant = {
    id: 'p1',
    name: 'Alice',
    gender: 'F',
    capabilities: ['acoustic_guitar', 'lead_vocal'],
    musicPreferences: ['jay_chou', 'accusefive'],
    joinedAt: 1,
  };

  const p2: Participant = {
    id: 'p2',
    name: 'Bob',
    gender: 'M',
    capabilities: ['cajon'],
    musicPreferences: ['jay_chou', 'weibird'],
    joinedAt: 2,
  };

  const p3: Participant = {
    id: 'p3',
    name: 'Charlie',
    gender: 'M',
    capabilities: ['bass'],
    musicPreferences: ['bestards', 'mandopop_ballad'],
    joinedAt: 3,
  };

  const pDisjoint: Participant = {
    id: 'p4',
    name: 'Diana',
    gender: 'F',
    capabilities: ['keyboard'],
    musicPreferences: ['yorushika', 'yoasobi'],
    joinedAt: 4,
  };

  it('evaluates harmonious group with shared consensus tags', () => {
    const evaluation = calculateGroupMusicScore([p1, p2, p3]);
    expect(evaluation.avgPairwise).toBeGreaterThan(0.6);
    expect(evaluation.minPairwise).toBeGreaterThan(0.5);
    expect(evaluation.consensusTags).toContain('mandopop_ballad');
    expect(evaluation.consensusTags).toContain('jay_chou');
    expect(evaluation.compositeScore).toBeGreaterThan(0.65);
  });

  it('safely handles empty or single member groups', () => {
    const emptyEval = calculateGroupMusicScore([]);
    expect(emptyEval.avgPairwise).toBe(0);
    expect(emptyEval.compositeScore).toBe(0);

    const singleEval = calculateGroupMusicScore([p1]);
    expect(singleEval.avgPairwise).toBe(1.0);
    expect(singleEval.compositeScore).toBe(1.0);
  });

  it('reflects worst-pair penalty in heterogeneous groups', () => {
    const harmonGroupEval = calculateGroupMusicScore([p1, p2]);
    const conflictingGroupEval = calculateGroupMusicScore([p1, pDisjoint]);

    expect(harmonGroupEval.compositeScore).toBeGreaterThan(conflictingGroupEval.compositeScore);
    expect(conflictingGroupEval.minPairwise).toBe(0);
  });
});
