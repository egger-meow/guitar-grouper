// @vitest-environment happy-dom
import React from 'react';
import { it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { HostView } from '../../src/components/HostView';
import { DEFAULT_HOST_SETTINGS } from '../../src/engine/taxonomy';
import { normalizeHostSettings } from '../../src/engine/settings';
import type { HostSettings } from '../../src/types/domain';

it('preserves the other sliders after server normalization and repeated changes', () => {
  const update = vi.fn();
  const props = { roomCode: 'TEST', hostSecret: 'secret', participantCount: 0, participants: {}, status: 'WAITING' as const, onStartGrouping: vi.fn(), onUpdateSettings: update };
  let settings: HostSettings = { ...DEFAULT_HOST_SETTINGS, preset: 'custom', weights: { role: .4, music: .35, diversity: .25 } };
  const { rerender } = render(<HostView {...props} settings={settings} />);
  fireEvent.change(screen.getByLabelText('樂器配置權重'), { target: { value: '80' } });
  settings = normalizeHostSettings({ ...settings, ...update.mock.calls.at(-1)![0] });
  expect(settings.weights.role).toBeCloseTo(.8 / 1.4);
  rerender(<HostView {...props} settings={settings} />);
  expect((screen.getByLabelText('曲風品味權重') as HTMLInputElement).value).toBe('35');
  expect((screen.getByLabelText('性別多元權重') as HTMLInputElement).value).toBe('25');
  fireEvent.change(screen.getByLabelText('曲風品味權重'), { target: { value: '60' } });
  settings = normalizeHostSettings({ ...settings, ...update.mock.calls.at(-1)![0] });
  rerender(<HostView {...props} settings={settings} />);
  expect((screen.getByLabelText('樂器配置權重') as HTMLInputElement).value).toBe('80');
  expect((screen.getByLabelText('性別多元權重') as HTMLInputElement).value).toBe('25');
  expect(settings.weights.role + settings.weights.music + settings.weights.diversity).toBeCloseTo(1);
  expect(normalizeHostSettings({ ...settings, weightRatios: { role: 0, music: 0, diversity: 0 } }).weights).toEqual(DEFAULT_HOST_SETTINGS.weights);
});

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
