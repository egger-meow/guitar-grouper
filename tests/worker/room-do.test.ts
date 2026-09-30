import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RoomDO } from '../../workers/room-do';
import worker from '../../workers/app';
import {
  MockWebSocketPair,
  MockDurableObjectNamespace,
  MockDurableObjectState,
} from './test-harness';
import { DEFAULT_HOST_SETTINGS } from '../../src/engine/taxonomy';
import type { Participant, Role } from '../../src/types/domain';

// Setup MockWebSocketPair in global environment
(globalThis as any).WebSocketPair = MockWebSocketPair;

describe('Task 6: Cloudflare Durable Object Room Coordination & WebSocket Protocol', () => {
  let env: {
    ROOM_DO: MockDurableObjectNamespace;
    ASSETS: { fetch: ReturnType<typeof vi.fn> };
  };

  beforeEach(() => {
    env = {
      ROOM_DO: new MockDurableObjectNamespace(RoomDO),
      ASSETS: {
        fetch: vi.fn(async () => new Response('<html>SPA</html>', { status: 200 })),
      },
    };
  });

  describe('1. Room Creation', () => {
    it('generates 4-letter uppercase code, initializes RoomDO state, and returns hostSecret', async () => {
      const req = new Request('http://localhost/api/room/create', { method: 'POST' });
      const res = await worker.fetch(req, env as any, {} as any);

      expect(res.status).toBe(200);
      const data = (await res.json()) as any;
      expect(data).toHaveProperty('roomCode');
      expect(data).toHaveProperty('hostSecret');
      expect(data.roomCode).toMatch(/^[A-Z]{4}$/);
      expect(typeof data.hostSecret).toBe('string');
      expect(data.hostSecret.length).toBeGreaterThanOrEqual(16);

      // Verify DO internal state
      const doEntry = env.ROOM_DO.getInstance(data.roomCode);
      expect(doEntry).toBeDefined();

      const stateReq = new Request('http://localhost/state', { method: 'GET' });
      const stateRes = await doEntry!.do.fetch(stateReq);
      expect(stateRes.status).toBe(200);
      const stateData = (await stateRes.json()) as any;
      expect(stateData.roomCode).toBe(data.roomCode);
      expect(stateData.status).toBe('WAITING');
      expect(stateData.settings).toEqual(DEFAULT_HOST_SETTINGS);
      expect(stateData.participantCount).toBe(0);
    });
  });

  describe('2. Participant Registration & Real-time Broadcast', () => {
    it('allows participant to join via WebSocket, updates state, and broadcasts PARTICIPANT_JOINED', async () => {
      // 1. Create Room
      const createRes = await worker.fetch(
        new Request('http://localhost/api/room/create', { method: 'POST' }),
        env as any,
        {} as any
      );
      const { roomCode, hostSecret } = (await createRes.json()) as any;

      // 2. Connect Host client WebSocket
      const hostWsReq = new Request(`http://localhost/api/room/${roomCode}/ws?hostSecret=${hostSecret}`, {
        headers: { Upgrade: 'websocket' },
      });
      const hostWsRes = await worker.fetch(hostWsReq, env as any, {} as any);
      expect(hostWsRes.status).toBe(101);
      const hostClientWs = (hostWsRes as any).webSocket;
      expect(hostClientWs).toBeDefined();

      // Clear initial welcome message
      await new Promise((r) => setTimeout(r, 10));
      hostClientWs.receivedMessages = [];

      // 3. Connect Participant client WebSocket
      const p1WsReq = new Request(`http://localhost/api/room/${roomCode}/ws`, {
        headers: { Upgrade: 'websocket' },
      });
      const p1WsRes = await worker.fetch(p1WsReq, env as any, {} as any);
      expect(p1WsRes.status).toBe(101);
      const p1ClientWs = (p1WsRes as any).webSocket;

      // 4. Participant sends JOIN_ROOM with authentic data
      const participantPayload: Omit<Participant, 'id' | 'joinedAt'> = {
        name: '陳志豪',
        gender: 'M',
        capabilities: ['acoustic_guitar', 'lead_vocal'],
        musicPreferences: ['mandopop_ballad', 'jay_chou'],
      };

      p1ClientWs.send(
        JSON.stringify({
          type: 'JOIN_ROOM',
          participant: participantPayload,
        })
      );

      // Wait for async processing
      await new Promise((r) => setTimeout(r, 20));

      // Host receives broadcast message
      const hostMessages = hostClientWs.receivedMessages.map((m: string) => JSON.parse(m));
      const joinBroadcast = hostMessages.find((m: any) => m.type === 'PARTICIPANT_JOINED');
      expect(joinBroadcast).toBeDefined();
      expect(joinBroadcast.participant.name).toBe('陳志豪');
      expect(joinBroadcast.participant.capabilities).toContain('acoustic_guitar');
      expect(joinBroadcast.participantCount).toBe(1);

      // Participant received JOINED confirmation with generated participantId
      const p1Messages = p1ClientWs.receivedMessages.map((m: string) => JSON.parse(m));
      const p1JoinAck = p1Messages.find(
        (m: any) => m.type === 'ROOM_STATE' || m.type === 'JOINED_SUCCESS'
      );
      expect(p1JoinAck).toBeDefined();
    });

    it('supports participant join via HTTP REST fallback', async () => {
      const createRes = await worker.fetch(
        new Request('http://localhost/api/room/create', { method: 'POST' }),
        env as any,
        {} as any
      );
      const { roomCode } = (await createRes.json()) as any;

      const joinReq = new Request(`http://localhost/api/room/${roomCode}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: '張詠晴',
          gender: 'F',
          capabilities: ['cajon', 'drums'] as Role[],
          musicPreferences: ['indie_rock', 'nodarty'],
        }),
      });

      const joinRes = await worker.fetch(joinReq, env as any, {} as any);
      expect(joinRes.status).toBe(200);
      const joinData = (await joinRes.json()) as any;
      expect(joinData.success).toBe(true);
      expect(joinData.participant.name).toBe('張詠晴');
      expect(joinData.participant.id).toBeDefined();
    });
  });

  describe('3. Host Authentication', () => {
    it('rejects unauthorized settings update or grouping trigger via WebSocket and HTTP', async () => {
      const createRes = await worker.fetch(
        new Request('http://localhost/api/room/create', { method: 'POST' }),
        env as any,
        {} as any
      );
      const { roomCode, hostSecret } = (await createRes.json()) as any;

      // Connect unauthenticated WebSocket
      const wsReq = new Request(`http://localhost/api/room/${roomCode}/ws`, {
        headers: { Upgrade: 'websocket' },
      });
      const wsRes = await worker.fetch(wsReq, env as any, {} as any);
      const clientWs = (wsRes as any).webSocket;

      clientWs.receivedMessages = [];

      // 1. Try to update settings with wrong secret
      clientWs.send(
        JSON.stringify({
          type: 'HOST_UPDATE_SETTINGS',
          hostSecret: 'wrong-secret-token',
          settings: { targetGroupSize: 5 },
        })
      );
      await new Promise((r) => setTimeout(r, 20));

      let msgs = clientWs.receivedMessages.map((m: string) => JSON.parse(m));
      let errorMsg = msgs.find((m: any) => m.type === 'ERROR');
      expect(errorMsg).toBeDefined();
      expect(errorMsg.code).toBe('UNAUTHORIZED');

      // 2. Try to trigger grouping with missing secret
      clientWs.receivedMessages = [];
      clientWs.send(
        JSON.stringify({
          type: 'HOST_START_GROUPING',
        })
      );
      await new Promise((r) => setTimeout(r, 20));

      msgs = clientWs.receivedMessages.map((m: string) => JSON.parse(m));
      errorMsg = msgs.find((m: any) => m.type === 'ERROR');
      expect(errorMsg).toBeDefined();
      expect(errorMsg.code).toBe('UNAUTHORIZED');

      // 3. Try HTTP /settings with wrong authorization
      const badHttpSettings = await worker.fetch(
        new Request(`http://localhost/api/room/${roomCode}/settings`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer invalid-token',
          },
          body: JSON.stringify({ settings: { targetGroupSize: 5 } }),
        }),
        env as any,
        {} as any
      );
      expect(badHttpSettings.status).toBe(401);
      const errHttp = (await badHttpSettings.json()) as any;
      expect(errHttp.code || errHttp.error).toBe('UNAUTHORIZED');

      // 4. Valid host updates settings
      const goodHttpSettings = await worker.fetch(
        new Request(`http://localhost/api/room/${roomCode}/settings`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${hostSecret}`,
          },
          body: JSON.stringify({ settings: { targetGroupSize: 3, groupSizePreference: 'smaller', groupSizePreferenceWeight: .75, desiredRoles: ['cajon', 'lead_vocal'], minRequiredRolesCount: 9 } }),
        }),
        env as any,
        {} as any
      );
      expect(goodHttpSettings.status).toBe(200);
      const updatedData = (await goodHttpSettings.json()) as any;
      expect(updatedData.settings.targetGroupSize).toBe(3);
      expect(updatedData.settings.groupSizePreference).toBe('smaller');
      expect(updatedData.settings.groupSizePreferenceWeight).toBe(.75);
      expect(updatedData.settings.keyRoles).toEqual(['cajon', 'lead_vocal']);
      expect(updatedData.settings.minRequiredRolesCount).toBe(2);
      const settingsSocket = await worker.fetch(new Request(`http://localhost/api/room/${roomCode}/ws?hostSecret=${hostSecret}`, {
        headers: { Upgrade: 'websocket' },
      }), env as any, {} as any);
      const socket = (settingsSocket as any).webSocket;
      socket.send(JSON.stringify({ type: 'HOST_UPDATE_SETTINGS', settings: { groupSizePreference: 'larger', groupSizePreferenceWeight: .5 } }));
      await vi.waitFor(() => {
        const messages = socket.receivedMessages.map((message: string) => JSON.parse(message));
        expect(messages.some((message: any) => message.type === 'ROOM_STATE' && message.settings.groupSizePreference === 'larger' && message.settings.groupSizePreferenceWeight === .5)).toBe(true);
      });

    });

    it('authenticates unprivileged WebSocket connection using HOST_AUTH and receives host view', async () => {
      // 1. Create Room
      const createRes = await worker.fetch(
        new Request('http://localhost/api/room/create', { method: 'POST' }),
        env as any,
        {} as any
      );
      const { roomCode, hostSecret } = (await createRes.json()) as any;

      // 2. Connect unauthenticated WebSocket (no hostSecret in query string)
      const wsReq = new Request(`http://localhost/api/room/${roomCode}/ws`, {
        headers: { Upgrade: 'websocket' },
      });
      const wsRes = await worker.fetch(wsReq, env as any, {} as any);
      const clientWs = (wsRes as any).webSocket;
      await new Promise((r) => setTimeout(r, 10));
      clientWs.receivedMessages = [];

      // 3. Send HOST_AUTH with invalid secret -> receives UNAUTHORIZED
      clientWs.send(JSON.stringify({ type: 'HOST_AUTH', hostSecret: 'wrong-secret' }));
      await new Promise((r) => setTimeout(r, 20));
      let msgs = clientWs.receivedMessages.map((m: string) => JSON.parse(m));
      expect(msgs.some((m: any) => m.type === 'ERROR' && m.code === 'UNAUTHORIZED')).toBe(true);

      // 4. Send HOST_AUTH with valid secret -> receives ROOM_STATE with host view
      clientWs.receivedMessages = [];
      clientWs.send(JSON.stringify({ type: 'HOST_AUTH', hostSecret }));
      await new Promise((r) => setTimeout(r, 20));
      msgs = clientWs.receivedMessages.map((m: string) => JSON.parse(m));
      const hostStateMsg = msgs.find((m: any) => m.type === 'ROOM_STATE');
      expect(hostStateMsg).toBeDefined();
      expect(hostStateMsg.participants).toBeDefined();

      // 5. Subsequent HOST_UPDATE_SETTINGS now succeeds because socket is authenticated
      clientWs.send(
        JSON.stringify({
          type: 'HOST_UPDATE_SETTINGS',
          settings: { targetGroupSize: 5 },
        })
      );
      await new Promise((r) => setTimeout(r, 20));
      const doEntry = env.ROOM_DO.getInstance(roomCode);
      const stateReq = new Request('http://localhost/state', {
        headers: { Authorization: `Bearer ${hostSecret}` },
      });
      const stateRes = await doEntry!.do.fetch(stateReq);
      const state = (await stateRes.json()) as any;
      expect(state.settings.targetGroupSize).toBe(5);
    });
  });

  describe('4. Grouping Lifecycle', () => {
    it('transitions WAITING -> OPTIMIZING -> REVEALED, runs optimizer, and broadcasts GROUPING_RESULT', async () => {
      // Create room
      const createRes = await worker.fetch(
        new Request('http://localhost/api/room/create', { method: 'POST' }),
        env as any,
        {} as any
      );
      const { roomCode, hostSecret } = (await createRes.json()) as any;

      // Register 6 authentic participants
      const authenticParticipants: Omit<Participant, 'id' | 'joinedAt'>[] = [
        {
          name: '林宥嘉',
          gender: 'M',
          capabilities: ['lead_vocal', 'acoustic_guitar'],
          musicPreferences: ['mandopop_ballad', 'jay_chou'],
        },
        {
          name: '李榮浩',
          gender: 'M',
          capabilities: ['acoustic_guitar', 'electric_guitar', 'bass'],
          musicPreferences: ['mandopop_ballad', 'weibird'],
        },
        {
          name: '魏如萱',
          gender: 'F',
          capabilities: ['lead_vocal'],
          musicPreferences: ['indie_rock', 'nodarty'],
        },
        {
          name: '陳綺貞',
          gender: 'F',
          capabilities: ['acoustic_guitar', 'lead_vocal'],
          musicPreferences: ['mandopop_ballad', 'accusefive'],
        },
        {
          name: '張震嶽',
          gender: 'M',
          capabilities: ['acoustic_guitar', 'cajon'],
          musicPreferences: ['indie_rock', 'fireex'],
        },
        {
          name: '盧廣仲',
          gender: 'M',
          capabilities: ['acoustic_guitar', 'lead_vocal'],
          musicPreferences: ['mandopop_ballad', 'bestards'],
        },
      ];

      for (const p of authenticParticipants) {
        await worker.fetch(
          new Request(`http://localhost/api/room/${roomCode}/join`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(p),
          }),
          env as any,
          {} as any
        );
      }

      // Update settings to targetGroupSize: 3
      await worker.fetch(
        new Request(`http://localhost/api/room/${roomCode}/settings`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${hostSecret}`,
          },
          body: JSON.stringify({ settings: { targetGroupSize: 3, groupSizePreference: 'smaller', groupSizePreferenceWeight: .75, desiredRoles: ['cajon', 'lead_vocal'], minRequiredRolesCount: 9 } }),
        }),
        env as any,
        {} as any
      );

      // Connect participant WebSocket
      const wsRes = await worker.fetch(
        new Request(`http://localhost/api/room/${roomCode}/ws`, {
          headers: { Upgrade: 'websocket' },
        }),
        env as any,
        {} as any
      );
      const clientWs = (wsRes as any).webSocket;
      await new Promise((r) => setTimeout(r, 10));
      clientWs.receivedMessages = [];

      // Host triggers grouping via HTTP
      const startRes = await worker.fetch(
        new Request(`http://localhost/api/room/${roomCode}/start`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${hostSecret}`,
          },
        }),
        env as any,
        {} as any
      );

      expect(startRes.status).toBe(200);
      const startData = (await startRes.json()) as any;
      expect(startData.status).toBe('REVEALED');
      expect(startData.result.groups.length).toBe(2); // 6 participants / targetGroupSize 3 or 4 -> 2 groups

      // Connected WebSocket received GROUPING_RESULT
      await new Promise((r) => setTimeout(r, 20));
      const msgs = clientWs.receivedMessages.map((m: string) => JSON.parse(m));
      const groupingResultMsg = msgs.find((m: any) => m.type === 'GROUPING_RESULT');
      expect(groupingResultMsg).toBeDefined();
      expect(groupingResultMsg.status).toBe('REVEALED');
      expect(groupingResultMsg.result.groups.length).toBe(2);
    });
  });

  describe('5. Participant Result Lookup & Teammate Details', () => {
    it('returns assigned group and teammates with capabilities and music preferences for participant', async () => {
      const createRes = await worker.fetch(
        new Request('http://localhost/api/room/create', { method: 'POST' }),
        env as any,
        {} as any
      );
      const { roomCode, hostSecret } = (await createRes.json()) as any;

      // Register participants and keep their IDs
      const p1Res = await worker.fetch(
        new Request(`http://localhost/api/room/${roomCode}/join`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: '林宥嘉',
            gender: 'M',
            capabilities: ['lead_vocal', 'acoustic_guitar'],
            musicPreferences: ['mandopop_ballad', 'jay_chou'],
          }),
        }),
        env as any,
        {} as any
      );
      const p1 = ((await p1Res.json()) as any).participant;

      const p2Res = await worker.fetch(
        new Request(`http://localhost/api/room/${roomCode}/join`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: '李榮浩',
            gender: 'M',
            capabilities: ['acoustic_guitar', 'electric_guitar', 'bass'],
            musicPreferences: ['mandopop_ballad', 'weibird'],
          }),
        }),
        env as any,
        {} as any
      );
      const p2 = ((await p2Res.json()) as any).participant;

      const p3Res = await worker.fetch(
        new Request(`http://localhost/api/room/${roomCode}/join`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: '魏如萱',
            gender: 'F',
            capabilities: ['lead_vocal'],
            musicPreferences: ['indie_rock', 'nodarty'],
          }),
        }),
        env as any,
        {} as any
      );
      const p3 = ((await p3Res.json()) as any).participant;

      const p4Res = await worker.fetch(
        new Request(`http://localhost/api/room/${roomCode}/join`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: '張震嶽',
            gender: 'M',
            capabilities: ['acoustic_guitar', 'cajon'],
            musicPreferences: ['indie_rock', 'fireex'],
          }),
        }),
        env as any,
        {} as any
      );
      const p4 = ((await p4Res.json()) as any).participant;

      // Host starts grouping
      await worker.fetch(
        new Request(`http://localhost/api/room/${roomCode}/start`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${hostSecret}` },
        }),
        env as any,
        {} as any
      );

      // Query state for participant p1
      const stateRes = await worker.fetch(
        new Request(`http://localhost/api/room/${roomCode}/state?participantId=${p1.id}`),
        env as any,
        {} as any
      );
      expect(stateRes.status).toBe(200);
      const p1State = (await stateRes.json()) as any;

      expect(p1State.status).toBe('REVEALED');
      expect(p1State.assignedGroup).toBeDefined();
      expect(p1State.assignedGroup.memberIds).toContain(p1.id);
      expect(p1State.teammates).toBeDefined();

      // Teammates must NOT include p1
      expect(p1State.teammates.some((t: Participant) => t.id === p1.id)).toBe(false);

      // Teammates must have capabilities and musicPreferences
      for (const teammate of p1State.teammates) {
        expect(teammate.id).toBeDefined();
        expect(teammate.name).toBeDefined();
        expect(Array.isArray(teammate.capabilities)).toBe(true);
        expect(Array.isArray(teammate.musicPreferences)).toBe(true);
      }
    });
  });

  describe('6. Reconnection Resilience', () => {
    it('reconnecting client with participantId retains registered profile and group assignment', async () => {
      const createRes = await worker.fetch(
        new Request('http://localhost/api/room/create', { method: 'POST' }),
        env as any,
        {} as any
      );
      const { roomCode, hostSecret } = (await createRes.json()) as any;

      // Register participant
      const joinRes = await worker.fetch(
        new Request(`http://localhost/api/room/${roomCode}/join`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: '盧廣仲',
            gender: 'M',
            capabilities: ['acoustic_guitar', 'lead_vocal'],
            musicPreferences: ['mandopop_ballad', 'crowd_lu'],
          }),
        }),
        env as any,
        {} as any
      );
      const participantId = ((await joinRes.json()) as any).participant.id;

      // Add other participants and start grouping
      for (const name of ['林宥嘉', '李榮浩', '魏如萱']) {
        await worker.fetch(
          new Request(`http://localhost/api/room/${roomCode}/join`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name,
              gender: 'M',
              capabilities: ['acoustic_guitar'],
              musicPreferences: ['mandopop_ballad'],
            }),
          }),
          env as any,
          {} as any
        );
      }

      await worker.fetch(
        new Request(`http://localhost/api/room/${roomCode}/start`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${hostSecret}` },
        }),
        env as any,
        {} as any
      );

      // Reconnect via WebSocket with existing participantId
      const reconnectWsReq = new Request(
        `http://localhost/api/room/${roomCode}/ws?participantId=${participantId}`,
        { headers: { Upgrade: 'websocket' } }
      );
      const reconnectWsRes = await worker.fetch(reconnectWsReq, env as any, {} as any);
      const clientWs = (reconnectWsRes as any).webSocket;

      await new Promise((r) => setTimeout(r, 20));
      const msgs = clientWs.receivedMessages.map((m: string) => JSON.parse(m));
      const stateMsg = msgs.find((m: any) => m.type === 'ROOM_STATE' || m.type === 'GROUPING_RESULT');

      expect(stateMsg).toBeDefined();
      expect(stateMsg.assignedGroup).toBeDefined();
      expect(stateMsg.assignedGroup.memberIds).toContain(participantId);
      expect(stateMsg.participant.name).toBe('盧廣仲');
    });
  });

  describe('7. Auto-TTL Alarm Cleanup', () => {
    it('sets 24-hour alarm on activity and purges room storage in alarm()', async () => {
      const createRes = await worker.fetch(
        new Request('http://localhost/api/room/create', { method: 'POST' }),
        env as any,
        {} as any
      );
      const { roomCode } = (await createRes.json()) as any;

      const doEntry = env.ROOM_DO.getInstance(roomCode)!;
      const alarmTime = await doEntry.state.storage.getAlarm();
      expect(alarmTime).toBeDefined();
      expect(alarmTime).toBeGreaterThan(Date.now() + 23 * 3600 * 1000);

      // Trigger alarm
      await doEntry.do.alarm();

      // Verify room storage was purged
      const storedRoom = await doEntry.state.storage.get('room');
      expect(storedRoom).toBeUndefined();

      // State query after alarm should return 404 Room Not Found
      const stateRes = await doEntry.do.fetch(new Request('http://localhost/state'));
      expect(stateRes.status).toBe(404);
    });
  });

  describe('8. Worker Health & Assets Fallback', () => {
    it('returns 200 OK on /api/health', async () => {
      const res = await worker.fetch(
        new Request('http://localhost/api/health'),
        env as any,
        {} as any
      );
      expect(res.status).toBe(200);
      const data = (await res.json()) as any;
      expect(data.status).toBe('ok');
    });

    it('delegates unknown non-api paths to env.ASSETS', async () => {
      const res = await worker.fetch(
        new Request('http://localhost/join/BAND'),
        env as any,
        {} as any
      );
      expect(env.ASSETS.fetch).toHaveBeenCalled();
      expect(res.status).toBe(200);
    });
  });
});
