import DevAuthBadge from "@/components/dev/DevAuthBadge";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <DevAuthBadge />
    </>
  );
}
