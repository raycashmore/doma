export type AppId = 'home' | 'budget' | 'mortgage' | 'schedule' | 'lists' | 'meals';

export type AppDescriptor = {
  id: AppId;
  label: string;
  /** Production path. In production, Vercel rewrites route this to the right zone. */
  href: string;
  enabled: boolean;
  /** Local dev port. Used to build absolute URLs in dev (where rewrites don't run). */
  devPort: number;
};

export const APPS: AppDescriptor[] = [
  {
    id: 'home',
    label: 'Home',
    href: '/',
    enabled: true,
    devPort: 3000
  },
  {
    id: 'budget',
    label: 'Budget',
    href: '/budget',
    enabled: true,
    devPort: 3001
  },
  {
    id: 'mortgage',
    label: 'Mortgage',
    href: '/mortgage',
    enabled: false,
    devPort: 3002
  },
  {
    id: 'schedule',
    label: 'Schedule',
    href: '/schedule',
    enabled: true,
    devPort: 3003
  },
  {
    id: 'lists',
    label: 'Lists',
    href: '/lists',
    enabled: true,
    devPort: 3004
  },
  {
    id: 'meals',
    label: 'Meals',
    href: '/meals',
    enabled: true,
    devPort: 3005
  }
];

/**
 * Resolve the right URL for an app link given the current runtime.
 *
 * - **Production (`isDev === false`):** returns the app's path (`/budget`).
 *   Vercel rewrites route it from the apex domain to the correct zone.
 * - **Dev (`isDev === true`):** each app runs at the root of its own port
 *   (Vercel rewrites don't run locally), so build an absolute URL to that port.
 *
 * `isDev` is injected by each app because the source differs per framework
 * (Vite exposes `import.meta.env.DEV`; Next exposes `process.env.NODE_ENV`).
 */
export function getAppHref(app: AppDescriptor, isDev: boolean): string {
  if (!isDev) return app.href;
  return `http://localhost:${app.devPort}/`;
}

export function getActiveAppId(pathname: string): AppId {
  if (pathname === '/' || pathname === '') return 'home';
  const segment = pathname.split('/').filter(Boolean)[0];
  const found = APPS.find((app) => app.id === segment);
  return found ? found.id : 'home';
}
