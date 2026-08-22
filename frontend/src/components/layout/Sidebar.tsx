import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Building2,
  Radar,
  PlayCircle,
  Activity,
  ScrollText,
  AlertOctagon,
  Settings,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/cn";

const NAV_ITEMS = [
  { to: "/", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/businesses", label: "Businesses", icon: Building2 },
  { to: "/scans", label: "Scans", icon: Radar },
  { to: "/runs", label: "Runs", icon: PlayCircle },
  { to: "/activity", label: "Activity", icon: Activity },
  { to: "/logs", label: "Logs", icon: ScrollText },
  { to: "/errors", label: "Errors", icon: AlertOctagon },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar({ variant = "desktop", onNavigate }: { variant?: "desktop" | "mobile"; onNavigate?: () => void }) {
  return (
    <aside
      className={cn(
        "w-64 flex-shrink-0 flex-col border-r border-[var(--color-border)] bg-white",
        variant === "desktop" ? "hidden lg:flex" : "flex h-full",
      )}
    >
      <div className="flex h-16 items-center gap-2 border-b border-[var(--color-border)] px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-accent)] text-white">
          <Sparkles className="h-4.5 w-4.5" />
        </div>
        <div>
          <div className="text-sm font-semibold leading-none text-[var(--color-ink)]">GEO Platform</div>
          <div className="mt-0.5 text-[11px] leading-none text-[var(--color-ink-muted)]">Visibility Intelligence</div>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 px-3 py-4">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
                  : "text-[var(--color-ink-muted)] hover:bg-slate-50 hover:text-[var(--color-ink)]",
              )
            }
          >
            <Icon className="h-4 w-4" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-[var(--color-border)] px-4 py-3 text-[11px] text-[var(--color-ink-faint)]">
        GEO System v0.1
      </div>
    </aside>
  );
}
