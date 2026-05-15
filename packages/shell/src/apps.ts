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
 * - **Local dev:** Vercel rewrites don't run, so paths would 404 on the apex
 *   port. Build an absolute URL to the app's own dev port instead
 *   (`http://localhost:3000/budget/`).
 */
export function getAppHref(app: AppDescriptor): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isDev = (import.meta as any).env?.DEV === true;
  if (!isDev) return app.href;
  const path = app.href === '/' ? '/' : `${app.href}/`;
  return `http://localhost:${app.devPort}${path}`;
}

export function getActiveAppId(pathname: string): AppId {
  if (pathname === '/' || pathname === '') return 'home';
  const segment = pathname.split('/').filter(Boolean)[0];
  const found = APPS.find((a) => a.id === segment);
  return found ? found.id : 'home';
}
