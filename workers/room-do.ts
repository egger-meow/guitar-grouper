import {
  Participant,
  HostSettings,
  OptimizationResult,
  GroupResult,
  Role,
} from '../src/types/domain';
import { optimizeGrouping } from '../src/engine/optimizer';
import { DEFAULT_HOST_SETTINGS } from '../src/engine/taxonomy';

export interface RoomState {
  roomCode: string;
  hostSecret: string;
  status: 'WAITING' | 'OPTIMIZING' | 'REVEALED';
  settings: HostSettings;
  participants: Record<string, Participant>;
  optimizationResult: OptimizationResult | null;
  lastActivity: number;
}

export interface WsAttachment {
  participantId?: string;
  isHost?: boolean;
}

/**
 * RoomDO - Cloudflare Durable Object managing room state, WebSocket hibernation,
 * host authorization, grouping execution, and 24h alarm TTL cleanup.
 */
export class RoomDO {
  public ctx: DurableObjectState;
  public env: any;
  private room: RoomState | null = null;
  private wsAttachments = new Map<WebSocket, WsAttachment>();

  constructor(ctx: DurableObjectState, env: any) {
    this.ctx = ctx;
    this.env = env;

    this.ctx.blockConcurrencyWhile(async () => {
      const stored = await this.ctx.storage.get<RoomState>('room');
      if (stored) {
        this.room = stored;
      }
    });
  }

  /**
   * Resets 24-hour TTL and schedules alarm
   */
  private async resetTTL(): Promise<void> {
    if (this.room) {
      this.room.lastActivity = Date.now();
    }
    // Schedule cleanup alarm 24 hours from now
    await this.ctx.storage.setAlarm(Date.now() + 24 * 3600 * 1000);
  }

  /**
   * Persists current room state into DO storage
   */
  private async saveState(): Promise<void> {
    if (this.room) {
      await this.ctx.storage.put('room', this.room);
    }
  }

  /**
   * Reads attachment from WebSocket or fallback memory map
   */
  private getAttachment(ws: WebSocket): WsAttachment {
    const cfWs = ws as any;
    if (typeof cfWs.deserializeAttachment === 'function') {
      const att = cfWs.deserializeAttachment();
      if (att) return att;
    }
    return this.wsAttachments.get(ws) || {};
  }

  /**
   * Stores attachment to WebSocket and fallback memory map
   */
  private setAttachment(ws: WebSocket, att: WsAttachment): void {
    this.wsAttachments.set(ws, att);
    const cfWs = ws as any;
    if (typeof cfWs.serializeAttachment === 'function') {
      cfWs.serializeAttachment(att);
    }
  }

  /**
   * Helper to construct participant view
   */
  private getParticipantView(participantId: string) {
    if (!this.room) return null;
    const participant = this.room.participants[participantId];
    let assignedGroup: GroupResult | undefined;
    let teammates: Participant[] | undefined;

    if (this.room.status === 'REVEALED' && this.room.optimizationResult) {
      assignedGroup = this.room.optimizationResult.groups.find((g) =>
        g.memberIds.includes(participantId)
      );
      if (assignedGroup) {
        teammates = assignedGroup.members.filter((m) => m.id !== participantId);
      }
    }

    return {
      roomCode: this.room.roomCode,
      status: this.room.status,
      participantCount: Object.keys(this.room.participants).length,
      settings: this.room.settings,
      participant,
      assignedGroup,
      teammates,
    };
  }

  /**
   * Helper to construct host view
   */
  private getHostView() {
    if (!this.room) return null;
    return {
      roomCode: this.room.roomCode,
      status: this.room.status,
      participantCount: Object.keys(this.room.participants).length,
      participants: this.room.participants,
      settings: this.room.settings,
      result: this.room.optimizationResult,
    };
  }

  /**
   * Helper to construct general public view
   */
  private getGeneralView() {
    if (!this.room) return null;
    return {
      roomCode: this.room.roomCode,
      status: this.room.status,
      participantCount: Object.keys(this.room.participants).length,
      settings: this.room.settings,
    };
  }

  /**
   * Broadcast message to connected hibernated WebSockets
   */
  public broadcast(message: unknown, filter?: (ws: WebSocket) => boolean): void {
    const text = typeof message === 'string' ? message : JSON.stringify(message);
    const sockets = this.ctx.getWebSockets();
    for (const ws of sockets) {
      if (!filter || filter(ws)) {
        try {
          ws.send(text);
        } catch {
          // ignore closed / failing sockets
        }
      }
    }
  }

  /**
   * Broadcasts grouping result with personalized view for participants
   */
  public broadcastGroupingResult(): void {
    if (!this.room || !this.room.optimizationResult) return;
    const sockets = this.ctx.getWebSockets();

    for (const ws of sockets) {
      const att = this.getAttachment(ws);
      if (att.participantId && this.room.participants[att.participantId]) {
        const pView = this.getParticipantView(att.participantId);
        try {
          ws.send(
            JSON.stringify({
              type: 'GROUPING_RESULT',
              status: 'REVEALED',
              result: this.room.optimizationResult,
              assignedGroup: pView?.assignedGroup,
              teammates: pView?.teammates,
            })
          );
        } catch {}
      } else {
        try {
          ws.send(
            JSON.stringify({
              type: 'GROUPING_RESULT',
              status: 'REVEALED',
              result: this.room.optimizationResult,
            })
          );
        } catch {}
      }
    }
  }

  /**
   * Alarm handler for 24h TTL cleanup
   */
  async alarm(): Promise<void> {
    await this.ctx.storage.deleteAll();
    const sockets = this.ctx.getWebSockets();
    for (const ws of sockets) {
      try {
        ws.close(1000, 'Room expired');
      } catch {}
    }
    this.room = null;
    this.wsAttachments.clear();
  }

  /**
   * HTTP request router and WebSocket upgrade handler
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Handle WebSocket upgrade
    const upgradeHeader = request.headers.get('Upgrade');
    if (upgradeHeader === 'websocket' || path.endsWith('/ws')) {
      if (!this.room) {
        return new Response(JSON.stringify({ error: 'ROOM_NOT_FOUND' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const WebSocketPairClass = (globalThis as any).WebSocketPair;
      if (!WebSocketPairClass) {
        return new Response('WebSocketPair is not supported in this runtime', { status: 500 });
      }

      const pair = new WebSocketPairClass();
      const [client, server] = [pair[0], pair[1]];
      server.doInstance = this;

      const participantId = url.searchParams.get('participantId') || undefined;
      const hostSecret = url.searchParams.get('hostSecret') || undefined;
      const isHost = Boolean(hostSecret && hostSecret === this.room.hostSecret);

      this.ctx.acceptWebSocket(server, participantId ? [participantId] : []);
      this.setAttachment(server, { participantId, isHost });
      await this.resetTTL();

      // Send immediate initial room state
      if (participantId && this.room.participants[participantId]) {
        const pView = this.getParticipantView(participantId);
        server.send(JSON.stringify({ type: 'ROOM_STATE', ...pView }));
        if (this.room.status === 'REVEALED') {
          server.send(
            JSON.stringify({
              type: 'GROUPING_RESULT',
              status: 'REVEALED',
              result: this.room.optimizationResult,
              assignedGroup: pView?.assignedGroup,
              teammates: pView?.teammates,
            })
          );
        }
      } else if (isHost) {
        server.send(JSON.stringify({ type: 'ROOM_STATE', ...this.getHostView() }));
      } else {
        server.send(JSON.stringify({ type: 'ROOM_STATE', ...this.getGeneralView() }));
      }

      try {
        return new Response(null, { status: 101, webSocket: client } as any);
      } catch {
        const res = new Response(null, { status: 200 });
        Object.defineProperty(res, 'status', { value: 101 });
        (res as any).webSocket = client;
        return res;
      }
    }

    // REST: Initialize Room
    if (path.endsWith('/init') && request.method === 'POST') {
      const body = (await request.json()) as {
        roomCode: string;
        hostSecret: string;
        settings?: HostSettings;
      };
      this.room = {
        roomCode: body.roomCode.toUpperCase(),
        hostSecret: body.hostSecret,
        status: 'WAITING',
        settings: body.settings ?? DEFAULT_HOST_SETTINGS,
        participants: {},
        optimizationResult: null,
        lastActivity: Date.now(),
      };
      await this.saveState();
      await this.resetTTL();

      return new Response(
        JSON.stringify({ success: true, roomCode: this.room.roomCode }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // If room is not initialized for other REST endpoints
    if (!this.room) {
      return new Response(JSON.stringify({ error: 'ROOM_NOT_FOUND' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    await this.resetTTL();

    // REST: Query Room State
    if (path.endsWith('/state') && request.method === 'GET') {
      const participantId = url.searchParams.get('participantId');
      const hostSecret =
        url.searchParams.get('hostSecret') ||
        request.headers.get('Authorization')?.replace('Bearer ', '');

      if (hostSecret === this.room.hostSecret) {
        return new Response(JSON.stringify(this.getHostView()), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (participantId && this.room.participants[participantId]) {
        return new Response(JSON.stringify(this.getParticipantView(participantId)), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify(this.getGeneralView()), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // REST: Join Room
    if (path.endsWith('/join') && request.method === 'POST') {
      if (this.room.status !== 'WAITING') {
        return new Response(
          JSON.stringify({ error: 'ROOM_ALREADY_STARTED', message: 'Grouping already in progress' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const body = (await request.json()) as any;
      const rawParticipant = body.participant || body;
      const id = rawParticipant.id || crypto.randomUUID();

      const newParticipant: Participant = {
        id,
        name: rawParticipant.name,
        gender: rawParticipant.gender || 'unspecified',
        capabilities: rawParticipant.capabilities || [],
        musicPreferences: rawParticipant.musicPreferences || [],
        joinedAt: rawParticipant.joinedAt || Date.now(),
      };

      this.room.participants[id] = newParticipant;
      await this.saveState();

      this.broadcast({
        type: 'PARTICIPANT_JOINED',
        participant: newParticipant,
        participantCount: Object.keys(this.room.participants).length,
      });

      return new Response(
        JSON.stringify({
          success: true,
          participantId: id,
          participant: newParticipant,
          state: this.getParticipantView(id),
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // REST: Update Settings (Host only)
    if (path.endsWith('/settings') && request.method === 'POST') {
      const body = (await request.json()) as any;
      const authHeader = request.headers.get('Authorization');
      const hostSecret = authHeader ? authHeader.replace('Bearer ', '') : body.hostSecret;

      if (!hostSecret || hostSecret !== this.room.hostSecret) {
        return new Response(
          JSON.stringify({ error: 'UNAUTHORIZED', code: 'UNAUTHORIZED', message: 'Invalid host secret' }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (body.settings) {
        this.room.settings = { ...this.room.settings, ...body.settings };
        await this.saveState();
        this.broadcast({ type: 'ROOM_STATE', ...this.getGeneralView() });
      }

      return new Response(
        JSON.stringify({ success: true, settings: this.room.settings }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // REST: Start Grouping (Host only)
    if (path.endsWith('/start') && request.method === 'POST') {
      let body: any = {};
      try {
        body = await request.json();
      } catch {}

      const authHeader = request.headers.get('Authorization');
      const hostSecret = authHeader ? authHeader.replace('Bearer ', '') : body.hostSecret;

      if (!hostSecret || hostSecret !== this.room.hostSecret) {
        return new Response(
          JSON.stringify({ error: 'UNAUTHORIZED', code: 'UNAUTHORIZED', message: 'Invalid host secret' }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (this.room.status === 'OPTIMIZING') {
        return new Response(
          JSON.stringify({ error: 'ALREADY_OPTIMIZING', message: 'Grouping is currently optimizing' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      this.room.status = 'OPTIMIZING';
      this.broadcast({ type: 'GROUPING_STARTED', status: 'OPTIMIZING' });

      // Run optimization algorithm
      const participantList = Object.values(this.room.participants);
      const result = optimizeGrouping(participantList, this.room.settings);

      this.room.optimizationResult = result;
      this.room.status = 'REVEALED';
      await this.saveState();

      // Broadcast results
      this.broadcastGroupingResult();

      return new Response(
        JSON.stringify({ success: true, status: 'REVEALED', result }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response('Not Found', { status: 404 });
  }

  /**
   * WebSocket message handler (Hibernation API)
   */
  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (!this.room) {
      ws.send(JSON.stringify({ type: 'ERROR', code: 'ROOM_NOT_FOUND', message: 'Room not found' }));
      return;
    }

    await this.resetTTL();

    const text = typeof message === 'string' ? message : new TextDecoder().decode(message);
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      ws.send(JSON.stringify({ type: 'ERROR', code: 'INVALID_JSON', message: 'Malformed JSON payload' }));
      return;
    }

    const att = this.getAttachment(ws);

    switch (data.type) {
      case 'PING': {
        ws.send(JSON.stringify({ type: 'PONG' }));
        break;
      }

      case 'JOIN_ROOM': {
        const rawParticipant = data.participant || {};
        const participantId = data.participantId || rawParticipant.id;

        // Reconnection check
        if (participantId && this.room.participants[participantId]) {
          this.setAttachment(ws, { ...att, participantId });
          const pView = this.getParticipantView(participantId);
          ws.send(JSON.stringify({ type: 'ROOM_STATE', ...pView }));
          if (this.room.status === 'REVEALED') {
            ws.send(
              JSON.stringify({
                type: 'GROUPING_RESULT',
                status: 'REVEALED',
                result: this.room.optimizationResult,
                assignedGroup: pView?.assignedGroup,
                teammates: pView?.teammates,
              })
            );
          }
          return;
        }

        if (this.room.status !== 'WAITING') {
          ws.send(
            JSON.stringify({
              type: 'ERROR',
              code: 'ROOM_ALREADY_STARTED',
              message: 'Grouping already in progress or completed',
            })
          );
          return;
        }

        const id = participantId || crypto.randomUUID();
        const newParticipant: Participant = {
          id,
          name: rawParticipant.name || '社團學員',
          gender: rawParticipant.gender || 'unspecified',
          capabilities: (rawParticipant.capabilities as Role[]) || [],
          musicPreferences: rawParticipant.musicPreferences || [],
          joinedAt: rawParticipant.joinedAt || Date.now(),
        };

        this.room.participants[id] = newParticipant;
        await this.saveState();
        this.setAttachment(ws, { ...att, participantId: id });

        ws.send(
          JSON.stringify({
            type: 'JOINED_SUCCESS',
            participantId: id,
            participant: newParticipant,
          })
        );
        ws.send(JSON.stringify({ type: 'ROOM_STATE', ...this.getParticipantView(id) }));

        this.broadcast(
          {
            type: 'PARTICIPANT_JOINED',
            participant: newParticipant,
            participantCount: Object.keys(this.room.participants).length,
          },
          (client) => client !== ws
        );
        break;
      }

      case 'HOST_UPDATE_SETTINGS': {
        const isHost =
          att.isHost || (data.hostSecret && data.hostSecret === this.room.hostSecret);

        if (!isHost) {
          ws.send(
            JSON.stringify({
              type: 'ERROR',
              code: 'UNAUTHORIZED',
              message: 'Invalid or missing host secret',
            })
          );
          return;
        }

        if (data.settings) {
          this.room.settings = { ...this.room.settings, ...data.settings };
          await this.saveState();
          this.broadcast({ type: 'ROOM_STATE', ...this.getGeneralView() });
        }
        break;
      }

      case 'HOST_START_GROUPING': {
        const isHost =
          att.isHost || (data.hostSecret && data.hostSecret === this.room.hostSecret);

        if (!isHost) {
          ws.send(
            JSON.stringify({
              type: 'ERROR',
              code: 'UNAUTHORIZED',
              message: 'Invalid or missing host secret',
            })
          );
          return;
        }

        if (this.room.status !== 'WAITING') {
          ws.send(
            JSON.stringify({
              type: 'ERROR',
              code: 'ALREADY_OPTIMIZING',
              message: 'Grouping already in progress or completed',
            })
          );
          return;
        }

        this.room.status = 'OPTIMIZING';
        this.broadcast({ type: 'GROUPING_STARTED', status: 'OPTIMIZING' });

        const participantList = Object.values(this.room.participants);
        const result = optimizeGrouping(participantList, this.room.settings);

        this.room.optimizationResult = result;
        this.room.status = 'REVEALED';
        await this.saveState();

        this.broadcastGroupingResult();
        break;
      }

      default: {
        ws.send(
          JSON.stringify({
            type: 'ERROR',
            code: 'UNKNOWN_MESSAGE_TYPE',
            message: `Unsupported message type: ${data.type}`,
          })
        );
      }
    }
  }

  /**
   * WebSocket close handler
   */
  async webSocketClose(ws: WebSocket, _code: number, _reason: string, _wasClean: boolean): Promise<void> {
    this.wsAttachments.delete(ws);
  }

  /**
   * WebSocket error handler
   */
  async webSocketError(ws: WebSocket, _error: unknown): Promise<void> {
    this.wsAttachments.delete(ws);
  }
}
