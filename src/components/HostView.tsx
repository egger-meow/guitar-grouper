import React, { useState } from 'react';
import type {
  Participant,
  HostSettings,
  PresetType,
  GenreGranularity,
  OptimizationResult,
  Role,
} from '../types/domain';
import { ROLES, PRESET_WEIGHTS, getTagNameZh, GENRES } from '../engine/taxonomy';
import { QRCodeDisplay } from './QRCodeDisplay';
import {
  Users,
  QrCode,
  Copy,
  Check,
  Play,
  Sparkles,
  Sliders,
  Music,
  Guitar,
  RefreshCw,
  AlertCircle,
  Award,
  ChevronRight,
  Disc,
  Lock,
  KeyRound,
  ShieldCheck,
  Link as LinkIcon,
  UserPlus,
  X,
} from 'lucide-react';
import { calculateGroupCapacities } from '../engine/optimizer';

export interface HostViewProps {
  roomCode: string;
  hostSecret: string;
  participantCount: number;
  participants: Record<string, Participant>;
  settings: HostSettings;
  status: 'WAITING' | 'OPTIMIZING' | 'REVEALED';
  result?: OptimizationResult | null;
  onStartGrouping: () => void;
  onUpdateSettings: (settings: Partial<HostSettings>) => void;
  onRerunGrouping?: () => void;
  onUnlockHost?: (secret: string) => void;
  onSwitchToParticipant?: () => void;
}

export function HostView({
  roomCode,
  hostSecret,
  participantCount,
  participants,
  settings,
  status,
  result,
  onStartGrouping,
  onUpdateSettings,
  onRerunGrouping,
  onUnlockHost,
  onSwitchToParticipant,
}: HostViewProps) {
  const [showQR, setShowQR] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedHostLink, setCopiedHostLink] = useState(false);
  const [unlockInput, setUnlockInput] = useState('');
  const [customWeightsOpen, setCustomWeightsOpen] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addName, setAddName] = useState('');
  const [addGender, setAddGender] = useState('unspecified');
  const [addRoles, setAddRoles] = useState<Role[]>(['acoustic_guitar']);
  const [addMusic, setAddMusic] = useState<string[]>(['any_genre']);
  const [isSubmittingManual, setIsSubmittingManual] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);

  const participantList = Object.values(participants);
  const canStart = participantCount >= 2;

  const handleManualAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = addName.trim();
    if (!cleanName) {
      setManualError('請輸入姓名或暱稱');
      return;
    }
    if (addRoles.length === 0) {
      setManualError('請至少選擇一項樂器或角色');
      return;
    }
    setManualError(null);
    setIsSubmittingManual(true);
    try {
      const res = await fetch(`/api/room/${roomCode}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participant: {
            name: cleanName,
            gender: addGender,
            capabilities: addRoles,
            musicPreferences: addMusic.length > 0 ? addMusic : ['any_genre'],
            joinedAt: Date.now(),
          },
        }),
      });
      if (!res.ok) {
        throw new Error('新增社員失敗，請確認網路連線');
      }
      setAddName('');
      setAddRoles(['acoustic_guitar']);
      setAddMusic(['any_genre']);
      setShowAddModal(false);
    } catch (err: any) {
      setManualError(err.message || '新增社員失敗');
    } finally {
      setIsSubmittingManual(false);
    }
  };

  const handleCopyCode = async () => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(roomCode);
      }
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const handlePresetSelect = (preset: PresetType) => {
    const weights =
      preset === 'custom'
        ? settings.weights || PRESET_WEIGHTS.custom
        : PRESET_WEIGHTS[preset] || PRESET_WEIGHTS.balanced;
    onUpdateSettings({
      preset,
      weights,
    });
    if (preset === 'custom') {
      setCustomWeightsOpen(true);
    }
  };

  const handleWeightChange = (field: 'role' | 'music' | 'diversity', val: number) => {
    const currentWeights = settings.weights || { role: 0.45, music: 0.4, diversity: 0.15 };
    onUpdateSettings({
      preset: 'custom',
      weights: {
        ...currentWeights,
        [field]: Math.max(0, Math.min(100, val)) / 100,
      },
    });
  };

  const handleNormalizeWeights = () => {
    const r = settings.weights?.role ?? 0.45;
    const m = settings.weights?.music ?? 0.4;
    const d = settings.weights?.diversity ?? 0.15;
    const sum = r + m + d || 1;
    const normR = Math.round((r / sum) * 100) / 100;
    const normM = Math.round((m / sum) * 100) / 100;
    const normD = Math.max(0, Math.round((1 - normR - normM) * 100) / 100);
    onUpdateSettings({
      preset: 'custom',
      weights: {
        role: normR,
        music: normM,
        diversity: normD,
      },
    });
  };

  const handleToggleDesiredRole = (roleId: Role) => {
    const current: Role[] =
      settings.desiredRoles && settings.desiredRoles.length > 0
        ? settings.desiredRoles
        : (['acoustic_guitar', 'electric_guitar', 'cajon', 'drums', 'lead_vocal'] as Role[]);
    const exists = current.includes(roleId);
    const next: Role[] = exists ? current.filter((id) => id !== roleId) : [...current, roleId];
    if (!next.length) return;
    onUpdateSettings({
      preset: 'custom',
      desiredRoles: next,
      keyRoles: next,
      minRequiredRolesCount: Math.min(settings.minRequiredRolesCount, next.length),
    });
  };

  const handleMinRequiredRolesChange = (count: number) => {
    onUpdateSettings({
      preset: 'custom',
      minRequiredRolesCount: count,
    });
  };

  const handleGranularitySelect = (granularity: GenreGranularity) => {
    onUpdateSettings({
      genreGranularity: granularity,
    });
  };

  const currentMin = settings.minGroupSize ?? 3;
  const currentMax = settings.maxGroupSize ?? 5;
  const currentTarget = settings.targetGroupSize ?? Math.round((currentMin + currentMax) / 2);

  const { K: estimatedK, capacities: estimatedCapacities } = calculateGroupCapacities(
    participantCount,
    {
      minGroupSize: currentMin,
      maxGroupSize: currentMax,
      targetGroupSize: currentTarget,
      groupSizePreference: settings.groupSizePreference,
    }
  );
  const minCap = estimatedCapacities.length > 0 ? Math.min(...estimatedCapacities) : currentMin;
  const maxCap = estimatedCapacities.length > 0 ? Math.max(...estimatedCapacities) : currentMax;

  const handleMinSlider = (val: number) => {
    const newMin = Math.max(2, Math.min(8, val));
    const newMax = Math.max(newMin, currentMax);
    const target = Math.round((newMin + newMax) / 2);
    onUpdateSettings({
      minGroupSize: newMin,
      maxGroupSize: newMax,
      targetGroupSize: target,
    });
  };

  const handleMaxSlider = (val: number) => {
    const newMax = Math.max(2, Math.min(8, val));
    const newMin = Math.min(newMax, currentMin);
    const target = Math.round((newMin + newMax) / 2);
    onUpdateSettings({
      minGroupSize: newMin,
      maxGroupSize: newMax,
      targetGroupSize: target,
    });
  };

  // Compute role tallies
  const roleTallies: Record<Role, number> = {
    lead_vocal: 0,
    acoustic_guitar: 0,
    electric_guitar: 0,
    cajon: 0,
    drums: 0,
    bass: 0,
    keyboard: 0,
    backing_vocal: 0,
    other: 0,
  };

  participantList.forEach((p) => {
    (p.capabilities || []).forEach((r) => {
      if (roleTallies[r] !== undefined) {
        roleTallies[r]++;
      }
    });
  });

  const handleCopyHostLink = async () => {
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : 'https://guitar-grouper.jjmowlab.com';
      const url = `${origin}/?room=${roomCode}&host=1&secret=${hostSecret}`;
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
      }
      setCopiedHostLink(true);
      setTimeout(() => setCopiedHostLink(false), 2000);
    } catch {
      setCopiedHostLink(true);
      setTimeout(() => setCopiedHostLink(false), 2000);
    }
  };

  // If hostSecret is missing, show friendly unlock screen
  if (!hostSecret) {
    return (
      <div className="w-full max-w-lg mx-auto py-12 px-4 text-center space-y-6 animate-fadeIn">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto shadow-inner">
            <KeyRound className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl sm:text-2xl font-black text-white">
              主辦人身份驗證
            </h2>
            <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
              您正在存取房間 <span className="font-mono font-bold text-amber-400">{roomCode}</span> 的主辦人控制台。此裝置尚未存有主辦人密鑰，請輸入建立房間時取得的密鑰以解鎖。
            </p>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const clean = unlockInput.trim();
              if (clean && onUnlockHost) {
                onUnlockHost(clean);
              }
            }}
            className="space-y-4"
          >
            <input
              type="text"
              value={unlockInput}
              onChange={(e) => setUnlockInput(e.target.value)}
              placeholder="請輸入主辦人密鑰 (Host Secret)"
              className="w-full px-4 py-3 rounded-2xl bg-slate-800 border border-slate-700 text-white font-mono text-center text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 uppercase"
            />
            <button
              type="submit"
              disabled={!unlockInput.trim()}
              className="w-full py-3.5 px-6 rounded-2xl bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-slate-950 font-black text-sm shadow-lg shadow-amber-400/20 active:scale-95 transition-all cursor-pointer"
            >
              解鎖主辦人控制台
            </button>
          </form>
          {onSwitchToParticipant && (
            <div className="pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={onSwitchToParticipant}
                className="text-xs text-slate-400 hover:text-white underline cursor-pointer"
              >
                我是社員，切換至社員填寫頁面
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-6 pb-28 sm:pb-8 space-y-6 sm:space-y-8 animate-fadeIn">
      {/* Top Banner: Big Kahoot-Style Room Code */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-900 via-slate-900 to-purple-950 border border-indigo-700/40 p-6 md:p-8 shadow-2xl">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="text-center md:text-left space-y-2">
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-semibold tracking-wider uppercase border border-indigo-400/20">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                主辦人控制台 (Host Room)
              </div>
              <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-semibold border border-emerald-500/30">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>已授權</span>
              </div>
            </div>
            <h2 className="text-slate-400 text-sm font-medium">房間邀請代碼</h2>
            <div className="flex items-center gap-4 justify-center md:justify-start">
              <span className="text-5xl md:text-6xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 drop-shadow">
                {roomCode}
              </span>
              <button
                type="button"
                onClick={handleCopyCode}
                className="p-3 rounded-2xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700 active:scale-95 transition-all cursor-pointer"
                title="複製代碼"
              >
                {copiedCode ? (
                  <Check className="w-5 h-5 text-emerald-400" />
                ) : (
                  <Copy className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 justify-center">
            <button
              type="button"
              onClick={handleCopyHostLink}
              className="flex items-center gap-1.5 px-4 py-3 rounded-2xl font-bold text-xs sm:text-sm bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700 active:scale-95 transition-all cursor-pointer"
              title="複製包含密鑰的主辦人管理網址，可用於投影機或電腦直接登入"
            >
              {copiedHostLink ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>已複製管理連結！</span>
                </>
              ) : (
                <>
                  <LinkIcon className="w-4 h-4 text-indigo-400" />
                  <span>複製主辦連結</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setShowQR(!showQR)}
              className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-bold text-sm border transition-all cursor-pointer ${
                showQR
                  ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-lg shadow-amber-400/20'
                  : 'bg-slate-800/80 hover:bg-slate-700 text-white border-slate-700'
              }`}
            >
              <QrCode className="w-4 h-4" />
              <span>{showQR ? '隱藏 QR Code' : '顯示 QR Code'}</span>
            </button>

            <div className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold text-sm">
              <Users className="w-4 h-4" />
              <span>已加入人數：</span>
              <span className="text-xl text-emerald-300">{participantCount}</span>
              <span>人</span>
            </div>
          </div>
        </div>

        {/* QR Code Popdown */}
        {showQR && (
          <div className="mt-6 pt-6 border-t border-indigo-800/50 flex justify-center animate-fadeIn">
            <QRCodeDisplay roomCode={roomCode} />
          </div>
        )}
      </div>

      {/* Main Grid: Left Controls, Right Participants */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Controls Column */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
            <div className="flex items-center gap-2 text-white font-bold text-lg border-b border-slate-800 pb-3">
              <Sliders className="w-5 h-5 text-amber-400" />
              <span>分組演算法設定</span>
            </div>

            {/* Group Size Range Selector */}
            <div className="space-y-3 bg-slate-950/40 p-4 rounded-2xl border border-slate-800/80">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-white text-xs font-bold uppercase tracking-wider block">
                    每組人數範圍
                  </label>
                  <p className="text-slate-400 text-[11px]">由演算法在此區間內動態分配最平衡人數</p>
                </div>
                <div className="px-3 py-1 rounded-xl bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border border-amber-500/40 text-amber-300 font-mono font-bold text-sm tracking-wide shadow-sm">
                  {currentMin === currentMax ? `${currentMin} 人` : `${currentMin} ~ ${currentMax} 人`}
                </div>
              </div>

              {/* Dual-Thumb Range Slider */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between text-xs font-medium text-slate-300">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400 border border-slate-950 inline-block shadow-sm" />
                    最少：<strong className="text-amber-300 font-mono font-bold text-sm">{currentMin}</strong> 人
                  </span>
                  <span className="flex items-center gap-1.5">
                    最多：<strong className="text-amber-300 font-mono font-bold text-sm">{currentMax}</strong> 人
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400 border border-slate-950 inline-block shadow-sm" />
                  </span>
                </div>

                <div className="relative py-4 px-1 flex items-center">
                  {/* Base Track */}
                  <div className="h-2.5 w-full bg-slate-800 rounded-full relative overflow-hidden">
                    {/* Active Range Fill */}
                    <div
                      className="absolute top-0 bottom-0 bg-gradient-to-r from-amber-500 to-yellow-400 rounded-full shadow-sm"
                      style={{
                        left: `${((currentMin - 2) / 6) * 100}%`,
                        width: `${((currentMax - currentMin) / 6) * 100}%`,
                      }}
                    />
                  </div>

                  {/* Left Thumb (Min) */}
                  <input
                    type="range"
                    min={2}
                    max={8}
                    step={1}
                    value={currentMin}
                    aria-label="最少人數"
                    onChange={(e) => handleMinSlider(Number(e.target.value))}
                    className={`absolute inset-0 w-full appearance-none bg-transparent pointer-events-none cursor-pointer focus:outline-none ${
                      currentMin > 5 ? 'z-20' : 'z-10'
                    } [&::-webkit-slider-runnable-track]:bg-transparent [&::-moz-range-track]:bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-amber-400 [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-slate-950 [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:cursor-grab active:[&::-webkit-slider-thumb]:cursor-grabbing hover:[&::-webkit-slider-thumb]:scale-110 active:[&::-webkit-slider-thumb]:scale-95 [&::-webkit-slider-thumb]:transition-transform [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:w-6 [&::-moz-range-thumb]:h-6 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-amber-400 [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-slate-950 [&::-moz-range-thumb]:shadow-lg [&::-moz-range-thumb]:cursor-grab active:[&::-moz-range-thumb]:cursor-grabbing hover:[&::-moz-range-thumb]:scale-110 active:[&::-moz-range-thumb]:scale-95 [&::-moz-range-thumb]:transition-transform`}
                  />

                  {/* Right Thumb (Max) */}
                  <input
                    type="range"
                    min={2}
                    max={8}
                    step={1}
                    value={currentMax}
                    aria-label="最多人數"
                    onChange={(e) => handleMaxSlider(Number(e.target.value))}
                    className={`absolute inset-0 w-full appearance-none bg-transparent pointer-events-none cursor-pointer focus:outline-none ${
                      currentMin > 5 ? 'z-10' : 'z-20'
                    } [&::-webkit-slider-runnable-track]:bg-transparent [&::-moz-range-track]:bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-amber-400 [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-slate-950 [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:cursor-grab active:[&::-webkit-slider-thumb]:cursor-grabbing hover:[&::-webkit-slider-thumb]:scale-110 active:[&::-webkit-slider-thumb]:scale-95 [&::-webkit-slider-thumb]:transition-transform [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:w-6 [&::-moz-range-thumb]:h-6 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-amber-400 [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-slate-950 [&::-moz-range-thumb]:shadow-lg [&::-moz-range-thumb]:cursor-grab active:[&::-moz-range-thumb]:cursor-grabbing hover:[&::-moz-range-thumb]:scale-110 active:[&::-moz-range-thumb]:scale-95 [&::-moz-range-thumb]:transition-transform`}
                  />
                </div>

                {/* Tick Numbers */}
                <div className="flex justify-between px-1 text-[11px] font-mono select-none">
                  {[2, 3, 4, 5, 6, 7, 8].map((num) => (
                    <span
                      key={num}
                      className={`transition-colors font-semibold ${
                        num >= currentMin && num <= currentMax
                          ? 'text-amber-300 font-bold'
                          : 'text-slate-600'
                      }`}
                    >
                      {num}人
                    </span>
                  ))}
                </div>
              </div>

              {/* Dynamic Group Count & Capacity Projection */}
              <div className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-[11px] text-slate-300 flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                {participantCount >= 2 ? (
                  <span>
                    目前 <strong className="text-white">{participantCount}</strong> 人：預計分成{' '}
                    <strong className="text-emerald-400">{estimatedK}</strong> 組（每組約{' '}
                    <span className="text-amber-300 font-mono font-bold">
                      {minCap === maxCap ? `${minCap}` : `${minCap} ~ ${maxCap}`}
                    </span>{' '}
                    人）
                  </span>
                ) : (
                  <span>人數範圍設定完成，社員加入時將自動動態預估組數</span>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-semibold text-slate-200">每組人數偏好</p>
              <div className="flex gap-2">
                {([['larger', '人多一點'], ['smaller', '人少一點'], ['any', '都可以']] as const).map(([value, label]) => (
                  <button key={value} type="button" aria-pressed={(settings.groupSizePreference ?? 'any') === value}
                    onClick={() => onUpdateSettings({ groupSizePreference: value })}
                    className={`flex-1 rounded-xl px-3 py-2 text-sm border ${(settings.groupSizePreference ?? 'any') === value ? 'border-amber-400 bg-amber-500/20 text-amber-200' : 'border-slate-700 text-slate-400'}`}>{label}</button>
                ))}
              </div>
              {(settings.groupSizePreference ?? 'any') !== 'any' && <label className="block text-xs text-slate-300">
                人數偏好權重：{Math.round((settings.groupSizePreferenceWeight ?? 0.25) * 100)}%
                <input aria-label="人數偏好權重" type="range" min="0" max="100" className="w-full mt-2"
                  value={Math.round((settings.groupSizePreferenceWeight ?? 0.25) * 100)}
                  onChange={e => onUpdateSettings({ groupSizePreferenceWeight: Number(e.target.value) / 100 })} />
              </label>}
              <p className="text-xs text-slate-400">先減少最低角色缺漏，再以此權重比較每組人數與其他偏好。都可以會比較範圍內所有可行組數；下方預估僅依人數，實際組數依角色及偏好決定。</p>
            </div>

            {/* Presets */}
            <div className="space-y-2">
              <label className="text-slate-300 text-xs font-semibold uppercase tracking-wider block">
                演算法策略預設
              </label>
              <div className="grid grid-cols-1 gap-2">
                <button
                  type="button"
                  onClick={() => handlePresetSelect('music_focus')}
                  className={`flex items-center justify-between p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                    settings.preset === 'music_focus'
                      ? 'bg-purple-900/40 border-purple-500 text-purple-200 ring-2 ring-purple-500/50'
                      : 'bg-slate-800/60 hover:bg-slate-800 border-slate-700/80 text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">🎵</span>
                    <div>
                      <div className="font-bold text-sm">曲風優先</div>
                      <div className="text-xs text-slate-400">同頻音樂偏好優先聚成一組</div>
                    </div>
                  </div>
                  {settings.preset === 'music_focus' && <Check className="w-4 h-4 text-purple-400" />}
                </button>

                <button
                  type="button"
                  onClick={() => handlePresetSelect('role_focus')}
                  className={`flex items-center justify-between p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                    settings.preset === 'role_focus'
                      ? 'bg-blue-900/40 border-blue-500 text-blue-200 ring-2 ring-blue-500/50'
                      : 'bg-slate-800/60 hover:bg-slate-800 border-slate-700/80 text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">🎸</span>
                    <div>
                      <div className="font-bold text-sm">樂器配置優先</div>
                      <div className="text-xs text-slate-400">優先提高所選目標角色的完整度</div>
                    </div>
                  </div>
                  {settings.preset === 'role_focus' && <Check className="w-4 h-4 text-blue-400" />}
                </button>

                <button
                  type="button"
                  onClick={() => handlePresetSelect('balanced')}
                  className={`flex items-center justify-between p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                    settings.preset === 'balanced'
                      ? 'bg-emerald-900/40 border-emerald-500 text-emerald-200 ring-2 ring-emerald-500/50'
                      : 'bg-slate-800/60 hover:bg-slate-800 border-slate-700/80 text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">⚖️</span>
                    <div>
                      <div className="font-bold text-sm">均衡模式 (推薦)</div>
                      <div className="text-xs text-slate-400">兼顧樂器完整度與曲風契合度</div>
                    </div>
                  </div>
                  {settings.preset === 'balanced' && <Check className="w-4 h-4 text-emerald-400" />}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    handlePresetSelect('custom');
                    setCustomWeightsOpen((prev) => (settings.preset === 'custom' ? !prev : true));
                  }}
                  className={`flex items-center justify-between p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                    settings.preset === 'custom'
                      ? 'bg-amber-900/40 border-amber-500 text-amber-200 ring-2 ring-amber-500/50'
                      : 'bg-slate-800/60 hover:bg-slate-800 border-slate-700/80 text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">⚙️</span>
                    <div>
                      <div className="font-bold text-sm">自訂權重</div>
                      <div className="text-xs text-slate-400">微調樂器、曲風與多樣性比重</div>
                    </div>
                  </div>
                  {settings.preset === 'custom' && <Check className="w-4 h-4 text-amber-400" />}
                </button>
              </div>

              {/* Custom Configuration Panel when custom is active */}
              {(settings.preset === 'custom' || customWeightsOpen) && (
                <div
                  data-testid="custom-weights-panel"
                  className="p-4 sm:p-5 rounded-2xl bg-amber-950/20 border border-amber-500/40 space-y-5 animate-fadeIn"
                >
                  <div className="flex items-center justify-between pb-3 border-b border-amber-500/20">
                    <div className="flex items-center gap-2">
                      <Sliders className="w-4 h-4 text-amber-400" />
                      <span className="font-bold text-sm text-amber-200">
                        自訂演算法權重與目標角色
                      </span>
                    </div>
                    <span className="text-[11px] text-amber-400/90 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20 font-medium">
                      客製化模式
                    </span>
                  </div>

                  {/* Weights Sliders */}
                  <div className="space-y-4">
                    {/* Role Weight Slider */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-blue-300 flex items-center gap-1.5">
                          <span>🎸</span> 樂器配置與角色完整度
                        </span>
                        <span className="font-mono font-bold text-blue-400 bg-blue-950/80 px-2 py-0.5 rounded border border-blue-800">
                          {Math.round((settings.weights?.role ?? 0.45) * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={5}
                        aria-label="樂器配置權重"
                        value={Math.round((settings.weights?.role ?? 0.45) * 100)}
                        onChange={(e) => handleWeightChange('role', Number(e.target.value))}
                        className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                      />
                      <div className="text-[11px] text-slate-400">
                        重視主唱、吉他、木箱鼓等編制齊全度與稀缺角色分散。
                      </div>
                    </div>

                    {/* Music Weight Slider */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-purple-300 flex items-center gap-1.5">
                          <span>🎵</span> 曲風品味契合度
                        </span>
                        <span className="font-mono font-bold text-purple-400 bg-purple-950/80 px-2 py-0.5 rounded border border-purple-800">
                          {Math.round((settings.weights?.music ?? 0.4) * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={5}
                        aria-label="曲風品味權重"
                        value={Math.round((settings.weights?.music ?? 0.4) * 100)}
                        onChange={(e) => handleWeightChange('music', Number(e.target.value))}
                        className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                      />
                      <div className="text-[11px] text-slate-400">
                        重視組員間喜愛之曲風與歌手契合度，創造最大音樂共鳴。
                      </div>
                    </div>

                    {/* Diversity Weight Slider */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-emerald-300 flex items-center gap-1.5">
                          <span>👥</span> 性別多元平衡
                        </span>
                        <span className="font-mono font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800">
                          {Math.round((settings.weights?.diversity ?? 0.15) * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={5}
                        aria-label="性別多元權重"
                        value={Math.round((settings.weights?.diversity ?? 0.15) * 100)}
                        onChange={(e) => handleWeightChange('diversity', Number(e.target.value))}
                        className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                      />
                      <div className="text-[11px] text-slate-400">
                        維持各組男女比例平衡，促進跨群體交流與破冰體驗。
                      </div>
                    </div>

                    {/* Total Weight Summary & Quick Reset */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400">權重合計:</span>
                        <span
                          className={`font-mono font-bold px-2 py-0.5 rounded ${
                            Math.round(
                              ((settings.weights?.role ?? 0.45) +
                                (settings.weights?.music ?? 0.4) +
                                (settings.weights?.diversity ?? 0.15)) *
                                100
                            ) === 100
                              ? 'bg-emerald-900/50 text-emerald-300 border border-emerald-700/50'
                              : 'bg-amber-900/50 text-amber-300 border border-amber-700/50'
                          }`}
                        >
                          {Math.round(
                            ((settings.weights?.role ?? 0.45) +
                              (settings.weights?.music ?? 0.4) +
                              (settings.weights?.diversity ?? 0.15)) *
                              100
                          )}
                          %
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={handleNormalizeWeights}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-[11px] font-medium transition-colors cursor-pointer"
                        >
                          ⚡ 歸一化至 100%
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Desired Roles Selection */}
                  <div className="space-y-2 pt-2 border-t border-slate-800/80">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-300 block">
                        每組目標樂器配置 (點擊多選)
                      </label>
                      <span className="text-[11px] text-slate-500">
                        已選 {(settings.desiredRoles || []).length} 種
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {ROLES.filter((r) => r.id !== 'other').map((role) => {
                        const isSelected = (settings.desiredRoles || []).includes(role.id);
                        return (
                          <button
                            key={role.id}
                            type="button"
                            onClick={() => handleToggleDesiredRole(role.id)}
                            className={`px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-all cursor-pointer flex items-center gap-1.5 ${
                              isSelected
                                ? 'bg-amber-500/20 border-amber-500/60 text-amber-200 shadow-sm'
                                : 'bg-slate-800/60 border-slate-700/60 text-slate-400 hover:text-slate-300 hover:bg-slate-800'
                            }`}
                          >
                            <span>{role.nameZh}</span>
                            {isSelected && <Check className="w-3.5 h-3.5 text-amber-400" />}
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-[11px] text-slate-400">
                      演算法將重點評估各組對所選樂器職責的涵蓋度，分散關鍵樂手。
                    </p>
                  </div>

                  {/* Min Required Roles Count */}
                  <div className="space-y-2 pt-2 border-t border-slate-800/80">
                    <label className="text-xs font-bold text-slate-300 block">
                      每組最少滿足目標角色數
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      {Array.from({ length: (settings.desiredRoles || []).length }, (_, i) => i + 1).map((count) => {
                        const isSelected = (settings.minRequiredRolesCount ?? 1) === count;
                        return (
                          <button
                            key={count}
                            type="button"
                            onClick={() => handleMinRequiredRolesChange(count)}
                            className={`py-2 px-1 text-center rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-amber-600 text-white border-amber-400 shadow-md ring-2 ring-amber-400/20'
                                : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
                            }`}
                          >
                            至少 {count} 項
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-[11px] text-slate-400">
                      若小組滿足上述目標角色的數量低於此門檻，演算法將啟動缺漏懲罰機制。
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Genre Granularity */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-slate-300 text-xs font-semibold uppercase tracking-wider block">
                  曲風對齊顆粒度
                </label>
                <span className="text-[10px] text-emerald-400 font-medium">⚡ 社員端即時同步</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleGranularitySelect('coarse')}
                  className={`py-2.5 px-3 rounded-xl font-bold text-xs border transition-all cursor-pointer ${
                    settings.genreGranularity === 'coarse'
                      ? 'bg-indigo-600 text-white border-indigo-400 shadow-md ring-2 ring-indigo-400/20'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-400 border-slate-700'
                  }`}
                >
                  寬鬆 (12大流派模式)
                </button>
                <button
                  type="button"
                  onClick={() => handleGranularitySelect('fine')}
                  className={`py-2.5 px-3 rounded-xl font-bold text-xs border transition-all cursor-pointer ${
                    settings.genreGranularity === 'fine'
                      ? 'bg-indigo-600 text-white border-indigo-400 shadow-md ring-2 ring-indigo-400/20'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-400 border-slate-700'
                  }`}
                >
                  細緻 (含170+歌手樂團)
                </button>
              </div>
              <p className="text-[11px] text-slate-400">
                {settings.genreGranularity === 'fine'
                  ? '精準配對喜愛同一位歌手（如交大吉他熱門、告五人、Yorushika、Wave to Earth、白小白）的組員'
                  : '社員端切為「12大主要風格大類」快速勾選，支援「都可以/雜食派」，最適合快速破冰迎新'}
              </p>
            </div>

            {/* Start Grouping Action */}
            <div className="pt-2">
              <button
                type="button"
                disabled={!canStart || status === 'OPTIMIZING'}
                onClick={onStartGrouping}
                className={`w-full py-4 px-6 rounded-2xl font-black text-lg flex items-center justify-center gap-3 transition-all cursor-pointer shadow-xl ${
                  canStart && status !== 'OPTIMIZING'
                    ? 'bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 text-slate-950 hover:shadow-emerald-500/25 active:scale-98'
                    : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                }`}
              >
                {status === 'OPTIMIZING' ? (
                  <>
                    <RefreshCw className="w-6 h-6 animate-spin text-slate-950" />
                    <span>演算法配對計算中...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-6 h-6 fill-current" />
                    <span>🚀 開始分組</span>
                  </>
                )}
              </button>

              {!canStart && (
                <div className="flex items-center gap-1.5 mt-2 text-amber-400/90 text-xs justify-center">
                  <AlertCircle className="w-4 h-4" />
                  <span>至少需要 2 位成員加入才能開始分組</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Live Participant Bubble Wall & Tallies Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Role Tallies Bar */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl">
            <h3 className="text-slate-300 text-xs font-semibold uppercase tracking-wider mb-3">
              即時樂器分佈統計 (Role Coverage Tallies)
            </h3>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {ROLES.slice(0, 7).map((role) => (
                <div
                  key={role.id}
                  className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-2.5 text-center"
                >
                  <div className="text-xs text-slate-400 truncate">{role.nameZh}</div>
                  <div className="text-xl font-bold text-amber-300">
                    {roleTallies[role.id] || 0}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Live Participant Bubble Wall */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-400" />
                <h3 className="text-white font-bold text-lg">
                  現場成員動態牆 ({participantList.length} 人)
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(true)}
                  className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>手動新增社員</span>
                </button>
                <span className="text-xs text-slate-400 hidden sm:inline">實時同步</span>
              </div>
            </div>

            {participantList.length === 0 ? (
              <div className="text-center py-16 space-y-3">
                <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mx-auto text-3xl">
                  🎸
                </div>
                <p className="text-slate-300 font-medium">目前還沒有學員加入</p>
                <p className="text-slate-500 text-xs max-w-sm mx-auto">
                  請大家掃描上方的 QR Code 或輸入房間代碼加入房間，並填寫樂器與音樂喜好！
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-[420px] overflow-y-auto pr-1">
                {participantList.map((p) => (
                  <div
                    key={p.id}
                    className="p-3 rounded-2xl bg-slate-800/70 border border-slate-700/70 hover:border-indigo-500/50 transition-all flex flex-col justify-between"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-white text-sm truncate">{p.name}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-700 text-slate-300">
                        {p.gender === 'male'
                          ? '男'
                          : p.gender === 'female'
                          ? '女'
                          : p.gender === 'other'
                          ? '其他'
                          : '同學'}
                      </span>
                    </div>

                    {/* Instrument badges */}
                    <div className="flex flex-wrap gap-1 mb-2">
                      {(p.capabilities || []).map((cap) => (
                        <span
                          key={cap}
                          className="text-[11px] px-2 py-0.5 rounded-lg bg-indigo-950/80 border border-indigo-700/50 text-indigo-300 font-medium"
                        >
                          {getTagNameZh(cap)}
                        </span>
                      ))}
                    </div>

                    {/* Music preferences preview */}
                    {(p.musicPreferences || []).length > 0 && (
                      <div className="text-[11px] text-slate-400 truncate">
                        🎵 {(p.musicPreferences || []).map(getTagNameZh).join('、')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Revealed Bands Overview (If Grouped) */}
      {(status === 'REVEALED' || result) && result && (
        <div className="bg-slate-900 border border-emerald-500/40 rounded-3xl p-6 md:p-8 shadow-2xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-300 text-xs font-semibold mb-1">
                <CheckCircle2Icon className="w-3.5 h-3.5" />
                <span>分組已完成！</span>
              </div>
              <h3 className="text-2xl font-black text-white">樂團名單一覽 (Formed Bands)</h3>
            </div>

            {onRerunGrouping && (
              <button
                type="button"
                onClick={onRerunGrouping}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-sm font-semibold transition-all cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>重新演算法分配</span>
              </button>
            )}
          </div>

          {/* Groups Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="rounded-xl border border-slate-700 p-4 space-y-2 text-sm text-slate-300">
              {result.warnings.map((warning, i) => <p key={i} className="text-amber-300">⚠ {warning}</p>)}
              {result.diagnostics.notesZh.map((note, i) => <p key={`note-${i}`}>{note}</p>)}
            </div>
            {result.groups.map((group, idx) => (
              <div
                key={group.id}
                className="bg-slate-800/80 border border-slate-700 rounded-2xl p-5 space-y-4 hover:border-emerald-500/50 transition-all"
              >
                <div className="flex items-center justify-between border-b border-slate-700 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-sm">
                      {idx + 1}
                    </span>
                    <h4 className="font-bold text-white text-base">{group.name}</h4>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2 py-0.5 rounded bg-purple-900/60 text-purple-300 border border-purple-700/50">
                      曲風: {Math.round(group.musicScore)}分
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded bg-blue-900/60 text-blue-300 border border-blue-700/50">
                      配置: {Math.round(group.roleScore)}分
                    </span>
                  </div>
                </div>

                {/* Group Members List */}
                <div className="space-y-2">
                  {group.members.map((member) => (
                    <div
                      key={member.id}
                      className="p-2.5 rounded-xl bg-slate-900/70 border border-slate-800 flex items-center justify-between text-xs"
                    >
                      <div className="font-semibold text-slate-200">{member.name}</div>
                      <div className="flex items-center gap-1.5 flex-wrap justify-end">
                        {(member.capabilities || []).map((cap) => (
                          <span
                            key={cap}
                            className="px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800/50 text-[10px]"
                          >
                            {getTagNameZh(cap)}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Consensus Music & Diagnostics */}
                <div className="px-4 py-3 text-xs text-slate-300 space-y-1">
                  <p>建議分工：{(group.roleAssignments || []).map(a => `${ROLES.find(r => r.id === a.role)?.nameZh ?? a.role}：${group.members.find(m => m.id === a.participantId)?.name ?? a.participantId}`).join('、') || '尚未配置'}</p>
                  {group.diagnosticsZh.map((note, i) => <p key={i}>{note}</p>)}
                </div>
                {group.consensusTags.length > 0 && (
                  <div className="pt-2 border-t border-slate-700/50 text-xs text-amber-300/90 flex items-center gap-2">
                    <Music className="w-3.5 h-3.5 shrink-0" />
                    <span>共識風格：{group.consensusTags.map(getTagNameZh).join('、')}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mobile Sticky Host Action Bar */}
      {status === 'WAITING' && (
        <div className="fixed sm:hidden bottom-0 left-0 right-0 p-3 bg-slate-950/95 backdrop-blur-lg border-t border-slate-800/90 z-40 pb-safe shadow-2xl">
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="text-[11px] text-slate-400 font-medium">現場進房統計</div>
              <div className="text-sm font-extrabold text-amber-400">
                {participantCount} 位社員就位
              </div>
            </div>
            <button
              type="button"
              disabled={!canStart}
              onClick={onStartGrouping}
              className={`py-3 px-5 rounded-xl font-black text-sm flex items-center gap-2 transition-all shadow-lg active:scale-95 touch-manipulation cursor-pointer ${
                canStart
                  ? 'bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 text-slate-950 shadow-emerald-500/20'
                  : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
              }`}
            >
              <Play className="w-4 h-4 fill-current" />
              <span>開始分組</span>
            </button>
          </div>
        </div>
      )}
      {/* Manual Add Participant Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-5 sm:p-6 w-full max-w-md shadow-2xl space-y-5 my-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-indigo-400" />
                <h3 className="text-white font-bold text-lg">手動代填 / 新增社員</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {manualError && (
              <div className="p-3 rounded-xl bg-red-950/80 border border-red-800 text-red-200 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{manualError}</span>
              </div>
            )}

            <form onSubmit={handleManualAdd} className="space-y-4">
              <div>
                <label className="block text-slate-300 text-xs font-bold mb-1.5">
                  社員暱稱 / 姓名 <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  placeholder="例如：阿杰、小陳"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-400 text-sm"
                />
              </div>

              <div>
                <label className="block text-slate-300 text-xs font-bold mb-1.5">性別 / 分類</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'male', label: '男生' },
                    { id: 'female', label: '女生' },
                    { id: 'unspecified', label: '不透漏' },
                  ].map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => setAddGender(g.id)}
                      className={`py-2 text-xs rounded-xl font-bold border transition-all cursor-pointer ${
                        addGender === g.id
                          ? 'bg-indigo-600 text-white border-indigo-400 shadow-sm'
                          : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-750'
                      }`}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-slate-300 text-xs font-bold mb-1.5">
                  負責樂器 / 角色 (可多選) <span className="text-red-400">*</span>
                </label>
                <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
                  {ROLES.filter((r) => r.id !== 'other').map((role) => {
                    const isSelected = addRoles.includes(role.id);
                    return (
                      <button
                        key={role.id}
                        type="button"
                        onClick={() => {
                          setAddRoles((prev) =>
                            isSelected ? prev.filter((r) => r !== role.id) : [...prev, role.id]
                          );
                        }}
                        className={`px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-all cursor-pointer flex items-center gap-1.5 ${
                          isSelected
                            ? 'bg-indigo-600/30 border-indigo-500 text-indigo-200'
                            : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <span>{role.nameZh}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-indigo-400" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-slate-300 text-xs font-bold mb-1.5">
                  音樂偏好 (預設為都可以)
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {GENRES.slice(0, 5).map((genre) => {
                    const isSelected = addMusic.includes(genre.id);
                    return (
                      <button
                        key={genre.id}
                        type="button"
                        onClick={() => {
                          setAddMusic((prev) =>
                            isSelected ? prev.filter((m) => m !== genre.id) : [...prev, genre.id]
                          );
                        }}
                        className={`px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-all cursor-pointer flex items-center gap-1.5 ${
                          isSelected
                            ? 'bg-purple-600/30 border-purple-500 text-purple-200'
                            : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <span>{genre.nameZh}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-purple-400" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingManual}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-400 hover:to-purple-400 text-white font-bold text-xs shadow-lg transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingManual ? '新增中...' : '確認新增並加入動態牆'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function CheckCircle2Icon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 24 24"
      {...props}
    >
      <circle cx={12} cy={12} r={10} />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}
