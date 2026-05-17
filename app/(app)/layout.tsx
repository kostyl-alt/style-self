import BottomNav from "@/components/BottomNav";
import DevAuthBadge from "@/components/dev/DevAuthBadge";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="pb-20">{children}</div>
      <BottomNav />
      <DevAuthBadge />
    </>
  );
}
