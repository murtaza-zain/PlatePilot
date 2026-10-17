import { useCallback, useEffect, useState } from 'react';
import type { RouteId } from '@/types';

/**
 * Minimal hash-based router — no external dependency.
 * Routes are simple string ids so the whole app stays in one bundle
 * and Phase 1 doesn't need a routing library.
 */

const ROUTES: RouteId[] = [
  'landing',
  'setup',
  'forecast',
  'counterfactual',
  'impact',
  'validation',
  'history',
];

function normalizeHash(): RouteId {
  const raw = window.location.hash.replace(/^#\/?/, '').trim();
  return (ROUTES.includes(raw as RouteId) ? raw : 'landing') as RouteId;
}

export function useRouter() {
  const [route, setRoute] = useState<RouteId>(() =>
    typeof window === 'undefined' ? 'landing' : normalizeHash(),
  );

  useEffect(() => {
    const onChange = () => setRoute(normalizeHash());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  const navigate = useCallback((to: RouteId) => {
    if (typeof window !== 'undefined') {
      window.location.hash = `/${to}`;
      // setRoute fires via hashchange, but set immediately for snappy UX
      setRoute(to);
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    }
  }, []);

  return { route, navigate };
}

export function routeHref(to: RouteId): string {
  return `#/${to}`;
}
