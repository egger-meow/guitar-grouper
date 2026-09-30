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

    it('creates room via API and stores hostSecret into session and local storage', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ roomCode: 'TEST', hostSecret: 'secret_abc_123' }),
      });
      globalThis.fetch = mockFetch;

      render(<App />);

      const createBtn = screen.getByRole('button', { name: /建立分組房間/i });
      fireEvent.click(createBtn);

      await new Promise((r) => setTimeout(r, 20));

      expect(mockFetch).toHaveBeenCalledWith('/api/room/create', { method: 'POST' });
      expect(sessionStorage.getItem('gg_host_secret_TEST')).toBe('secret_abc_123');
      expect(localStorage.getItem('gg_host_secret_TEST')).toBe('secret_abc_123');
      expect(window.location.search).toContain('room=TEST');
      expect(window.location.search).toContain('host=1');
      expect(window.location.search).toContain('secret=secret_abc_123');
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

      // Start Grouping button (available on desktop and mobile sticky bar)
      const startBtn = screen.getAllByRole('button', { name: /開始分組/i })[0];
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

      const startBtns = screen.getAllByRole('button', { name: /開始分組/i });
      expect(startBtns[0].hasAttribute('disabled')).toBe(true);
      expect(screen.getByText(/至少需要 2 位成員/i)).toBeTruthy();
    });

    it('renders unlock prompt when hostSecret is missing, and unlocks on submit', () => {
      const onUnlockHost = vi.fn();
      const onSwitchToParticipant = vi.fn();

      render(
        <HostView
          roomCode="PASS"
          hostSecret=""
          participantCount={0}
          participants={{}}
          settings={mockSettings}
          status="WAITING"
          onStartGrouping={vi.fn()}
          onUpdateSettings={vi.fn()}
          onUnlockHost={onUnlockHost}
          onSwitchToParticipant={onSwitchToParticipant}
        />
      );

      // Verify unlock prompt
      expect(screen.getByText(/主辦人身份驗證/i)).toBeTruthy();
      const secretInput = screen.getByPlaceholderText(/請輸入主辦人密鑰/i);
      expect(secretInput).toBeTruthy();

      fireEvent.change(secretInput, { target: { value: 'my_secret_token' } });
      const unlockBtn = screen.getByRole('button', { name: /解鎖主辦人控制台/i });
      fireEvent.click(unlockBtn);

      expect(onUnlockHost).toHaveBeenCalledWith('my_secret_token');

      // Verify switch to participant button
      const switchBtn = screen.getByText(/切換至社員填寫頁面/i);
      fireEvent.click(switchBtn);
      expect(onSwitchToParticipant).toHaveBeenCalledTimes(1);
    });

    it('renders copy host link button and verified badge when hostSecret is provided', () => {
      render(
        <HostView
          roomCode="PASS"
          hostSecret="valid_secret_xyz"
          participantCount={2}
          participants={mockParticipants}
          settings={mockSettings}
          status="WAITING"
          onStartGrouping={vi.fn()}
          onUpdateSettings={vi.fn()}
        />
      );

      expect(screen.getByText(/已授權/i)).toBeTruthy();
      expect(screen.getByRole('button', { name: /複製主辦連結/i })).toBeTruthy();
    });

    it('allows room leader to adjust group size range using dual-thumb slider', () => {
      const onUpdateSettings = vi.fn();

      render(
        <HostView
          roomCode="PASS"
          hostSecret="valid_secret_xyz"
          participantCount={12}
          participants={mockParticipants}
          settings={{
            ...mockSettings,
            minGroupSize: 3,
            maxGroupSize: 5,
            targetGroupSize: 4,
          }}
          status="WAITING"
          onStartGrouping={vi.fn()}
          onUpdateSettings={onUpdateSettings}
        />
      );

      // Check range header and badge
      expect(screen.getByText(/每組人數範圍/i)).toBeTruthy();
      expect(screen.getAllByText(/3 ~ 5 人/).length).toBeGreaterThanOrEqual(1);

      // Min and Max sliders
      const minSlider = screen.getByLabelText(/最少人數/i) as HTMLInputElement;
      const maxSlider = screen.getByLabelText(/最多人數/i) as HTMLInputElement;

      expect(minSlider).toBeTruthy();
      expect(maxSlider).toBeTruthy();
      expect(minSlider.value).toBe('3');
      expect(maxSlider.value).toBe('5');

      // Adjust min slider to 2
      fireEvent.change(minSlider, { target: { value: '2' } });
      expect(onUpdateSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          minGroupSize: 2,
          maxGroupSize: 5,
          targetGroupSize: 4,
        })
      );

      // Adjust max slider to 6
      fireEvent.change(maxSlider, { target: { value: '6' } });
      expect(onUpdateSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          minGroupSize: 3,
          maxGroupSize: 6,
          targetGroupSize: 5,
        })
      );

      // Dynamic projection badge displayed for 12 participants
      expect(screen.getByText(/目前/i)).toBeTruthy();
      expect(screen.getByText(/預計分成/i)).toBeTruthy();
    });

    it('renders and interacts with custom weights and role requirements panel', () => {
      const onUpdateSettings = vi.fn();

      render(
        <HostView
          roomCode="CUST"
          hostSecret="secret123"
          participantCount={8}
          participants={mockParticipants}
          settings={{
            ...mockSettings,
            preset: 'custom',
            weights: { role: 0.5, music: 0.3, diversity: 0.2 },
            desiredRoles: ['acoustic_guitar', 'lead_vocal'],
            minRequiredRolesCount: 1,
          }}
          status="WAITING"
          onStartGrouping={vi.fn()}
          onUpdateSettings={onUpdateSettings}
        />
      );

      // Verify custom configuration panel is rendered
      expect(screen.getByTestId('custom-weights-panel')).toBeTruthy();
      expect(screen.getByText(/自訂演算法權重與目標角色/i)).toBeTruthy();

      // Sliders exist with accessible labels
      const roleSlider = screen.getByLabelText(/樂器配置權重/i) as HTMLInputElement;
      const musicSlider = screen.getByLabelText(/曲風品味權重/i) as HTMLInputElement;
      const diversitySlider = screen.getByLabelText(/性別多元權重/i) as HTMLInputElement;

      expect(roleSlider.value).toBe('50');
      expect(musicSlider.value).toBe('30');
      expect(diversitySlider.value).toBe('20');

      // Adjust role slider
      fireEvent.change(roleSlider, { target: { value: '60' } });
      expect(onUpdateSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          preset: 'custom',
          weights: expect.objectContaining({ role: 0.6 }),
        })
      );

      // Toggle desired role (e.g. 貝斯)
      const bassBtn = screen.getByRole('button', { name: /貝斯/i });
      fireEvent.click(bassBtn);
      expect(onUpdateSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          preset: 'custom',
          desiredRoles: expect.arrayContaining(['acoustic_guitar', 'lead_vocal', 'bass']),
        })
      );

      // Change minimum required roles to 2
      const min2Btn = screen.getByRole('button', { name: /至少 2 項/i });
      fireEvent.click(min2Btn);
      expect(onUpdateSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          preset: 'custom',
          minRequiredRolesCount: 2,
        })
      );

      // Normalize weights
      const normalizeBtn = screen.getByRole('button', { name: /歸一化至 100%/i });
      fireEvent.click(normalizeBtn);
      expect(onUpdateSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          preset: 'custom',
          weights: expect.objectContaining({
            role: expect.any(Number),
            music: expect.any(Number),
            diversity: expect.any(Number),
          }),
        })
      );
    });

    it('opens manual add participant modal and submits new member', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, participantId: 'new_p' }),
      });
      globalThis.fetch = mockFetch;

      render(
        <HostView
          roomCode="ADDM"
          hostSecret="secret123"
          participantCount={2}
          participants={mockParticipants}
          settings={mockSettings}
          status="WAITING"
          onStartGrouping={vi.fn()}
          onUpdateSettings={vi.fn()}
        />
      );

      const addBtn = screen.getByRole('button', { name: /手動新增社員/i });
      fireEvent.click(addBtn);

      expect(screen.getByText(/手動代填 \/ 新增社員/i)).toBeTruthy();

      // Enter name
      const nameInput = screen.getByPlaceholderText(/阿杰、小陳/i);
      fireEvent.change(nameInput, { target: { value: '阿銘' } });

      // Click submit
      const confirmBtn = screen.getByRole('button', { name: /確認新增並加入動態牆/i });
      fireEvent.click(confirmBtn);

      await new Promise((r) => setTimeout(r, 20));

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/room/ADDM/join',
        expect.objectContaining({
          method: 'POST',
        })
      );
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
      const guitarPill = screen.getAllByRole('button', { name: /木吉他/i })[0];
      const vocalPill = screen.getByRole('button', { name: /主唱/i });
      fireEvent.click(guitarPill);
      fireEvent.click(vocalPill);

      // Music style / artist pills (multi-select)
      const jayChouPill = screen.getByRole('button', { name: /^周杰倫$/i });
      const accusefivePill = screen.getByRole('button', { name: /^告五人$/i });
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

    it('supports coarse mode with major genre multi-select and any_genre wildcard', () => {
      const onSubmit = vi.fn();

      render(
        <ParticipantView
          roomCode="BAND"
          participant={null}
          status="WAITING"
          settings={{
            ...DEFAULT_HOST_SETTINGS,
            genreGranularity: 'coarse',
          }}
          onSubmit={onSubmit}
        />
      );

      // Verify coarse mode banner
      expect(screen.getByText(/寬鬆流派模式/i)).toBeTruthy();

      // Enter name & role
      fireEvent.change(screen.getByPlaceholderText(/你的暱稱|輸入姓名/i), {
        target: { value: '小美' },
      });
      fireEvent.click(screen.getAllByRole('button', { name: /木吉他/i })[0]);

      // Select "都可以 / 雜食派" and "台灣獨立樂團"
      const anyGenreBtn = screen.getByRole('button', { name: /都可以 \/ 雜食派/i });
      const indieRockBtn = screen.getByRole('button', { name: /台灣獨立樂團/i });
      fireEvent.click(anyGenreBtn);
      fireEvent.click(indieRockBtn);

      // Verify notice appears
      expect(screen.getByText(/全能適配/i)).toBeTruthy();

      // Submit form
      fireEvent.click(screen.getByRole('button', { name: /加入房間|立即加入/i }));

      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          name: '小美',
          capabilities: ['acoustic_guitar'],
          musicPreferences: expect.arrayContaining(['any_genre', 'indie_rock']),
        })
      );
    });

    it('shows animated rhythm pulse waiting screen with real-time participant counter when already joined', () => {
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
          participantCount={15}
          status="WAITING"
          onSubmit={vi.fn()}
        />
      );

      expect(screen.getByText(/等待主辦人開始分組/i)).toBeTruthy();
      expect(screen.getByText('安安')).toBeTruthy();
      expect(screen.getByText(/鍵盤/i)).toBeTruthy();

      // Real-time counter badge
      expect(screen.getByText(/目前已加入/i)).toBeTruthy();
      expect(screen.getAllByText('15').length).toBeGreaterThanOrEqual(1);
    });

    it('shows real-time online counter in the registration form header', () => {
      render(
        <ParticipantView
          roomCode="BAND"
          participant={null}
          participantCount={7}
          status="WAITING"
          onSubmit={vi.fn()}
        />
      );

      expect(screen.getByText(/7 人在線/i)).toBeTruthy();
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

      // Copy lineup button (available in hero and mobile sticky action bar)
      expect(screen.getAllByRole('button', { name: /複製本組名單|複製分組資訊/i }).length).toBeGreaterThanOrEqual(1);
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
