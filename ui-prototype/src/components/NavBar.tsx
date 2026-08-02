import { Camera, Flame, LayoutGrid, Target, TrendingUp } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { streak, user } from "../data/mockData";

export type Tab = "dashboard" | "log-meal" | "plan" | "progress";

const TABS: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: "dashboard", label: "Today", icon: LayoutGrid },
  { id: "log-meal", label: "Log meal", icon: Camera },
  { id: "plan", label: "Plan", icon: Target },
  { id: "progress", label: "Progress", icon: TrendingUp },
];

interface Props {
  active: Tab;
  onChange: (tab: Tab) => void;
}

export function NavBar({ active, onChange }: Props) {
  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:flex lg:w-60 lg:flex-col lg:border-r lg:border-stone-200 lg:bg-white lg:px-4 lg:py-6">
        <div className="mb-8 flex items-center gap-2 px-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
            N
          </span>
          <span className="text-lg font-bold tracking-tight text-stone-900">nutrilens</span>
        </div>

        <nav className="flex flex-1 flex-col gap-1">
          {TABS.map((tab) => {
            const isActive = active === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onChange(tab.id)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-brand-50 text-brand-700"
                    : "text-stone-500 hover:bg-stone-100 hover:text-stone-800"
                }`}
              >
                <tab.icon size={18} strokeWidth={2} />
                {tab.label}
              </button>
            );
          })}
        </nav>

        <div className="flex items-center gap-3 rounded-lg bg-stone-100 px-3 py-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-100 text-accent-600">
            <Flame size={16} strokeWidth={2.25} />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-stone-800">
              {streak.current}-day streak
            </p>
            <p className="truncate text-xs text-stone-500">Hi, {user.displayName}</p>
          </div>
        </div>
      </aside>

      {/* Mobile bottom tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-stone-200 bg-white/95 backdrop-blur-sm lg:hidden">
        <ul className="mx-auto flex max-w-3xl justify-around px-2 py-1.5">
          {TABS.map((tab) => {
            const isActive = active === tab.id;
            return (
              <li key={tab.id} className="flex-1">
                <button
                  onClick={() => onChange(tab.id)}
                  className={`flex w-full flex-col items-center gap-0.5 rounded-lg py-1.5 text-[11px] font-medium transition-colors ${
                    isActive ? "text-brand-700" : "text-stone-400"
                  }`}
                >
                  <tab.icon size={20} strokeWidth={isActive ? 2.25 : 1.9} />
                  {tab.label}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
