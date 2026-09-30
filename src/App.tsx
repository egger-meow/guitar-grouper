import React, { useState, useEffect } from 'react';
import { useRoomSocket } from './hooks/useRoomSocket';
import { HostView } from './components/HostView';
import { ParticipantView } from './components/ParticipantView';
import { ResultsView } from './components/ResultsView';
import {
  Guitar,
  Users,
  PlusCircle,
  LogIn,
  Sparkles,
  Radio,
  ArrowLeft,
  AlertTriangle,
} from 'lucide-react';

interface RouteState {
  room: string;
  host: boolean;
  secret?: string;
}

function parseUrlRoute(): RouteState {
  if (typeof window === 'undefined') return { room: '', host: false };
  const params = new URLSearchParams(window.location.search);
  const room = (params.get('room') || '').trim().toUpperCase();
  const host = params.get('host') === '1' || params.get('host') === 'true';
  const secret = (params.get('secret') || '').trim();
  return { room, host, secret: secret || undefined };
}

export function App() {
  const [route, setRoute] = useState<RouteState>(parseUrlRoute);
  const [inputCode, setInputCode] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  // Sync state with popstate (back/forward buttons)
  useEffect(() => {
    const handlePopState = () => {
      setRoute(parseUrlRoute());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateTo = (newRoute: RouteState) => {
    const params = new URLSearchParams();
    if (newRoute.room) params.set('room', newRoute.room);
    if (newRoute.host) params.set('host', '1');
    if (newRoute.secret) params.set('secret', newRoute.secret);
    const newSearch = params.toString() ? `?${params.toString()}` : '/';
    window.history.pushState({}, '', newSearch);
    setRoute(newRoute);
    setGlobalError(null);
  };

  const getStoredHostSecret = (code: string): string => {
    if (typeof window === 'undefined' || !code) return '';
    try {
      return (
        sessionStorage.getItem(`gg_host_secret_${code}`) ||
        localStorage.getItem(`gg_host_secret_${code}`) ||
        ''
      );
    } catch {
      return '';
    }
  };

  const effectiveHostSecret = route.secret || getStoredHostSecret(route.room);

  const {
    connected,
    connecting,
    status,
    participantCount,
    settings,
    participants,
    participant,
    assignedGroup,
    optimizationResult,
    error: socketError,
    joinRoom,
    updateSettings,
    startGrouping,
    resetGrouping,
    authenticateHost,
  } = useRoomSocket(route.room, {
    isHost: route.host,
    hostSecret: effectiveHostSecret || undefined,
  });

  const handleCreateRoom = async () => {
    setIsCreating(true);
    setGlobalError(null);
    try {
      const res = await fetch('/api/room/create', { method: 'POST' });
      if (!res.ok) {
        throw new Error('建立房間失敗，請稍後再試');
      }
      const data = (await res.json()) as { roomCode: string; hostSecret: string };
      if (typeof window !== 'undefined') {
        try {
          sessionStorage.setItem(`gg_host_secret_${data.roomCode}`, data.hostSecret);
          localStorage.setItem(`gg_host_secret_${data.roomCode}`, data.hostSecret);
        } catch {}
      }
      navigateTo({ room: data.roomCode, host: true, secret: data.hostSecret });
    } catch (err: any) {
      setGlobalError(err.message || '建立房間時發生錯誤');
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinByCode = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = inputCode.trim().toUpperCase();
    if (!clean) {
      setGlobalError('請輸入房間代碼');
      return;
    }
    if (clean.length !== 4) {
      setGlobalError('請輸入 4 位英文房間代碼');
      return;
    }
    navigateTo({ room: clean, host: false });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-slate-950">
      {/* Top Navbar */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-slate-950/80 border-b border-slate-800/80 px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigateTo({ room: '', host: false })}
            className="flex items-center gap-2.5 text-left group cursor-pointer"
          >
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 shadow-md shadow-emerald-500/20 group-hover:scale-105 transition-transform">
              <Guitar className="w-6 h-6 fill-current" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-black text-lg text-white tracking-tight">
                  吉他社分組神器
                </span>
                <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Guitar Group
                </span>
              </div>
              <p className="text-[11px] text-slate-400">大專院校吉他社即時品味配對</p>
            </div>
          </button>

          {/* Room status / back button */}
          {route.room && (
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs">
                <span
                  className={`w-2 h-2 rounded-full ${
                    connected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                  }`}
                />
                <span className="text-slate-400">房間:</span>
                <span className="font-mono font-bold text-amber-400">{route.room}</span>
              </div>

              <button
                type="button"
                onClick={() => navigateTo({ room: '', host: false })}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs text-slate-300 font-medium transition-all cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>返回大廳</span>
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Global Error Banner */}
      {(globalError || socketError) && (
        <div className="max-w-xl mx-auto w-full px-4 pt-4">
          <div className="p-4 rounded-2xl bg-red-950/80 border border-red-700/60 text-red-200 text-xs font-medium flex items-center gap-3 shadow-lg">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{globalError || socketError}</span>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col items-center justify-center p-4">
        {/* 1. Home View (No room selected) */}
        {!route.room && (
          <div className="w-full max-w-xl mx-auto py-8 text-center space-y-8 animate-fadeIn">
            {/* Hero Banner */}
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-bold tracking-wider uppercase">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>為吉他社而生的智慧分組系統</span>
              </div>

              <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight leading-tight">
                吉他社分組神器
                <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-amber-300">
                  Guitar Group
                </span>
              </h1>

              <p className="text-slate-400 text-sm sm:text-base max-w-md mx-auto">
                不用再為期初社大或成發組團傷腦筋！即時掃碼、30秒填寫樂器與音樂品味，一鍵找到最合拍的樂團夥伴！
              </p>
            </div>

            {/* Actions Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
              {/* Option A: Create Room (Host) */}
              <div className="space-y-2">
                <button
                  type="button"
                  disabled={isCreating}
                  onClick={handleCreateRoom}
                  className="w-full py-4 px-6 rounded-2xl font-black text-lg bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 hover:from-emerald-300 hover:to-teal-300 text-slate-950 flex items-center justify-center gap-3 shadow-xl shadow-emerald-500/20 active:scale-98 transition-all cursor-pointer"
                >
                  <PlusCircle className="w-6 h-6 stroke-[2.5]" />
                  <span>{isCreating ? '正在建立房間...' : '建立分組房間'}</span>
                </button>
                <p className="text-slate-500 text-xs">
                  社長 / 主辦幹部請點此，獲得大螢幕 Kahoot 投影代碼與 QR Code
                </p>
              </div>

              <div className="relative flex items-center justify-center py-2">
                <div className="border-t border-slate-800 w-full" />
                <span className="bg-slate-900 px-4 text-xs text-slate-500 font-bold uppercase tracking-wider absolute">
                  或者學員加入
                </span>
              </div>

              {/* Option B: Join Room with Code */}
              <form onSubmit={handleJoinByCode} className="space-y-3">
                <div className="text-left">
                  <label className="block text-slate-300 text-xs font-bold uppercase tracking-wider mb-1.5">
                    輸入代碼加入
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      maxLength={4}
                      value={inputCode}
                      onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                      placeholder="請輸入 4 位英文房間代碼"
                      className="flex-1 px-4 py-3 rounded-2xl bg-slate-800 border border-slate-700 text-white font-mono font-bold tracking-widest text-center text-lg placeholder:text-slate-500 placeholder:text-xs placeholder:font-sans focus:outline-none focus:ring-2 focus:ring-amber-400 uppercase"
                    />
                    <button
                      type="submit"
                      className="px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm shadow-lg shadow-indigo-600/20 active:scale-95 transition-all cursor-pointer flex items-center gap-2 shrink-0"
                    >
                      <LogIn className="w-4 h-4" />
                      <span>進入房間</span>
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* 2. Host View */}
        {route.room && route.host && (
          <HostView
            roomCode={route.room}
            hostSecret={effectiveHostSecret}
            participantCount={participantCount}
            participants={participants}
            settings={settings}
            status={status}
            result={optimizationResult}
            onStartGrouping={startGrouping}
            onUpdateSettings={updateSettings}
            onRerunGrouping={startGrouping}
            onResetGrouping={resetGrouping}
            onUnlockHost={(secret) => {
              authenticateHost(secret);
              navigateTo({ room: route.room, host: true, secret });
            }}
            onSwitchToParticipant={() => {
              navigateTo({ room: route.room, host: false });
            }}
          />
        )}

        {/* 3. Participant Results View (When Revealed) */}
        {route.room && !route.host && status === 'REVEALED' && assignedGroup && (
          <ResultsView
            assignedGroup={assignedGroup}
            currentParticipantId={participant?.id}
            isHost={false}
          />
        )}

        {/* 4. Participant Form / Waiting Room (When Not Revealed) */}
        {route.room && !route.host && (status !== 'REVEALED' || !assignedGroup) && (
          <ParticipantView
            roomCode={route.room}
            participant={participant}
            status={status}
            settings={settings}
            participantCount={participantCount}
            onSubmit={joinRoom}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 py-4 px-4 text-center text-xs text-slate-500">
        吉他社分組神器 © 2026 Guitar Group · Powered by Cloudflare Workers & React 19
      </footer>
    </div>
  );
}

export default App;
