import { createContext, useCallback, useContext, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { Calculator, LayoutDashboard, Menu, Plus, ReceiptText, Tags, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button, IconButton } from "./ui";
import { ExpenseModal, type ExpenseModalState } from "./ExpenseModal";
import type { Expense } from "@shared/types";

const NAV = [
  { to: "/", label: "Overzicht", icon: LayoutDashboard, end: true },
  { to: "/kosten", label: "Kosten", icon: ReceiptText },
  { to: "/categorieen", label: "Categorieën & budgetten", icon: Tags },
  { to: "/btw", label: "BTW-calculator", icon: Calculator },
];

interface ExpenseEditor {
  openNew: () => void;
  openEdit: (expense: Expense) => void;
  openDuplicate: (expense: Expense) => void;
}

const ExpenseEditorContext = createContext<ExpenseEditor | null>(null);

export function useExpenseEditor(): ExpenseEditor {
  const ctx = useContext(ExpenseEditorContext);
  if (!ctx) throw new Error("useExpenseEditor moet binnen Layout gebruikt worden");
  return ctx;
}

export function Logo({ className }: { className?: string }) {
  return <img src="/logo.svg" alt="" className={cn("h-8 w-8", className)} />;
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full w-64 flex-col border-r border-[var(--color-border)] bg-white">
      <div className="flex h-16 items-center gap-2.5 px-5">
        <Logo />
        <div className="leading-tight">
          <div className="text-[15px] font-semibold tracking-tight">Analyty</div>
          <div className="text-xs text-[var(--color-ink-muted)]">Kostenbeheer</div>
        </div>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4" aria-label="Hoofdmenu">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-2.5 rounded-full px-3.5 py-2 text-sm font-medium transition-colors",
                isActive ? "bg-[var(--color-lime)] text-[var(--color-ink)]" : "text-[var(--color-ink-muted)] hover:bg-[var(--color-canvas)] hover:text-[var(--color-ink)]",
              )
            }
          >
            <Icon className="h-4 w-4" />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="px-5 py-4 text-xs text-[var(--color-ink-faint)]">Bedragen in euro · BTW 9% / 21%</div>
    </div>
  );
}

export function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [modal, setModal] = useState<ExpenseModalState | null>(null);

  const openNew = useCallback(() => setModal({ mode: "new" }), []);
  const openEdit = useCallback((expense: Expense) => setModal({ mode: "edit", expense }), []);
  const openDuplicate = useCallback((expense: Expense) => setModal({ mode: "duplicate", expense }), []);

  return (
    <ExpenseEditorContext.Provider value={{ openNew, openEdit, openDuplicate }}>
      <div className="flex h-screen overflow-hidden">
        <aside className="hidden lg:block">
          <Sidebar />
        </aside>

        {mobileOpen && (
          <div className="fixed inset-0 z-40 flex lg:hidden">
            <div className="fixed inset-0 bg-[#141414]/40" onClick={() => setMobileOpen(false)} />
            <div className="relative z-10">
              <Sidebar onNavigate={() => setMobileOpen(false)} />
            </div>
            <IconButton label="Menu sluiten" onClick={() => setMobileOpen(false)} className="absolute top-3 right-3 bg-white">
              <X className="h-4 w-4" />
            </IconButton>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-16 flex-shrink-0 items-center justify-between gap-3 border-b border-[var(--color-border)] bg-[var(--color-canvas)]/90 px-4 backdrop-blur sm:px-6">
            <div className="flex items-center gap-2 lg:hidden">
              <IconButton label="Menu openen" onClick={() => setMobileOpen(true)}>
                <Menu className="h-5 w-5" />
              </IconButton>
              <Logo className="h-7 w-7" />
            </div>
            <div className="hidden lg:block" />
            <Button variant="lime" icon={<Plus className="h-4 w-4" />} onClick={openNew}>
              Kost toevoegen
            </Button>
          </header>
          <main className="flex-1 overflow-y-auto">
            <div className="mx-auto max-w-[1300px] px-4 py-6 sm:px-6 lg:px-8">
              <Outlet />
            </div>
          </main>
        </div>
      </div>

      {modal && <ExpenseModal state={modal} onClose={() => setModal(null)} />}
    </ExpenseEditorContext.Provider>
  );
}
