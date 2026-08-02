export type Tab = "dashboard" | "log-meal" | "plan" | "progress";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "dashboard", label: "Today", icon: "\u{1F4CA}" },
  { id: "log-meal", label: "Log Meal", icon: "\u{1F4F7}" },
  { id: "plan", label: "Plan", icon: "\u{1F3AF}" },
  { id: "progress", label: "Progress", icon: "\u{1F4C8}" },
];

interface Props {
  active: Tab;
  onChange: (tab: Tab) => void;
}

export function NavBar({ active, onChange }: Props) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-gray-200 bg-white sm:static sm:border-t-0 sm:border-b">
      <ul className="mx-auto flex max-w-3xl justify-around px-2 py-2 sm:justify-start sm:gap-2 sm:px-6">
        {TABS.map((tab) => (
          <li key={tab.id}>
            <button
              onClick={() => onChange(tab.id)}
              className={`flex flex-col items-center gap-0.5 rounded-lg px-4 py-1.5 text-xs font-medium transition-colors sm:flex-row sm:gap-2 sm:text-sm ${
                active === tab.id
                  ? "bg-brand-50 text-brand-700"
                  : "text-gray-500 hover:bg-gray-50"
              }`}
            >
              <span aria-hidden="true">{tab.icon}</span>
              {tab.label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
