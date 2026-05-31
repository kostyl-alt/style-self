// Sprint H-4a: thread のメッセージ ロード / 永続化サービス(★ messages の単一真実源は page 側 state)
//
// 設計: docs/STYLE-SELF_Sprint-H-4_中央チャット大改造_凡庸問題根治_設計調査.md(700f61f)§B 工程1
// API: app/api/threads/[id]/messages(H-2・1a7c2e9)
//
// ★ 設計からの安全寄りの調整(機能等価):
//   承認設計は { messages, sendMessage } を hook が保持する形だが、page.tsx(1051行)は
//   既に messages を単一 state で持つ。二重 state 化(race / 不整合)を避けるため、本 hook は
//   ★ ロード/永続化の「サービス」に徹し、messages 配列は持たない。page が単一真実源を維持する。
//   出力 UI 構造化(7+5)は H-4b・本 hook は H-4a スコープ(thread 接続)のみ。

import { useCallback, useState } from "react";

// page.tsx の Message と round-trip させるための最小形(content は kind 判別共用体: unknown 扱い)。
export interface PersistableMessage {
  id:        string;
  role:      "user" | "assistant";
  content:   unknown;          // page.tsx の MessageContent(kind 判別共用体)
  createdAt: number;
}

// DB messages 行(app/api/threads/[id]/messages の返却形)
interface DbMessageRow {
  id:         string;
  thread_id:  string;
  role:       "user" | "assistant";
  content:    string;
  attachments: unknown | null;
  metadata:   { message?: PersistableMessage } | null;  // ★ H-4a: 原 Message を忠実復元するため格納
  created_at: string;
}

interface UseThreadMessagesResult {
  loading: boolean;
  error:   string | null;
  // DB → page Message[] にマップして返す(threadId が null なら空)
  loadMessages:   (threadId: string) => Promise<PersistableMessage[]>;
  // user/assistant 1 件を DB に永続化(fire-and-forget 用途・失敗は error に積むだけ)
  persistMessage: (threadId: string, message: PersistableMessage, displayText: string) => Promise<void>;
}

// DB 行 → page Message。metadata.message があれば忠実復元、無ければ text バブルにフォールバック。
function rowToMessage(row: DbMessageRow): PersistableMessage {
  if (row.metadata?.message) {
    return { ...row.metadata.message, id: row.id };
  }
  return {
    id:        row.id,
    role:      row.role,
    content:   { kind: "text", text: row.content },
    createdAt: Date.parse(row.created_at) || 0,
  };
}

export function useThreadMessages(): UseThreadMessagesResult {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const loadMessages = useCallback(async (threadId: string): Promise<PersistableMessage[]> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/threads/${threadId}/messages`, { method: "GET" });
      const data = await res.json() as { messages?: DbMessageRow[]; error?: string };
      if (!res.ok) {
        setError(data.error ?? `HTTP ${res.status}`);
        return [];
      }
      return (data.messages ?? []).map(rowToMessage);
    } catch (err) {
      setError(err instanceof Error ? err.message : "通信エラー");
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const persistMessage = useCallback(
    async (threadId: string, message: PersistableMessage, displayText: string): Promise<void> => {
      try {
        // content は表示テキスト(DB の text 列)・原 Message は metadata.message に格納し H-4b で活用
        const res = await fetch(`/api/threads/${threadId}/messages`, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({
            role:     message.role,
            content:  displayText.length > 0 ? displayText : "(空)",
            metadata: { message },
          }),
        });
        if (!res.ok) {
          const data = await res.json() as { error?: string };
          setError(data.error ?? `HTTP ${res.status}`);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "通信エラー");
      }
    },
    [],
  );

  return { loading, error, loadMessages, persistMessage };
}
