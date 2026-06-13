"use client";

// 会話消失修正 (ii) レイアウト保持: /ai の会話 messages を (app)/layout レベルへ持ち上げる。
//   /ai ↔ /self 等の往復は (app)/layout が非再マウントなので Context state が生存し会話が残る。
//   フルリロード / cold open は Provider が初期化され messages=[] = 新規(7c056d7 の意図を維持)。
//   ★ hydrate(localStorage 読み戻し)は足さない = 初期値は常に空。persist は ai/page 側に温存。
import { createContext, useContext, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import type { Message } from "@/types/chat-ui";

interface ChatSessionValue {
  messages:    Message[];
  setMessages: Dispatch<SetStateAction<Message[]>>;
  // 一時チャット(TEMPORARY_CHAT_MODE)の ON/OFF。★ messages と同じ Provider に置くことで
  //   /ai↔/self 往復で生存・フルリロードで初期化(=痕跡ゼロ)のライフサイクルを messages と揃える。
  temporaryMode:    boolean;
  setTemporaryMode: Dispatch<SetStateAction<boolean>>;
}

const ChatSessionContext = createContext<ChatSessionValue | null>(null);

export function ChatSessionProvider({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [temporaryMode, setTemporaryMode] = useState(false);
  const value = useMemo<ChatSessionValue>(
    () => ({ messages, setMessages, temporaryMode, setTemporaryMode }),
    [messages, temporaryMode],
  );
  return <ChatSessionContext.Provider value={value}>{children}</ChatSessionContext.Provider>;
}

export function useChatSession(): ChatSessionValue {
  const ctx = useContext(ChatSessionContext);
  if (!ctx) throw new Error("useChatSession must be used within ChatSessionProvider");
  return ctx;
}
