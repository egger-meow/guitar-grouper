import { RoomDO } from './room-do';

export interface Env {
  ROOM_DO: DurableObjectNamespace;
  ASSETS?: Fetcher;
}

/**
 * Generates random 4-letter uppercase room code
 */
function generateRoomCode(): string {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += letters.charAt(Math.floor(Math.random() * letters.length));
  }
  return code;
}

/**
 * Generates secure random host secret
 */
function generateHostSecret(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Health check endpoint
    if (path === '/api/health') {
      return new Response(JSON.stringify({ status: 'ok' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Room Creation endpoint
    if (path === '/api/room/create' && request.method === 'POST') {
      let customCode: string | undefined;
      try {
        const body = (await request.json()) as any;
        if (body?.roomCode && typeof body.roomCode === 'string' && body.roomCode.length === 4) {
          customCode = body.roomCode.toUpperCase();
        }
      } catch {}

      const roomCode = customCode || generateRoomCode();
      const hostSecret = generateHostSecret();

      const id = env.ROOM_DO.idFromName(roomCode);
      const stub = env.ROOM_DO.get(id);

      const initRes = await stub.fetch(
        new Request('http://localhost/init', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomCode, hostSecret }),
        })
      );

      if (!initRes.ok) {
        return new Response(
          JSON.stringify({ error: 'FAILED_TO_INIT_ROOM' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ roomCode, hostSecret }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Room DO routing: /api/room/:code/...
    const roomMatch = path.match(/^\/api\/room\/([A-Za-z0-9]{4})(?:\/(.*))?$/);
    if (roomMatch) {
      const code = roomMatch[1].toUpperCase();
      const subpath = roomMatch[2] ? `/${roomMatch[2]}` : '/state';
      const id = env.ROOM_DO.idFromName(code);
      const stub = env.ROOM_DO.get(id);

      const doUrl = new URL(request.url);
      doUrl.pathname = subpath;

      return stub.fetch(new Request(doUrl.toString(), request));
    }

    // Static asset fallback for SPA
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response('Not Found', { status: 404 });
  },
};

export { RoomDO };
