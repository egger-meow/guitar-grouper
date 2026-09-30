// @vitest-environment happy-dom
import React from 'react';
import { it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { HostView } from '../../src/components/HostView';
import { DEFAULT_HOST_SETTINGS } from '../../src/engine/taxonomy';

afterEach(cleanup);
it('updates the host size preference and its weight through the settings callback', () => {
  const update = vi.fn();
  const props = { roomCode: 'TEST', hostSecret: 'secret', participantCount: 24, participants: {}, settings: DEFAULT_HOST_SETTINGS, status: 'WAITING' as const, onStartGrouping: vi.fn(), onUpdateSettings: update };
  const { rerender } = render(<HostView {...props} />);
  expect(screen.getByRole('button', { name: '都可以' }).getAttribute('aria-pressed')).toBe('true');
  fireEvent.click(screen.getByRole('button', { name: '人少一點' }));
  expect(update).toHaveBeenCalledWith({ groupSizePreference: 'smaller' });
  rerender(<HostView {...props} settings={{ ...DEFAULT_HOST_SETTINGS, groupSizePreference: 'smaller' }} />);
  fireEvent.change(screen.getByRole('slider', { name: '人數偏好權重' }), { target: { value: '75' } });
  expect(update).toHaveBeenCalledWith({ groupSizePreferenceWeight: .75 });
});

it('shows scarcity and role diagnostics in the host results', () => {
  render(<HostView roomCode="TEST" hostSecret="secret" participantCount={0} participants={{}} settings={DEFAULT_HOST_SETTINGS}
    status="REVEALED" onStartGrouping={vi.fn()} onUpdateSettings={vi.fn()}
    result={{ groups: [], warnings: ['至少有 1 組無法配置木箱鼓'], diagnostics: { avgRoleCoverage: 0, minRoleSatisfactionPct: 0, avgMusicScore: 0, worstGroupMusicScore: 0, diversityScore: 0, talentWasteIndex: 0, totalScore: 0, notesZh: ['配置評分採實際分工'] } }} />);
  expect(screen.getByText(/至少有 1 組/)).toBeTruthy();
  expect(screen.getByText('配置評分採實際分工')).toBeTruthy();
});

it('exposes the return-to-waiting action on completed grouping', async () => {
  const reset = vi.fn().mockResolvedValue(undefined);
  render(<HostView roomCode="TEST" hostSecret="secret" participantCount={0} participants={{}} settings={DEFAULT_HOST_SETTINGS}
    status="REVEALED" onStartGrouping={vi.fn()} onUpdateSettings={vi.fn()} onResetGrouping={reset}
    result={{ groups: [], warnings: [], diagnostics: { avgRoleCoverage: 0, minRoleSatisfactionPct: 0, avgMusicScore: 0, worstGroupMusicScore: 0, diversityScore: 0, talentWasteIndex: 0, totalScore: 0, notesZh: [] } }} />);
  fireEvent.click(screen.getByRole('button', { name: '返回待分組（保留名單）' }));
  expect(reset).toHaveBeenCalledOnce();
});
