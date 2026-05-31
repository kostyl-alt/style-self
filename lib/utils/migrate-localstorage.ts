// Sprint H-4a: localStorage 会話履歴 → DB thread 自動移行(★ 冪等)
//
// 設計: docs/STYLE-SELF_Sprint-H-4_中央チャット大改造_凡庸問題根治_設計調査.md(700f61f)§B 工程2 / 論点 H4-1(案A)
//
// 既存ユーザーの localStorage 履歴(style-self:ai:messages:v1)を一度だけ DB thread 化する。
// ★ localStorage 自体は残す(念のため・破壊しない)。移行済みは migrated フラグで二度目以降 skip。
// ★ 自動移行後は ★ ページ遷移しない(ユーザーが意図的に開いたわけではないため・論点 H4-5 補足)。

const LS_MESSAGES_KEY = "style-self:ai:messages:v1";
const LS_MIGRATED_KEY = "style-self:ai:migrated:v1";

interface MigrateOptions {
  // 新規 thread 作成(成功で { id } を返す・失敗は null)
  createThread: (title: string) => Promise<{ id: string } | null>;
  // messages 一括保存(threadId とパース済み配列)
  saveMessages: (threadId: string, messages: unknown[]) => Promise<void>;
  onSuccess?:   (threadId: string) => void;
}

interface MigrateResult {
  migrated:  boolean;
  threadId?: string;
  error?:    string;
}

export async function migrateLocalstorageIfNeeded(options: MigrateOptions): Promise<MigrateResult> {
  if (typeof window === "undefined") return { migrated: false };

  // 1. 冪等性チェック(移行済みなら何もしない)
  if (localStorage.getItem(LS_MIGRATED_KEY) === "true") return { migrated: false };

  // 2. 既存履歴 read(無ければ flag 立てて終了)
  const raw = localStorage.getItem(LS_MESSAGES_KEY);
  if (!raw) {
    localStorage.setItem(LS_MIGRATED_KEY, "true");
    return { migrated: false };
  }

  let parsed: unknown[];
  try {
    const json: unknown = JSON.parse(raw);
    if (!Array.isArray(json) || json.length === 0) {
      localStorage.setItem(LS_MIGRATED_KEY, "true");
      return { migrated: false };
    }
    parsed = json;
  } catch {
    // 破損データは skip(既存ユーザーに被害を出さない)
    localStorage.setItem(LS_MIGRATED_KEY, "true");
    return { migrated: false };
  }

  // 3. 新規 thread 作成
  try {
    const thread = await options.createThread("過去の会話");
    if (!thread) {
      // ★ flag は立てない(次回リトライ可能・重複は createThread 失敗時のみなので発生しない)
      return { migrated: false, error: "thread 作成に失敗しました" };
    }

    // 4. messages 一括保存
    await options.saveMessages(thread.id, parsed);

    // 5. 移行済みフラグ(localStorage 本体は残す)
    localStorage.setItem(LS_MIGRATED_KEY, "true");
    options.onSuccess?.(thread.id);

    return { migrated: true, threadId: thread.id };
  } catch (err) {
    return { migrated: false, error: err instanceof Error ? err.message : String(err) };
  }
}
