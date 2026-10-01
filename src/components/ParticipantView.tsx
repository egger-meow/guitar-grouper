import React, { useState } from 'react';
import type { Participant, Role, HostSettings } from '../types/domain';
import { ROLES, GENRES, ARTISTS, getTagNameZh } from '../engine/taxonomy';
import {
  Check,
  Sparkles,
  Guitar,
  Edit3,
  Search,
  ChevronDown,
  ChevronUp,
  Users,
} from 'lucide-react';

export interface ParticipantViewProps {
  roomCode: string;
  participant: Participant | null;
  status: 'WAITING' | 'OPTIMIZING' | 'DRAFT' | 'REVEALED';
  settings?: HostSettings;
  participantCount?: number;
  onSubmit: (data: {
    name: string;
    gender: string;
    capabilities: Role[];
    musicPreferences: string[];
  }) => void;
}

export function ParticipantView({
  roomCode,
  participant,
  status,
  settings,
  participantCount,
  onSubmit,
}: ParticipantViewProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(participant?.name || '');
  const [gender, setGender] = useState(participant?.gender || 'unspecified');
  const [selectedRoles, setSelectedRoles] = useState<Role[]>(participant?.capabilities || []);
  const [selectedMusic, setSelectedMusic] = useState<string[]>(participant?.musicPreferences || []);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFullArtistLibrary, setShowFullArtistLibrary] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const isCoarse = settings?.genreGranularity === 'coarse';

  const toggleRole = (roleId: Role) => {
    setSelectedRoles((prev) =>
      prev.includes(roleId) ? prev.filter((r) => r !== roleId) : [...prev, roleId]
    );
  };

  const toggleMusic = (itemId: string) => {
    setSelectedMusic((prev) =>
      prev.includes(itemId) ? prev.filter((m) => m !== itemId) : [...prev, itemId]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setValidationError('請輸入你的暱稱或姓名');
      return;
    }
    if (selectedRoles.length === 0) {
      setValidationError('請至少選擇一項能負責的樂器或角色');
      return;
    }
    setValidationError(null);
    onSubmit({
      name: name.trim(),
      gender,
      capabilities: selectedRoles,
      musicPreferences: selectedMusic,
    });
    setIsEditing(false);
  };

  // If already joined and not in edit mode
  if (participant && !isEditing) {
    return (
      <div className="w-full max-w-lg mx-auto p-4 animate-fadeIn">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl text-center space-y-6">
          {/* Animated Rhythm Pulse Visual */}
          <div className="relative w-28 h-28 mx-auto flex items-center justify-center">
            <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping opacity-75" />
            <div className="absolute inset-2 rounded-full bg-emerald-500/30 animate-pulse" />
            <div className="relative w-20 h-20 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/30">
              <Guitar className="w-10 h-10 text-slate-950" />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-center gap-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-xs text-slate-300">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                房間：<strong className="text-amber-400 font-mono tracking-widest">{roomCode}</strong>
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-xs font-semibold text-emerald-300 shadow-sm shadow-emerald-500/10">
                <Users className="w-3.5 h-3.5 text-emerald-400" />
                <span>
                  目前已加入 <strong className="text-white font-bold">{participantCount ?? 1}</strong> 人
                </span>
              </div>
            </div>
            <h2 className="text-2xl font-black text-white">{status === 'WAITING' ? '等待房主開始分組' : '等待房主安排並發布結果'}</h2>
            <p className="text-slate-400 text-sm">
              你已經成功報名！目前全場共{' '}
              <strong className="text-emerald-400 font-bold">{participantCount ?? 1}</strong>{' '}
              位社員已加入。房主確認並發布後，你會在這裡看到自己的組別。
            </p>
          </div>

          {/* Participant submitted profile summary */}
          <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700 text-left space-y-3">
            <div className="flex items-center justify-between border-b border-slate-700/60 pb-2">
              <span className="text-sm font-bold text-white flex items-center gap-2">
                <span className="text-lg">👤</span> {participant.name}
              </span>
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>修改資料</span>
              </button>
            </div>

            <div>
              <div className="text-xs text-slate-400 mb-1">負責樂器 / 職責：</div>
              <div className="flex flex-wrap gap-1.5">
                {participant.capabilities.map((c) => (
                  <span
                    key={c}
                    className="text-xs px-2.5 py-1 rounded-lg bg-indigo-950 border border-indigo-700/60 text-indigo-300 font-medium"
                  >
                    {getTagNameZh(c)}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <div className="text-xs text-slate-400 mb-1">喜好曲風 / 歌手：</div>
              <div className="flex flex-wrap gap-1.5">
                {participant.musicPreferences.length === 0 ? (
                  <span className="text-xs text-slate-500">不限，隨緣配合</span>
                ) : (
                  participant.musicPreferences.map((m) => (
                    <span
                      key={m}
                      className="text-xs px-2.5 py-1 rounded-lg bg-purple-950 border border-purple-700/60 text-purple-300"
                    >
                      {getTagNameZh(m)}
                    </span>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Filtered artists based on category & search query
  const filteredArtists = ARTISTS.filter((item) => {
    const matchesCategory =
      activeCategory === 'all' || item.parentId === activeCategory;
    const matchesSearch =
      !searchQuery ||
      item.nameZh.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.subtext && item.subtext.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const hasAnyGenreSelected = selectedMusic.includes('any_genre');

  // Category filter list for artists
  const artistCategoryFilters = [
    { id: 'all', label: '全部歌手' },
    { id: 'indie_rock', label: '台灣獨立' },
    { id: 'mandopop_ballad', label: '華語流行' },
    { id: 'campus_folk_acoustic', label: '校園民謠' },
    { id: 'western_rock', label: '西洋搖滾' },
    { id: 'western_pop_rnb', label: '西洋流行' },
    { id: 'jpop_anime_jrock', label: '日語動漫' },
    { id: 'kpop_kindie', label: '韓系獨立' },
    { id: 'hiphop_funk', label: 'CityPop/黑樂' },
    { id: 'cn_pop_indie', label: '中國民謠' },
    { id: 'douyin_viral', label: '抖音熱門' },
    { id: 'heavy_metal_math', label: '重型數搖' },
  ];

  return (
    <div className="w-full max-w-xl mx-auto px-4 py-6 animate-fadeIn">
      <form
        onSubmit={handleSubmit}
        className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-8 pb-28 sm:pb-8 shadow-2xl space-y-6"
      >
        <div className="border-b border-slate-800 pb-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-amber-400 uppercase tracking-widest">
              30 秒快速填寫
            </span>
            <div className="flex items-center gap-2">
              {typeof participantCount === 'number' && participantCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-bold text-[11px] flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <Users className="w-3 h-3 text-emerald-400" />
                  <span>{participantCount} 人在線</span>
                </span>
              )}
              <span className="text-xs text-slate-400 font-mono">房間: {roomCode}</span>
            </div>
          </div>
          <h2 className="text-2xl font-black text-white">加入吉他社分組</h2>
          <p className="text-slate-400 text-xs mt-1">
            選擇你的主要樂器與喜歡的曲風，演算法將為你找到最契合的樂團搭檔！
          </p>
        </div>

        {/* 1. Name & Gender */}
        <div className="space-y-4">
          <div>
            <label className="block text-slate-300 text-sm font-bold mb-1.5">
              你的暱稱 / 姓名 <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="請輸入你的暱稱或姓名（例如：阿杰）"
              className="w-full px-4 py-3 rounded-2xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400 transition-all text-base"
            />
          </div>

          <div>
            <label className="block text-slate-300 text-sm font-bold mb-1.5">
              性別 / 稱呼（供多元分組參考）
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { id: 'male', label: '男生' },
                { id: 'female', label: '女生' },
                { id: 'other', label: '其他' },
                { id: 'unspecified', label: '不透露' },
              ].map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setGender(g.id)}
                  className={`py-2 px-1 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                    gender === g.id
                      ? 'bg-indigo-600 border-indigo-400 text-white shadow-md'
                      : 'bg-slate-800/80 hover:bg-slate-700 text-slate-400 border-slate-700'
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 2. Visual Multi-Select Instrument Pills */}
        <div className="space-y-2">
          <label className="block text-slate-300 text-sm font-bold">
            負責樂器 / 角色 (可複選) <span className="text-red-400">*</span>
          </label>
          <p className="text-slate-400 text-xs">點擊選取你會彈奏或想擔任的角色</p>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
            {ROLES.map((role) => {
              const isSelected = selectedRoles.includes(role.id);
              return (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => toggleRole(role.id)}
                  className={`flex items-center gap-2 p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-gradient-to-r from-emerald-600/40 to-teal-600/40 border-emerald-400 text-white shadow-lg ring-1 ring-emerald-400/50'
                      : 'bg-slate-800/60 hover:bg-slate-800 border-slate-700/80 text-slate-300'
                  }`}
                >
                  <span className="text-lg">
                    {role.id === 'acoustic_guitar' && '🎸'}
                    {role.id === 'electric_guitar' && '⚡'}
                    {role.id === 'cajon' && '🥁'}
                    {role.id === 'drums' && '🥁'}
                    {role.id === 'bass' && '🎸'}
                    {role.id === 'keyboard' && '🎹'}
                    {role.id === 'lead_vocal' && '🎤'}
                    {role.id === 'backing_vocal' && '🎶'}
                    {role.id === 'other' && '➕'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold truncate">{role.nameZh}</div>
                  </div>
                  {isSelected && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. Music Styles & Artists Multi-Select */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="block text-slate-300 text-sm font-bold">
              音樂品味與喜愛流派 (可複選)
            </label>
            <span className="text-xs text-purple-400 font-semibold">
              已選 {selectedMusic.length} 項
            </span>
          </div>

          {/* Granularity Mode Banner */}
          <div
            className={`px-3 py-2 rounded-xl border text-xs flex items-center justify-between ${
              isCoarse
                ? 'bg-indigo-950/60 border-indigo-700/60 text-indigo-300'
                : 'bg-purple-950/60 border-purple-700/60 text-purple-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                主辦人設定：
                <strong className="text-white">
                  {isCoarse ? '寬鬆流派模式 (快速勾選)' : '細緻歌手模式 (含170+組藝人)'}
                </strong>
              </span>
            </div>
            <span className="text-[11px] font-mono text-slate-400">
              {isCoarse ? '大類配對' : '歌手精配'}
            </span>
          </div>

          {/* Special "Any Genre" Notice if selected */}
          {hasAnyGenreSelected && (
            <div className="px-3.5 py-2.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs flex items-center gap-2">
              <span className="text-base">🌟</span>
              <span>
                你已選擇<strong>「都可以 / 雜食派」</strong>：演算法將視為全能適配，與任何組別皆能完美融合！
              </span>
            </div>
          )}

          {/* Major Genres Multi-Select Grid (Available in both modes, primary in coarse mode) */}
          <div className="space-y-1.5">
            <div className="text-[11px] font-bold text-slate-400 flex items-center justify-between">
              <span>主要音樂風格（點擊直接多選）：</span>
              <span className="text-slate-500">支援複選</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {GENRES.map((genre) => {
                const isSelected = selectedMusic.includes(genre.id);
                const isAny = genre.id === 'any_genre';
                return (
                  <button
                    key={genre.id}
                    type="button"
                    onClick={() => toggleMusic(genre.id)}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? isAny
                          ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-md font-bold ring-2 ring-amber-400/40'
                          : 'bg-purple-600 text-white border-purple-400 shadow-md font-bold ring-2 ring-purple-400/30'
                        : isAny
                        ? 'bg-slate-800/90 hover:bg-slate-800 text-amber-300 border-amber-500/40'
                        : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 border-slate-700/80'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-bold truncate">
                        {isAny && '🌟 '}
                        {genre.nameZh}
                      </span>
                      {isSelected && (
                        <Check
                          className={`w-3.5 h-3.5 shrink-0 ${
                            isAny ? 'text-slate-950' : 'text-purple-200'
                          }`}
                        />
                      )}
                    </div>
                    {genre.subtext && (
                      <div
                        className={`text-[10px] mt-1 line-clamp-1 ${
                          isSelected
                            ? isAny
                              ? 'text-slate-900 font-medium'
                              : 'text-purple-200 font-medium'
                            : 'text-slate-400'
                        }`}
                      >
                        {genre.subtext}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Coarse Mode: Optional expander to reveal full artist library */}
          {isCoarse && (
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowFullArtistLibrary(!showFullArtistLibrary)}
                className="w-full py-2.5 px-3 rounded-xl bg-slate-800/50 hover:bg-slate-800 border border-slate-700 text-xs text-slate-300 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Search className="w-3.5 h-3.5 text-purple-400" />
                <span>
                  {showFullArtistLibrary
                    ? '收起特定歌手搜尋庫'
                    : '想特別指定喜愛的歌手？點此展開完整藝人庫 (170+ 組)'}
                </span>
                {showFullArtistLibrary ? (
                  <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                )}
              </button>
            </div>
          )}

          {/* Specific Artists & Bands Cloud (Shown in fine mode, or when expanded in coarse mode) */}
          {(!isCoarse || showFullArtistLibrary) && (
            <div className="space-y-2.5 pt-2 border-t border-slate-800/80 animate-fadeIn">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-400">
                  熱門歌手與樂團（170+ 組，支援即時搜尋與代表作配對）：
                </span>
                <span className="text-[10px] text-slate-500 font-mono">
                  共 {filteredArtists.length} 組
                </span>
              </div>

              {/* Category Filter Tabs */}
              <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                {artistCategoryFilters.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveCategory(tab.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap border transition-all cursor-pointer ${
                      activeCategory === tab.id
                        ? 'bg-purple-600 text-white border-purple-400 shadow-sm'
                        : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Quick Search with song title matching */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="搜尋歌手、樂團或代表作（例如：周杰倫、草東、Gravity、白小白、Yorushika、Wave to Earth、菸癮）"
                  className="w-full pl-9 pr-8 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-white text-xs placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-purple-400"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs p-1 cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Artists Pills Cloud */}
              <div className="flex flex-wrap gap-2 max-h-64 overflow-y-auto p-2 bg-slate-950/60 rounded-2xl border border-slate-800 touch-pan-y">
                {filteredArtists.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-500 w-full">
                    查無符合「{searchQuery}」的歌手或歌曲，請嘗試不同關鍵字
                  </div>
                ) : (
                  filteredArtists.map((artist) => {
                    const isSelected = selectedMusic.includes(artist.id);
                    return (
                      <button
                        key={artist.id}
                        type="button"
                        onClick={() => toggleMusic(artist.id)}
                        className={`px-3 py-2 rounded-xl text-xs font-medium border transition-all active:scale-95 cursor-pointer flex items-center gap-1.5 touch-manipulation ${
                          isSelected
                            ? 'bg-purple-900/70 border-purple-400 text-purple-200 shadow-md ring-1 ring-purple-400/50'
                            : 'bg-slate-800/70 hover:bg-slate-800 border-slate-700/70 text-slate-300'
                        }`}
                        title={artist.subtext}
                      >
                        <span className="font-semibold">{artist.nameZh}</span>
                        {isSelected && <Check className="w-3 h-3 text-purple-300 shrink-0" />}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {validationError && (
          <div className="p-3 rounded-xl bg-red-900/30 border border-red-700/50 text-red-300 text-xs text-center font-medium animate-shake">
            {validationError}
          </div>
        )}

        {/* Sticky Mobile Submit Bar (Fixed on phone, inline on desktop) */}
        <div className="fixed sm:static bottom-0 left-0 right-0 p-4 sm:p-0 bg-slate-950/95 sm:bg-transparent backdrop-blur-lg sm:backdrop-blur-none border-t border-slate-800/90 sm:border-0 z-40 pb-safe shadow-2xl">
          <div className="max-w-xl mx-auto flex items-center gap-3">
            <div className="sm:hidden flex-1 min-w-0 text-left">
              <div className="text-[11px] text-slate-400 font-medium truncate">
                {selectedRoles.length > 0
                  ? `已選 ${selectedRoles.length} 項樂器`
                  : '請勾選樂器'}
                {selectedMusic.length > 0 ? ` · ${selectedMusic.length} 首/歌手` : ''}
              </div>
              <div className="text-xs font-extrabold text-amber-400 truncate">
                {name.trim() ? name : '尚未輸入暱稱'}
              </div>
            </div>
            <button
              type="submit"
              className="flex-1 sm:w-full py-3.5 sm:py-4 px-6 rounded-2xl font-black text-base sm:text-lg bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 text-slate-950 hover:shadow-lg hover:shadow-emerald-500/25 active:scale-95 transition-all cursor-pointer shadow-lg shadow-emerald-500/10 touch-manipulation"
            >
              🎸 加入房間
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
