# Guitar Group (吉他社分組神器) - 系統架構與演算法設計規範 (Design Spec)

- **專案名稱**：Guitar Group / Guitar Grouper
- **目標網域**：`guitar-grouper.jjmowlab.com` (及 `guitar-group.jjmowlab.com`)
- **基礎設施**：Cloudflare 原生環境（Cloudflare Workers + Durable Objects + Assets）
- **語言介面**：繁體中文（Taiwan Traditional Chinese）

---

## 1. 產品目標與情境 (Product Context & Goals)

大學吉他社在期初迎新舞台、三家配對、期末發表或大型成果展時，需要現場將 20~100+ 位社員迅速分成多個演出樂團。
過往人工排組或簡單抽籤往往造成以下問題：
1. **音樂喜好斷裂**：想玩日系動漫搖滾的同學跟只想彈唱中文抒情慢歌的同學被綁在一起，難以選歌。
2. **關鍵角色缺失或集中**：某組有 3 個能彈吉他也能打木箱鼓與主唱的全能好手，另一組卻連一個唱或節奏都沒有。
3. **稀缺樂器分配不均**：全場僅有 3 位會木箱鼓或鍵盤，卻有兩位被分在同一組，造成其他組完全缺件。
4. **性別/多元分佈失衡**：出現不必要的全男或全女組，缺乏互動多元性。
5. **現場等待冗長**：傳統紙筆或表單統計耗費大量時間。

**Guitar Group** 提供類 Kahoot 的極致低門檻即時房間系統：
- 房主（活動負責人）大螢幕投影房間碼與 QR Code。
- 社員以手機掃碼，30 秒內免登入完成暱稱、性別/分類、能力多選（吉他、電吉他、木箱鼓、主唱...）與音樂偏好多選。
- 房主一鍵「開始分組」，Cloudflare Durable Object 即刻運行多目標階層最佳化演算法，即時揭曉分配結果與組內推薦曲風。

---

## 2. 系統架構 (System Architecture)

採用純 Cloudflare-native 單一工作站架構，無外部資料庫，零維護負擔：

```
                    ┌────────────────────────────────────────┐
                    │               Client                   │
                    │   (Vite + React 19 + Tailwind CSS)     │
                    └──────────────────┬─────────────────────┘
                                       │ HTTP / WebSocket
                                       ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                        Cloudflare Worker (Gateway)                         │
│  - 路由分發 / 靜態 SPA 資源服務 (Cloudflare Assets)                          │
│  - 房間路由轉發至對應 Durable Object (idFromName(roomCode))                 │
└──────────────────────────────────────┬─────────────────────────────────────┘
                                       │ env.ROOM_DO.get(id)
                                       ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                       RoomDO (Durable Object)                              │
│  - 單房狀態中心 (Linearizable In-Memory State)                               │
│  - WebSocket Hibernation API 即時廣播 (連線管理、全體心跳、斷線重連)          │
│  - 房主權限控制 (Host Secret Token 驗證)                                    │
│  - 嵌入式分組最佳化引擎 (Grouping Optimization Engine, Pure TypeScript)     │
│  - 自動生命週期與清理 (Alarm TTL: 24 小時無操作自動釋放)                      │
└────────────────────────────────────────────────────────────────────────────┘
```

### 架構特性
1. **單房狀態線性一致**：每個房間對應一個獨立的 `RoomDO` 實例，所有進房、資料提交、鎖房皆循序處理，天然免疫 Race Condition。
2. **WebSocket 廣播 (Hibernation API)**：手機客戶端在房間等待時幾乎零資源消耗，房主一按「開始分組」或有新成員加入時瞬間推送。
3. **HTTP 備援支援**：若現場校園網路防火牆阻擋 WebSocket，客戶端自動回退為 REST 輪詢，體驗不中斷。
4. **免維護暫態儲存**：房間狀態存於 DO 記憶體及 DO Storage，並透過 `setAlarm(Date.now() + 24 * 3600 * 1000)` 自動排程清理，不佔用永續資料庫額度。

---

## 3. 資料模型與音樂分類層級 (Domain Models & Hierarchical Taxonomy)

### 3.1 樂器與能力標籤 (Role Taxonomy)
預設樂器角色列表：
- `acoustic_guitar`: 木吉他
- `electric_guitar`: 電吉他
- `cajon`: 木箱鼓 / 打擊
- `drums`: 爵士鼓
- `bass`: 貝斯
- `keyboard`: 鍵盤 / 鋼琴
- `lead_vocal`: 主唱
- `backing_vocal`: 和聲
- `other`: 其他樂器

### 3.2 階層式音樂分類 (Hierarchical Music Taxonomy)
房主可選擇「寬（粗分類）」或「細（支援知名歌手與樂團）」。
若兩位成員在「細」層級未直接選取相同歌手，系統能自動向上溯源至父層大類，計算語意重疊：

```typescript
export interface MusicItem {
  id: string;
  name: string;
  parentId?: string; // 父層領域 ID
  category: 'genre' | 'artist';
}
```

#### 分類階層表：
1. **中文流行 / 抒情 (`mandopop_ballad`)**
   - 知名代表：周杰倫 (`jay_chou`), 告五人 (`accusefive`), 理想混蛋 (`bestards`), 茄子蛋 (`eggplantegg`), 韋禮安 (`weibird`), 蔡依林 (`jolin`), 孫盛希 (`shishi`)
2. **獨立音樂 / 搖滾 (`indie_rock`)**
   - 知名代表：草東沒有派對 (`nodarty`), 滅火器 (`fireex`), 康士坦的變化球 (`ksth`), 麋先生 (`mixer`), 溫室雜草 (`easy_weeds`), 拍謝少年 (`sorry_youth`)
3. **英文流行 / R&B (`western_pop_rnb`)**
   - 知名代表：Taylor Swift (`taylor_swift`), Ed Sheeran (`ed_sheeran`), Justin Bieber (`justin_bieber`), keshi (`keshi`), Bruno Mars (`bruno_mars`), Lauv (`lauv`)
4. **西洋搖滾 / 另類 (`western_rock`)**
   - 知名代表：Oasis (`oasis`), Coldplay (`coldplay`), Queen (`queen`), Green Day (`green_day`), Radiohead (`radiohead`), Maroon 5 (`maroon_5`)
5. **日語流行 / 動漫 / J-Rock (`jpop_anime_jrock`)**
   - 知名代表：YOASOBI (`yoasobi`), Aimer (`aimer`), Eve (`eve`), Official髭男dism (`higedan`), ONE OK ROCK (`oor`), 結束バンド (`kessoku`)
6. **嘻哈 / 饒舌 / 放克 (`hiphop_funk`)**
   - 知名代表：蛋堡 (`softlipa`), 頑童MJ116 (`mj116`), 9m88 (`9m88`), 宇宙人 (`cosmospeople`), 落日飛車 (`sunset_rollercoaster`)

### 3.3 成員間音樂相似度計算 (Hierarchical Similarity)
對參與者 $A$ 和 $B$ 的音樂偏好集合：
- **精確細項匹配（Exact Artist Match）**：權重 $1.0$。
- **共同父層匹配（Shared Parent Category Fallback）**：若 $A$ 選 `Justin Bieber`、$B$ 選 `keshi`，兩者細項不同但均隸屬 `western_pop_rnb`，給予 $0.6$ 之相容權重。
- **跨類相近風格（Genre Neighborhood）**：如 `indie_rock` 與 `western_rock` 具備部分搖滾交集，給予 $0.25$ 之關聯權重。
- 透過加權 Jaccard / 軟餘弦相似度計算向量重疊，輸出 $0.0 \sim 1.0$ 的相容性得分。

---

## 4. 分組最佳化引擎 (Grouping Optimization Engine)

### 4.1 問題定義
給定 $N$ 位參與者、房主設定之目標每組人數 $S$（預設 4，允許 3~5）：
1. 計算總組數 $K = \text{round}(N / S)$。
2. 劃分各組目標人數：設定為 $\lfloor N/K \rfloor$ 與 $\lceil N/K \rceil$，確保各組人數極差 $\le 1$（例如 23 人 5 組 $\to$ 5, 5, 5, 4, 4）。
3. 尋找最佳分配分劃 $P = \{G_1, G_2, \dots, G_K\}$，最大化全局適應度 $F(P)$。

### 4.2 全局多目標適應度函數 (Fitness Objective)
$$F(P) = w_{\text{role}} \cdot S_{\text{role}}(P) + w_{\text{music}} \cdot S_{\text{music}}(P) + w_{\text{div}} \cdot S_{\text{div}}(P) - \text{Penalties}(P)$$

#### (1) 樂器編制與稀缺性得分 ($S_{\text{role}}$)
- **稀缺權重 (Scarcity Factor)**：設角色 $r$ 在全場共有 $C_r$ 位成員會演奏。
  $$W_r = 1.0 + \max\left(0, \frac{K - C_r}{K}\right) \times 2.0$$
  若某樂器在全場少於總組數（例如 5 組但只有 2 個木箱鼓），該樂器的覆蓋權重將大幅提升，促使演算法將其分散到不同組。
- **邊際效益遞減 (Diminishing Marginal Utility)**：
  組內每增加一位具備角色 $r$ 的成員，其貢獻為：
  $$\text{Gain}(k) = \frac{W_r}{1 + 0.8 \times (k - 1)}$$
  第 1 位能帶來 $100\%$ 效益，第 2 位降為 $55\%$，第 3 位降為 $38\%$。這防止了「將 3 個吉他手或 2 個鼓手堆在同一組」的無謂堆疊。
- **必備編制底線 (Min Required Roles)**：
  若房主指定「吉他、木箱鼓、主唱」至少需覆蓋 2 項，若某組未達標，處以重罰項 $P_{\text{deficit}}$。

#### (2) 音樂風格相容性 ($S_{\text{music}}$)
- **成對和諧度 (Pairwise Harmony)**：計算組內所有兩兩成員之階層音樂相似度均值。
- **全團公約數加分 (Consensus Core Bonus)**：若組內全體成員共同覆蓋至少 1 個共同曲風領域，給予額外加分。
- **最差組保護 (Worst-Group Safeguard / Min-Max Fairness)**：
  除了全場平均相容度，特別引入最差組相容度評分：
  $$S_{\text{music}}(P) = 0.7 \times \text{AvgMusic}(P) + 0.3 \times \min_{G \in P} \text{Music}(G)$$
  避免犧牲特定組別成為「雜牌孤兒團」。

#### (3) 性別與多樣性平衡 ($S_{\text{div}}$)
- 計算全場母體之性別比例（如男女比 $60\% : 40\%$）。
- 評估各組性別分佈與母體分佈之卡方/熵值偏差，柔性引導混合編制，除非全場性別極端不均，否則不製造全單一性別組。

#### (4) 懲罰項 ($\text{Penalties}$)
- **多工能力浪費懲罰 ($P_{\text{waste}}$)**：檢測多工成員（同時具備 3 種以上技能的好手）。若多名多工者集中於同一組，而其他組有技能缺口，施加全局能力浪費扣分。
- **人數偏差懲罰 ($P_{\text{size}}$)**：組人數超出預期範圍者嚴厲懲罰。

### 4.3 演算法執行流程 (Hybrid Constructive + Simulated Annealing)
1. **階段一：稀缺錨定啟發式構建 (Scarce Role Anchor Seeding)**：
   - 統計全場稀缺度最高的角色列表。
   - 將具備稀缺角色的成員優先分散派發至 $K$ 個組作為「核心支柱 (Anchors)」。
   - 其餘成員依音樂匹配度與角色互補度進行貪婪初配。
2. **階段二：模擬退火與禁忌局部搜索 (Simulated Annealing Optimization)**：
   - **鄰域操作 (Neighborhood Moves)**：
     - **成員交換 (Member Swap)**：隨機挑選兩組 $G_i, G_j$，各抽出一名成員進行互換。
     - **成員調動 (Member Shift)**：若組人數允許，將成員從人數多（如 5 人）的組移至人數少（如 4 人）的組。
     - **三方循環交換 (3-Way Cyclic Swap)**：以微小機率觸發 $G_a \to G_b \to G_c \to G_a$ 三方輪調，跳出局部最優解。
   - **降溫排程 (Cooling Schedule)**：
     - 初溫 $T_0 = 1.0$，末溫 $T_{\text{end}} = 0.001$，冷卻係數 $\alpha = 0.995$。
     - 運行約 3,000 ~ 6,000 輪迭代（在 Cloudflare Worker V8 引擎上僅耗時約 15 ~ 35 ms）。
   - **確定性種子 (Deterministic PRNG)**：使用 Mulberry32 演算法，相同 Seed 輸入保證 100% 產出完全相同的分組結果，利於除錯、測試與重現。

### 4.4 房主比重預設對應表
| 預設選項 | 樂器權重 $w_{\text{role}}$ | 音樂權重 $w_{\text{music}}$ | 多樣性權重 $w_{\text{div}}$ | 說明 |
| :--- | :--- | :--- | :--- | :--- |
| **🎵 曲風優先** | 0.25 | 0.60 | 0.15 | 特別適合練歌發表的活動，確保選歌大家都有共鳴 |
| **🎸 樂器配置優先** | 0.65 | 0.20 | 0.15 | 強調樂團編制完整，主唱/鼓/吉他缺一不可 |
| **⚖️ 平衡模式 (預設)** | 0.45 | 0.40 | 0.15 | 兼顧組內樂器編制與曲風契合度 |
| **⚙️ 自訂** | 0.0 ~ 1.0 | 0.0 ~ 1.0 | 0.0 ~ 1.0 | 房主可微調滑桿 |

---

## 5. 即時房間協同協定 (Real-Time Kahoot Protocol)

### 5.1 狀態機生命週期
```
[房主建立房間] ──► WAITING (等待社員加入)
                        │
                        ▼ (房主點擊「開始分組」)
                   OPTIMIZING (鎖房中 / 演算法運算)
                        │
                        ▼ (計算完成 / 存入 DO / 廣播結果)
                   REVEALED (全場開獎 / 查閱名單與診斷)
```

### 5.2 WebSocket 訊息規格 (Type-Safe JSON Messages)

#### Client -> Server:
- `JOIN_ROOM`: `{ type: "JOIN_ROOM", roomCode, participantId, name, gender, capabilities: string[], musicPreferences: string[] }`
- `UPDATE_PROFILE`: `{ type: "UPDATE_PROFILE", capabilities, musicPreferences }`
- `HOST_UPDATE_SETTINGS`: `{ type: "HOST_UPDATE_SETTINGS", hostSecret, settings }`
- `HOST_START_GROUPING`: `{ type: "HOST_START_GROUPING", hostSecret, seed?: number }`
- `PING`: `{ type: "PING" }`

#### Server -> Client:
- `ROOM_STATE`: `{ type: "ROOM_STATE", status, roomCode, participantCount, participantsSummary, settings }`
- `PARTICIPANT_JOINED`: `{ type: "PARTICIPANT_JOINED", participant: { id, name, gender, capabilities } }`
- `GROUPING_STARTED`: `{ type: "GROUPING_STARTED" }`
- `GROUPING_RESULT`: `{ type: "GROUPING_RESULT", groups: GroupResult[], diagnostics: PartitionDiagnostics }`
- `ERROR`: `{ type: "ERROR", code, message }`
- `PONG`: `{ type: "PONG" }`

---

## 6. 使用者體驗與介面設計 (UI/UX Design)

### 6.1 設計語彙 (Design Language)
- **色彩風格**：活潑有朝氣的吉他音樂祭風格（溫暖琥珀橘、復古木質吉他棕、現代石墨黑、電音紫微光）。
- **響應式配置**：
  - 社員端：專為手機垂直螢幕最佳化（大按鈕、滑動卡片多選、視覺化樂器圖示）。
  - 房主端：支援大螢幕投影（超大 4 碼房間代碼、高對比 QR Code、動態進房社員泡泡牆、樂器分佈即時儀表板）。
- **零行話用語**：絕不出現「模擬退火迭代次數」、「懲罰權重」等工程術語，全數轉化為吉他社親切用語（如「曲風契合度」、「樂器完整度」、「全能救火隊分散度」）。

### 6.2 不可能條件與極端狀況之優雅處置 (Failure & Graceful Handling)
當房主設定的理想條件無法完全達成時（例如：全場僅 2 位木箱鼓，但分 5 組），系統決不閃退或噴出錯誤，而是：
1. 演算法最大努力（Best-Effort）將稀缺樂器分散（例如 2 組有鼓、另 3 組平均分配節奏/主唱）。
2. 在結果頁面以親切小卡說明：
   > 💡 **小提醒**：本次共有 5 組，但全場僅有 2 位社員會木箱鼓，系統已將鼓手平均分配至第 1、第 3 組，其餘組別已強化吉他與主唱配置！
3. 房主可一鍵「換個種子重新排組」或「微調條件重算」。

---

## 7. 模擬測試與效能驗證 (Simulation & Benchmark Suite)

為了驗證分組引擎超越傳統貪婪與隨機分組，建立完整的獨立測試套件：
1. **規模覆蓋**：10 人（微型室內團）、20 人、30 人（典型迎新社課）、50 人、100 人、300 人（大型全校性音樂祭）。
2. **對抗情境 (Adversarial Scenarios)**：
   - 極端稀缺鼓手/主唱（例如 30 人中僅 1 位能唱）。
   - 2~3 位頂級全能樂手 vs 大量單一吉他新手。
   - 音樂口味兩極分化（一半只聽動漫 J-Rock，一半只聽台語/華語抒情流行）。
   - 人數非整除（23 人、31 人、47 人）。
   - 嚴重性別不均（85% 男性 / 15% 女性）。
3. **量化指標比對 (Benchmark Metrics)**：
   - 隨機分組 (Random Baseline) vs 樸素貪婪 (Naive Greedy Baseline) vs **Guitar Group 最佳化引擎**。
   - 評估：必備樂器滿足率（%）、稀缺資源分散方差、平均音樂相容度、**最差組相容度（重點驗證）**、多工能力浪費指數、演算法計算耗時（ms）。

---

## 8. 部署與環境配置 (Deployment)

- **Wrangler 專案設定 (`wrangler.jsonc`)**：
  - Worker 名稱：`guitar-grouper`
  - 自訂網域繫結：`guitar-grouper.jjmowlab.com` (及 `guitar-group.jjmowlab.com`)
  - Durable Object 繫結：`ROOM_DO` (Class `RoomDO`)
  - Compatibility Date：`2026-09-27` (啟用 `nodejs_compat`)
- **CI / 本地部署指令**：
  - 本地開發：`pnpm dev`
  - 單元與演算法測試：`pnpm test`
  - 正式發布：`pnpm run deploy` (`npx wrangler deploy`)
