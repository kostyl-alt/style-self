import DevAuthBadge from "@/components/dev/DevAuthBadge";
import { ChatSessionProvider } from "@/components/chat/ChatSessionProvider";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ChatSessionProvider>
      {children}
      <DevAuthBadge />
    </ChatSessionProvider>
  );
}
