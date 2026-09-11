import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { HistoryPanel } from "@/components/history/history-panel";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1400px] px-6 py-8 md:px-10 md:py-10">
            {children}
          </div>
        </main>
      </div>
      <HistoryPanel />
    </div>
  );
}
