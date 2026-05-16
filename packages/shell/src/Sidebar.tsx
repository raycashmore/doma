import { LogOut } from 'lucide-react';
import clsx from 'clsx';
import {
  APPS,
  getAppHref,
  type AppDescriptor,
  type AppId
} from './apps';
import { useUrlAuth } from './auth';

const homeApp = APPS.find((a) => a.id === 'home')!;

export interface SidebarProps {
  activeAppId: AppId;
  onSignOut?: () => void;
  brandLabel?: string;
}

export function Sidebar({
  activeAppId,
  onSignOut,
  brandLabel = 'D'
}: SidebarProps) {
  // When signed-in via Clerk, append the dev session token to cross-origin
  // URLs so the destination port auto-rehydrates the session. In production
  // (same origin) and pre-Clerk dev (no provider), this is the identity.
  const urlAuth = useUrlAuth();
  const buildHref = (app: AppDescriptor) => {
    const href = getAppHref(app);
    return urlAuth && href.startsWith('http') ? urlAuth(href) : href;
  };

  return (
    <nav
      aria-label="App navigation"
      className="flex flex-col items-center gap-2 w-16 bg-neutral-900 text-neutral-100 py-4 h-full"
    >
      <a
        href={buildHref(homeApp)}
        className="flex items-center justify-center w-10 h-10 rounded-md bg-orange-500 text-white font-bold text-lg mb-4"
        aria-label="Home"
      >
        {brandLabel}
      </a>

      <ul className="flex flex-col gap-2 flex-1 w-full items-center">
        {APPS.filter((app) => app.id !== 'home' && app.enabled).map((app) => {
          const Icon = app.icon;
          const isActive = activeAppId === app.id;
          return (
            <li key={app.id}>
              <a
                href={buildHref(app)}
                aria-label={app.label}
                aria-current={isActive ? 'page' : undefined}
                className={clsx(
                  'flex items-center justify-center w-10 h-10 rounded-md transition-colors',
                  isActive
                    ? 'bg-orange-500 text-white'
                    : 'text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100'
                )}
              >
                <Icon size={20} aria-hidden="true" />
              </a>
            </li>
          );
        })}
      </ul>

      {onSignOut ? (
        <button
          type="button"
          onClick={onSignOut}
          aria-label="Log out"
          className="flex items-center justify-center w-10 h-10 rounded-md text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100"
        >
          <LogOut size={20} aria-hidden="true" />
        </button>
      ) : null}
    </nav>
  );
}
