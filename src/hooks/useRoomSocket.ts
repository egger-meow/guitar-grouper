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
  connected: boolean;
  connecting: boolean;
  roomCode: string;
  status: 'WAITING' | 'OPTIMIZING' | 'REVEALED';
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
  refreshState: () => Promise<void>;
}

export function useRoomSocket(
  roomCode: string,
  options: UseRoomSocketOptions = {}
): UseRoomSocketReturn {
  const normalizedCode = roomCode ? roomCode.trim().toUpperCase() : '';

  // Recover cached identity from sessionStorage
  const [cachedHostSecret, setCachedHostSecret] = useState<string>(() => {
    if (options.hostSecret) return options.hostSecret;
    if (typeof window === 'undefined') return '';
    return sessionStorage.getItem(`gg_host_secret_${normalizedCode}`) || '';
  });

  const [cachedParticipantId, setCachedParticipantId] = useState<string>(() => {
    if (options.initialParticipantId) return options.initialParticipantId;
    if (typeof window === 'undefined') return '';
    return sessionStorage.getItem(`gg_participant_id_${normalizedCode}`) || '';
  });

  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [status, setStatus] = useState<'WAITING' | 'OPTIMIZING' | 'REVEALED'>('WAITING');
  const [participantCount, setParticipantCount] = useState<number>(0);
  const [settings, setSettings] = useState<HostSettings>(DEFAULT_HOST_SETTINGS);
  const [participants, setParticipants] = useState<Record<string, Participant>>({});
  const [participant, setParticipant] = useState<Participant | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = sessionStorage.getItem(`gg_participant_${normalizedCode}`);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [assignedGroup, setAssignedGroup] = useState<GroupResult | null>(null);
  const [teammates, setTeammates] = useState<Participant[]>([]);
  const [optimizationResult, setOptimizationResult] = useState<OptimizationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<any>(null);
  const pingIntervalRef = useRef<any>(null);

  // Sync hostSecret into sessionStorage if provided in options
  useEffect(() => {
    if (options.hostSecret && normalizedCode) {
      sessionStorage.setItem(`gg_host_secret_${normalizedCode}`, options.hostSecret);
      setCachedHostSecret(options.hostSecret);
    }
  }, [options.hostSecret, normalizedCode]);

  // HTTP State Polling / Fallback
  const refreshState = useCallback(async () => {
    if (!normalizedCode) return;
    try {
      const params = new URLSearchParams();
      if (cachedParticipantId) params.set('participantId', cachedParticipantId);
      if (cachedHostSecret) params.set('hostSecret', cachedHostSecret);

      const headers: Record<string, string> = {};
      if (cachedHostSecret) {
        headers['Authorization'] = `Bearer ${cachedHostSecret}`;
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
      if (data.status) setStatus(data.status);
      if (typeof data.participantCount === 'number') setParticipantCount(data.participantCount);
      if (data.settings) setSettings(data.settings);
      if (data.participants) setParticipants(data.participants);
      if (data.participant) {
        setParticipant(data.participant);
        sessionStorage.setItem(`gg_participant_${normalizedCode}`, JSON.stringify(data.participant));
      }
      if (data.assignedGroup) setAssignedGroup(data.assignedGroup);
      if (data.teammates) setTeammates(data.teammates);
      if (data.result) setOptimizationResult(data.result);
    } catch (e: any) {
      console.warn('refreshState fallback failed:', e);
    }
  }, [normalizedCode, cachedParticipantId, cachedHostSecret]);

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
    const params = new URLSearchParams();
    if (cachedParticipantId) params.set('participantId', cachedParticipantId);
    if (cachedHostSecret) params.set('hostSecret', cachedHostSecret);

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
              if (msg.status) setStatus(msg.status);
              if (typeof msg.participantCount === 'number') setParticipantCount(msg.participantCount);
              if (msg.settings) setSettings(msg.settings);
              if (msg.participants) setParticipants(msg.participants);
              if (msg.participant) {
                setParticipant(msg.participant);
                sessionStorage.setItem(`gg_participant_${normalizedCode}`, JSON.stringify(msg.participant));
              }
              if (msg.assignedGroup) setAssignedGroup(msg.assignedGroup);
              if (msg.teammates) setTeammates(msg.teammates);
              if (msg.result) setOptimizationResult(msg.result);
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
              if (msg.result) setOptimizationResult(msg.result);
              if (msg.assignedGroup) setAssignedGroup(msg.assignedGroup);
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
  }, [normalizedCode, cachedParticipantId, cachedHostSecret]);

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
      const secret = cachedHostSecret;
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
    [normalizedCode, cachedHostSecret]
  );

  // Start Grouping Action (Host)
  const startGrouping = useCallback(async () => {
    if (!normalizedCode) return;
    setStatus('OPTIMIZING');
    const secret = cachedHostSecret;
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'HOST_START_GROUPING',
          hostSecret: secret,
        })
      );
    } else {
      const res = await fetch(`/api/room/${normalizedCode}/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${secret}`,
        },
        body: JSON.stringify({ hostSecret: secret }),
      });
      if (res.ok) {
        const data = (await res.json()) as any;
        if (data.result) setOptimizationResult(data.result);
        setStatus('REVEALED');
      }
    }
  }, [normalizedCode, cachedHostSecret]);

  return {
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
    refreshState,
  };
}
