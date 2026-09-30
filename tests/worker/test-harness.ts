import type { RoomDO } from '../../workers/room-do';

/**
 * Mock storage for Cloudflare Durable Objects
 */
export class MockStorage {
  private map = new Map<string, any>();
  private alarmTime: number | null = null;

  async get<T = any>(key: string): Promise<T | undefined> {
    const val = this.map.get(key);
    return val !== undefined ? JSON.parse(JSON.stringify(val)) : undefined;
  }

  async put<T = any>(key: string, value: T): Promise<void> {
    this.map.set(key, JSON.parse(JSON.stringify(value)));
  }

  async delete(key: string): Promise<boolean> {
    return this.map.delete(key);
  }

  async deleteAll(): Promise<void> {
    this.map.clear();
  }

  async setAlarm(time: number | Date): Promise<void> {
    this.alarmTime = typeof time === 'number' ? time : time.getTime();
  }

  async getAlarm(): Promise<number | null> {
    return this.alarmTime;
  }

  async deleteAlarm(): Promise<void> {
    this.alarmTime = null;
  }
}

/**
 * Mock WebSocket supporting Cloudflare Hibernation API and attachments
 */
export class MockWebSocket {
  public readyState: number = 1; // 1 = OPEN
  public attachment: any = null;
  public tags: string[] = [];
  public sentMessages: string[] = [];
  public receivedMessages: string[] = [];
  public onmessage: ((event: { data: string }) => void) | null = null;
  public onclose: ((event: { code: number; reason: string; wasClean: boolean }) => void) | null = null;
  public peer: MockWebSocket | null = null;
  public doInstance?: RoomDO;

  serializeAttachment(val: any): void {
    this.attachment = JSON.parse(JSON.stringify(val));
  }

  deserializeAttachment<T = any>(): T | null {
    return this.attachment ? JSON.parse(JSON.stringify(this.attachment)) : null;
  }

  send(data: string | ArrayBuffer): void {
    const text = typeof data === 'string' ? data : new TextDecoder().decode(data);
    this.sentMessages.push(text);

    if (this.peer) {
      this.peer.receivedMessages.push(text);
      if (this.peer.onmessage) {
        this.peer.onmessage({ data: text });
      }
      if (this.peer.doInstance) {
        // Hibernation API delivers to webSocketMessage
        Promise.resolve().then(() => {
          this.peer?.doInstance?.webSocketMessage?.(this.peer as any, text);
        });
      }
    }
  }

  close(code = 1000, reason = ''): void {
    this.readyState = 3; // CLOSED
    if (this.peer) {
      this.peer.readyState = 3;
      if (this.peer.onclose) {
        this.peer.onclose({ code, reason, wasClean: true });
      }
      if (this.peer.doInstance) {
        Promise.resolve().then(() => {
          this.peer?.doInstance?.webSocketClose?.(this.peer as any, code, reason, true);
        });
      }
    }
  }
}

/**
 * Mock WebSocketPair matching Cloudflare standard
 */
export class MockWebSocketPair {
  0: MockWebSocket;
  1: MockWebSocket;

  constructor() {
    const client = new MockWebSocket();
    const server = new MockWebSocket();
    client.peer = server;
    server.peer = client;
    this[0] = client;
    this[1] = server;
  }
}

/**
 * Mock DurableObjectState with Hibernation WebSocket support
 */
export class MockDurableObjectState {
  public storage = new MockStorage();
  public webSockets: MockWebSocket[] = [];

  acceptWebSocket(ws: MockWebSocket, tags: string[] = []): void {
    ws.tags = tags;
    if (!this.webSockets.includes(ws)) {
      this.webSockets.push(ws);
    }
  }

  getWebSockets(tag?: string): MockWebSocket[] {
    return this.webSockets.filter(
      (ws) => ws.readyState === 1 && (!tag || ws.tags.includes(tag))
    );
  }

  async blockConcurrencyWhile<T>(callback: () => Promise<T>): Promise<T> {
    return await callback();
  }
}

/**
 * Mock Durable Object namespace managing stubs
 */
export class MockDurableObjectNamespace {
  private instances = new Map<string, { state: MockDurableObjectState; do: RoomDO }>();
  private RoomDOClass: new (ctx: any, env: any) => RoomDO;
  private env: any;

  constructor(RoomDOClass: new (ctx: any, env: any) => RoomDO, env: any = {}) {
    this.RoomDOClass = RoomDOClass;
    this.env = env;
  }

  idFromName(name: string) {
    return { name, toString: () => name };
  }

  get(id: { name: string }) {
    let entry = this.instances.get(id.name);
    if (!entry) {
      const state = new MockDurableObjectState();
      const instance = new this.RoomDOClass(state as any, this.env);
      entry = { state, do: instance };
      this.instances.set(id.name, entry);
    }
    const currentEntry = entry;
    return {
      fetch: (req: Request) => currentEntry.do.fetch(req),
      getDOInstance: () => currentEntry.do,
      getState: () => currentEntry.state,
    };
  }

  getInstance(name: string) {
    return this.instances.get(name);
  }
}
