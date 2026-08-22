import { useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { AddBusinessModal } from "@/components/business/AddBusinessModal";
import { StartScanModal } from "@/components/scan/StartScanModal";

export function AppShell() {
  const navigate = useNavigate();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [addBusinessOpen, setAddBusinessOpen] = useState(false);
  const [startScanOpen, setStartScanOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--color-canvas)]">
      <Sidebar />

      {mobileNavOpen && (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <div className="fixed inset-0 bg-slate-900/40" onClick={() => setMobileNavOpen(false)} />
          <div className="relative z-10">
            <Sidebar variant="mobile" onNavigate={() => setMobileNavOpen(false)} />
          </div>
          <button
            onClick={() => setMobileNavOpen(false)}
            className="absolute right-3 top-3 rounded-md bg-white p-1.5 text-[var(--color-ink-muted)] shadow"
            aria-label="Close navigation"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          onMenuClick={() => setMobileNavOpen(true)}
          onAddBusiness={() => setAddBusinessOpen(true)}
          onStartScan={() => setStartScanOpen(true)}
        />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
            <Outlet />
          </div>
        </main>
      </div>

      <AddBusinessModal
        open={addBusinessOpen}
        onClose={() => setAddBusinessOpen(false)}
        onCreated={(business) => navigate(`/businesses/${business.id}`)}
      />
      <StartScanModal open={startScanOpen} onClose={() => setStartScanOpen(false)} />
    </div>
  );
}
