# Guitar Group (吉他社分組神器) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a production-ready, Cloudflare-native web application ("Guitar Group" / `guitar-grouper.jjmowlab.com`) for university guitar clubs featuring a Kahoot-style room system, a sophisticated multi-objective hierarchical grouping optimization engine, real-time WebSocket room coordination via Durable Objects, and an extensive simulation benchmark suite.

**Architecture:** Frontend built with Vite, React 19, and Tailwind CSS served via Cloudflare Workers Assets. Backend powered by Cloudflare Workers and a single Durable Object per room (`RoomDO`) leveraging the WebSocket Hibernation API for linearizable, zero-database real-time synchronization with automatic 24-hour TTL cleanup alarms. Core grouping engine runs pure TypeScript simulated annealing with scarce role anchoring, hierarchical music similarity matching (with fallback to parent genres), talent waste penalties, worst-group protection, and deterministic PRNG.

**Tech Stack:** React 19, TypeScript 5.9+, Vite 7+, Tailwind CSS, Vitest, Cloudflare Workers & Durable Objects (`wrangler`).

**Spec:** [`docs/superpowers/specs/2026-09-30-guitar-grouper-design.md`](file:///c:/IDEA/guitar-grouper/docs/superpowers/specs/2026-09-30-guitar-grouper-design.md)

## Global Constraints
- Target domain: `guitar-grouper.jjmowlab.com` (and `guitar-group.jjmowlab.com`)
- Cloudflare-native only: Workers + Durable Objects (`ROOM_DO`). No external database or Redis.
- Zero mock or fake data in production; strictly real music artists (周杰倫, 告五人, 理想混蛋, 茄子蛋, Taylor Swift, keshi, Justin Bieber, Yorushika, YOASOBI, Aimer, etc.) and real guitar club instrument roles.
- Traditional Chinese UI/UX for all user-facing screens and messages.
- Rule 1: Always commit and push to `origin main` after completing each task/milestone.

---

### Task 1: Project Scaffolding & Configuration

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `wrangler.jsonc`
- Create: `index.html`
- Create: `src/main.tsx`
- Create: `src/index.css`
- Test: `tests/smoke.test.ts`

**Interfaces:**
- Produces: Base build and test environment supporting React 19, TypeScript, Vitest, Tailwind CSS, and Wrangler Worker/Durable Objects.

- [ ] **Step 1: Create package.json with scripts and dependencies**
  Configure dependencies: `react`, `react-dom`, `lucide-react`, `qrcode.react`, `@cloudflare/workers-types`, `typescript`, `vite`, `vitest`, `tailwindcss`, `@tailwindcss/vite`, `wrangler`.
- [ ] **Step 2: Create tsconfig.json and vite.config.ts**
  Setup React 19 JSX transform, nodejs_compat, path aliases (`@/`).
- [ ] **Step 3: Create wrangler.jsonc**
  Setup worker configuration with `ROOM_DO` Durable Object binding, assets directory `./dist`, and routes for `guitar-grouper.jjmowlab.com`.
- [ ] **Step 4: Create HTML entry and minimal React root**
  Setup `index.html`, `src/main.tsx`, and `src/index.css` with Tailwind styling.
- [ ] **Step 5: Write smoke test and verify test runner**
  Run `pnpm install` and `pnpm test` to verify Vitest passes.
- [ ] **Step 6: Commit and push**
  `git add . && git commit -m "chore: scaffold project with React 19, Vite, Tailwind, and Wrangler" && git push origin main`

---

### Task 2: Domain Taxonomy & Hierarchical Music Similarity Engine

**Files:**
- Create: `src/types/domain.ts`
- Create: `src/engine/taxonomy.ts`
- Create: `src/engine/similarity.ts`
- Test: `tests/engine/similarity.test.ts`

**Interfaces:**
- Produces:
  - `Role`: standard instruments and vocal roles.
  - `MusicItem`: genre categories and artists with `parentId`.
  - `calculateHierarchicalSimilarity(prefsA: string[], prefsB: string[]): number`: $0.0 \sim 1.0$ score.
  - `calculateGroupMusicScore(members: Participant[]): { avgPairwise: number; minPairwise: number; consensusTags: string[]; compositeScore: number }`

- [ ] **Step 1: Write failing tests for taxonomy and hierarchical similarity**
  Test cases:
  1. Exact artist match gives high score (1.0).
  2. Fallback to parent category: `justin_bieber` and `keshi` have no exact match, but both belong to `western_pop_rnb`, returning $\ge 0.6$.
  3. Artists with shared genre roots (e.g. `yorushika` and `yoasobi` under `jpop_anime_jrock`).
  4. Completely disjoint genres return 0.
  5. Multi-label overlap correctly combines exact matches and parent fallbacks.
- [ ] **Step 2: Run test to verify it fails**
  Run: `pnpm test tests/engine/similarity.test.ts` (Expected: FAIL, modules not found).
- [ ] **Step 3: Define domain models in `src/types/domain.ts`**
  Types for `Participant`, `Role`, `RoleDefinition`, `MusicItem`, `HostSettings`, `GroupResult`, `PartitionDiagnostics`.
- [ ] **Step 4: Implement taxonomy data in `src/engine/taxonomy.ts`**
  Populate verified instruments: 木吉他, 電吉他, 木箱鼓, 爵士鼓, 貝斯, 鍵盤, 主唱, 和聲.
  Populate genres and artists including Yorushika, YOASOBI, Aimer, Eve, Jay Chou, Accusefive, Bestards, EggPlantEgg, Taylor Swift, Ed Sheeran, Justin Bieber, keshi, etc.
- [ ] **Step 5: Implement `similarity.ts`**
  Hierarchical fallback algorithm using artist-to-parent mapping, Jaccard/soft-cosine metric, consensus tag discovery.
- [ ] **Step 6: Run tests to verify they pass**
  Run: `pnpm test tests/engine/similarity.test.ts` (Expected: PASS).
- [ ] **Step 7: Commit and push**
  `git add src/ tests/ && git commit -m "feat(engine): implement domain taxonomy and hierarchical music similarity" && git push origin main`

---

### Task 3: Global Partition Scoring Model (Fitness Function)

**Files:**
- Create: `src/engine/scoring.ts`
- Test: `tests/engine/scoring.test.ts`

**Interfaces:**
- Consumes: `Participant`, `HostSettings` from `src/types/domain.ts`, `similarity.ts`.
- Produces: `scorePartition(partition: Participant[][], settings: HostSettings, allParticipants: Participant[]): PartitionEvaluation`
  - `evaluation.totalScore`: composite fitness number.
  - `evaluation.roleScore`, `evaluation.musicScore`, `evaluation.diversityScore`.
  - `evaluation.penalties`: talent waste, min-role deficit, size variance.
  - `evaluation.worstGroupScore`: minimum score among all groups.

- [ ] **Step 1: Write failing tests for partition scoring**
  Test cases:
  1. Role coverage and scarcity: distributing 2 cajón players across 2 different groups scores higher than putting both in 1 group.
  2. Diminishing returns: 3 guitarists in one group yields less marginal score than 1 guitarist in each.
  3. Talent waste penalty: penalizes bundling two triple-threats (guitar+vocal+cajon) together when another group lacks vocal/rhythm.
  4. Worst-group music protection: partition with evenly matched music preferences scores higher than one with 1 perfect group and 1 completely conflicting group.
  5. Min-role coverage requirement penalty triggers when required roles are deficient.
- [ ] **Step 2: Run test to verify it fails**
  Run: `pnpm test tests/engine/scoring.test.ts` (Expected: FAIL).
- [ ] **Step 3: Implement `scoring.ts`**
  Implement scarcity calculations ($W_r$), diminishing marginal utility, talent waste tracking, diversity ratio entropy, and composite objective function.
- [ ] **Step 4: Run tests to verify they pass**
  Run: `pnpm test tests/engine/scoring.test.ts` (Expected: PASS).
- [ ] **Step 5: Commit and push**
  `git add src/engine/scoring.ts tests/engine/scoring.test.ts && git commit -m "feat(engine): implement global multi-objective partition scoring model" && git push origin main`

---

### Task 4: Grouping Optimizer (Constructive Seeding + Simulated Annealing + Diagnostics)

**Files:**
- Create: `src/engine/prng.ts`
- Create: `src/engine/optimizer.ts`
- Test: `tests/engine/optimizer.test.ts`

**Interfaces:**
- Consumes: `scoring.ts`, `similarity.ts`, `taxonomy.ts`.
- Produces: `optimizeGrouping(participants: Participant[], settings: HostSettings, seed?: number): OptimizationResult`
  - `result.groups`: assigned groups with members.
  - `result.diagnostics`: explanation for each group (common music tags, covered roles, key contributions, overall score).
  - `result.warnings`: friendly explanation of impossible or constrained criteria (e.g. only 2 drummers for 5 groups).

- [ ] **Step 1: Write failing tests for the optimizer**
  Test cases:
  1. Deterministic output: same seed produces identical grouping results.
  2. Size constraint: 23 participants with target size 4 outputs 5 groups of sizes [5, 5, 5, 4, 4].
  3. Role coverage optimization: scarce cajón / vocal roles are dispersed across groups.
  4. Diagnostics generation: output contains human-readable explanation and shared genre tags for every group.
  5. Warning generation: detects when required role count is strictly less than group count.
- [ ] **Step 2: Run test to verify it fails**
  Run: `pnpm test tests/engine/optimizer.test.ts` (Expected: FAIL).
- [ ] **Step 3: Implement deterministic PRNG in `src/engine/prng.ts`**
  Mulberry32 generator with seed control.
- [ ] **Step 4: Implement constructive seeding & Simulated Annealing in `src/engine/optimizer.ts`**
  - Calculate optimal group count $K = \text{round}(N / S)$ and slot distribution.
  - Phase 1: Scarce role anchor seeding.
  - Phase 2: Simulated Annealing with member swaps, transfers, and cyclic moves over cooling schedule.
  - Diagnostics synthesizer: translates math scores into guitar-club friendly explanations.
- [ ] **Step 5: Run tests to verify they pass**
  Run: `pnpm test tests/engine/optimizer.test.ts` (Expected: PASS).
- [ ] **Step 6: Commit and push**
  `git add src/engine/ tests/engine/ && git commit -m "feat(engine): implement simulated annealing grouping optimizer with diagnostics" && git push origin main`

---

### Task 5: Simulation Suite & Baselines Benchmark

**Files:**
- Create: `src/simulation/generator.ts`
- Create: `src/simulation/baselines.ts`
- Create: `src/simulation/benchmark.ts`
- Test: `tests/simulation/benchmark.test.ts`

**Interfaces:**
- Produces:
  - `generateSyntheticRoom(count: number, scenario: ScenarioType): Participant[]`
  - `runRandomBaseline(participants, settings): OptimizationResult`
  - `runNaiveGreedyBaseline(participants, settings): OptimizationResult`
  - `runComparativeBenchmark(count, scenario): BenchmarkComparison`

- [ ] **Step 1: Write benchmark comparison tests**
  Test sizes: 10, 20, 30, 50, 100, 300 participants.
  Scenarios:
  - Standard campus club distribution.
  - Extremely scarce vocal/cajon players.
  - Concentrated multi-talent vs beginners.
  - Polarized music genres (J-Rock vs Mandopop).
  - Odd count (e.g. 23, 31).
  Verify that `optimizeGrouping` consistently beats Random and Naive Greedy on role coverage %, scarce role dispersion, and worst-group music harmony.
- [ ] **Step 2: Run test to verify it fails**
  Run: `pnpm test tests/simulation/benchmark.test.ts` (Expected: FAIL).
- [ ] **Step 3: Implement synthetic room generator in `src/simulation/generator.ts`**
  Realistic distributions based on university guitar clubs with customizable adversarial parameters.
- [ ] **Step 4: Implement baseline algorithms in `src/simulation/baselines.ts`**
  Pure Random partition and Naive Greedy (fills groups one by one without global marginal reasoning).
- [ ] **Step 5: Implement benchmark runner and metrics evaluator in `src/simulation/benchmark.ts`**
  Computes min-role satisfaction rate, average role coverage, music compatibility (avg & worst group), execution time (ms).
- [ ] **Step 6: Run benchmark tests to verify optimizer dominance**
  Run: `pnpm test tests/simulation/benchmark.test.ts` (Expected: PASS, showing clear quantitative margin over baselines).
- [ ] **Step 7: Commit and push**
  `git add src/simulation/ tests/simulation/ && git commit -m "test(simulation): add comprehensive 10-300 participant benchmark suite and baselines" && git push origin main`

---

### Task 6: Cloudflare Durable Object Room Backend & WebSocket Protocol

**Files:**
- Create: `workers/room-do.ts`
- Create: `workers/app.ts`
- Test: `tests/worker/room-do.test.ts`

**Interfaces:**
- Produces:
  - `RoomDO` class: Durable Object handling room state, WebSocket hibernation, participant registration, host secret authentication, optimization execution, and 24h alarm TTL cleanup.
  - Worker router handling API requests and WebSocket upgrades (`/api/room/:code/ws`).

- [ ] **Step 1: Write integration tests for RoomDO**
  Test cases:
  1. Room creation generates room code and secret token.
  2. Participant joins, updates participant list, and broadcasts state.
  3. Host updates settings (e.g. switch to fine genre mode or role-focus mode).
  4. Host triggers grouping: room status transitions to `OPTIMIZING` then `REVEALED`, results broadcasted.
  5. Non-host attempts to start grouping and receives unauthorized error.
- [ ] **Step 2: Run test to verify it fails**
  Run: `pnpm test tests/worker/room-do.test.ts` (Expected: FAIL).
- [ ] **Step 3: Implement `workers/room-do.ts`**
  Implement room state storage, WebSocket hibernation (`webSocketMessage`, `webSocketClose`), message routing, host verification, and alarm TTL.
- [ ] **Step 4: Implement worker entry in `workers/app.ts`**
  Implement URL router for room creation, WebSocket upgrade delegation, and static asset handling.
- [ ] **Step 5: Run integration tests to verify they pass**
  Run: `pnpm test tests/worker/room-do.test.ts` (Expected: PASS).
- [ ] **Step 6: Commit and push**
  `git add workers/ tests/worker/ && git commit -m "feat(worker): implement Durable Object room coordination and WebSocket protocol" && git push origin main`

---

### Task 7: Modern Kahoot-Style Mobile & Desktop Frontend (React 19 + Tailwind)

**Files:**
- Create: `src/hooks/useRoomSocket.ts`
- Create: `src/components/HostView.tsx`
- Create: `src/components/ParticipantView.tsx`
- Create: `src/components/ResultsView.tsx`
- Create: `src/components/QRCodeDisplay.tsx`
- Modify: `src/App.tsx`
- Test: `tests/ui/app.test.tsx`

**Interfaces:**
- Produces:
  - Mobile-first participant flow: join with room code, multi-select instruments and music/artists, wait screen, **revealed screen showing assigned group, teammates with their capabilities and selected music preferences, and recommended band vibe**.
  - Host view: big 4-letter room code, QR code toggle, live participant tally and instrument bubbles, simplified preset controls (曲風優先 / 樂器配置優先 / 平衡 / 自訂, 寬/細曲風切換), "開始分組" button, full results and diagnostics inspection.

- [ ] **Step 1: Write UI component tests**
  Verify host control rendering, participant multi-select form validation, and results card showing teammate capabilities and music preferences.
- [ ] **Step 2: Run test to verify it fails**
  Run: `pnpm test tests/ui/app.test.tsx` (Expected: FAIL).
- [ ] **Step 3: Implement WebSocket hook `useRoomSocket.ts`**
  Manage connection state, auto-reconnection, session token caching in `sessionStorage`, and event subscriptions.
- [ ] **Step 4: Implement `HostView.tsx` and `QRCodeDisplay.tsx`**
  Big Kahoot room code, QR code for mobile scanning, real-time participant bubble list, preset dropdown/buttons, and grouping trigger.
- [ ] **Step 5: Implement `ParticipantView.tsx` and `ResultsView.tsx`**
  - Streamlined 30-second mobile form with visual instrument pills and genre/artist chips.
  - Waiting screen with animated pulse.
  - **Results view: "你在 第 X 組！" + cards for every teammate showing their name, capabilities (e.g. 木吉他、主唱), and selected music preferences (e.g. Yorushika、告五人), plus group consensus style.**
- [ ] **Step 6: Wire up `src/App.tsx`**
  Support URL query params (`?room=ABCD`, `?host=1`), navigation, and error toasts.
- [ ] **Step 7: Run UI tests and verify build**
  Run `pnpm test` and `pnpm run build` to verify clean TypeScript compilation and asset bundling.
- [ ] **Step 8: Commit and push**
  `git add src/ tests/ui/ && git commit -m "feat(ui): implement Kahoot-style mobile and desktop UI with teammate profile results" && git push origin main`

---

### Task 8: Verification, End-to-End Simulation, and Cloudflare Deployment Configuration

**Files:**
- Modify: `wrangler.jsonc`
- Create: `README.md`
- Test: Full test suite (`pnpm test`) & Production build (`pnpm run build`)

**Interfaces:**
- Produces: Production deployment configuration and verified build ready for `guitar-grouper.jjmowlab.com`.

- [ ] **Step 1: Verify complete test suite and benchmarks**
  Run: `pnpm test --run` to ensure 100% test pass rate across similarity, scoring, optimizer, simulation, and UI.
- [ ] **Step 2: Verify production build**
  Run: `pnpm run build` and ensure `./dist` is produced with zero TypeScript errors.
- [ ] **Step 3: Test Wrangler dry-run deployment**
  Run: `npx wrangler deploy --dry-run` to verify Cloudflare Worker and Durable Object bindings validate against Cloudflare API.
- [ ] **Step 4: Write comprehensive README.md**
  Document project background, architecture, grouping algorithm mathematics, local development, simulation benchmarks, and Cloudflare deployment steps.
- [ ] **Step 5: Final commit and push**
  `git add . && git commit -m "docs: finalize deployment docs, README, and verification" && git push origin main`
