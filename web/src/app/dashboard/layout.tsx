import { NavRail } from "./NavRail";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col md:flex-row h-screen bg-bg-base overflow-hidden">
      <NavRail />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
