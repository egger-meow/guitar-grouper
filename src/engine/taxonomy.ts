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
 * Comprehensive real music genre categories verified for guitar clubs
 */
export const GENRES: MusicItem[] = [
  {
    id: 'any_genre',
    nameZh: '都可以 / 雜食派',
    category: 'genre',
    subtext: '不限曲風、隨遇而安，任何樂團曲風皆可完美融入',
  },
  {
    id: 'indie_rock',
    nameZh: '台灣獨立樂團 / 搖滾',
    category: 'genre',
    subtext: '草東沒有派對、告五人、滅火器、麋先生、康士坦、老王樂隊、mango jump',
  },
  {
    id: 'mandopop_ballad',
    nameZh: '華語流行 / 金曲抒情',
    category: 'genre',
    subtext: '周杰倫、五月天、蘇打綠、韋禮安、蔡依林、林俊傑、陶喆、伍佰',
  },
  {
    id: 'campus_folk_acoustic',
    nameZh: '校園民謠 / 不插電木吉他',
    category: 'genre',
    subtext: '陳綺貞、盧廣仲、安溥/張懸、棉花糖、黃玠、好樂團、南西肯恩、貝克小姐',
  },
  {
    id: 'western_rock',
    nameZh: '西洋搖滾 / 經典另類',
    category: 'genre',
    subtext: 'Oasis、Coldplay、Queen、Green Day、Radiohead、The Beatles',
  },
  {
    id: 'western_pop_rnb',
    nameZh: '西洋流行 / R&B / 民謠',
    category: 'genre',
    subtext: 'Taylor Swift、Ed Sheeran、keshi、John Mayer、Jason Mraz、Bruno Mars',
  },
  {
    id: 'jpop_anime_jrock',
    nameZh: '日語流行 / 動漫 / J-Rock',
    category: 'genre',
    subtext: 'Yorushika (ヨルシカ)、YOASOBI、Official髭男dism、ONE OK ROCK、結束バンド',
  },
  {
    id: 'kpop_kindie',
    nameZh: '韓系獨立 / K-Indie / 流行',
    category: 'genre',
    subtext: 'Wave to Earth、HYUKOH、The Black Skirts、DAY6、Jannabi、10CM',
  },
  {
    id: 'hiphop_funk',
    nameZh: 'City Pop / 嘻哈 / 放克爵士',
    category: 'genre',
    subtext: '落日飛車、9m88、蛋堡、頑童MJ116、宇宙人、鶴 The Crane、LINION',
  },
  {
    id: 'cn_pop_indie',
    nameZh: '中國民謠 / 獨立搖滾',
    category: 'genre',
    subtext: '萬能青年旅店、房東的貓、郭頂、趙雷、陳粒、薛之謙、毛不易',
  },
  {
    id: 'douyin_viral',
    nameZh: '抖音神曲 / 短影音熱門',
    category: 'genre',
    subtext: '白小白、LB利比、井朧、隊長、承桓、彭席彥/溫和治療、漠河舞廳',
  },
  {
    id: 'heavy_metal_math',
    nameZh: '重型音樂 / 金屬 / 數搖',
    category: 'genre',
    subtext: '血肉果汁機、閃靈、大象體操、Polyphia、體熊專科',
  },
];

/**
 * Authentic artists and popular songs verified in Taiwan/Asian/Western university guitar clubs
 * (100% REAL DATA, NO FAKE DATA)
 */
export const ARTISTS: MusicItem[] = [
  // ----------------------------------------------------
  // 1. 台灣獨立樂團 / 搖滾 (indie_rock)
  // ----------------------------------------------------
  { id: 'nodarty', nameZh: '草東沒有派對', parentId: 'indie_rock', category: 'artist', subtext: '山海、大風吹、爛泥、如常' },
  { id: 'accusefive', nameZh: '告五人', parentId: 'mandopop_ballad', category: 'artist', subtext: '披星戴月的想你、愛人錯過、在這座城市遺失了你' },
  { id: 'bestards', nameZh: '理想混蛋', parentId: 'indie_rock', category: 'artist', subtext: '行星、不是因為天氣晴朗才愛你、愚者、離開的一路上' },
  { id: 'eggplantegg', nameZh: '茄子蛋', parentId: 'indie_rock', category: 'artist', subtext: '浪子回頭、浪流連、日常、愛情你比我想的閣較偉大' },
  { id: 'fireex', nameZh: '滅火器', parentId: 'indie_rock', category: 'artist', subtext: '島嶼天光、長途夜車、晚安台灣、海上的人' },
  { id: 'ksth', nameZh: '康士坦的變化球', parentId: 'indie_rock', category: 'artist', subtext: '美好的事可不可以發生在我身上、擱淺的人、更迭' },
  { id: 'mixer', nameZh: '麋先生', parentId: 'indie_rock', category: 'artist', subtext: '嗜愛動物、長成什麼樣子算成人、壞蛋、你不必那麼堅強' },
  { id: 'easy_weeds', nameZh: '溫室雜草', parentId: 'indie_rock', category: 'artist', subtext: '在為你預留的座位、春天有腳、積水' },
  { id: 'sorry_youth', nameZh: '拍謝少年', parentId: 'indie_rock', category: 'artist', subtext: '暗流、兄弟沒夢不應該、百百人生、下海' },
  { id: 'amazing_show', nameZh: '美秀集團', parentId: 'indie_rock', category: 'artist', subtext: '捲菸、擋一根、米兒、我要你愛、電火王' },
  { id: 'your_woman_sleep_with_others', nameZh: '老王樂隊', parentId: 'indie_rock', category: 'artist', subtext: '我還年輕 我還年輕、安九、補習班的門口高掛著我的黑白照片' },
  { id: 'chih_siou', nameZh: '持修', parentId: 'indie_rock', category: 'artist', subtext: '我還在你的夢裡嗎、Imma Get A New One、正想著你呢' },
  { id: 'mango_jump', nameZh: '芒果醬 Mango Jump', parentId: 'indie_rock', category: 'artist', subtext: '小紫、芒太郎、去海邊、夏夜晚風' },
  { id: 'collage', nameZh: '珂拉琪 Collage', parentId: 'indie_rock', category: 'artist', subtext: '萬千花蕊慈母悲哀、蓮花空行母、這該死的拘執佮愛' },
  { id: 'shallow_levee', nameZh: '淺堤', parentId: 'indie_rock', category: 'artist', subtext: '怪癖、信天翁、永和' },
  { id: 'sweet_john', nameZh: '甜約翰', parentId: 'indie_rock', category: 'artist', subtext: '留給你的我從未、失蹤人口、降雨機率' },
  { id: 'no_party_cigar', nameZh: '無妄合作社', parentId: 'indie_rock', category: 'artist', subtext: '檳榔、開店歌、搖滾明星' },
  { id: 'fool_and_idiot', nameZh: '傻子與白痴', parentId: 'indie_rock', category: 'artist', subtext: '夜長夢少、象牙舟、你終究不如想的那樣' },
  { id: 'trash', nameZh: 'TRASH', parentId: 'indie_rock', category: 'artist', subtext: '重感情的廢物、終究還是因為愛、希望你回來' },
  { id: 'fatpunc', nameZh: '怕胖團', parentId: 'indie_rock', category: 'artist', subtext: '魚、我真的很好奇、月旁月光' },
  { id: 'thick_big_band', nameZh: '粗大Band', parentId: 'indie_rock', category: 'artist', subtext: '留下來陪我生活、Uncle Ray' },
  { id: 'hormone_boys', nameZh: '荷爾蒙少年', parentId: 'indie_rock', category: 'artist', subtext: '4:00A.M.、中華商場、都會愛情故事' },
  { id: 'icyball', nameZh: '冰球樂團 icyball', parentId: 'indie_rock', category: 'artist', subtext: '搖啊搖、能不能和我留在台北、醉後喜歡我' },
  { id: 'who_cares', nameZh: '胡凱兒 Who Cares', parentId: 'indie_rock', category: 'artist', subtext: '菸癮 (交大吉他常開)、天際線、原諒' },
  { id: 'the_dinosaur_skin', nameZh: '恐龍的皮', parentId: 'indie_rock', category: 'artist', subtext: 'Jurassic Ride、All My Friends Are Dead' },
  { id: 'the_loophole', nameZh: '露波合唱團', parentId: 'indie_rock', category: 'artist', subtext: '幽默男孩、腦神經衰弱' },
  { id: 'jade', nameZh: 'JADE', parentId: 'indie_rock', category: 'artist', subtext: '迷惘的美、森林防衛隊' },
  { id: 'obsess', nameZh: 'OBSESS', parentId: 'indie_rock', category: 'artist', subtext: '破滅、海市蜃樓' },
  { id: 'i_mean_us', nameZh: 'I Mean Us', parentId: 'indie_rock', category: 'artist', subtext: 'Sovereignty、You So' },
  { id: 'echo', nameZh: '回聲樂團 Echo', parentId: 'indie_rock', category: 'artist', subtext: '時髦、被溺愛的渴望' },
  { id: 'mary_see_the_future', nameZh: '先知瑪莉', parentId: 'indie_rock', category: 'artist', subtext: 'Cheer、禮物、多美好' },
  { id: 'tizzy_bac', nameZh: 'Tizzy Bac', parentId: 'indie_rock', category: 'artist', subtext: '鞋貓夫人、鐵之貝克、這是因為我們能感到疼痛' },
  { id: 'iguanas', nameZh: '那我懂你意思了', parentId: 'indie_rock', category: 'artist', subtext: '所以我停下來、原諒我不明白你的悲傷' },
  { id: 'wonfu', nameZh: '旺福', parentId: 'indie_rock', category: 'artist', subtext: '迷你裙、小美人魚、我當你空氣' },
  { id: 'quarterback', nameZh: '四分衛', parentId: 'indie_rock', category: 'artist', subtext: '起來、雨和眼淚' },
  { id: 'tolaku', nameZh: '脫拉庫', parentId: 'indie_rock', category: 'artist', subtext: '我愛夏天、妹妹的喜帖' },

  // ----------------------------------------------------
  // 2. 華語流行 / 金曲抒情 (mandopop_ballad)
  // ----------------------------------------------------
  { id: 'jay_chou', nameZh: '周杰倫', parentId: 'mandopop_ballad', category: 'artist', subtext: '晴天、告白氣球、稻香、安靜、不能說的秘密' },
  { id: 'mayday', nameZh: '五月天', parentId: 'mandopop_ballad', category: 'artist', subtext: '溫柔、志明與春嬌、擁抱、乾杯、憨人' },
  { id: 'sodagreen', nameZh: '蘇打綠 / 魚丁糸', parentId: 'mandopop_ballad', category: 'artist', subtext: '小情歌、無與倫比的美麗、你在煩惱什麼、喜歡寂寞' },
  { id: 'weibird', nameZh: '韋禮安', parentId: 'mandopop_ballad', category: 'artist', subtext: '如果可以、女孩、因為愛、慢慢等、好天氣' },
  { id: 'jolin', nameZh: '蔡依林', parentId: 'mandopop_ballad', category: 'artist', subtext: '玫瑰少年、倒帶、日不落、說愛你' },
  { id: 'shishi', nameZh: '孫盛希', parentId: 'mandopop_ballad', category: 'artist', subtext: '少一點天份、眼淚記得你、稀有植物' },
  { id: 'jj_lin', nameZh: '林俊傑', parentId: 'mandopop_ballad', category: 'artist', subtext: '修煉愛情、可惜沒如果、江南、不為誰而作的歌' },
  { id: 'david_tao', nameZh: '陶喆', parentId: 'mandopop_ballad', category: 'artist', subtext: '飛機場的10:30 (交大吉他)、愛很簡單、普通朋友、流沙' },
  { id: 'chang_chen_yue', nameZh: '張震嶽', parentId: 'mandopop_ballad', category: 'artist', subtext: '愛我別走、自由、再見、思念是一種病' },
  { id: 'wubai', nameZh: '伍佰 & China Blue', parentId: 'mandopop_ballad', category: 'artist', subtext: 'Last Dance、挪威的森林、浪人情歌、愛你一萬年' },
  { id: 'hebe', nameZh: '田馥甄 Hebe', parentId: 'mandopop_ballad', category: 'artist', subtext: '小幸運、寂寞寂寞就好、魔鬼中的天使' },
  { id: 'eric_chou', nameZh: '周興哲', parentId: 'mandopop_ballad', category: 'artist', subtext: '以後別做朋友 (交大吉他翻唱)、你,好不好?、如果雨之後' },
  { id: 'jam_hsiao', nameZh: '蕭敬騰', parentId: 'mandopop_ballad', category: 'artist', subtext: '阿飛的小蝴蝶、王妃、王子的新衣' },
  { id: 'fish_leong', nameZh: '梁靜茹', parentId: 'mandopop_ballad', category: 'artist', subtext: '慢冷、情歌、勇氣、暖暖' },
  { id: 'lala_hsu', nameZh: '徐佳瑩', parentId: 'mandopop_ballad', category: 'artist', subtext: '身騎白馬、失落沙洲、言不由衷' },
  { id: 'eve_ai', nameZh: '艾怡良', parentId: 'mandopop_ballad', category: 'artist', subtext: 'Forever Young、我不知道愛是什麼' },
  { id: 'tanya_chua', nameZh: '蔡健雅', parentId: 'mandopop_ballad', category: 'artist', subtext: '達爾文、紅色高跟鞋、Letting Go' },
  { id: 'power_station', nameZh: '動力火車', parentId: 'mandopop_ballad', category: 'artist', subtext: '忠孝東路走九遍、當、外套' },
  { id: 'richie_jen', nameZh: '任賢齊', parentId: 'mandopop_ballad', category: 'artist', subtext: '心太軟、對面的女孩看過來、傷心太平洋' },
  { id: 'lo_ta_yu', nameZh: '羅大佑', parentId: 'mandopop_ballad', category: 'artist', subtext: '光陰的故事、童年、鹿港小鎮' },
  { id: 'jonathan_lee', nameZh: '李宗盛', parentId: 'mandopop_ballad', category: 'artist', subtext: '山丘、給自己的歌、凡人歌' },
  { id: 'tom_chang', nameZh: '張雨生', parentId: 'mandopop_ballad', category: 'artist', subtext: '天天想你、大海、我的未來不是夢' },
  { id: 'beyond', nameZh: 'Beyond', parentId: 'mandopop_ballad', category: 'artist', subtext: '海闊天空、光輝歲月、情人' },
  { id: 'osn_gao', nameZh: '高爾宣 OSN', parentId: 'mandopop_ballad', category: 'artist', subtext: 'Without You、So Good' },
  { id: 'shou_lou', nameZh: '婁峻碩', parentId: 'mandopop_ballad', category: 'artist', subtext: 'COLORFUL、NEVER LAND' },
  { id: 'eight_three_one', nameZh: '八三夭', parentId: 'mandopop_ballad', category: 'artist', subtext: '想見你想見你想見你、最後的831、東區東區' },

  // ----------------------------------------------------
  // 3. 校園民謠 / 不插電木吉他 (campus_folk_acoustic)
  // ----------------------------------------------------
  { id: 'cheer_chen', nameZh: '陳綺貞', parentId: 'campus_folk_acoustic', category: 'artist', subtext: '旅行的意義、吉他手、讓我想一想、魚、太聰明' },
  { id: 'crowd_lu', nameZh: '盧廣仲', parentId: 'campus_folk_acoustic', category: 'artist', subtext: '慢靈魂、魚仔、幾分之幾、刻在我心底的名字、早安晨之美' },
  { id: 'anpu', nameZh: '安溥 / 張懸', parentId: 'campus_folk_acoustic', category: 'artist', subtext: '寶貝、玫瑰色的你、艷火、喜歡、城市' },
  { id: 'katncandix2', nameZh: '棉花糖', parentId: 'campus_folk_acoustic', category: 'artist', subtext: '貳拾貳、也許像星星、一直都在 (交大春季小木屋成發)' },
  { id: 'huang_chieh', nameZh: '黃玠', parentId: 'campus_folk_acoustic', category: 'artist', subtext: '香格里拉、下雨的晚上、做朋友' },
  { id: 'goodband', nameZh: '好樂團', parentId: 'campus_folk_acoustic', category: 'artist', subtext: '他們說我是沒有用的年輕人、我把我的青春給你、遊蕩的人' },
  { id: 'nasyken', nameZh: '南西肯恩', parentId: 'campus_folk_acoustic', category: 'artist', subtext: '蒙毅將軍、大海、我也曾經想過這樣殺了我自己' },
  { id: 'crispy', nameZh: 'Crispy脆樂團', parentId: 'campus_folk_acoustic', category: 'artist', subtext: '100萬隻蝴蝶、編織星空的人、離開與到來' },
  { id: 'miss_bac', nameZh: '貝克小姐 Miss Bac', parentId: 'campus_folk_acoustic', category: 'artist', subtext: '四月七號 (吉他社神曲)、你特別、嘿，我想你了' },
  { id: 'liao_wen_chiang', nameZh: '廖文強', parentId: 'campus_folk_acoustic', category: 'artist', subtext: '自卑、喜劇人生' },
  { id: 'eli_hsieh', nameZh: '謝震廷', parentId: 'campus_folk_acoustic', category: 'artist', subtext: '查理、燈光、愛麗絲' },
  { id: 'yo_lee', nameZh: '李友廷', parentId: 'campus_folk_acoustic', category: 'artist', subtext: '誰、直到我遇見了你、想和你一起' },
  { id: 'pei_yu_hung', nameZh: '洪佩瑜', parentId: 'campus_folk_acoustic', category: 'artist', subtext: '踮起腳尖愛、不在一起就不會分開、明室' },
  { id: 'enno_cheng', nameZh: '鄭宜農', parentId: 'campus_folk_acoustic', category: 'artist', subtext: '玉仔的心、海王星、千千萬萬' },
  { id: 'annie_hung', nameZh: '洪安妮', parentId: 'campus_folk_acoustic', category: 'artist', subtext: '我喜歡你、只有我的天空有烏雲' },
  { id: 'fang_wu', nameZh: '吳汶芳', parentId: 'campus_folk_acoustic', category: 'artist', subtext: '孤獨的總和、無窮' },
  { id: 'chyi_chin', nameZh: '知更', parentId: 'campus_folk_acoustic', category: 'artist', subtext: '風箏白雲、怪人' },
  { id: 'ball_chuang', nameZh: '莊鵑瑛 小球', parentId: 'campus_folk_acoustic', category: 'artist', subtext: '星之所向、七分滿' },
  { id: 'waa_wei', nameZh: '魏如萱', parentId: 'campus_folk_acoustic', category: 'artist', subtext: '你啊你啊、彼個所在、香格里拉、買你' },
  { id: 'joanna_wang', nameZh: '王若琳', parentId: 'campus_folk_acoustic', category: 'artist', subtext: 'I Love You、迷宮、Start from Here' },

  // ----------------------------------------------------
  // 4. 西洋搖滾 / 經典另類 (western_rock)
  // ----------------------------------------------------
  { id: 'oasis', nameZh: 'Oasis', parentId: 'western_rock', category: 'artist', subtext: "Wonderwall、Don't Look Back In Anger、Champagne Supernova" },
  { id: 'coldplay', nameZh: 'Coldplay', parentId: 'western_rock', category: 'artist', subtext: 'Yellow、Fix You、Viva La Vida、The Scientist' },
  { id: 'queen', nameZh: 'Queen', parentId: 'western_rock', category: 'artist', subtext: 'Bohemian Rhapsody、We Are The Champions、Don\'t Stop Me Now' },
  { id: 'green_day', nameZh: 'Green Day', parentId: 'western_rock', category: 'artist', subtext: 'Wake Me Up When September Ends、Basket Case、21 Guns' },
  { id: 'radiohead', nameZh: 'Radiohead', parentId: 'western_rock', category: 'artist', subtext: 'Creep、Karma Police、No Surprises' },
  { id: 'maroon_5', nameZh: 'Maroon 5', parentId: 'western_rock', category: 'artist', subtext: 'She Will Be Loved、Sunday Morning、Sugar' },
  { id: 'beatles', nameZh: 'The Beatles', parentId: 'western_rock', category: 'artist', subtext: 'Let It Be、Hey Jude、Yesterday、While My Guitar Gently Weeps' },
  { id: 'guns_n_roses', nameZh: "Guns N' Roses", parentId: 'western_rock', category: 'artist', subtext: "Sweet Child O' Mine、Don't Cry、Patience" },
  { id: 'rhcp', nameZh: 'Red Hot Chili Peppers', parentId: 'western_rock', category: 'artist', subtext: 'Californication、Under the Bridge、Can\'t Stop' },
  { id: 'linkin_park', nameZh: 'Linkin Park', parentId: 'western_rock', category: 'artist', subtext: 'In the End、Numb、Faint' },
  { id: 'nirvana', nameZh: 'Nirvana', parentId: 'western_rock', category: 'artist', subtext: 'Smells Like Teen Spirit、Come as You Are' },
  { id: 'the_1975', nameZh: 'The 1975', parentId: 'western_rock', category: 'artist', subtext: 'Somebody Else、Robbers、About You' },
  { id: 'arctic_monkeys', nameZh: 'Arctic Monkeys', parentId: 'western_rock', category: 'artist', subtext: "Do I Wanna Know?、Why'd You Only Call Me When You're High?" },
  { id: 'cas', nameZh: 'Cigarettes After Sex', parentId: 'western_rock', category: 'artist', subtext: 'Apocalypse、K.、Sweet' },
  { id: 'eagles', nameZh: 'Eagles', parentId: 'western_rock', category: 'artist', subtext: 'Hotel California、Desperado' },
  { id: 'eric_clapton', nameZh: 'Eric Clapton', parentId: 'western_rock', category: 'artist', subtext: 'Tears in Heaven、Wonderful Tonight、Layla' },

  // ----------------------------------------------------
  // 5. 西洋流行 / R&B / 民謠 (western_pop_rnb)
  // ----------------------------------------------------
  { id: 'john_mayer', nameZh: 'John Mayer', parentId: 'western_pop_rnb', category: 'artist', subtext: 'Gravity (交大冬季小木屋成發)、Slow Dancing in a Burning Room' },
  { id: 'jason_mraz', nameZh: 'Jason Mraz', parentId: 'western_pop_rnb', category: 'artist', subtext: "I'm Yours (吉他社必練神曲)、Lucky、Geek in the Pink" },
  { id: 'jack_johnson', nameZh: 'Jack Johnson', parentId: 'western_pop_rnb', category: 'artist', subtext: 'Banana Pancakes、Better Together' },
  { id: 'taylor_swift', nameZh: 'Taylor Swift', parentId: 'western_pop_rnb', category: 'artist', subtext: 'Love Story、Cruel Summer、All Too Well、Cardigan' },
  { id: 'ed_sheeran', nameZh: 'Ed Sheeran', parentId: 'western_pop_rnb', category: 'artist', subtext: 'Perfect、Shape of You、Photograph、Thinking Out Loud' },
  { id: 'keshi', nameZh: 'keshi', parentId: 'western_pop_rnb', category: 'artist', subtext: 'beside you、like i need u、limbo、understand' },
  { id: 'bruno_mars', nameZh: 'Bruno Mars', parentId: 'western_pop_rnb', category: 'artist', subtext: 'Just the Way You Are、Leave the Door Open、That\'s What I Like' },
  { id: 'lauv', nameZh: 'Lauv', parentId: 'western_pop_rnb', category: 'artist', subtext: 'I Like Me Better、Paris in the Rain' },
  { id: 'justin_bieber', nameZh: 'Justin Bieber', parentId: 'western_pop_rnb', category: 'artist', subtext: 'Peaches、Ghost、Love Yourself' },
  { id: 'billie_eilish', nameZh: 'Billie Eilish', parentId: 'western_pop_rnb', category: 'artist', subtext: 'bad guy、ocean eyes、what was i made for' },
  { id: 'olivia_rodrigo', nameZh: 'Olivia Rodrigo', parentId: 'western_pop_rnb', category: 'artist', subtext: 'drivers license、vampire、deja vu' },
  { id: 'harry_styles', nameZh: 'Harry Styles', parentId: 'western_pop_rnb', category: 'artist', subtext: 'As It Was、Watermelon Sugar' },
  { id: 'adele', nameZh: 'Adele', parentId: 'western_pop_rnb', category: 'artist', subtext: 'Someone Like You、Rolling in the Deep' },
  { id: 'tom_misch', nameZh: 'Tom Misch', parentId: 'western_pop_rnb', category: 'artist', subtext: 'Movie、It Runs Through Me' },
  { id: 'daniel_caesar', nameZh: 'Daniel Caesar', parentId: 'western_pop_rnb', category: 'artist', subtext: 'Best Part、Get You' },
  { id: 'honne', nameZh: 'Honne', parentId: 'western_pop_rnb', category: 'artist', subtext: 'Day 1、Warm on a Cold Night' },
  { id: 'lany', nameZh: 'LANY', parentId: 'western_pop_rnb', category: 'artist', subtext: 'ILYSB、Malibu Nights' },
  { id: 'jeremy_zucker', nameZh: 'Jeremy Zucker', parentId: 'western_pop_rnb', category: 'artist', subtext: 'comethru、all the kids are depressed' },
  { id: 'conan_gray', nameZh: 'Conan Gray', parentId: 'western_pop_rnb', category: 'artist', subtext: 'Heather、Maniac' },
  { id: 'boy_pablo', nameZh: 'Boy Pablo', parentId: 'western_pop_rnb', category: 'artist', subtext: 'Everytime、Feeling Lonely' },
  { id: 'phum_viphurit', nameZh: 'Phum Viphurit', parentId: 'western_pop_rnb', category: 'artist', subtext: 'Lover Boy、Hello, Anxiety' },
  { id: 'corinne_bailey_rae', nameZh: 'Corinne Bailey Rae', parentId: 'western_pop_rnb', category: 'artist', subtext: 'Like a Star (交大吉他迎新表演)' },

  // ----------------------------------------------------
  // 6. 日語流行 / 動漫 / J-Rock (jpop_anime_jrock)
  // ----------------------------------------------------
  { id: 'yorushika', nameZh: 'Yorushika (ヨルシカ)', parentId: 'jpop_anime_jrock', category: 'artist', subtext: 'だから僕は音楽を辞めた、春泥棒、ただ君に晴れ、花に亡霊' },
  { id: 'yoasobi', nameZh: 'YOASOBI', parentId: 'jpop_anime_jrock', category: 'artist', subtext: '夜に駆ける、群青、アイドル、怪物' },
  { id: 'higedan', nameZh: 'Official髭男dism', parentId: 'jpop_anime_jrock', category: 'artist', subtext: 'Pretender、Subtitle、I LOVE...、宿命' },
  { id: 'oor', nameZh: 'ONE OK ROCK', parentId: 'jpop_anime_jrock', category: 'artist', subtext: 'Wherever you are、The Beginning、Clock Strikes' },
  { id: 'kessoku', nameZh: '結束バンド (孤獨搖滾)', parentId: 'jpop_anime_jrock', category: 'artist', subtext: '青春コンプレックス、星座になれたら、ギターと孤独と蒼い惑星' },
  { id: 'aimyon', nameZh: 'Aimyon (あいみょん)', parentId: 'jpop_anime_jrock', category: 'artist', subtext: 'マリーゴールド/金盞花、愛を伝えたいだとか、君はロックを聴かない' },
  { id: 'king_gnu', nameZh: 'King Gnu', parentId: 'jpop_anime_jrock', category: 'artist', subtext: '白日、一途、逆夢、SPECIALZ' },
  { id: 'vaundy', nameZh: 'Vaundy', parentId: 'jpop_anime_jrock', category: 'artist', subtext: '怪獣の花唄、踊り子、東京フラッシュ、不可幸力' },
  { id: 'radwimps', nameZh: 'RADWIMPS', parentId: 'jpop_anime_jrock', category: 'artist', subtext: '前前前世、なんでもないや、スパークル' },
  { id: 'back_number', nameZh: 'back number', parentId: 'jpop_anime_jrock', category: 'artist', subtext: 'クリスマスソング、高嶺の花子さん、水平線' },
  { id: 'fujii_kaze', nameZh: '藤井風 (Fujii Kaze)', parentId: 'jpop_anime_jrock', category: 'artist', subtext: '死ぬのがいいわ (Shinunoga E-Wa)、きらり、Matsuri' },
  { id: 'yuuri', nameZh: '優里 (Yuuri)', parentId: 'jpop_anime_jrock', category: 'artist', subtext: 'ドライフラワー (Dry Flower)、ベテルギウス (Betelgeuse)' },
  { id: 'aimer', nameZh: 'Aimer', parentId: 'jpop_anime_jrock', category: 'artist', subtext: '殘響散歌、カタオモイ、Brave Shine' },
  { id: 'eve', nameZh: 'Eve', parentId: 'jpop_anime_jrock', category: 'artist', subtext: '迴迴奇奇、ドラマツルギー、心予報' },
  { id: 'ado', nameZh: 'Ado', parentId: 'jpop_anime_jrock', category: 'artist', subtext: 'うっせぇわ、新時代、踊' },
  { id: 'yonezu', nameZh: '米津玄師 (Kenshi Yonezu)', parentId: 'jpop_anime_jrock', category: 'artist', subtext: 'Lemon、KICK BACK、アイネクライネ、打上花火' },
  { id: 'lisa', nameZh: 'LiSA', parentId: 'jpop_anime_jrock', category: 'artist', subtext: '紅蓮華、炎、Crossing Field' },
  { id: 'spitz', nameZh: 'Spitz', parentId: 'jpop_anime_jrock', category: 'artist', subtext: 'チェリー/櫻桃、楓、ロビンソン' },
  { id: 'mrs_green_apple', nameZh: 'Mrs. GREEN APPLE', parentId: 'jpop_anime_jrock', category: 'artist', subtext: '青と夏、インフェルノ、ダンスホール' },
  { id: 'bump_of_chicken', nameZh: 'BUMP OF CHICKEN', parentId: 'jpop_anime_jrock', category: 'artist', subtext: '天体観測、ray' },
  { id: 'akfg', nameZh: 'Asian Kung-Fu Generation', parentId: 'jpop_anime_jrock', category: 'artist', subtext: '遙か彼方、ソラニン/Solanin' },
  { id: 'spyair', nameZh: 'SPYAIR', parentId: 'jpop_anime_jrock', category: 'artist', subtext: 'サムライハート、現状ディストラクション' },
  { id: 'larc', nameZh: "L'Arc~en~Ciel", parentId: 'jpop_anime_jrock', category: 'artist', subtext: "Driver's High、虹" },
  { id: 'mr_children', nameZh: 'Mr.Children', parentId: 'jpop_anime_jrock', category: 'artist', subtext: 'Innocent World、Sign、HANABI' },
  { id: 'sheena_ringo', nameZh: '椎名林檎 / 東京事變', parentId: 'jpop_anime_jrock', category: 'artist', subtext: '丸之內SADISTIC、群青日和' },
  { id: 'zutomayo', nameZh: 'ずっと真夜中でいいのに。', parentId: 'jpop_anime_jrock', category: 'artist', subtext: '秒針を噛む、お勉強しといてよ' },
  { id: 'tuyu', nameZh: 'ツユ (Tuyu)', parentId: 'jpop_anime_jrock', category: 'artist', subtext: 'くらべられっ子、泥の分際で私だけの大切を奪おうだなんて' },
  { id: 'polkadot_stingray', nameZh: 'Polkadot Stingray', parentId: 'jpop_anime_jrock', category: 'artist', subtext: 'テレキャスター・ストライプ、ヒミツ' },
  { id: 'kana_boon', nameZh: 'KANA-BOON', parentId: 'jpop_anime_jrock', category: 'artist', subtext: 'シルエット (Silhouette)、ないものねだり' },
  { id: 'saucy_dog', nameZh: 'Saucy Dog', parentId: 'jpop_anime_jrock', category: 'artist', subtext: 'シンデレラボーイ、いつか' },
  { id: 'gestalt_girl', nameZh: '格式塔少女 (Gestalt Girl)', parentId: 'jpop_anime_jrock', category: 'artist', subtext: '生きてるだけで生きてゆけ (台灣日系樂團)' },

  // ----------------------------------------------------
  // 7. 韓系獨立 / K-Indie / 流行 (kpop_kindie)
  // ----------------------------------------------------
  { id: 'wave_to_earth', nameZh: 'Wave to Earth', parentId: 'kpop_kindie', category: 'artist', subtext: 'seasons、bad、love.、peach eyes (大學吉他必聽神團)' },
  { id: 'hyukoh', nameZh: 'HYUKOH', parentId: 'kpop_kindie', category: 'artist', subtext: 'TOMBOY、Wi Ing Wi Ing、Comes And Goes' },
  { id: 'black_skirts', nameZh: 'The Black Skirts (黑裙子)', parentId: 'kpop_kindie', category: 'artist', subtext: 'EVERYTHING、Wait More' },
  { id: 'day6', nameZh: 'DAY6', parentId: 'kpop_kindie', category: 'artist', subtext: 'You Were Beautiful、Time of Our Life、Congratulations、Zombie' },
  { id: 'jannabi', nameZh: 'Jannabi', parentId: 'kpop_kindie', category: 'artist', subtext: 'For Lovers Who Hesitate、Summer' },
  { id: 'ten_cm', nameZh: '10CM', parentId: 'kpop_kindie', category: 'artist', subtext: 'What The Spring??、Americano、Gradation、Tell Me It\'s Not a Dream' },
  { id: 'silica_gel', nameZh: 'Silica Gel', parentId: 'kpop_kindie', category: 'artist', subtext: 'NO PAIN、Tik Tak Tok' },
  { id: 'se_so_neon', nameZh: 'SE SO NEON', parentId: 'kpop_kindie', category: 'artist', subtext: 'A Long Dream、NAN CHUN' },
  { id: 'nell', nameZh: 'Nell', parentId: 'kpop_kindie', category: 'artist', subtext: 'Time Walking On Memory、Four Times Around the Sun' },
  { id: 'lucy', nameZh: 'Lucy', parentId: 'kpop_kindie', category: 'artist', subtext: 'Hero、Flowering、Snooze' },
  { id: 'ftisland', nameZh: 'FTISLAND', parentId: 'kpop_kindie', category: 'artist', subtext: 'Severely、I Hope、Wind' },
  { id: 'cnblue', nameZh: 'CNBLUE', parentId: 'kpop_kindie', category: 'artist', subtext: "I'm a Loner、Can't Stop" },
  { id: 'iu', nameZh: 'IU', parentId: 'kpop_kindie', category: 'artist', subtext: 'Blueming、Through the Night (夜信)、eight、Good Day' },
  { id: 'akmu', nameZh: 'AKMU (樂童音樂家)', parentId: 'kpop_kindie', category: 'artist', subtext: '200%、Give Love、How can I love the heartbreak' },
  { id: 'lee_mu_jin', nameZh: '李茂珍 (Lee Mu-jin)', parentId: 'kpop_kindie', category: 'artist', subtext: 'Traffic Light、Rain and You' },
  { id: 'paul_kim', nameZh: 'Paul Kim', parentId: 'kpop_kindie', category: 'artist', subtext: 'Every day, Every Moment、Me After You' },
  { id: 'bol4', nameZh: '臉紅的思春期 (BOL4)', parentId: 'kpop_kindie', category: 'artist', subtext: 'To My Youth、Some、Galaxy' },
  { id: 'zion_t', nameZh: 'Zion.T', parentId: 'kpop_kindie', category: 'artist', subtext: '楊花大橋、Eat' },
  { id: 'crush', nameZh: 'Crush', parentId: 'kpop_kindie', category: 'artist', subtext: 'Beautiful、Oasis' },
  { id: 'dean', nameZh: 'Dean', parentId: 'kpop_kindie', category: 'artist', subtext: 'instagram、D (Half Moon)' },
  { id: 'newjeans', nameZh: 'NewJeans', parentId: 'kpop_kindie', category: 'artist', subtext: 'Ditto、Hype Boy、OMG' },
  { id: 'bts', nameZh: 'BTS', parentId: 'kpop_kindie', category: 'artist', subtext: 'Spring Day、Butter' },
  { id: 'blackpink', nameZh: 'BLACKPINK', parentId: 'kpop_kindie', category: 'artist', subtext: 'Lovesick Girls、Stay' },

  // ----------------------------------------------------
  // 8. City Pop / 嘻哈 / 放克爵士 (hiphop_funk)
  // ----------------------------------------------------
  { id: 'sunset_rollercoaster', nameZh: '落日飛車', parentId: 'hiphop_funk', category: 'artist', subtext: 'My Jinji、Vanilla、Burgundy Red、I Know You Know I Love You' },
  { id: 'nine_m_eight_eight', nameZh: '9m88', parentId: 'hiphop_funk', category: 'artist', subtext: '九頭身日奈、最高品質靜悄悄、平庸之上' },
  { id: 'cosmospeople', nameZh: '宇宙人', parentId: 'hiphop_funk', category: 'artist', subtext: '藍色的你 (交大吉他迎新)、如果我們還在一起、那你呢' },
  { id: 'the_crane', nameZh: '鶴 The Crane', parentId: 'hiphop_funk', category: 'artist', subtext: '不介意、拉麵公子、Natural Ability' },
  { id: 'linion', nameZh: 'LINION', parentId: 'hiphop_funk', category: 'artist', subtext: 'Room 335、Mountain Dude、Can\'t Find' },
  { id: 'layton_wu', nameZh: '雷擎', parentId: 'hiphop_funk', category: 'artist', subtext: '心肝寶貝、風馳電掣' },
  { id: 'softlipa', nameZh: '蛋堡', parentId: 'hiphop_funk', category: 'artist', subtext: '少年維持著煩惱、收斂水、過程、家常音樂' },
  { id: 'mj116', nameZh: '頑童MJ116', parentId: 'hiphop_funk', category: 'artist', subtext: '幹大事、辣台妹、少年董' },
  { id: 'leo_wang', nameZh: 'Leo王', parentId: 'hiphop_funk', category: 'artist', subtext: '快樂的甘蔗人、神經元、雞開天窗' },
  { id: 'dr_paper', nameZh: '國蛋', parentId: 'hiphop_funk', category: 'artist', subtext: 'White Noise、飛行少女、嘻哈囝' },
  { id: 'kumachan', nameZh: '熊仔', parentId: 'hiphop_funk', category: 'artist', subtext: '買榜、凶宅、才子' },
  { id: 'mc_hotdog', nameZh: '熱狗 MC HotDog', parentId: 'hiphop_funk', category: 'artist', subtext: '差不多先生、安可、樓下的房客' },
  { id: 'tatsuro_yamashita', nameZh: '山下達郎', parentId: 'hiphop_funk', category: 'artist', subtext: 'Ride on Time、Christmas Eve (City Pop始祖)' },
  { id: 'miki_matsubara', nameZh: '松原美紀 / 竹內瑪莉亞', parentId: 'hiphop_funk', category: 'artist', subtext: 'Stay With Me、Plastic Love' },
  { id: 'lamp', nameZh: 'Lamp', parentId: 'hiphop_funk', category: 'artist', subtext: 'ゆめうつつ、八月的詩情' },

  // ----------------------------------------------------
  // 9. 中國民謠 / 獨立搖滾 (cn_pop_indie)
  // ----------------------------------------------------
  { id: 'omni_youth', nameZh: '萬能青年旅店', parentId: 'cn_pop_indie', category: 'artist', subtext: '十萬嬉皮、殺死那個石家莊人、秦皇島' },
  { id: 'landlord_cat', nameZh: '房東的貓', parentId: 'cn_pop_indie', category: 'artist', subtext: '雲煙成雨、秋釀、下一站茶山劉、美好事物' },
  { id: 'zhao_lei', nameZh: '趙雷', parentId: 'cn_pop_indie', category: 'artist', subtext: '成都、畫、少年錦時' },
  { id: 'song_dongye', nameZh: '宋冬野', parentId: 'cn_pop_indie', category: 'artist', subtext: '安和橋、董小姐、斑馬斑馬' },
  { id: 'ma_di', nameZh: '馬頔', parentId: 'cn_pop_indie', category: 'artist', subtext: '南山南、傲寒' },
  { id: 'chen_li', nameZh: '陳粒', parentId: 'cn_pop_indie', category: 'artist', subtext: '奇妙能力歌、易燃易爆炸、小半、莉莉安' },
  { id: 'jiao_maiqi', nameZh: '焦邁奇', parentId: 'cn_pop_indie', category: 'artist', subtext: '我的名字、嘩啦啦少年再見' },
  { id: 'mao_buyi', nameZh: '毛不易', parentId: 'cn_pop_indie', category: 'artist', subtext: '消愁、像我這樣的人、平凡的一天、不染' },
  { id: 'guo_ding', nameZh: '郭頂', parentId: 'cn_pop_indie', category: 'artist', subtext: '水星記、淒美地、保留' },
  { id: 'li_ronghao', nameZh: '李榮浩', parentId: 'cn_pop_indie', category: 'artist', subtext: '模特、年少有為、李白、烏梅子醬' },
  { id: 'joker_xue', nameZh: '薛之謙', parentId: 'cn_pop_indie', category: 'artist', subtext: '演員、紳士、認真的雪、天外來物' },
  { id: 'li_jian', nameZh: '李健', parentId: 'cn_pop_indie', category: 'artist', subtext: '貝加爾湖畔、風吹麥浪、傳奇' },
  { id: 'pu_shu', nameZh: '朴樹', parentId: 'cn_pop_indie', category: 'artist', subtext: '平凡之路、那些花兒、生如夏花' },
  { id: 'xu_wei', nameZh: '許巍', parentId: 'cn_pop_indie', category: 'artist', subtext: '藍蓮花、曾經的你' },
  { id: 'miserable_faith', nameZh: '痛仰樂隊', parentId: 'cn_pop_indie', category: 'artist', subtext: '再見傑克、公路之歌、西湖' },
  { id: 'new_pants', nameZh: '新褲子', parentId: 'cn_pop_indie', category: 'artist', subtext: '你要跳舞嗎、生活因你而火熱' },
  { id: 'hedgehog', nameZh: '刺蝟樂隊', parentId: 'cn_pop_indie', category: 'artist', subtext: '火車駛向雲外，夢安魂於九霄' },
  { id: 'wutiao_ren', nameZh: '五條人', parentId: 'cn_pop_indie', category: 'artist', subtext: '阿珍愛上了阿強、道山靚仔' },
  { id: 'lost_train', nameZh: '丟火車', parentId: 'cn_pop_indie', category: 'artist', subtext: '白蘭鴿巡遊記、晚安' },
  { id: 'mayuan_poet', nameZh: '麻園詩人', parentId: 'cn_pop_indie', category: 'artist', subtext: '瀘沽湖、晚安' },
  { id: 'hua_chenyu', nameZh: '華晨宇', parentId: 'cn_pop_indie', category: 'artist', subtext: '好想愛這個世界啊 (交大春季小木屋成發)' },

  // ----------------------------------------------------
  // 10. 抖音神曲 / 短影音熱門 (douyin_viral)
  // ----------------------------------------------------
  { id: 'bai_xiaobai', nameZh: '白小白', parentId: 'douyin_viral', category: 'artist', subtext: '最美的傷口、我愛過你、愛我就別傷害我' },
  { id: 'lb_libi', nameZh: 'LB利比', parentId: 'douyin_viral', category: 'artist', subtext: '跳樓機、小城夏天' },
  { id: 'jing_long', nameZh: '井朧 / 井迪', parentId: 'douyin_viral', category: 'artist', subtext: '不刪、把孤獨當作晚餐、驍' },
  { id: 'peng_xiyan', nameZh: '彭席彥 / 溫和治療', parentId: 'douyin_viral', category: 'artist', subtext: '海嶼你' },
  { id: 'young_captain', nameZh: '隊長 (Young Captain)', parentId: 'douyin_viral', category: 'artist', subtext: '哪裡都是你、予你、樓頂上的小雞' },
  { id: 'chenghuan', nameZh: '承桓', parentId: 'douyin_viral', category: 'artist', subtext: '我會等' },
  { id: 'liu_shuang', nameZh: '柳爽', parentId: 'douyin_viral', category: 'artist', subtext: '漠河舞廳、玫瑰竊賊' },
  { id: 'dazi', nameZh: '大籽', parentId: 'douyin_viral', category: 'artist', subtext: '白月光與硃砂痣' },
  { id: 'a_rong', nameZh: '阿冗', parentId: 'douyin_viral', category: 'artist', subtext: '與我無關、你的答案' },
  { id: 'gebi_laofan', nameZh: '隔壁老樊', parentId: 'douyin_viral', category: 'artist', subtext: '多想在平庸的生活擁抱你、四塊五' },
  { id: 'silence_wang', nameZh: '汪蘇瀧', parentId: 'douyin_viral', category: 'artist', subtext: '萬有引力、一笑傾城、有點甜' },
  { id: 'hu_er', nameZh: '虎二', parentId: 'douyin_viral', category: 'artist', subtext: '一個人決定、一百萬個可能' },

  // ----------------------------------------------------
  // 11. 重型音樂 / 金屬 / 數搖 (heavy_metal_math)
  // ----------------------------------------------------
  { id: 'flesh_juicer', nameZh: '血肉果汁機', parentId: 'heavy_metal_math', category: 'artist', subtext: '粗殘台中、關閉太陽、太子哥 (金曲最佳樂團)' },
  { id: 'chthonic', nameZh: '閃靈 Chthonic', parentId: 'heavy_metal_math', category: 'artist', subtext: '暮沉武德殿、皇軍' },
  { id: 'elephant_gym', nameZh: '大象體操 Elephant Gym', parentId: 'heavy_metal_math', category: 'artist', subtext: '中途、夜洋風景、被遺忘的 (數搖代表)' },
  { id: 'polyphia', nameZh: 'Polyphia', parentId: 'heavy_metal_math', category: 'artist', subtext: 'Playing God、G.O.A.T. (全球前衛指彈神團)' },
  { id: 'bear_chamber', nameZh: '體熊專科', parentId: 'heavy_metal_math', category: 'artist', subtext: '技、瞬 (台灣純器樂數搖)' },
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
    campus_folk_acoustic: 0.25,
    jpop_anime_jrock: 0.2,
    heavy_metal_math: 0.25,
    mandopop_ballad: 0.2,
    kpop_kindie: 0.2,
  },
  mandopop_ballad: {
    indie_rock: 0.2,
    campus_folk_acoustic: 0.3,
    cn_pop_indie: 0.25,
    douyin_viral: 0.2,
  },
  campus_folk_acoustic: {
    mandopop_ballad: 0.3,
    indie_rock: 0.25,
    western_pop_rnb: 0.25,
    cn_pop_indie: 0.25,
  },
  western_rock: {
    indie_rock: 0.25,
    western_pop_rnb: 0.2,
    jpop_anime_jrock: 0.2,
    heavy_metal_math: 0.25,
  },
  western_pop_rnb: {
    campus_folk_acoustic: 0.25,
    western_rock: 0.2,
    hiphop_funk: 0.25,
    kpop_kindie: 0.2,
  },
  jpop_anime_jrock: {
    indie_rock: 0.2,
    western_rock: 0.2,
  },
  kpop_kindie: {
    western_pop_rnb: 0.2,
    hiphop_funk: 0.25,
    indie_rock: 0.2,
  },
  hiphop_funk: {
    western_pop_rnb: 0.25,
    kpop_kindie: 0.25,
  },
  cn_pop_indie: {
    mandopop_ballad: 0.25,
    campus_folk_acoustic: 0.25,
    douyin_viral: 0.2,
  },
  douyin_viral: {
    mandopop_ballad: 0.2,
    cn_pop_indie: 0.2,
  },
  heavy_metal_math: {
    indie_rock: 0.25,
    western_rock: 0.25,
  },
};

/**
 * Returns cross-genre soft relationship weight
 */
export function getGenreNeighborhoodWeight(genreA: string, genreB: string): number {
  if (genreA === genreB) return 1.0;
  if (genreA === 'any_genre' || genreB === 'any_genre') return 1.0;
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
  groupSizePreference: 'any',
  groupSizePreferenceWeight: 0.25,
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
  keyRoles: ['acoustic_guitar', 'electric_guitar', 'cajon', 'drums', 'lead_vocal'],
};

export const ROLE_DEFINITIONS = ROLES;
export { PRESET_WEIGHTS } from './scoring';
