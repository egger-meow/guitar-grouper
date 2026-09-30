import type { Participant, Role } from '../types/domain';
import { ROLES, GENRES, ARTISTS } from '../engine/taxonomy';
import { createPrng } from '../engine/prng';

export type ScenarioType =
  | 'realistic'
  | 'scarce_drums'
  | 'scarce_vocals'
  | 'high_versatility_cluster'
  | 'polarized_genres'
  | 'imbalanced_gender'
  | 'odd_counts';

export const SCENARIO_TYPES: ScenarioType[] = [
  'realistic',
  'scarce_drums',
  'scarce_vocals',
  'high_versatility_cluster',
  'polarized_genres',
  'imbalanced_gender',
  'odd_counts',
];

const SURNAMES = [
  '陳', '林', '黃', '張', '李', '王', '吳', '劉', '蔡', '楊',
  '許', '鄭', '謝', '洪', '郭', '曾', '邱', '廖', '賴', '周',
  '徐', '蘇', '葉', '莊', '呂', '江', '何', '蕭', '羅', '高',
];

const GIVEN_NAMES_M = [
  '冠宇', '柏翰', '冠廷', '宇軒', '宗翰', '承恩', '家豪', '廷宇', '品睿', '睿恩',
  '宣佑', '宸瑋', '子軒', '子豪', '志偉', '俊傑', '博翔', '奕勳', '威廷', '冠霖',
];

const GIVEN_NAMES_F = [
  '雅婷', '婷萱', '冠伶', '宜萱', '鈺婷', '雅筑', '欣妤', '佳穎', '詩涵', '詠晴',
  '子晴', '語彤', '恩綺', '思妤', '心慈', '品言', '芸萱', '柔安', '羽婕', '亭萱',
];

// Group artists by parent genre
const ARTISTS_BY_GENRE: Record<string, string[]> = {};
for (const artist of ARTISTS) {
  if (artist.parentId) {
    if (!ARTISTS_BY_GENRE[artist.parentId]) {
      ARTISTS_BY_GENRE[artist.parentId] = [];
    }
    ARTISTS_BY_GENRE[artist.parentId].push(artist.id);
  }
}

/**
 * Generates synthetic participants for testing and benchmarking
 * strictly adhering to authentic domain taxonomy and deterministic PRNG.
 */
export function generateSyntheticRoom(
  count: number,
  scenario: ScenarioType = 'realistic',
  seed: number = 42
): Participant[] {
  const prng = createPrng(seed);

  let effectiveCount = count;
  if (scenario === 'odd_counts') {
    effectiveCount = count % 2 === 0 ? count + 1 : count;
  }

  const participants: Participant[] = [];

  // Determine scenario-specific role limits
  let scarceRoleCount = 0;
  let versatileCount = 0;
  if (scenario === 'scarce_drums') {
    scarceRoleCount = Math.max(1, Math.min(4, Math.floor(effectiveCount / 8)));
  } else if (scenario === 'scarce_vocals') {
    scarceRoleCount = Math.max(1, Math.min(4, Math.floor(effectiveCount / 8)));
  } else if (scenario === 'high_versatility_cluster') {
    versatileCount = Math.max(4, Math.floor(effectiveCount / 4));
  }

  for (let i = 0; i < effectiveCount; i++) {
    const id = `p-${i + 1}`;

    // 1. Gender assignment
    let gender: string;
    if (scenario === 'imbalanced_gender') {
      gender = prng() < 0.85 ? 'M' : 'F';
    } else {
      gender = prng() < 0.5 ? 'M' : 'F';
    }

    // 2. Authentic Chinese name
    const surname = SURNAMES[Math.floor(prng() * SURNAMES.length)];
    const givenList = gender === 'M' ? GIVEN_NAMES_M : GIVEN_NAMES_F;
    const given = givenList[Math.floor(prng() * givenList.length)];
    const name = `${surname}${given}`;

    // 3. Capabilities assignment
    const capabilities: Role[] = [];

    if (scenario === 'scarce_drums') {
      if (i < scarceRoleCount) {
        // Limited drummers
        capabilities.push(prng() < 0.5 ? 'cajon' : 'drums');
        if (prng() < 0.4) capabilities.push('acoustic_guitar');
      } else {
        // Non-drummers: guitars, vocals, bass, keyboards
        const roll = prng();
        if (roll < 0.55) {
          capabilities.push('acoustic_guitar');
        } else if (roll < 0.75) {
          capabilities.push('electric_guitar');
        } else if (roll < 0.9) {
          capabilities.push('lead_vocal');
        } else {
          capabilities.push('bass');
        }

        if (prng() < 0.3) {
          if (!capabilities.includes('lead_vocal')) capabilities.push('lead_vocal');
          else capabilities.push('acoustic_guitar');
        }
      }
    } else if (scenario === 'scarce_vocals') {
      if (i < scarceRoleCount) {
        // Limited vocalists
        capabilities.push('lead_vocal');
        if (prng() < 0.5) capabilities.push('acoustic_guitar');
      } else {
        // Non-vocalists
        const roll = prng();
        if (roll < 0.5) {
          capabilities.push('acoustic_guitar');
        } else if (roll < 0.75) {
          capabilities.push('electric_guitar');
        } else if (roll < 0.9) {
          capabilities.push('cajon');
        } else {
          capabilities.push('bass');
        }

        if (prng() < 0.25) {
          if (!capabilities.includes('cajon')) capabilities.push('cajon');
        }
      }
    } else if (scenario === 'high_versatility_cluster') {
      if (i < versatileCount) {
        // Triple threat / multi-talent
        capabilities.push('acoustic_guitar', 'cajon', 'lead_vocal');
        if (prng() < 0.3) capabilities.push('electric_guitar');
      } else {
        // Single role guitarists
        capabilities.push(prng() < 0.7 ? 'acoustic_guitar' : 'electric_guitar');
      }
    } else {
      // Standard realistic / polarized / imbalanced / odd_counts distribution
      const roll = prng();
      if (roll < 0.55) {
        // 55% single capability
        const r2 = prng();
        if (r2 < 0.55) capabilities.push('acoustic_guitar');
        else if (r2 < 0.75) capabilities.push('electric_guitar');
        else if (r2 < 0.85) capabilities.push('lead_vocal');
        else if (r2 < 0.93) capabilities.push('cajon');
        else capabilities.push('bass');
      } else if (roll < 0.9) {
        // 35% dual capability
        const primaryRoll = prng();
        if (primaryRoll < 0.6) {
          capabilities.push('acoustic_guitar');
          capabilities.push(prng() < 0.5 ? 'lead_vocal' : 'cajon');
        } else {
          capabilities.push('electric_guitar');
          capabilities.push(prng() < 0.5 ? 'bass' : 'backing_vocal');
        }
      } else {
        // 10% versatile triple threat
        capabilities.push('acoustic_guitar');
        capabilities.push('cajon');
        capabilities.push('lead_vocal');
      }
    }

    // 4. Music preferences assignment
    const musicPreferences: string[] = [];

    if (scenario === 'polarized_genres') {
      // Polarized: 50% J-Rock / Anime, 50% Mandopop Ballad
      const isCampA = i < effectiveCount / 2;
      const primaryGenre = isCampA ? 'jpop_anime_jrock' : 'mandopop_ballad';
      musicPreferences.push(primaryGenre);

      const availableArtists = ARTISTS_BY_GENRE[primaryGenre] || [];
      const numArtists = 1 + Math.floor(prng() * 3); // 1 to 3 artists
      const shuffled = [...availableArtists].sort(() => prng() - 0.5);
      for (let a = 0; a < Math.min(numArtists, shuffled.length); a++) {
        musicPreferences.push(shuffled[a]);
      }
    } else {
      // Pick 1 primary genre
      const genreObj = GENRES[Math.floor(prng() * GENRES.length)];
      musicPreferences.push(genreObj.id);

      // Pick 1 to 3 artists under primary genre
      const availableArtists = ARTISTS_BY_GENRE[genreObj.id] || [];
      const numArtists = 1 + Math.floor(prng() * 3);
      const shuffled = [...availableArtists].sort(() => prng() - 0.5);
      for (let a = 0; a < Math.min(numArtists, shuffled.length); a++) {
        musicPreferences.push(shuffled[a]);
      }

      // 30% chance for secondary genre
      if (prng() < 0.3) {
        const otherGenres = GENRES.filter((g) => g.id !== genreObj.id);
        const secondary = otherGenres[Math.floor(prng() * otherGenres.length)];
        musicPreferences.push(secondary.id);
        const secArtists = ARTISTS_BY_GENRE[secondary.id] || [];
        if (secArtists.length > 0 && prng() < 0.6) {
          musicPreferences.push(secArtists[Math.floor(prng() * secArtists.length)]);
        }
      }
    }

    participants.push({
      id,
      name,
      gender,
      capabilities,
      musicPreferences,
      joinedAt: 1700000000000 + i * 60000,
    });
  }

  return participants;
}
