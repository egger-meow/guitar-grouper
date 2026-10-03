import React, { useState } from 'react';
import type { GroupResult, Participant } from '../types/domain';
import { getTagNameZh } from '../engine/taxonomy';
import {
  Trophy,
  Copy,
  Check,
  Music,
  Guitar,
  Sparkles,
  Users,
  Flame,
  Radio,
  Share2,
} from 'lucide-react';

export interface ResultsViewProps {
  assignedGroup: GroupResult | null;
  currentParticipantId?: string;
  isHost?: boolean;
  allGroups?: GroupResult[];
}

export function ResultsView({
  assignedGroup,
  currentParticipantId,
  isHost = false,
  allGroups,
}: ResultsViewProps) {
  const [copied, setCopied] = useState(false);
  const [selectedGroupIndex, setSelectedGroupIndex] = useState(0);

  // If host wants to inspect all groups, use selected group or assignedGroup
  const activeGroup =
    isHost && allGroups && allGroups.length > 0
      ? allGroups[selectedGroupIndex]
      : assignedGroup;

  if (!activeGroup) {
    return (
      <div className="w-full max-w-xl mx-auto p-6 text-center bg-slate-900 border border-slate-800 rounded-3xl shadow-xl space-y-4">
        <div className="w-16 h-16 rounded-full bg-slate-800 text-3xl flex items-center justify-center mx-auto">
          ⏳
        </div>
        <h2 className="text-xl font-bold text-white">等待分組結果揭曉</h2>
        <p className="text-slate-400 text-sm">
          演算法正在計算或主辦人尚未公佈分組結果，請稍候片刻。
        </p>
      </div>
    );
  }

  // Find current user's group index or name
  const groupTitle = activeGroup.name || '第 1 組';
  const groupNumberMatch = groupTitle.match(/\d+/);
  const groupNumber = groupNumberMatch ? groupNumberMatch[0] : '1';

  // Format lineup text for copying to LINE / IG / Discord
  const handleCopyLineup = async () => {
    const lines: string[] = [
      `🎸【吉他社分組名單 - ${activeGroup.name}】`,
      `🎵 共識風格：${activeGroup.consensusTags.join('、') || '多元融合'}`,
      `👥 組員陣容：`,
    ];

    activeGroup.members.forEach((m, idx) => {
      const roles = (m.capabilities || []).map(getTagNameZh).join('/');
      const tastes = (m.musicPreferences || []).map(getTagNameZh).join('、');
      lines.push(`${idx + 1}. ${m.name} (${roles}) - 偏好: ${tastes || '隨緣'}`);
    });

    if (activeGroup.diagnosticsZh && activeGroup.diagnosticsZh.length > 0) {
      lines.push(`💡 陣容亮點：${activeGroup.diagnosticsZh.join('；')}`);
    }

    const textToCopy = lines.join('\n');
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(textToCopy);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-6 pb-28 sm:pb-8 space-y-6 sm:space-y-8 animate-fadeIn">
      {/* Host Group Switcher (if host has multiple groups) */}
      {isHost && allGroups && allGroups.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
          {allGroups.map((g, idx) => (
            <button
              key={g.id}
              type="button"
              onClick={() => setSelectedGroupIndex(idx)}
              className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap border transition-all cursor-pointer ${
                selectedGroupIndex === idx
                  ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-md'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
              }`}
            >
              {g.name}
            </button>
          ))}
        </div>
      )}

      {/* Main Hero Group Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-950 via-slate-900 to-emerald-950 border border-emerald-500/30 p-6 md:p-8 shadow-2xl text-center space-y-4">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-extrabold uppercase tracking-widest">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>分組結果大公開</span>
        </div>

        <div>
          <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight">
            🎉 你在 第 {groupNumber} 組！
          </h1>
          <p className="text-slate-300 text-base md:text-lg mt-2 font-medium">
            {activeGroup.name}
          </p>
        </div>

        {/* Consensus style & band vibe */}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          {activeGroup.consensusTags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-purple-950/80 border border-purple-700/60 text-purple-300 font-bold text-xs shadow"
            >
              <Music className="w-3.5 h-3.5" />
              <span>{tag}</span>
            </span>
          ))}

          <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-950/80 border border-indigo-700/60 text-indigo-300 font-bold text-xs shadow">
            <Radio className="w-3.5 h-3.5" />
            <span>樂器契合度 {Math.round(activeGroup.roleScore)}%</span>
          </span>
        </div>

        {/* Copy Lineup CTA */}
        <div className="pt-2 flex justify-center">
          <button
            type="button"
            onClick={handleCopyLineup}
            className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-300 hover:to-teal-400 text-slate-950 font-black text-sm shadow-xl shadow-emerald-500/20 active:scale-95 transition-all cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 stroke-[3]" />
                <span>已複製本組名單與歌單！</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span>📋 複製本組名單</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Teammate Cards Grid: Must show each member's capabilities and music preferences */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-400" />
            <span>本組夥伴陣容與品味檔案 (Teammates)</span>
          </h2>
          <span className="text-xs text-slate-400">
            共 {activeGroup.members.length} 位音樂夥伴
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {activeGroup.members.map((member) => {
            const isMe = member.id === currentParticipantId;
            return (
              <div
                key={member.id}
                className={`relative rounded-3xl p-4 sm:p-5 border transition-all shadow-xl flex flex-col justify-between ${
                  isMe
                    ? 'bg-slate-900 border-emerald-400/80 ring-2 ring-emerald-400/30'
                    : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                }`}
              >
                {/* Header: Member Name and Gender badge */}
                <div>
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-9 h-9 sm:w-10 sm:h-10 rounded-2xl flex items-center justify-center font-black text-base shadow shrink-0 ${
                          isMe
                            ? 'bg-emerald-400 text-slate-950'
                            : 'bg-slate-800 text-indigo-300 border border-slate-700'
                        }`}
                      >
                        {member.name.slice(0, 1)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-white text-base truncate">
                            {member.name}
                          </span>
                          {isMe && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shrink-0">
                              你
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-slate-400">
                          {member.gender === 'male'
                            ? '男生'
                            : member.gender === 'female'
                            ? '女生'
                            : member.gender === 'other'
                            ? '其他'
                            : '社團同學'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 1. Capabilities / Covered Instruments */}
                  <div className="space-y-1.5 mb-3">
                    <div className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
                      <Guitar className="w-3.5 h-3.5 text-indigo-400" />
                      <span>負責樂器 / 專長：</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {member.capabilities.map((role) => (
                        <span
                          key={role}
                          className="px-2.5 py-1 rounded-xl bg-indigo-950/80 border border-indigo-700/60 text-indigo-200 text-xs font-semibold shadow-sm"
                        >
                          {getTagNameZh(role)}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* 2. Music Preferences / Verified Artists */}
                  <div className="space-y-1.5">
                    <div className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
                      <Music className="w-3.5 h-3.5 text-purple-400" />
                      <span>音樂偏好 / 喜歡歌手：</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {(member.musicPreferences || []).length === 0 ? (
                        <span className="text-xs text-slate-500 italic">隨緣自由配合</span>
                      ) : (
                        (member.musicPreferences || []).map((m) => (
                          <span
                            key={m}
                            className="px-2.5 py-1 rounded-xl bg-purple-950/80 border border-purple-700/60 text-purple-200 text-xs font-medium shadow-sm"
                          >
                            {getTagNameZh(m)}
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Band Vibe Suggestions & Diagnostics */}
      {activeGroup.diagnosticsZh && activeGroup.diagnosticsZh.length > 0 && (
        <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-3">
          <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
            <Flame className="w-4 h-4" />
            <span>樂團配置與默契亮點 (Band Vibe Insights)</span>
          </div>
          <ul className="space-y-2">
            {activeGroup.diagnosticsZh.map((item, idx) => (
              <li
                key={idx}
                className="flex items-start gap-2.5 text-xs md:text-sm text-slate-300"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-2 shrink-0" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Mobile Sticky Quick Share / Copy Bar */}
      <div className="fixed sm:hidden bottom-0 left-0 right-0 p-3 bg-slate-950/95 backdrop-blur-lg border-t border-slate-800/90 z-40 pb-safe shadow-2xl">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopyLineup}
            className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-500 text-slate-950 font-black text-sm active:scale-95 transition-all shadow-lg shadow-emerald-500/10 cursor-pointer touch-manipulation"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 stroke-[3]" />
                <span>名單已複製！</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span>📋 複製本組名單與歌單</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
