import { useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';
import type { RouteId } from '@/types';
import { useRouter } from '@/router';
import { Sidebar } from '@/components/Sidebar';
import { LandingPage } from '@/pages/LandingPage';
import { SetupPage } from '@/pages/SetupPage';
import { ForecastPage } from '@/pages/ForecastPage';
import { CounterfactualPage } from '@/pages/CounterfactualPage';
import { ImpactPage } from '@/pages/ImpactPage';
import { ValidationPage } from '@/pages/ValidationPage';
import { HistoryPage } from '@/pages/HistoryPage';
import { AppStateProvider } from '@/state/AppStateContext';

export default function App() {
  return (
    <AppStateProvider>
      <AppInner />
    </AppStateProvider>
  );
}

function AppInner() {
  const { route, navigate } = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setMobileOpen(false);
  }, [route]);

  if (route === 'landing') {
    return <LandingPage navigate={navigate} />;
  }

  return (
    <div className="min-h-screen bg-primary-950">
      <div className="mx-auto flex min-h-screen max-w-[1400px]">
        {/* Desktop sidebar */}
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-primary-800/70 bg-primary-900/40 lg:block">
          <Sidebar route={route} />
        </aside>

        {/* Mobile drawer */}
        {mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div
              className="absolute inset-0 bg-primary-950/70 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
            />
            <aside className="absolute left-0 top-0 h-full w-72 border-r border-primary-800/70 bg-primary-900 animate-fade-in">
              <button
                className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-lg text-neutral2-400 hover:bg-primary-800 hover:text-white focus-ring"
                onClick={() => setMobileOpen(false)}
                aria-label="Close navigation"
              >
                <X className="h-5 w-5" />
              </button>
              <Sidebar route={route} onNavigate={() => setMobileOpen(false)} />
            </aside>
          </div>
        )}

        {/* Main column */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Mobile top bar */}
          <div className="sticky top-0 z-30 flex items-center justify-between border-b border-primary-800/70 bg-primary-950/80 px-4 py-3 backdrop-blur lg:hidden">
            <button
              className="grid h-9 w-9 place-items-center rounded-lg text-neutral2-300 hover:bg-primary-800 hover:text-white focus-ring"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
            >
              <Menu className="h-5 w-5" />
            </button>
            <span className="font-display text-sm font-semibold tracking-tight text-white">
              PlatePilot
            </span>
            <span className="h-9 w-9" />
          </div>

          <main className="flex-1">
            <RouteView route={route} navigate={navigate} />
          </main>
        </div>
      </div>
    </div>
  );
}

function RouteView({
  route,
  navigate,
}: {
  route: RouteId;
  navigate: (to: RouteId) => void;
}) {
  switch (route) {
    case 'setup':
      return <SetupPage />;
    case 'forecast':
      return <ForecastPage />;
    case 'counterfactual':
      return <CounterfactualPage />;
    case 'impact':
      return <ImpactPage />;
    case 'validation':
      return <ValidationPage />;
    case 'history':
      return <HistoryPage />;
    case 'landing':
    default:
      return <LandingPage navigate={navigate} />;
  }
}
