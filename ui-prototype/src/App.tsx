import { useState } from "react";
import { NavBar, type Tab } from "./components/NavBar";
import { Dashboard } from "./pages/Dashboard";
import { LogMeal } from "./pages/LogMeal";
import { Plan } from "./pages/Plan";
import { Progress } from "./pages/Progress";

const PAGES: Record<Tab, React.ComponentType> = {
  dashboard: Dashboard,
  "log-meal": LogMeal,
  plan: Plan,
  progress: Progress,
};

export default function App() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const Page = PAGES[tab];

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar active={tab} onChange={setTab} />
      <main>
        <Page />
      </main>
    </div>
  );
}
