// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { App } from '../../src/App';
import { HostView } from '../../src/components/HostView';
import { ParticipantView } from '../../src/components/ParticipantView';
import { ResultsView } from '../../src/components/ResultsView';
import { QRCodeDisplay } from '../../src/components/QRCodeDisplay';
import type { Participant, GroupResult, HostSettings } from '../../src/types/domain';
import { DEFAULT_HOST_SETTINGS } from '../../src/engine/taxonomy';

describe('Task 7: Modern Kahoot-Style UI Suite', () => {
  beforeEach(() => {
    sessionStorage.clear();
    window.history.pushState({}, '', '/');
  });

  afterEach(() => {
    cleanup();
  });

  describe('1. Home Screen', () => {
    it('renders branding, create room button, and join code input', () => {
      render(<App />);

      // Branding
      expect(screen.getAllByText(/吉他社分組神器/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Guitar Group/i).length).toBeGreaterThan(0);

      // Create room CTA
      expect(screen.getByRole('button', { name: /建立分組房間/i })).toBeTruthy();

      // Join room section
      expect(screen.getByText(/輸入代碼加入/i)).toBeTruthy();
      expect(screen.getByPlaceholderText(/請輸入 4 位英文房間代碼/i)).toBeTruthy();
      expect(screen.getByRole('button', { name: /進入房間/i })).toBeTruthy();
    });
  });

  describe('2. Host Screen', () => {
    const mockSettings: HostSettings = {
      ...DEFAULT_HOST_SETTINGS,
      preset: 'balanced',
    };

    const mockParticipants: Record<string, Participant> = {
      p1: {
        id: 'p1',
        name: '小明',
        gender: 'male',
        capabilities: ['acoustic_guitar', 'lead_vocal'],
        musicPreferences: ['mandopop_ballad', 'jay_chou'],
        joinedAt: Date.now(),
      },
      p2: {
        id: 'p2',
        name: '小華',
        gender: 'female',
        capabilities: ['cajon'],
        musicPreferences: ['indie_rock', 'accusefive'],
        joinedAt: Date.now() + 100,
      },
    };

    it('displays room code, QR toggle, participant counter, preset buttons, and start grouping action', () => {
      const onStartGrouping = vi.fn();
      const onUpdateSettings = vi.fn();

      render(
        <HostView
          roomCode="ROCK"
          hostSecret="secret123"
          participantCount={2}
          participants={mockParticipants}
          settings={mockSettings}
          status="WAITING"
          onStartGrouping={onStartGrouping}
          onUpdateSettings={onUpdateSettings}
        />
      );

      // Room code displayed prominently
      expect(screen.getByText('ROCK')).toBeTruthy();

      // QR Code toggle
      expect(screen.getByRole('button', { name: /QR Code/i })).toBeTruthy();

      // Participant counter
      expect(screen.getByText(/已加入人數/i)).toBeTruthy();
      expect(screen.getAllByText(/2/).length).toBeGreaterThan(0);

      // Live participant chips
      expect(screen.getByText('小明')).toBeTruthy();
      expect(screen.getByText('小華')).toBeTruthy();

      // Presets
      expect(screen.getByRole('button', { name: /曲風優先/i })).toBeTruthy();
      expect(screen.getByRole('button', { name: /樂器配置優先/i })).toBeTruthy();
      expect(screen.getByRole('button', { name: /均衡模式|平衡/i })).toBeTruthy();

      // Start Grouping button
      const startBtn = screen.getByRole('button', { name: /開始分組/i });
      expect(startBtn).toBeTruthy();
      expect(startBtn.hasAttribute('disabled')).toBe(false);

      fireEvent.click(startBtn);
      expect(onStartGrouping).toHaveBeenCalledTimes(1);
    });

    it('disables start grouping button when participant count is less than 2', () => {
      render(
        <HostView
          roomCode="JAZZ"
          hostSecret="secret123"
          participantCount={1}
          participants={{
            p1: mockParticipants.p1,
          }}
          settings={mockSettings}
          status="WAITING"
          onStartGrouping={vi.fn()}
          onUpdateSettings={vi.fn()}
        />
      );

      const startBtn = screen.getByRole('button', { name: /開始分組/i });
      expect(startBtn.hasAttribute('disabled')).toBe(true);
      expect(screen.getByText(/至少需要 2 位成員/i)).toBeTruthy();
    });
  });

  describe('3. Participant Form', () => {
    it('allows entering nickname, selecting gender/category, multi-selecting instruments, and selecting music styles & artists', () => {
      const onSubmit = vi.fn();

      render(
        <ParticipantView
          roomCode="BAND"
          participant={null}
          status="WAITING"
          onSubmit={onSubmit}
        />
      );

      // Nickname input
      const nameInput = screen.getByPlaceholderText(/你的暱稱|輸入姓名/i);
      fireEvent.change(nameInput, { target: { value: '阿杰' } });

      // Gender selection
      const genderBtn = screen.getByRole('button', { name: /男生|男性/i });
      fireEvent.click(genderBtn);

      // Instrument pills (multi-select)
      const guitarPill = screen.getByRole('button', { name: /木吉他/i });
      const vocalPill = screen.getByRole('button', { name: /主唱/i });
      fireEvent.click(guitarPill);
      fireEvent.click(vocalPill);

      // Music style / artist pills (multi-select)
      const jayChouPill = screen.getByRole('button', { name: /周杰倫/i });
      const accusefivePill = screen.getByRole('button', { name: /告五人/i });
      fireEvent.click(jayChouPill);
      fireEvent.click(accusefivePill);

      // Submit form
      const submitBtn = screen.getByRole('button', { name: /加入房間|立即加入/i });
      fireEvent.click(submitBtn);

      expect(onSubmit).toHaveBeenCalledTimes(1);
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          name: '阿杰',
          capabilities: expect.arrayContaining(['acoustic_guitar', 'lead_vocal']),
          musicPreferences: expect.arrayContaining(['jay_chou', 'accusefive']),
        })
      );
    });

    it('shows animated rhythm pulse waiting screen when already joined', () => {
      const joinedUser: Participant = {
        id: 'p99',
        name: '安安',
        gender: 'female',
        capabilities: ['keyboard'],
        musicPreferences: ['jpop_anime_jrock', 'yorushika'],
        joinedAt: Date.now(),
      };

      render(
        <ParticipantView
          roomCode="BAND"
          participant={joinedUser}
          status="WAITING"
          onSubmit={vi.fn()}
        />
      );

      expect(screen.getByText(/等待主辦人開始分組/i)).toBeTruthy();
      expect(screen.getByText('安安')).toBeTruthy();
      expect(screen.getByText(/鍵盤/i)).toBeTruthy();
    });
  });

  describe('4. Results Screen (Teammate Details)', () => {
    const mockCurrentParticipant: Participant = {
      id: 'p1',
      name: '王小明',
      gender: 'male',
      capabilities: ['acoustic_guitar', 'lead_vocal'],
      musicPreferences: ['jay_chou', 'accusefive'],
      joinedAt: Date.now(),
    };

    const mockTeammates: Participant[] = [
      {
        id: 'p2',
        name: '李小美',
        gender: 'female',
        capabilities: ['lead_vocal'],
        musicPreferences: ['yorushika', 'keshi'],
        joinedAt: Date.now() + 1,
      },
      {
        id: 'p3',
        name: '陳大同',
        gender: 'male',
        capabilities: ['cajon'],
        musicPreferences: ['bai_xiaobai', 'lb_libi'],
        joinedAt: Date.now() + 2,
      },
    ];

    const mockAssignedGroup: GroupResult = {
      id: 'g-1',
      name: '第 1 組',
      memberIds: ['p1', 'p2', 'p3'],
      members: [mockCurrentParticipant, ...mockTeammates],
      consensusTags: ['流行抒情', '日語動漫'],
      roleCoverage: [
        { role: 'lead_vocal', coveredBy: ['p1', 'p2'] },
        { role: 'acoustic_guitar', coveredBy: ['p1'] },
        { role: 'cajon', coveredBy: ['p3'] },
      ],
      musicScore: 88,
      roleScore: 92,
      diagnosticsZh: ['雙主唱高音互補', '木吉他加木箱鼓節奏完整'],
    };

    it('displays "你在 第 X 組！" and renders teammate cards with capabilities and music preferences', () => {
      render(
        <ResultsView
          assignedGroup={mockAssignedGroup}
          currentParticipantId={mockCurrentParticipant.id}
          isHost={false}
        />
      );

      // Check "你在 第 1 組！"
      expect(screen.getByText(/你在 第 1 組！/i)).toBeTruthy();

      // Check current participant card
      expect(screen.getByText(/王小明/)).toBeTruthy();
      expect(screen.getAllByText(/木吉他/).length).toBeGreaterThan(0);
      expect(screen.getByText(/周杰倫/)).toBeTruthy();

      // Check teammate李小美: vocal, yorushika, keshi
      expect(screen.getByText(/李小美/)).toBeTruthy();
      expect(screen.getByText(/Yorushika|ヨルシカ/i)).toBeTruthy();
      expect(screen.getByText(/keshi/i)).toBeTruthy();

      // Check teammate陳大同: cajon, 白小白, LB利比
      expect(screen.getByText(/陳大同/)).toBeTruthy();
      expect(screen.getAllByText(/木箱鼓/).length).toBeGreaterThan(0);
      expect(screen.getByText(/白小白/)).toBeTruthy();
      expect(screen.getByText(/LB利比/)).toBeTruthy();

      // Group consensus style and vibe suggestions
      expect(screen.getByText(/流行抒情/)).toBeTruthy();
      expect(screen.getByText(/雙主唱高音互補/)).toBeTruthy();

      // Copy lineup button
      expect(screen.getByRole('button', { name: /複製本組名單|複製分組資訊/i })).toBeTruthy();
    });
  });

  describe('5. QRCodeDisplay Component', () => {
    it('renders direct scan URL and copy button', () => {
      render(<QRCodeDisplay roomCode="COOL" />);

      expect(screen.getByText(/guitar-grouper\.jjmowlab\.com\/\?room=COOL/i)).toBeTruthy();
      expect(screen.getByRole('button', { name: /複製連結/i })).toBeTruthy();
    });
  });
});
