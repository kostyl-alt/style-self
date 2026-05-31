// Sprint H-3: スレッド CRUD の fetch wrapper(★ plain fetch + useState・SWR 未導入)
//
// 設計: docs/STYLE-SELF_Sprint-H-3_左ペイン_スレッド履歴一覧UI_設計調査.md(129bd9f)§D
// API: app/api/threads(H-2・1a7c2e9)
//
// 既存慣習(component 内インライン fetch)を hook に分離。page.tsx(1051 行)の肥大化を避ける。
// ★ H-3 スコープ: スレッド一覧 / 作成 / 改名 / 削除。中央チャットとの接続(messages ロード)は H-4。

import { useCallback, useEffect, useState } from "react";
import type { ChatThreadRow } from "@/types/chat-thread";

export type Thread = ChatThreadRow;

interface UseThreadsResult {
  threads: Thread[];
  loading: boolean;
  error:   string | null;
  refresh: () => Promise<void>;
  create:  (title?: string, moodboardId?: string | null) => Promise<Thread | null>;
  rename:  (id: string, title: string) => Promise<void>;
  remove:  (id: string) => Promise<void>;
}

export function useThreads(): UseThreadsResult {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/threads", { method: "GET" });
      const data = await res.json() as { threads?: Thread[]; error?: string };
      if (!res.ok) {
        setError(data.error ?? `HTTP ${res.status}`);
        return;
      }
      setThreads(data.threads ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "通信エラー");
    } finally {
      setLoading(false);
    }
  }, []);

  const create = useCallback(
    async (title?: string, moodboardId?: string | null): Promise<Thread | null> => {
      try {
        const res = await fetch("/api/threads", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ title, moodboard_id: moodboardId ?? undefined }),
        });
        const data = await res.json() as { thread?: Thread; error?: string };
        if (!res.ok || !data.thread) {
          setError(data.error ?? `HTTP ${res.status}`);
          return null;
        }
        // 楽観更新(先頭に挿入)+ サーバ整合のため refresh は呼ばず手元に反映
        setThreads((prev) => [data.thread as Thread, ...prev]);
        return data.thread;
      } catch (err) {
        setError(err instanceof Error ? err.message : "通信エラー");
        return null;
      }
    },
    [],
  );

  const rename = useCallback(async (id: string, title: string) => {
    // 楽観更新
    setThreads((prev) => prev.map((t) => (t.id === id ? { ...t, title } : t)));
    try {
      const res = await fetch(`/api/threads/${id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ title }),
      });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        setError(data.error ?? `HTTP ${res.status}`);
        await refresh();  // 失敗時は真値に戻す
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "通信エラー");
      await refresh();
    }
  }, [refresh]);

  const remove = useCallback(async (id: string) => {
    // 楽観更新
    setThreads((prev) => prev.filter((t) => t.id !== id));
    try {
      const res = await fetch(`/api/threads/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        setError(data.error ?? `HTTP ${res.status}`);
        await refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "通信エラー");
      await refresh();
    }
  }, [refresh]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { threads, loading, error, refresh, create, rename, remove };
}
