import { it, expect } from 'vitest';
import { RoomDO } from '../../workers/room-do';
import { MockDurableObjectState, MockWebSocketPair } from './test-harness';

(globalThis as any).WebSocketPair = MockWebSocketPair;

async function fixture() {
  const state = new MockDurableObjectState();
  const room = new RoomDO(state as any, {});
  const call = (path: string, body: unknown = {}, secret = 'host') => room.fetch(new Request(`http://localhost/${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` }, body: JSON.stringify(body),
  }));
  await call('init', { roomCode: 'TEST', hostSecret: 'host' });
  const people = [];
  for (let i = 0; i < 6; i++) people.push((await (await call('join', { name: `Fixture ${i}`, capabilities: ['acoustic_guitar'], musicPreferences: ['any_genre'] })).json() as any).participant);
  const host = async () => await (await room.fetch(new Request('http://localhost/state?hostSecret=host'))).json() as any;
  const participant = async (id: string) => await (await room.fetch(new Request(`http://localhost/state?participantId=${id}`))).json() as any;
  await call('start');
  return { room, state, call, host, participant, people };
}

it('keeps drafts private over REST, WebSocket and restart; preserves the published snapshot until republished', async () => {
  const { room, state, call, host, participant, people } = await fixture();
  let h = await host();
  expect(h.status).toBe('DRAFT');
  expect((await participant(people[0].id)).assignedGroup).toBeNull();
  const ws = (await room.fetch(new Request(`http://localhost/ws?participantId=${people[0].id}`, { headers: { Upgrade: 'websocket' } })) as any).webSocket;
  const guest = (await room.fetch(new Request('http://localhost/ws', { headers: { Upgrade: 'websocket' } })) as any).webSocket;
  expect(ws.receivedMessages.map((m: string) => JSON.parse(m)).some((m: any) => m.result)).toBe(false);
  expect((await call('publish', { revision: h.draftRevision }, 'wrong')).status).toBe(401);
  expect((await call('publish', { revision: h.draftRevision })).status).toBe(200);
  const old = await participant(people[0].id);
  const current = h.result.groups.find((g: any) => g.memberIds.includes(people[0].id));
  const target = h.result.groups.find((g: any) => g.id !== current.id);
  expect((await call('move', { revision: h.draftRevision, participantId: people[0].id, groupId: target.id })).status).toBe(200);
  expect((await participant(people[0].id)).assignedGroup).toEqual(old.assignedGroup);
  expect((await call('publish', { revision: h.draftRevision })).status).toBe(409);
  h = await host();
  const restarted = new RoomDO(state as any, {});
  await state.blockConcurrencyWhile(async () => {});
  const recovered = await (await restarted.fetch(new Request('http://localhost/state?hostSecret=host'))).json() as any;
  expect(recovered.result).toEqual(h.result);
  expect(recovered.publishedResult).toEqual(h.publishedResult);
  await call('publish', { revision: h.draftRevision });
  expect((await participant(people[0].id)).assignedGroup.id).toBe(target.id);
  for (const client of [ws, guest]) expect(client.receivedMessages.map((m: string) => JSON.parse(m)).every((m: any) => !('result' in m) && !('publishedResult' in m))).toBe(true);
});

it('accepts late joins through REST and WebSocket, fills only empty seats, enforces capacity and supports undo and partial publication', async () => {
  const { room, call, host, participant } = await fixture();
  let h = await host();
  await call('publish', { revision: h.draftRevision });
  const late = (await (await call('join', { name: 'Late fixture', capabilities: ['cajon'], musicPreferences: ['any_genre'] })).json() as any).participant;
  expect((await participant(late.id)).assignedGroup).toBeNull();
  const before = h.result.groups.map((g: any) => [...g.memberIds]);
  h = await host();
  await call('fill', { revision: h.draftRevision });
  h = await host();
  h.result.groups.forEach((g: any, i: number) => before[i].forEach((id: string) => expect(g.memberIds).toContain(id)));
  expect(h.result.groups.flatMap((g: any) => g.memberIds)).toContain(late.id);
  expect((await participant(late.id)).assignedGroup).toBeNull();
  await call('undo', { revision: h.draftRevision });
  h = await host();
  expect(h.result.groups.flatMap((g: any) => g.memberIds)).not.toContain(late.id);
  await call('publish', { revision: h.draftRevision });
  expect((await participant(late.id)).assignedGroup).toBeNull();
  const wsRes = await room.fetch(new Request('http://localhost/ws', { headers: { Upgrade: 'websocket' } }));
  const ws = (wsRes as any).webSocket;
  ws.send(JSON.stringify({ type: 'JOIN_ROOM', participant: { name: 'WS late fixture', capabilities: ['bass'] } }));
  await new Promise(resolve => setTimeout(resolve, 20));
  h = await host();
  expect(h.participantCount).toBe(8);
  const full = h.result.groups[0];
  await call('settings', { settings: { maxGroupSize: full.memberIds.length, minGroupSize: 2 } });
  h = await host();
  expect((await call('move', { revision: h.draftRevision, participantId: late.id, groupId: full.id })).status).toBe(400);
  expect((await host()).result.groups[0].memberIds).toEqual(full.memberIds);
  const revision = h.draftRevision;
  await call('fill', { revision });
  expect((await host()).draftRevision).toBe(revision);
  expect((await host()).result.groups.flatMap((g: any) => g.memberIds)).not.toContain(late.id);
  expect((await call('move', null)).status).toBe(400);
  expect((await call('move', { revision, participantId: '__proto__', groupId: null })).status).toBe(400);
});

it('clears a published assignment when moved to pending and republished; undo restores membership and recalculates scores', async () => {
  const { call, host, participant, people } = await fixture();
  let h = await host();
  await call('publish', { revision: h.draftRevision });
  const before = h.result;
  await call('move', { revision: h.draftRevision, participantId: people[0].id, groupId: null });
  h = await host();
  expect(h.result.groups.flatMap((g: any) => g.memberIds)).not.toContain(people[0].id);
  expect(h.result.diagnostics.notesZh[0]).toContain('1 人未分組');
  await call('publish', { revision: h.draftRevision });
  expect((await participant(people[0].id)).assignedGroup).toBeNull();
  expect((await participant(people[0].id)).teammates).toEqual([]);
  await call('undo', { revision: h.draftRevision });
  h = await host();
  expect(h.result.groups).toEqual(before.groups);
  expect(h.result.diagnostics.totalScore).toBe(before.diagnostics.totalScore);
});

it('rejects a publication from before reset, even after a new draft has been generated', async () => {
  const { call, host } = await fixture();
  const old = await host();
  await call('reset');
  await call('start');
  expect((await host()).draftRevision).toBeGreaterThan(old.draftRevision);
  expect((await call('publish', { revision: old.draftRevision })).status).toBe(409);
});

it('retains previously revealed rooms as published when loading the old storage format', async () => {
  const { state, call, host, people } = await fixture();
  const h = await host();
  await call('publish', { revision: h.draftRevision });
  const stored = await state.storage.get('room');
  delete stored.publishedResult;
  delete stored.draftRevision;
  delete stored.publishedRevision;
  await state.storage.put('room', stored);
  const migrated = new RoomDO(state as any, {});
  await state.blockConcurrencyWhile(async () => {});
  const member = await (await migrated.fetch(new Request(`http://localhost/state?participantId=${people[0].id}`))).json() as any;
  expect(member.status).toBe('REVEALED');
  expect(member.assignedGroup.memberIds).toContain(people[0].id);
  expect(member.result).toBeUndefined();
});
