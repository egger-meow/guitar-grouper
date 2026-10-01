import { useEffect, useRef, useState, useCallback } from 'react';
import type {
  Participant,
  HostSettings,
  GroupResult,
  OptimizationResult,
  Role,
} from '../types/domain';
import { DEFAULT_HOST_SETTINGS } from '../engine/taxonomy';

export interface UseRoomSocketOptions {
  isHost?: boolean;
  hostSecret?: string;
  initialParticipantId?: string;
  autoConnect?: boolean;
}

export interface UseRoomSocketReturn {
  draftRevision: number;
  publishedRevision: number;
  publishedResult: OptimizationResult | null;
  canUndo: boolean;
  draftAction: (action: 'move' | 'fill' | 'undo' | 'publish', payload?: Record<string, unknown>) => Promise<void>;
  connected: boolean;
  connecting: boolean;
  roomCode: string;
  status: 'WAITING' | 'OPTIMIZING' | 'DRAFT' | 'REVEALED';
  participantCount: number;
  settings: HostSettings;
  participants: Record<string, Participant>;
  participant: Participant | null;
  assignedGroup: GroupResult | null;
  teammates: Participant[];
  optimizationResult: OptimizationResult | null;
  error: string | null;
  joinRoom: (p: {
    name: string;
    gender?: string;
    capabilities?: Role[];
    musicPreferences?: string[];
  }) => Promise<void>;
  updateSettings: (settings: Partial<HostSettings>) => Promise<void>;
  startGrouping: () => Promise<void>;
  resetGrouping: () => Promise<void>;
  refreshState: () => Promise<void>;
  authenticateHost: (secret: string) => Promise<void>;
}

export function useRoomSocket(
  roomCode: string,
  options: UseRoomSocketOptions = {}
): UseRoomSocketReturn {
  const normalizedCode = roomCode ? roomCode.trim().toUpperCase() : '';

  const getStoredSecret = useCallback((): string => {
    if (typeof window === 'undefined' || !normalizedCode) return '';
    try {
      return (
        sessionStorage.getItem(`gg_host_secret_${normalizedCode}`) ||
        localStorage.getItem(`gg_host_secret_${normalizedCode}`) ||
        ''
      );
    } catch {
      return '';
    }
  }, [normalizedCode]);

  // Recover cached identity from options, sessionStorage, or localStorage
  const [cachedHostSecret, setCachedHostSecret] = useState<string>(() => {
    if (options.hostSecret) return options.hostSecret;
    if (typeof window === 'undefined' || !normalizedCode) return '';
    try {
      return (
        sessionStorage.getItem(`gg_host_secret_${normalizedCode}`) ||
        localStorage.getItem(`gg_host_secret_${normalizedCode}`) ||
        ''
      );
    } catch {
      return '';
    }
  });

  const [cachedParticipantId, setCachedParticipantId] = useState<string>(() => {
    if (options.initialParticipantId) return options.initialParticipantId;
    if (typeof window === 'undefined' || !normalizedCode) return '';
    try {
      return (
        sessionStorage.getItem(`gg_participant_id_${normalizedCode}`) ||
        localStorage.getItem(`gg_participant_id_${normalizedCode}`) ||
        ''
      );
    } catch {
      return '';
    }
  });

  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [status, setStatus] = useState<'WAITING' | 'OPTIMIZING' | 'DRAFT' | 'REVEALED'>('WAITING');
  const [participantCount, setParticipantCount] = useState<number>(0);
  const [settings, setSettings] = useState<HostSettings>(DEFAULT_HOST_SETTINGS);
  const [participants, setParticipants] = useState<Record<string, Participant>>({});
  const [participant, setParticipant] = useState<Participant | null>(() => {
    if (typeof window === 'undefined' || !normalizedCode) return null;
    try {
      const raw =
        sessionStorage.getItem(`gg_participant_${normalizedCode}`) ||
        localStorage.getItem(`gg_participant_${normalizedCode}`);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [assignedGroup, setAssignedGroup] = useState<GroupResult | null>(null);
  const [teammates, setTeammates] = useState<Participant[]>([]);
  const [optimizationResult, setOptimizationResult] = useState<OptimizationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [draftRevision, setDraftRevision] = useState(0);
  const [publishedRevision, setPublishedRevision] = useState(0);
  const [publishedResult, setPublishedResult] = useState<OptimizationResult | null>(null);
  const [canUndo, setCanUndo] = useState(false);

  const latestDraftRevision = useRef(0);
  useEffect(() => { latestDraftRevision.current = 0; }, [normalizedCode]);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<any>(null);
  const pingIntervalRef = useRef<any>(null);

  // Sync hostSecret into storage if provided in options
  useEffect(() => {
    if (options.hostSecret && normalizedCode) {
      try {
        sessionStorage.setItem(`gg_host_secret_${normalizedCode}`, options.hostSecret);
        localStorage.setItem(`gg_host_secret_${normalizedCode}`, options.hostSecret);
      } catch {}
      setCachedHostSecret(options.hostSecret);
    }
  }, [options.hostSecret, normalizedCode]);

  const getEffectiveSecret = useCallback((): string => {
    return cachedHostSecret || options.hostSecret || getStoredSecret();
  }, [cachedHostSecret, options.hostSecret, getStoredSecret]);

  // HTTP State Polling / Fallback
  const refreshState = useCallback(async () => {
    if (!normalizedCode) return;
    try {
      const secret = getEffectiveSecret();
      const params = new URLSearchParams();
      if (cachedParticipantId) params.set('participantId', cachedParticipantId);
      if (secret) params.set('hostSecret', secret);

      const headers: Record<string, string> = {};
      if (secret) {
        headers['Authorization'] = `Bearer ${secret}`;
      }

      const res = await fetch(`/api/room/${normalizedCode}/state?${params.toString()}`, {
        headers,
      });

      if (!res.ok) {
        if (res.status === 404) {
          setError('找不到房間，請確認代碼是否正確');
        }
        return;
      }

      const data = (await res.json()) as any;
      if (typeof data.draftRevision === 'number') {
        if (data.draftRevision < latestDraftRevision.current) return;
        latestDraftRevision.current = data.draftRevision;
      }
      if (data.status) setStatus(data.status);
      if (data.status === 'WAITING') { setOptimizationResult(null); setAssignedGroup(null); setTeammates([]); }
      if (typeof data.participantCount === 'number') setParticipantCount(data.participantCount);
      if (data.settings) setSettings(data.settings);
      if (data.participants) setParticipants(data.participants);
      if (data.participant) {
        setParticipant(data.participant);
        sessionStorage.setItem(`gg_participant_${normalizedCode}`, JSON.stringify(data.participant));
      }
      if ('assignedGroup' in data) setAssignedGroup(data.assignedGroup ?? null);
      if (data.teammates) setTeammates(data.teammates);
      if ('result' in data) setOptimizationResult(data.result ?? null);
      if (typeof data.draftRevision === 'number') setDraftRevision(data.draftRevision);
      if (typeof data.publishedRevision === 'number') setPublishedRevision(data.publishedRevision);
      if ('publishedResult' in data) setPublishedResult(data.publishedResult ?? null);
      if (typeof data.canUndo === 'boolean') setCanUndo(data.canUndo);
    } catch (e: any) {
      console.warn('refreshState fallback failed:', e);
    }
  }, [normalizedCode, cachedParticipantId, getEffectiveSecret]);

  // WebSocket Connection Logic
  const connectWs = useCallback(() => {
    if (!normalizedCode || typeof window === 'undefined') return;
    if (typeof WebSocket === 'undefined') return;

    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    setConnecting(true);
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const secret = getEffectiveSecret();
    const params = new URLSearchParams();
    if (cachedParticipantId) params.set('participantId', cachedParticipantId);
    if (secret) params.set('hostSecret', secret);

    const wsUrl = `${protocol}//${host}/api/room/${normalizedCode}/ws?${params.toString()}`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        setConnecting(false);
        setError(null);

        // Start ping interval
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'PING' }));
          }
        }, 15000);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          switch (msg.type) {
            case 'PONG':
              break;

            case 'ROOM_STATE': {
              if (typeof msg.draftRevision === 'number') {
                if (msg.draftRevision < latestDraftRevision.current) break;
                latestDraftRevision.current = msg.draftRevision;
              }
              if (msg.status) setStatus(msg.status);
              if (msg.status === 'WAITING') { setOptimizationResult(null); setAssignedGroup(null); setTeammates([]); }
              if (typeof msg.participantCount === 'number') setParticipantCount(msg.participantCount);
              if (msg.settings) setSettings(msg.settings);
              if (msg.participants) setParticipants(msg.participants);
              if (msg.participant) {
                setParticipant(msg.participant);
                sessionStorage.setItem(`gg_participant_${normalizedCode}`, JSON.stringify(msg.participant));
              }
              if ('assignedGroup' in msg) setAssignedGroup(msg.assignedGroup ?? null);
              if (msg.teammates) setTeammates(msg.teammates);
              if ('result' in msg) setOptimizationResult(msg.result ?? null);
              if (typeof msg.draftRevision === 'number') setDraftRevision(msg.draftRevision);
              if (typeof msg.publishedRevision === 'number') setPublishedRevision(msg.publishedRevision);
              if ('publishedResult' in msg) setPublishedResult(msg.publishedResult ?? null);
              if (typeof msg.canUndo === 'boolean') setCanUndo(msg.canUndo);
              break;
            }

            case 'PARTICIPANT_JOINED': {
              if (typeof msg.participantCount === 'number') {
                setParticipantCount(msg.participantCount);
              }
              if (msg.participant) {
                setParticipants((prev) => ({
                  ...prev,
                  [msg.participant.id]: msg.participant,
                }));
              }
              break;
            }

            case 'JOINED_SUCCESS': {
              if (msg.participantId) {
                setCachedParticipantId(msg.participantId);
                sessionStorage.setItem(`gg_participant_id_${normalizedCode}`, msg.participantId);
              }
              if (msg.participant) {
                setParticipant(msg.participant);
                sessionStorage.setItem(`gg_participant_${normalizedCode}`, JSON.stringify(msg.participant));
              }
              break;
            }

            case 'GROUPING_STARTED': {
              setStatus('OPTIMIZING');
              break;
            }

            case 'GROUPING_RESULT': {
              setStatus('REVEALED');
              if ('result' in msg) setOptimizationResult(msg.result ?? null);
              if (typeof msg.draftRevision === 'number') setDraftRevision(msg.draftRevision);
              if (typeof msg.publishedRevision === 'number') setPublishedRevision(msg.publishedRevision);
              if ('publishedResult' in msg) setPublishedResult(msg.publishedResult ?? null);
              if (typeof msg.canUndo === 'boolean') setCanUndo(msg.canUndo);
              if ('assignedGroup' in msg) setAssignedGroup(msg.assignedGroup ?? null);
              if (msg.teammates) setTeammates(msg.teammates);
              break;
            }

            case 'ERROR': {
              setError(msg.message || msg.code || '發生錯誤');
              break;
            }

            default:
              break;
          }
        } catch (err) {
          console.warn('Failed to parse WebSocket message', err);
        }
      };

      ws.onclose = () => {
        setConnected(false);
        setConnecting(false);
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
        // Attempt reconnect after 2 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          connectWs();
        }, 2000);
      };

      ws.onerror = () => {
        setConnected(false);
        setConnecting(false);
      };
    } catch {
      setConnected(false);
      setConnecting(false);
    }
  }, [normalizedCode, cachedParticipantId, getEffectiveSecret]);

  useEffect(() => {
    if (!normalizedCode) return;
    refreshState();
    connectWs();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
    };
  }, [normalizedCode, refreshState, connectWs]);

  // Keep published results current when a network blocks WebSocket connections.
  useEffect(() => {
    if (!normalizedCode || connected) return;
    const interval = setInterval(() => { void refreshState(); }, 3000);
    return () => clearInterval(interval);
  }, [normalizedCode, connected, refreshState]);

  // Authenticate Host Action
  const authenticateHost = useCallback(
    async (secret: string) => {
      const cleanSecret = secret.trim();
      if (!cleanSecret || !normalizedCode) return;
      try {
        sessionStorage.setItem(`gg_host_secret_${normalizedCode}`, cleanSecret);
        localStorage.setItem(`gg_host_secret_${normalizedCode}`, cleanSecret);
      } catch {}
      setCachedHostSecret(cleanSecret);
      setError(null);

      // Send auth over WebSocket if open
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'HOST_AUTH',
            hostSecret: cleanSecret,
          })
        );
      } else {
        refreshState();
      }
    },
    [normalizedCode, refreshState]
  );

  // Join Room Action
  const joinRoom = useCallback(
    async (p: {
      name: string;
      gender?: string;
      capabilities?: Role[];
      musicPreferences?: string[];
    }) => {
      if (!normalizedCode) return;
      const payload = {
        id: cachedParticipantId || undefined,
        name: p.name.trim(),
        gender: p.gender || 'unspecified',
        capabilities: p.capabilities || [],
        musicPreferences: p.musicPreferences || [],
        joinedAt: Date.now(),
      };

      // Try via WebSocket first if open
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'JOIN_ROOM',
            participantId: payload.id,
            participant: payload,
          })
        );
      } else {
        // HTTP REST fallback
        const res = await fetch(`/api/room/${normalizedCode}/join`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ participant: payload }),
        });
        if (!res.ok) {
          const err = (await res.json().catch(() => ({}))) as any;
          throw new Error(err.message || '加入房間失敗');
        }
        const data = (await res.json()) as any;
        if (data.participantId) {
          setCachedParticipantId(data.participantId);
          sessionStorage.setItem(`gg_participant_id_${normalizedCode}`, data.participantId);
        }
        if (data.participant) {
          setParticipant(data.participant);
          sessionStorage.setItem(`gg_participant_${normalizedCode}`, JSON.stringify(data.participant));
        }
      }
    },
    [normalizedCode, cachedParticipantId]
  );

  // Update Settings Action (Host)
  const updateSettings = useCallback(
    async (newSettings: Partial<HostSettings>) => {
      if (!normalizedCode) return;
      const secret = getEffectiveSecret();
      if (!secret && options.isHost) {
        setError('尚未提供主辦人密鑰，無法修改房間設定');
        return;
      }
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'HOST_UPDATE_SETTINGS',
            hostSecret: secret,
            settings: newSettings,
          })
        );
      } else {
        await fetch(`/api/room/${normalizedCode}/settings`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${secret}`,
          },
          body: JSON.stringify({ hostSecret: secret, settings: newSettings }),
        });
      }
      setSettings((prev) => ({ ...prev, ...newSettings }));
    },
    [normalizedCode, getEffectiveSecret, options.isHost]
  );

  const resetGrouping = useCallback(async () => {
    if (!normalizedCode) return;
    try {
      const res = await fetch(`/api/room/${normalizedCode}/reset`, {
        method: 'POST', headers: { Authorization: `Bearer ${getEffectiveSecret()}` },
      });
      if (!res.ok) {
        const data = await res.json() as any;
        throw new Error(data.message || '返回待分組失敗');
      }
      setStatus('WAITING');
      setPublishedResult(null);
      setDraftRevision(0);
      setPublishedRevision(0);
      setCanUndo(false);
      setOptimizationResult(null);
      setAssignedGroup(null);
      setTeammates([]);
      setError(null);
      await refreshState();
    } catch (error) {
      setError(error instanceof Error ? error.message : '返回待分組失敗');
    }
  }, [normalizedCode, getEffectiveSecret, refreshState]);

  const draftAction = useCallback(async (action: 'move' | 'fill' | 'undo' | 'publish', payload: Record<string, unknown> = {}) => {
    const res = await fetch(`/api/room/${normalizedCode}/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getEffectiveSecret()}` },
      body: JSON.stringify({ ...payload, revision: draftRevision }),
    });
    const data = await res.json() as any;
    if (!res.ok) { await refreshState(); throw new Error(data.message || '操作失敗，請重試'); }
    if (data.draftRevision < latestDraftRevision.current) return;
    latestDraftRevision.current = data.draftRevision;
    setStatus(data.status);
    setOptimizationResult(data.result ?? null);
    setDraftRevision(data.draftRevision);
    setPublishedRevision(data.publishedRevision);
    setPublishedResult(data.publishedResult ?? null);
    setCanUndo(data.canUndo);
  }, [normalizedCode, getEffectiveSecret, draftRevision, refreshState]);

  const startGrouping = useCallback(async () => {
    if (!normalizedCode) return;
    setError(null);
    setStatus('OPTIMIZING');
    try {
      const res = await fetch(`/api/room/${normalizedCode}/start`, {
        method: 'POST', headers: { Authorization: `Bearer ${getEffectiveSecret()}` },
      });
      const data = await res.json() as any;
      if (!res.ok) throw new Error(data.message || '產生草稿失敗');
      await refreshState();
    } catch (error) {
      setError(error instanceof Error ? error.message : '產生草稿失敗');
      await refreshState();
    }
  }, [normalizedCode, getEffectiveSecret, refreshState]);

  return {
    draftRevision, publishedRevision, publishedResult, canUndo, draftAction,
    connected,
    connecting,
    roomCode: normalizedCode,
    status,
    participantCount,
    settings,
    participants,
    participant,
    assignedGroup,
    teammates,
    optimizationResult,
    error,
    joinRoom,
    updateSettings,
    startGrouping,
    resetGrouping,
    refreshState,
    authenticateHost,
  };
}
