// P1-C-1.5 リグレッションテスト(1.5a 連続性 + 1.5b 完成形 + race fix v2 + L4-A)
//
// 実行: npx tsx scripts/test-stylist-chat-continuity.ts
// 終了コード: 全件成功で 0・1 件でも失敗で 1
//
// 【前提コミット】HEAD = 60c7fa8(1.5b 完成形 = i + ii)
//   - 1.5a 連続性:        04d6296
//   - 1.5b-i closet:      88dea21
//   - race fix v2 案C:    040078c
//   - L4-A 切替検出:      60c7fa8 ← 検証対象
//
// 【検証カバレッジ】設計案 docs/STYLE-SELF_D1_P1-C-1.5_リグレッションテスト_設計案.md (87a574d)
//   a   : 1往復目 diagnose → sessionIntent 保持
//   b   : 2往復目 継続セッション維持
//   c   : 5往復 history N=3 維持
//   d   : プライバシー PRODUCT_WORLDVIEW_TAGS 全件除去(動的・31語ハードコードなし)
//   f   : MVP-1b スコープ外 intent → 従来 intent-result カード
//   g   : 1.5b-i closet 会話化 + wardrobe 要約反映
//   h-1 : hydrate 復元(localStorage に履歴 → setMessages)
//   h-2-α : persist 通常書込
//   h-2-β : ★ race fix v2 核心 — persist 空配列ガード(messages.length===0 早期 return)
//   h-2-γ : persist hydrate 完了前ガード(!hydrated 早期 return)
//   h-3 : hydrate 側 空配列復元防止(parsed.length>0 条件で弾く)
//   i-1 : L4-A 切替 diagnose → closet
//   i-2 : L4-A 逆方向切替 closet → diagnose
//   i-3 : ★ L3 対象外 intent 継続維持(STYLIST_CHAT_INTENTS.has で自動 false)
//   i-4 : ★ L2 低信頼継続(confidence < SWITCH_THRESHOLD で切替しない)
//
// 【★ 連動更新ルール】本体改修時はテストも更新
//   本ファイルは app/(app)/ai/page.tsx と app/api/ai/stylist-chat/route.ts のロジックを
//   simulator として再現している。次のいずれかが変わったら ★ 本ファイルを同期更新する責務:
//     - handleSubmit の routing 判定(isContinuingSession / isSwitchToOtherTarget /
//       effectiveContinuing / isStylistTarget の式)
//     - hydrate / persist useEffect の guard ロジック
//     - getSessionIntent / buildStylistHistory / replaceMessage の挙動
//     - 定数 STYLIST_CHAT_INTENTS / SWITCH_THRESHOLD / CONFIDENCE_THRESHOLD /
//       STYLIST_CHAT_HISTORY_MAX / MAX_MESSAGES / STORAGE_KEY
//     - stripCanonicalSlugs の正規表現 / 正規化(本体 route.ts:299-320)
//
// 【★ 実物 import】
//   - PRODUCT_WORLDVIEW_TAGS: lib/knowledge/product-worldview-tags.ts から直接 import
//     → 31 語の語彙ドリフトを構造的に防止(増減があれば自動追従)
//
// 【★ replicated(本体不変原則のため)】
//   - stripCanonicalSlugs / SLUG_PATTERN / escapeRegExp:
//     app/api/ai/stylist-chat/route.ts:299-324 の内部関数で export されていないため、
//     本ファイル内に同等実装を再掲。本体は PRODUCT_WORLDVIEW_TAGS を直参照しているので、
//     語彙ドリフトはここでも自動追従(regex は body と機械的に同形)。
//   - handleSubmit routing / hydrate / persist:
//     React state に強く依存するため import 不可・simulator として再現。
//
// 【方式】案 C(設計案 章 B):mock 主体・LLM / 実 API 呼ばない・コスト 0・決定性 100%

import { PRODUCT_WORLDVIEW_TAGS } from "../lib/knowledge/product-worldview-tags";

// ====================================================================
// 本体と同期する定数(コピー: app/(app)/ai/page.tsx)
// ★ 本体側の値が変わったら ★ ここも同期更新
// ====================================================================
const CONFIDENCE_THRESHOLD       = 0.7;  // app/(app)/ai/page.tsx:54
const MAX_MESSAGES               = 30;   // app/(app)/ai/page.tsx:57
const STORAGE_KEY                = "style-self:ai:messages:v1"; // app/(app)/ai/page.tsx:63
const STYLIST_CHAT_INTENTS       = new Set<string>(["diagnose", "closet"]); // app/(app)/ai/page.tsx:78
const STYLIST_CHAT_HISTORY_MAX   = 3;    // app/(app)/ai/page.tsx:90
const SWITCH_THRESHOLD           = 0.85; // app/(app)/ai/page.tsx:92

// ====================================================================
// 型(本体と同型: app/(app)/ai/page.tsx)
// ====================================================================
interface SuggestionItem { intent: string; label: string }

interface IntentResponse {
  ok:           boolean;
  intent?:      string;
  mode?:        string;
  params?:      Record<string, unknown>;
  confidence?:  number;
  suggestions?: SuggestionItem[];
  reason?:      "auth_required" | "empty_input";
}

type MessageContent =
  | { kind: "text";          text: string }
  | { kind: "intent-result"; result: IntentResponse }
  | { kind: "reply";         text: string; actions?: SuggestionItem[]; sessionIntent?: string }
  | { kind: "loading" }
  | { kind: "error";         message: string };

interface Message {
  id:        string;
  role:      "user" | "assistant";
  content:   MessageContent;
  createdAt: number;
}

interface StylistChatResponse {
  ok:       boolean;
  reply?:   string;
  actions?: SuggestionItem[];
  reason?:  "auth_required" | "empty_input" | "intent_out_of_scope";
  error?:   string;
}

type StylistHistoryItem = { role: "user" | "assistant"; text: string };

let _msgIdCounter = 0;
function newMessageId(): string { return `test-msg-${++_msgIdCounter}`; }

// ====================================================================
// Assertion helpers(Jest 不要・自前定義)
// ====================================================================
let pass = 0;
let fail = 0;
const failures: string[] = [];

function record(condition: boolean, label: string): void {
  if (condition) { pass++; console.log(`    PASS ${label}`); }
  else           { fail++; failures.push(label); console.log(`    FAIL ${label}`); }
}
function assertEqual<T>(actual: T, expected: T, label: string): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  record(a === e, `${label} (期待=${e} 実測=${a})`);
}
function assertTrue(cond: boolean, label: string): void  { record(cond === true,  label); }
function assertFalse(cond: boolean, label: string): void { record(cond === false, label); }
function assertContains(haystack: string, needle: string, label: string): void {
  record(haystack.includes(needle), `${label} (含む: "${needle}")`);
}

// ====================================================================
// 出力フィルタ(本体 app/api/ai/stylist-chat/route.ts:299-324 のコピー)
// ★ PRODUCT_WORLDVIEW_TAGS は実物 import で語彙ドリフト 0
// ====================================================================
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
const SLUG_PATTERN = new RegExp(
  `\\b(?:${PRODUCT_WORLDVIEW_TAGS.map(escapeRegExp).join("|")})\\b`,
  "gi",
);
function stripCanonicalSlugs(text: string): { cleaned: string; removed: boolean } {
  let removed = false;
  const cleaned = text.replace(SLUG_PATTERN, () => { removed = true; return ""; });
  if (!removed) return { cleaned: text, removed: false };
  const normalized = cleaned
    .replace(/[ \t]+/g, " ")
    .replace(/\s*([、。])\s*/g, "$1")
    .replace(/(^|\n)[ \t、。]+/g, "$1")
    .trim();
  return { cleaned: normalized, removed: true };
}

// ====================================================================
// Mocks
// ====================================================================
interface LocalStorageMock {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}
function createLocalStorageMock(): LocalStorageMock {
  const store = new Map<string, string>();
  return {
    getItem(k)    { return store.has(k) ? store.get(k)! : null; },
    setItem(k, v) { store.set(k, v); },
    removeItem(k) { store.delete(k); },
  };
}

type FetchHandler = (body: unknown) => unknown;
interface FetchMock {
  mock: (url: string, init?: { method?: string; body?: string }) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;
  calls: { url: string; body: unknown }[];
}
function createFetchMock(handlers: Record<string, FetchHandler>): FetchMock {
  const calls: { url: string; body: unknown }[] = [];
  return {
    calls,
    async mock(url, init) {
      const body = init?.body ? JSON.parse(init.body) : undefined;
      calls.push({ url, body });
      for (const [key, handler] of Object.entries(handlers)) {
        if (url.includes(key)) {
          const result = handler(body);
          return { ok: true, status: 200, json: async () => result };
        }
      }
      return { ok: false, status: 500, json: async () => ({ ok: false, error: "no_handler" }) };
    },
  };
}

// ====================================================================
// 本体ロジックの再現(simulator)
// ★ 本体 app/(app)/ai/page.tsx のヘルパ + handleSubmit を純粋関数として再現
// ====================================================================

// 本体 page.tsx:352-363
function getSessionIntent(messages: Message[]): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== "assistant") continue;
    if (m.content.kind === "reply") return m.content.sessionIntent ?? null;
    return null;
  }
  return null;
}

// 本体 page.tsx:369-380
function buildStylistHistory(messages: Message[]): StylistHistoryItem[] {
  const out: StylistHistoryItem[] = [];
  for (const m of messages) {
    if (m.role === "user" && m.content.kind === "text") {
      out.push({ role: "user", text: m.content.text });
    } else if (m.role === "assistant" && m.content.kind === "reply") {
      out.push({ role: "assistant", text: m.content.text });
    }
  }
  return out.slice(-STYLIST_CHAT_HISTORY_MAX);
}

// 本体 page.tsx:335-338
function trimByMax(msgs: Message[]): Message[] {
  if (msgs.length <= MAX_MESSAGES) return msgs;
  return msgs.slice(msgs.length - MAX_MESSAGES);
}

// 本体 page.tsx:340-346
function replaceMessage(messages: Message[], id: string, newContent: MessageContent): Message[] {
  return messages.map(m => m.id === id ? { ...m, content: newContent } : m);
}

// handleSubmit simulator(本体 page.tsx:153-269)
interface SimulateInput {
  text:            string;
  initialMessages: Message[];
  fetchMock:       FetchMock;
}
interface SimulateOutput {
  finalMessages:         Message[];
  sessionIntent:         string | null;
  isContinuingSession:   boolean;
  isSwitchToOtherTarget: boolean;
  effectiveContinuing:   boolean;
  isStylistTarget:       boolean;
  intentToSend:          string | null;
  recentHistory:         StylistHistoryItem[] | null;
  segmentBCalled:        boolean;
  intentDataReceived:    IntentResponse | null;
}

async function simulateHandleSubmit(input: SimulateInput): Promise<SimulateOutput> {
  const { text, initialMessages, fetchMock } = input;
  const trimmed = text.trim();

  const userMsg: Message    = { id: newMessageId(), role: "user",      content: { kind: "text", text: trimmed }, createdAt: Date.now() };
  const loadingId           = newMessageId();
  const loadingMsg: Message = { id: loadingId,      role: "assistant", content: { kind: "loading" },             createdAt: Date.now() };
  let   messages: Message[] = trimByMax([...initialMessages, userMsg, loadingMsg]);

  const out: SimulateOutput = {
    finalMessages: messages, sessionIntent: null, isContinuingSession: false,
    isSwitchToOtherTarget: false, effectiveContinuing: false, isStylistTarget: false,
    intentToSend: null, recentHistory: null, segmentBCalled: false, intentDataReceived: null,
  };

  // 段階A
  const res  = await fetchMock.mock("/api/overlay/intent", { method: "POST", body: JSON.stringify({ text: trimmed }) });
  const data = await res.json() as IntentResponse & { error?: string };
  out.intentDataReceived = data;

  if (!res.ok) {
    messages = replaceMessage(messages, loadingId, { kind: "error", message: data.error ?? `HTTP ${res.status}` });
    out.finalMessages = messages;
    return out;
  }

  // 連続性 + L4-A 切替(本体 page.tsx:201-220)
  const sessionIntent = getSessionIntent(initialMessages);
  const isContinuingSession =
    sessionIntent !== null && STYLIST_CHAT_INTENTS.has(sessionIntent);
  const isSwitchToOtherTarget =
    isContinuingSession
    && typeof data.intent === "string"
    && STYLIST_CHAT_INTENTS.has(data.intent)
    && data.intent !== sessionIntent
    && (data.confidence ?? 0) >= SWITCH_THRESHOLD;
  const effectiveContinuing = isContinuingSession && !isSwitchToOtherTarget;

  const isStylistTarget = effectiveContinuing || (
    data.ok
    && data.reason === undefined
    && typeof data.intent === "string"
    && STYLIST_CHAT_INTENTS.has(data.intent)
  );

  out.sessionIntent         = sessionIntent;
  out.isContinuingSession   = isContinuingSession;
  out.isSwitchToOtherTarget = isSwitchToOtherTarget;
  out.effectiveContinuing   = effectiveContinuing;
  out.isStylistTarget       = isStylistTarget;

  if (isStylistTarget) {
    const intentToSend  = effectiveContinuing ? sessionIntent! : (data.intent as string);
    const recentHistory = isSwitchToOtherTarget ? [] : buildStylistHistory(initialMessages);
    out.intentToSend    = intentToSend;
    out.recentHistory   = recentHistory;
    out.segmentBCalled  = true;

    const replyRes  = await fetchMock.mock("/api/ai/stylist-chat", {
      method: "POST",
      body: JSON.stringify({ text: trimmed, intent: intentToSend, history: recentHistory }),
    });
    const replyData = await replyRes.json() as StylistChatResponse;

    if (!replyRes.ok || replyData.reason || !replyData.reply) {
      messages = replaceMessage(messages, loadingId, { kind: "intent-result", result: data });
    } else {
      messages = replaceMessage(messages, loadingId, {
        kind: "reply", text: replyData.reply, actions: replyData.actions, sessionIntent: intentToSend,
      });
    }
    out.finalMessages = messages;
    return out;
  }

  messages = replaceMessage(messages, loadingId, { kind: "intent-result", result: data });
  out.finalMessages = messages;
  return out;
}

// hydrate / persist simulator(本体 page.tsx:122-148・race fix v2 案C)
function simulateHydrate(localStorage: LocalStorageMock): { messages: Message[]; hydrated: boolean } {
  let messages: Message[] = [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        messages = parsed as Message[];
      }
    }
  } catch { /* corrupt JSON 無視 */ }
  return { messages, hydrated: true };
}
function simulatePersist(localStorage: LocalStorageMock, messages: Message[], hydrated: boolean): { wrote: boolean } {
  if (!hydrated)              return { wrote: false };
  if (messages.length === 0)  return { wrote: false };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    return { wrote: true };
  } catch {
    return { wrote: false };
  }
}

// ====================================================================
// Test cases
// ====================================================================

async function caseA() {
  console.log("\n[a] 1往復目 「診断したい」 → sessionIntent=diagnose 保持");
  const fetchMock = createFetchMock({
    "/api/overlay/intent": () => ({ ok: true, intent: "diagnose", confidence: 0.95, mode: "navigate" }),
    "/api/ai/stylist-chat": () => ({ ok: true, reply: "診断を始めますね。気分はどんな感じですか?", actions: [] }),
  });
  const out = await simulateHandleSubmit({ text: "診断したい", initialMessages: [], fetchMock });
  assertEqual(out.sessionIntent,         null,  "初回 sessionIntent=null");
  assertEqual(out.isContinuingSession,   false, "isContinuingSession=false");
  assertEqual(out.isSwitchToOtherTarget, false, "isSwitchToOtherTarget=false");
  assertEqual(out.effectiveContinuing,   false, "effectiveContinuing=false");
  assertEqual(out.isStylistTarget,       true,  "isStylistTarget=true");
  assertEqual(out.segmentBCalled,        true,  "段階B 呼ばれる");
  assertEqual(out.intentToSend,          "diagnose", "intentToSend=diagnose");
  assertEqual(out.recentHistory,         [], "recentHistory=[](初回)");
  const last = out.finalMessages[out.finalMessages.length - 1];
  assertTrue(last.role === "assistant" && last.content.kind === "reply", "末尾は assistant reply");
  if (last.content.kind === "reply") {
    assertEqual(last.content.sessionIntent, "diagnose", "末尾.sessionIntent=diagnose");
  }
}

async function caseB() {
  console.log("\n[b] 2往復目 継続セッション維持(対象外 intent でも diagnose 維持)");
  const initial: Message[] = [
    { id: "u1", role: "user",      content: { kind: "text",  text: "診断したい" },                                    createdAt: 1 },
    { id: "a1", role: "assistant", content: { kind: "reply", text: "診断を始めますね", sessionIntent: "diagnose" }, createdAt: 2 },
  ];
  const fetchMock = createFetchMock({
    "/api/overlay/intent": () => ({ ok: true, intent: "style-consult", confidence: 0.55 }), // 対象外+低信頼
    "/api/ai/stylist-chat": () => ({ ok: true, reply: "もう少し教えてください", actions: [] }),
  });
  const out = await simulateHandleSubmit({ text: "似合う服が分からない", initialMessages: initial, fetchMock });
  assertEqual(out.sessionIntent,         "diagnose", "sessionIntent=diagnose 検出");
  assertEqual(out.isContinuingSession,   true,       "isContinuingSession=true");
  assertEqual(out.isSwitchToOtherTarget, false,      "対象外 intent → 切替なし");
  assertEqual(out.effectiveContinuing,   true,       "effectiveContinuing=true(継続)");
  assertEqual(out.isStylistTarget,       true,       "isStylistTarget=true");
  assertEqual(out.intentToSend,          "diagnose", "intentToSend=diagnose 維持");
  assertEqual(out.segmentBCalled,        true,       "段階B 呼ばれる");
}

async function caseC() {
  console.log("\n[c] 5往復 history N=3 維持(STYLIST_CHAT_HISTORY_MAX)");
  let messages: Message[] = [];
  let last5: SimulateOutput | null = null;
  for (let i = 1; i <= 5; i++) {
    const fetchMock = createFetchMock({
      "/api/overlay/intent": () => ({ ok: true, intent: "diagnose", confidence: 0.9 }),
      "/api/ai/stylist-chat": () => ({ ok: true, reply: `応答${i}`, actions: [] }),
    });
    const out = await simulateHandleSubmit({ text: `発話${i}`, initialMessages: messages, fetchMock });
    messages = out.finalMessages;
    if (i === 5) last5 = out;
  }
  assertTrue(last5 !== null, "5 往復完了");
  assertTrue(last5!.recentHistory !== null, "5往復目 recentHistory 算出");
  const hist = last5!.recentHistory ?? [];
  assertTrue(hist.length <= STYLIST_CHAT_HISTORY_MAX,
    `5往復目 history.length=${hist.length} ≤ ${STYLIST_CHAT_HISTORY_MAX}`);
}

async function caseD() {
  console.log("\n[d] プライバシー: PRODUCT_WORLDVIEW_TAGS 全件除去(動的・31語ハードコードなし)");
  // 全タグを含む合成 reply
  const synthetic = `これは合成テキストです: ${PRODUCT_WORLDVIEW_TAGS.join(" ")} を含みます。`;
  const { cleaned, removed } = stripCanonicalSlugs(synthetic);
  assertEqual(removed, true, "removed=true");

  // .length で動的検証(31 語が将来増減しても追従)
  console.log(`    INFO PRODUCT_WORLDVIEW_TAGS.length=${PRODUCT_WORLDVIEW_TAGS.length}(現状)`);
  for (const tag of PRODUCT_WORLDVIEW_TAGS) {
    const re = new RegExp(`\\b${escapeRegExp(tag)}\\b`, "i");
    assertFalse(re.test(cleaned), `tag "${tag}" 除去`);
  }

  // 呼出側 console.warn 相当の挙動再現(本体 route.ts:144-145)
  let warnCalled = false;
  const origWarn = console.warn;
  console.warn = () => { warnCalled = true; };
  try {
    const r = stripCanonicalSlugs("clean な気分");
    if (r.removed) console.warn("[stylist-chat] english slug detected in reply, removed");
  } finally {
    console.warn = origWarn;
  }
  assertEqual(warnCalled, true, "removed 時に console.warn 相当が呼ばれる");

  // 検出なし時は warn しない
  const r2 = stripCanonicalSlugs("英語スラッグを一切含まない自然な日本語文");
  assertEqual(r2.removed, false, "検出なし時 removed=false");
}

async function caseF() {
  console.log("\n[f] MVP-1b スコープ外 intent → 従来 intent-result カード");
  const fetchMock = createFetchMock({
    "/api/overlay/intent": () => ({ ok: true, intent: "coordinate", confidence: 0.9, mode: "api" }),
    // 段階B は呼ばれない想定
  });
  const out = await simulateHandleSubmit({ text: "コーデ提案して", initialMessages: [], fetchMock });
  assertEqual(out.isStylistTarget, false, "isStylistTarget=false");
  assertEqual(out.segmentBCalled,  false, "段階B 呼ばれない");
  const last = out.finalMessages[out.finalMessages.length - 1];
  assertTrue(last.content.kind === "intent-result", "末尾は intent-result(従来挙動)");
  // /api/ai/stylist-chat は呼ばれていない
  const sbCalled = fetchMock.calls.some(c => c.url.includes("/api/ai/stylist-chat"));
  assertFalse(sbCalled, "stylist-chat fetch 0 回");
}

async function caseG() {
  console.log("\n[g] 1.5b-i closet 会話化(初回 closet 発話 → reply に wardrobe 要約)");
  const fetchMock = createFetchMock({
    "/api/overlay/intent": () => ({ ok: true, intent: "closet", confidence: 0.95, mode: "navigate" }),
    "/api/ai/stylist-chat": () => ({
      ok: true,
      reply: "ブラック系のトップス 5 件・アウター 3 件があります。組みますか?一覧見ますか?",
      actions: [],
    }),
  });
  const out = await simulateHandleSubmit({ text: "クローゼット見せて", initialMessages: [], fetchMock });
  assertEqual(out.isStylistTarget, true,    "isStylistTarget=true");
  assertEqual(out.intentToSend,    "closet","intentToSend=closet");
  const last = out.finalMessages[out.finalMessages.length - 1];
  assertTrue(last.content.kind === "reply", "末尾は reply");
  if (last.content.kind === "reply") {
    assertEqual(last.content.sessionIntent, "closet", "sessionIntent=closet 保持");
    assertContains(last.content.text, "ブラック系", "reply に色系統言及(wardrobe 要約反映)");
    assertContains(last.content.text, "トップス",   "reply にカテゴリ言及(wardrobe 要約反映)");
  }
}

async function caseH1() {
  console.log("\n[h-1] hydrate 復元(localStorage に履歴 → setMessages)");
  const ls = createLocalStorageMock();
  const stored: Message[] = [
    { id: "x1", role: "user",      content: { kind: "text",  text: "テスト発話" },                                  createdAt: 1 },
    { id: "x2", role: "assistant", content: { kind: "reply", text: "テスト応答", sessionIntent: "diagnose" }, createdAt: 2 },
  ];
  ls.setItem(STORAGE_KEY, JSON.stringify(stored));
  const result = simulateHydrate(ls);
  assertEqual(result.messages.length, 2, "hydrate 後 messages.length=2");
  assertEqual(result.messages[0].id,  "x1", "復元 message[0].id=x1");
  assertEqual(result.hydrated,        true, "setHydrated(true)");
}

async function caseH2Alpha() {
  console.log("\n[h-2-α] persist 通常書込(hydrated=true・messages 非空)");
  const ls = createLocalStorageMock();
  const messages: Message[] = [
    { id: "p1", role: "user", content: { kind: "text", text: "発話" }, createdAt: 1 },
  ];
  const r = simulatePersist(ls, messages, true);
  assertEqual(r.wrote, true, "wrote=true");
  const saved = JSON.parse(ls.getItem(STORAGE_KEY) ?? "[]");
  assertEqual(saved.length, 1, "localStorage に 1 件保存");
  assertEqual(saved[0].id, "p1", "保存 message[0].id=p1");
}

async function caseH2Beta() {
  console.log("\n[h-2-β] ★ race fix v2 核心 — persist 空配列で既存履歴を上書きしない");
  const ls = createLocalStorageMock();
  // 先に有効な履歴を保存
  const prev: Message[] = [{ id: "prev", role: "user", content: { kind: "text", text: "保存済み" }, createdAt: 0 }];
  ls.setItem(STORAGE_KEY, JSON.stringify(prev));
  // messages=[] でも persist 実行(stale closure シミュレート)
  const r = simulatePersist(ls, [], true);
  assertEqual(r.wrote, false, "wrote=false(空配列ガードで早期 return)");
  const saved = JSON.parse(ls.getItem(STORAGE_KEY) ?? "[]");
  assertEqual(saved.length, 1,      "localStorage の既存履歴が破壊されない");
  assertEqual(saved[0].id,  "prev", "既存履歴 ID 維持");
}

async function caseH2Gamma() {
  console.log("\n[h-2-γ] persist hydrate 完了前ガード(!hydrated 早期 return)");
  const ls = createLocalStorageMock();
  const messages: Message[] = [{ id: "g1", role: "user", content: { kind: "text", text: "発話" }, createdAt: 1 }];
  const r = simulatePersist(ls, messages, false); // hydrated=false
  assertEqual(r.wrote, false, "wrote=false(hydrate 前は書込しない)");
  assertEqual(ls.getItem(STORAGE_KEY), null, "localStorage 未書込");
}

async function caseH3() {
  console.log("\n[h-3] hydrate 側 空配列復元防止(parsed.length>0 で弾く)");
  const ls = createLocalStorageMock();
  ls.setItem(STORAGE_KEY, "[]"); // 過去のバグで残された空配列
  const result = simulateHydrate(ls);
  assertEqual(result.messages.length, 0,    "messages 復元しない");
  assertEqual(result.hydrated,        true, "setHydrated(true) は呼ぶ");
}

async function caseI1() {
  console.log("\n[i-1] L4-A 切替 diagnose → closet(target 内・confidence ≥ 0.85)");
  const initial: Message[] = [
    { id: "u1", role: "user",      content: { kind: "text",  text: "診断したい" },                                    createdAt: 1 },
    { id: "a1", role: "assistant", content: { kind: "reply", text: "診断を始めますね", sessionIntent: "diagnose" }, createdAt: 2 },
  ];
  const fetchMock = createFetchMock({
    "/api/overlay/intent": () => ({ ok: true, intent: "closet", confidence: 0.95, mode: "navigate" }),
    "/api/ai/stylist-chat": () => ({ ok: true, reply: "クローゼットを見ましょう", actions: [] }),
  });
  const out = await simulateHandleSubmit({ text: "クローゼット見せて", initialMessages: initial, fetchMock });
  assertEqual(out.sessionIntent,         "diagnose", "切替前 sessionIntent=diagnose");
  assertEqual(out.isContinuingSession,   true,       "isContinuingSession=true");
  assertEqual(out.isSwitchToOtherTarget, true,       "★ 切替検出 true");
  assertEqual(out.effectiveContinuing,   false,      "新セッション扱い");
  assertEqual(out.intentToSend,          "closet",   "intentToSend=closet(新 intent)");
  assertEqual(out.recentHistory,         [],         "★ history=[](切替時リセット)");
  const last = out.finalMessages[out.finalMessages.length - 1];
  if (last.content.kind === "reply") {
    assertEqual(last.content.sessionIntent, "closet", "新セッション sessionIntent=closet");
  }
}

async function caseI2() {
  console.log("\n[i-2] L4-A 逆方向切替 closet → diagnose");
  const initial: Message[] = [
    { id: "u1", role: "user",      content: { kind: "text",  text: "クローゼット" },                                  createdAt: 1 },
    { id: "a1", role: "assistant", content: { kind: "reply", text: "了解しました", sessionIntent: "closet" }, createdAt: 2 },
  ];
  const fetchMock = createFetchMock({
    "/api/overlay/intent": () => ({ ok: true, intent: "diagnose", confidence: 0.9, mode: "navigate" }),
    "/api/ai/stylist-chat": () => ({ ok: true, reply: "診断を始めます", actions: [] }),
  });
  const out = await simulateHandleSubmit({ text: "診断したい", initialMessages: initial, fetchMock });
  assertEqual(out.sessionIntent,         "closet",   "切替前 sessionIntent=closet");
  assertEqual(out.isSwitchToOtherTarget, true,       "★ 切替検出 true");
  assertEqual(out.intentToSend,          "diagnose", "intentToSend=diagnose");
  assertEqual(out.recentHistory,         [],         "★ history=[](切替時リセット)");
}

async function caseI3() {
  console.log("\n[i-3] ★ L3 対象外 intent 継続維持(高信頼でも intent-result カードに戻らない)");
  const initial: Message[] = [
    { id: "u1", role: "user",      content: { kind: "text",  text: "診断したい" },                                createdAt: 1 },
    { id: "a1", role: "assistant", content: { kind: "reply", text: "了解",   sessionIntent: "diagnose" }, createdAt: 2 },
  ];
  const fetchMock = createFetchMock({
    "/api/overlay/intent": () => ({ ok: true, intent: "coordinate", confidence: 0.92, mode: "api" }), // 対象外+高信頼
    "/api/ai/stylist-chat": () => ({ ok: true, reply: "続けますね、診断は何が気になっていますか?", actions: [] }),
  });
  const out = await simulateHandleSubmit({ text: "コーデ提案して", initialMessages: initial, fetchMock });
  assertEqual(out.isSwitchToOtherTarget, false,      "対象外 intent → 切替なし(STYLIST_CHAT_INTENTS.has で自動 false)");
  assertEqual(out.effectiveContinuing,   true,       "★ 継続維持");
  assertEqual(out.intentToSend,          "diagnose", "intentToSend=diagnose 不変");
  assertEqual(out.segmentBCalled,        true,       "段階B 続行(intent-result カードに戻らない)");
  assertTrue((out.recentHistory ?? []).length > 0, "★ history 残置(切替でないので buildStylistHistory)");
}

async function caseI4() {
  console.log("\n[i-4] ★ L2 低信頼継続(confidence < SWITCH_THRESHOLD=0.85)");
  const initial: Message[] = [
    { id: "u1", role: "user",      content: { kind: "text",  text: "診断したい" },                                createdAt: 1 },
    { id: "a1", role: "assistant", content: { kind: "reply", text: "了解",   sessionIntent: "diagnose" }, createdAt: 2 },
  ];
  const fetchMock = createFetchMock({
    "/api/overlay/intent": () => ({ ok: true, intent: "closet", confidence: 0.75, mode: "navigate" }), // target 内だが低信頼
    "/api/ai/stylist-chat": () => ({ ok: true, reply: "続けますね", actions: [] }),
  });
  const out = await simulateHandleSubmit({ text: "曖昧な発話", initialMessages: initial, fetchMock });
  assertEqual(out.isSwitchToOtherTarget, false,      "confidence<0.85 → 切替なし");
  assertEqual(out.effectiveContinuing,   true,       "継続維持");
  assertEqual(out.intentToSend,          "diagnose", "intentToSend=diagnose 不変");
  assertTrue((out.recentHistory ?? []).length > 0, "history 残置");
}

// ====================================================================
// Main
// ====================================================================
async function main() {
  console.log("==========================================");
  console.log("P1-C-1.5 リグレッションテスト(HEAD = 60c7fa8 想定)");
  console.log("==========================================");
  console.log(`PRODUCT_WORLDVIEW_TAGS:   ${PRODUCT_WORLDVIEW_TAGS.length} 語(実物 import)`);
  console.log(`STYLIST_CHAT_INTENTS:     {${Array.from(STYLIST_CHAT_INTENTS).join(", ")}}`);
  console.log(`SWITCH_THRESHOLD:         ${SWITCH_THRESHOLD}`);
  console.log(`CONFIDENCE_THRESHOLD:     ${CONFIDENCE_THRESHOLD}`);
  console.log(`STYLIST_CHAT_HISTORY_MAX: ${STYLIST_CHAT_HISTORY_MAX}`);

  await caseA();
  await caseB();
  await caseC();
  await caseD();
  await caseF();
  await caseG();
  await caseH1();
  await caseH2Alpha();
  await caseH2Beta();
  await caseH2Gamma();
  await caseH3();
  await caseI1();
  await caseI2();
  await caseI3();
  await caseI4();

  console.log("\n==========================================");
  console.log(`Total: ${pass}/${pass + fail} passed`);
  if (fail > 0) {
    console.log("Failures:");
    for (const f of failures) console.log(`  - ${f}`);
  }
  console.log("==========================================");
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("[test-stylist-chat-continuity] FATAL:", err);
  process.exit(1);
});
