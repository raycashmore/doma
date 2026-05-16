import {
  Home,
  PiggyBank,
  Landmark,
  Calendar,
  ListChecks,
  ShoppingBasket,
  ChefHat,
  type LucideIcon
} from 'lucide-react';

export type AppId =
  | 'home'
  | 'budget'
  | 'mortgage'
  | 'schedule'
  | 'todo'
  | 'shopping'
  | 'recipes';

export interface AppDescriptor {
  id: AppId;
  label: string;
  /** Production path. In production, Vercel rewrites route this to the right zone. */
  href: string;
  icon: LucideIcon;
  enabled: boolean;
  /** Local dev port. Used to build absolute URLs in dev (where rewrites don't run). */
  devPort: number;
}

export const APPS: AppDescriptor[] = [
  {
    id: 'home',
    label: 'Home',
    href: '/',
    icon: Home,
    enabled: true,
    devPort: 3001
  },
  {
    id: 'budget',
    label: 'Budget',
    href: '/budget',
    icon: PiggyBank,
    enabled: true,
    devPort: 3000
  },
  {
    id: 'mortgage',
    label: 'Mortgage',
    href: '/mortgage',
    icon: Landmark,
    enabled: false,
    devPort: 3002
  },
  {
    id: 'schedule',
    label: 'Schedule',
    href: '/schedule',
    icon: Calendar,
    enabled: false,
    devPort: 3003
  },
  {
    id: 'todo',
    label: 'Todo',
    href: '/todo',
    icon: ListChecks,
    enabled: false,
    devPort: 3004
  },
  {
    id: 'shopping',
    label: 'Shopping',
    href: '/shopping',
    icon: ShoppingBasket,
    enabled: false,
    devPort: 3005
  },
  {
    id: 'recipes',
    label: 'Recipes',
    href: '/recipes',
    icon: ChefHat,
    enabled: false,
    devPort: 3006
  }
];

/**
 * Resolve the right URL for an app link given the current runtime.
 *
 * - **Production:** returns the app's path (`/budget`). Vercel rewrites route
 *   it from the apex domain to the correct zone.
 * - **Dev behind the Caddy proxy** (see /Caddyfile): also returns the path —
 *   the proxy reverse-routes /budget/* to the Budget zone, so a single origin
 *   serves everything. This is what lets Clerk's cookie cover all zones in
 *   dev. Detected at runtime by checking that the browser host isn't one of
 *   the direct dev ports.
 * - **Dev without the proxy:** each app serves at the root of its own port,
 *   so build an absolute URL to the app's dev port.
 */
export function getAppHref(app: AppDescriptor): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isDev = (import.meta as any).env?.DEV === true;
  if (!isDev) return app.href;
  if (typeof window !== 'undefined') {
    const directDevHosts = APPS.map((a) => `localhost:${a.devPort}`);
    const isBehindProxy = !directDevHosts.includes(window.location.host);
    if (isBehindProxy) return app.href;
  }
  return `http://localhost:${app.devPort}/`;
}

export function getActiveAppId(pathname: string): AppId {
  if (pathname === '/' || pathname === '') return 'home';
  const segment = pathname.split('/').filter(Boolean)[0];
  const found = APPS.find((a) => a.id === segment);
  return found ? found.id : 'home';
}
