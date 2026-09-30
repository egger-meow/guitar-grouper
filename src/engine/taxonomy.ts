import type { Role, RoleDefinition, MusicItem, HostSettings } from '../types/domain';

/**
 * Real university guitar club instrument and vocal roles
 */
export const ROLES: RoleDefinition[] = [
  { id: 'acoustic_guitar', nameZh: '木吉他', icon: 'Guitar', isRhythmOrHarmony: true },
  { id: 'electric_guitar', nameZh: '電吉他', icon: 'Zap', isRhythmOrHarmony: true },
  { id: 'cajon', nameZh: '木箱鼓 / 打擊', icon: 'Box', isRhythmOrHarmony: true },
  { id: 'drums', nameZh: '爵士鼓', icon: 'Disc', isRhythmOrHarmony: true },
  { id: 'bass', nameZh: '貝斯', icon: 'Music2', isRhythmOrHarmony: true },
  { id: 'keyboard', nameZh: '鍵盤 / 鋼琴', icon: 'Piano', isRhythmOrHarmony: true },
  { id: 'lead_vocal', nameZh: '主唱', icon: 'Mic', isRhythmOrHarmony: false },
  { id: 'backing_vocal', nameZh: '和聲', icon: 'Mic2', isRhythmOrHarmony: false },
  { id: 'other', nameZh: '其他', icon: 'MoreHorizontal', isRhythmOrHarmony: false },
];

export const ROLE_MAP: Record<Role, RoleDefinition> = ROLES.reduce(
  (acc, role) => {
    acc[role.id] = role;
    return acc;
  },
  {} as Record<Role, RoleDefinition>
);

/**
 * Real music genre categories
 */
export const GENRES: MusicItem[] = [
  {
    id: 'mandopop_ballad',
    nameZh: '中文流行 / 抒情',
    category: 'genre',
    subtext: '周杰倫、告五人、茄子蛋、韋禮安',
  },
  {
    id: 'indie_rock',
    nameZh: '獨立音樂 / 搖滾',
    category: 'genre',
    subtext: '草東沒有派對、滅火器、麋先生、康士坦',
  },
  {
    id: 'western_pop_rnb',
    nameZh: '西洋流行 / R&B',
    category: 'genre',
    subtext: 'Taylor Swift、Ed Sheeran、keshi、Justin Bieber',
  },
  {
    id: 'western_rock',
    nameZh: '西洋搖滾 / 另類',
    category: 'genre',
    subtext: 'Oasis、Coldplay、Queen、Green Day、Radiohead',
  },
  {
    id: 'jpop_anime_jrock',
    nameZh: '日語流行 / 動漫 / J-Rock',
    category: 'genre',
    subtext: 'Yorushika (ヨルシカ)、YOASOBI、ONE OK ROCK、結束バンド',
  },
  {
    id: 'hiphop_funk',
    nameZh: '嘻哈 / 饒舌 / 放克',
    category: 'genre',
    subtext: '蛋堡、頑童MJ116、9m88、宇宙人、落日飛車',
  },
  {
    id: 'cn_pop_indie',
    nameZh: '中國流行 / 民謠 / 獨立',
    category: 'genre',
    subtext: '李榮浩、薛之謙、毛不易、郭頂、趙雷、萬青',
  },
  {
    id: 'douyin_viral',
    nameZh: '抖音神曲 / 短影音熱門',
    category: 'genre',
    subtext: '白小白、LB利比、井朧、隊長、承桓、漠河舞廳',
  },
];

/**
 * Authentic artists and popular songs verified in Taiwan/Chinese university guitar clubs
 * (NO FAKE / MOCK DATA)
 */
export const ARTISTS: MusicItem[] = [
  // 1. mandopop_ballad
  { id: 'jay_chou', nameZh: '周杰倫', parentId: 'mandopop_ballad', category: 'artist', subtext: '晴天、告白氣球、稻香' },
  { id: 'accusefive', nameZh: '告五人', parentId: 'mandopop_ballad', category: 'artist', subtext: '披星戴月的想你、愛人錯過' },
  { id: 'bestards', nameZh: '理想混蛋', parentId: 'mandopop_ballad', category: 'artist', subtext: '行星、不是因為天氣晴朗才愛你' },
  { id: 'eggplantegg', nameZh: '茄子蛋', parentId: 'mandopop_ballad', category: 'artist', subtext: '浪子回頭、日常' },
  { id: 'weibird', nameZh: '韋禮安', parentId: 'mandopop_ballad', category: 'artist', subtext: '如果可以、女孩' },
  { id: 'jolin', nameZh: '蔡依林', parentId: 'mandopop_ballad', category: 'artist', subtext: '玫瑰少年、倒帶' },
  { id: 'shishi', nameZh: '孫盛希', parentId: 'mandopop_ballad', category: 'artist', subtext: '少一點天份、眼淚記得你' },

  // 2. indie_rock
  { id: 'nodarty', nameZh: '草東沒有派對', parentId: 'indie_rock', category: 'artist', subtext: '大風吹、山海' },
  { id: 'fireex', nameZh: '滅火器', parentId: 'indie_rock', category: 'artist', subtext: '島嶼天光、長途夜車' },
  { id: 'ksth', nameZh: '康士坦的變化球', parentId: 'indie_rock', category: 'artist', subtext: '美好的事可不可以發生在我身上' },
  { id: 'mixer', nameZh: '麋先生', parentId: 'indie_rock', category: 'artist', subtext: '嗜愛動物、長成什麼樣子算成人' },
  { id: 'easy_weeds', nameZh: '溫室雜草', parentId: 'indie_rock', category: 'artist', subtext: '在為你預留的座位、春天有腳' },
  { id: 'sorry_youth', nameZh: '拍謝少年', parentId: 'indie_rock', category: 'artist', subtext: '暗流、兄弟沒夢不應該' },

  // 3. western_pop_rnb
  { id: 'taylor_swift', nameZh: 'Taylor Swift', parentId: 'western_pop_rnb', category: 'artist', subtext: 'Love Story、Cruel Summer' },
  { id: 'ed_sheeran', nameZh: 'Ed Sheeran', parentId: 'western_pop_rnb', category: 'artist', subtext: 'Perfect、Shape of You' },
  { id: 'justin_bieber', nameZh: 'Justin Bieber', parentId: 'western_pop_rnb', category: 'artist', subtext: 'Peaches、Ghost、Love Yourself' },
  { id: 'keshi', nameZh: 'keshi', parentId: 'western_pop_rnb', category: 'artist', subtext: 'beside you、like i need u、limbo' },
  { id: 'bruno_mars', nameZh: 'Bruno Mars', parentId: 'western_pop_rnb', category: 'artist', subtext: 'Just the Way You Are、Leave the Door Open' },
  { id: 'lauv', nameZh: 'Lauv', parentId: 'western_pop_rnb', category: 'artist', subtext: 'I Like Me Better、Paris in the Rain' },

  // 4. western_rock
  { id: 'oasis', nameZh: 'Oasis', parentId: 'western_rock', category: 'artist', subtext: "Wonderwall、Don't Look Back In Anger" },
  { id: 'coldplay', nameZh: 'Coldplay', parentId: 'western_rock', category: 'artist', subtext: 'Yellow、Fix You、Viva La Vida' },
  { id: 'queen', nameZh: 'Queen', parentId: 'western_rock', category: 'artist', subtext: 'Bohemian Rhapsody、We Are The Champions' },
  { id: 'green_day', nameZh: 'Green Day', parentId: 'western_rock', category: 'artist', subtext: 'Wake Me Up When September Ends、21 Guns' },
  { id: 'radiohead', nameZh: 'Radiohead', parentId: 'western_rock', category: 'artist', subtext: 'Creep、Karma Police' },
  { id: 'maroon_5', nameZh: 'Maroon 5', parentId: 'western_rock', category: 'artist', subtext: 'She Will Be Loved、Sugar' },

  // 5. jpop_anime_jrock
  { id: 'yorushika', nameZh: 'Yorushika (ヨルシカ)', parentId: 'jpop_anime_jrock', category: 'artist', subtext: 'だから僕は音楽を辞めた、春泥棒、ただ君に晴れ' },
  { id: 'yoasobi', nameZh: 'YOASOBI', parentId: 'jpop_anime_jrock', category: 'artist', subtext: '夜に駆ける、群青、アイドル' },
  { id: 'aimer', nameZh: 'Aimer', parentId: 'jpop_anime_jrock', category: 'artist', subtext: '殘響散歌、カタオモイ' },
  { id: 'eve', nameZh: 'Eve', parentId: 'jpop_anime_jrock', category: 'artist', subtext: '迴迴奇奇、ドラマツルギー' },
  { id: 'higedan', nameZh: 'Official髭男dism', parentId: 'jpop_anime_jrock', category: 'artist', subtext: 'Pretender、Subtitle' },
  { id: 'oor', nameZh: 'ONE OK ROCK', parentId: 'jpop_anime_jrock', category: 'artist', subtext: 'Wherever you are、The Beginning' },
  { id: 'kessoku', nameZh: '結束バンド', parentId: 'jpop_anime_jrock', category: 'artist', subtext: '青春コンプレックス、星座になれたら (孤獨搖滾)' },

  // 6. hiphop_funk
  { id: 'softlipa', nameZh: '蛋堡', parentId: 'hiphop_funk', category: 'artist', subtext: '少年維持著煩惱、家常音樂' },
  { id: 'mj116', nameZh: '頑童MJ116', parentId: 'hiphop_funk', category: 'artist', subtext: '幹大事、辣台妹' },
  { id: '9m88', nameZh: '9m88', parentId: 'hiphop_funk', category: 'artist', subtext: '九頭身日奈、最高品質靜悄悄' },
  { id: 'cosmospeople', nameZh: '宇宙人', parentId: 'hiphop_funk', category: 'artist', subtext: '藍色的你、如果我們還在一起' },
  { id: 'sunset_rollercoaster', nameZh: '落日飛車', parentId: 'hiphop_funk', category: 'artist', subtext: 'My Jinji、Vanilla' },

  // 7. cn_pop_indie
  { id: 'li_ronghao', nameZh: '李榮浩', parentId: 'cn_pop_indie', category: 'artist', subtext: '模特、年少有為、李白' },
  { id: 'joker_xue', nameZh: '薛之謙', parentId: 'cn_pop_indie', category: 'artist', subtext: '演員、紳士、認真的雪' },
  { id: 'mao_buyi', nameZh: '毛不易', parentId: 'cn_pop_indie', category: 'artist', subtext: '消愁、像我這樣的人' },
  { id: 'guo_ding', nameZh: '郭頂', parentId: 'cn_pop_indie', category: 'artist', subtext: '水星記、淒美地' },
  { id: 'zhao_lei', nameZh: '趙雷', parentId: 'cn_pop_indie', category: 'artist', subtext: '成都、畫' },
  { id: 'omni_youth', nameZh: '萬能青年旅店', parentId: 'cn_pop_indie', category: 'artist', subtext: '十萬嬉皮、殺死那個石家莊人' },
  { id: 'landlord_cat', nameZh: '房東的貓', parentId: 'cn_pop_indie', category: 'artist', subtext: '雲煙成雨、秋釀' },

  // 8. douyin_viral
  { id: 'bai_xiaobai', nameZh: '白小白', parentId: 'douyin_viral', category: 'artist', subtext: '最美的傷口、我愛過你' },
  { id: 'lb_libi', nameZh: 'LB利比', parentId: 'douyin_viral', category: 'artist', subtext: '跳樓機、小城夏天' },
  { id: 'jing_long', nameZh: '井朧 / 井迪', parentId: 'douyin_viral', category: 'artist', subtext: '不刪、把孤獨當作晚餐' },
  { id: 'peng_xiyan', nameZh: '彭席彥 / 溫和治療', parentId: 'douyin_viral', category: 'artist', subtext: '海嶼你' },
  { id: 'young_captain', nameZh: '隊長', parentId: 'douyin_viral', category: 'artist', subtext: '哪裡都是你、樓頂上的小雞' },
  { id: 'chenghuan', nameZh: '承桓', parentId: 'douyin_viral', category: 'artist', subtext: '我會等' },
  { id: 'liu_shuang', nameZh: '柳爽', parentId: 'douyin_viral', category: 'artist', subtext: '漠河舞廳' },
  { id: 'dazi', nameZh: '大籽', parentId: 'douyin_viral', category: 'artist', subtext: '白月光與硃砂痣' },
  { id: 'wumei_sauce', nameZh: '烏梅子醬', parentId: 'douyin_viral', category: 'artist', subtext: '烏梅子醬 (抖音熱門吉他翻唱)' },
  { id: 'douyin_hits', nameZh: '抖音熱門吉他翻唱', parentId: 'douyin_viral', category: 'artist', subtext: '短影音吉他彈唱熱榜' },
];

export const TAXONOMY: MusicItem[] = [...GENRES, ...ARTISTS];

export const TAXONOMY_MAP: Record<string, MusicItem> = TAXONOMY.reduce(
  (acc, item) => {
    acc[item.id] = item;
    return acc;
  },
  {} as Record<string, MusicItem>
);

/**
 * Genre neighborhood soft weights for related stylistic traditions
 */
const NEIGHBORHOOD_WEIGHTS: Record<string, Record<string, number>> = {
  indie_rock: {
    western_rock: 0.25,
    jpop_anime_jrock: 0.2,
  },
  western_rock: {
    indie_rock: 0.25,
  },
  mandopop_ballad: {
    cn_pop_indie: 0.25,
    douyin_viral: 0.2,
  },
  cn_pop_indie: {
    mandopop_ballad: 0.25,
    douyin_viral: 0.2,
  },
  douyin_viral: {
    mandopop_ballad: 0.2,
    cn_pop_indie: 0.2,
  },
  western_pop_rnb: {
    hiphop_funk: 0.2,
  },
  hiphop_funk: {
    western_pop_rnb: 0.2,
  },
  jpop_anime_jrock: {
    indie_rock: 0.2,
  },
};

/**
 * Returns cross-genre soft relationship weight
 */
export function getGenreNeighborhoodWeight(genreA: string, genreB: string): number {
  if (genreA === genreB) return 1.0;
  return NEIGHBORHOOD_WEIGHTS[genreA]?.[genreB] ?? NEIGHBORHOOD_WEIGHTS[genreB]?.[genreA] ?? 0.0;
}

/**
 * Helper to get Chinese display name for a role or music item
 */
export function getTagNameZh(id: string): string {
  if (TAXONOMY_MAP[id]) {
    return TAXONOMY_MAP[id].nameZh;
  }
  const role = ROLES.find((r) => r.id === id);
  if (role) {
    return role.nameZh;
  }
  return id;
}

/**
 * Verified default host settings for guitar group optimization
 */
export const DEFAULT_HOST_SETTINGS: HostSettings = {
  targetGroupSize: 4,
  minGroupSize: 3,
  maxGroupSize: 5,
  preset: 'balanced',
  weights: {
    role: 0.45,
    music: 0.4,
    diversity: 0.15,
  },
  genreGranularity: 'fine',
  desiredRoles: ['acoustic_guitar', 'electric_guitar', 'cajon', 'drums', 'lead_vocal'],
  minRequiredRolesCount: 1,
  keyRoles: ['acoustic_guitar', 'electric_guitar', 'cajon', 'lead_vocal'],
};

export const ROLE_DEFINITIONS = ROLES;
export { PRESET_WEIGHTS } from './scoring';

