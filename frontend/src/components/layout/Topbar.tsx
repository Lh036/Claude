import { Menu, Plus, Rocket } from "lucide-react";
import { Button } from "@/components/ui/Button";

export function Topbar({
  onMenuClick,
  onAddBusiness,
  onStartScan,
}: {
  onMenuClick: () => void;
  onAddBusiness: () => void;
  onStartScan: () => void;
}) {
  return (
    <header className="sticky top-0 z-30 flex h-16 flex-shrink-0 items-center justify-between border-b border-[var(--color-border)] bg-white/90 px-4 backdrop-blur sm:px-6">
      <button
        onClick={onMenuClick}
        className="rounded-md p-2 text-[var(--color-ink-muted)] hover:bg-slate-100 lg:hidden"
        aria-label="Open navigation"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="hidden lg:block" />

      <div className="flex items-center gap-2">
        <Button variant="secondary" size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={onAddBusiness}>
          <span className="hidden sm:inline">Add business</span>
        </Button>
        <Button size="sm" icon={<Rocket className="h-3.5 w-3.5" />} onClick={onStartScan}>
          <span className="hidden sm:inline">New scan</span>
        </Button>
      </div>
    </header>
  );
}
