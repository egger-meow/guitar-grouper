// @vitest-environment happy-dom
import React from 'react';
import { it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { GroupingBoard } from '../../src/components/GroupingBoard';
import { evaluateGrouping } from '../../src/engine/optimizer';
import { DEFAULT_HOST_SETTINGS } from '../../src/engine/taxonomy';
import type { Participant } from '../../src/types/domain';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const people: Participant[] = [0, 1, 2].map(i => ({ id: `p${i}`, name: `UI Fixture ${i}`, gender: 'unspecified', capabilities: ['acoustic_guitar'], musicPreferences: ['any_genre'], joinedAt: i }));
const result = evaluateGrouping([[people[0]], [people[1]]], DEFAULT_HOST_SETTINGS, people);
const participants = Object.fromEntries(people.map(p => [p.id, p]));
const props = { result, participants, settings: DEFAULT_HOST_SETTINGS, draftRevision: 1, publishedRevision: 0, publishedResult: null, canUndo: true };

it('moves between groups and pending by drag or mobile select without publishing; exposes undo', async () => {
  const onAction = vi.fn().mockResolvedValue(undefined);
  render(<GroupingBoard {...props} onAction={onAction} />);
  fireEvent.change(screen.getByLabelText('移動 UI Fixture 0'), { target: { value: 'group-2' } });
  await waitFor(() => expect(onAction).toHaveBeenCalledWith('move', { participantId: 'p0', groupId: 'group-2' }));
  await waitFor(() => expect((screen.getByLabelText('移動 UI Fixture 0') as unknown as HTMLSelectElement).disabled).toBe(false));
  const zone = screen.getByText('未分組（1 人）').parentElement!;
  fireEvent.drop(zone, { dataTransfer: { getData: () => 'p0' } });
  await waitFor(() => expect(onAction).toHaveBeenCalledWith('move', { participantId: 'p0', groupId: null }));
  await waitFor(() => expect((screen.getByRole('button', { name: '復原上一步' }) as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(screen.getByRole('button', { name: '復原上一步' }));
  await waitFor(() => expect(onAction).toHaveBeenCalledWith('undo', undefined));
  expect(onAction.mock.calls.some(([action]) => action === 'publish')).toBe(false);
});

it('requires explicit publication confirmation and explains pending members; reports errors without losing the draft', async () => {
  const onAction = vi.fn().mockRejectedValue(new Error('草稿已更新，請重新確認'));
  render(<GroupingBoard {...props} onAction={onAction} />);
  expect(screen.getByText('尚未發布')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '發布分組結果' }));
  expect(onAction).not.toHaveBeenCalled();
  expect(screen.getByRole('dialog')).toBeTruthy();
  expect(screen.getByText(/仍有 1 位成員未分組/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '確認發布' }));
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('草稿已更新'));
  expect(screen.getByLabelText('移動 UI Fixture 0')).toBeTruthy();
});

it('distinguishes unpublished edits from the version members see and disables publication when unchanged', () => {
  const { rerender } = render(<GroupingBoard {...props} publishedResult={result} publishedRevision={1} onAction={vi.fn()} />);
  expect((screen.getByRole('button', { name: '發布更新' }) as HTMLButtonElement).disabled).toBe(true);
  rerender(<GroupingBoard {...props} publishedResult={result} publishedRevision={1} draftRevision={2} onAction={vi.fn()} />);
  expect(screen.getByText('有未發布的修改')).toBeTruthy();
  expect(screen.getByText(/成員仍看到上次發布的結果/)).toBeTruthy();
});

it('handles pointer dragging with a movement threshold and leaves simple clicks unchanged', async () => {
  const onAction = vi.fn().mockResolvedValue(undefined);
  render(<GroupingBoard {...props} onAction={onAction} />);
  const source = screen.getByLabelText('移動 UI Fixture 0').parentElement!;
  const target = screen.getByText('第 2 組', { selector: 'h4' }).parentElement!.parentElement!;
  source.setPointerCapture = vi.fn();
  const original = document.elementFromPoint;
  document.elementFromPoint = vi.fn(() => target);
  try {
    fireEvent(source, new MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 100, clientY: 150 }));
    fireEvent(source, new MouseEvent('pointerup', { bubbles: true, button: 0, clientX: 100, clientY: 150 }));
    expect(onAction).not.toHaveBeenCalled();
    fireEvent(source, new MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 100, clientY: 150 }));
    fireEvent(source, new MouseEvent('pointermove', { bubbles: true, clientX: 300, clientY: 200 }));
    fireEvent(source, new MouseEvent('pointerup', { bubbles: true, button: 0, clientX: 300, clientY: 200 }));
    await waitFor(() => expect(onAction).toHaveBeenCalledWith('move', { participantId: 'p0', groupId: 'group-2' }));
  } finally { document.elementFromPoint = original; }
});
