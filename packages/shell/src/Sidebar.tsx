import { Home, LogOut } from 'lucide-react';
import clsx from 'clsx';
import { APPS, getAppHref, type AppDescriptor, type AppId } from './apps';
import { useUrlAuth } from './auth';

const homeApp = APPS.find((a) => a.id === 'home')!;

export interface SidebarProps {
  activeAppId: AppId;
  onSignOut?: () => void;
}

export function Sidebar({ activeAppId, onSignOut }: SidebarProps) {
  const urlAuth = useUrlAuth();
  const isHomeActive = activeAppId === 'home';
  const buildHref = (app: AppDescriptor) => {
    const href = getAppHref(app);
    return urlAuth && href.startsWith('http') ? urlAuth(href) : href;
  };

  return (
    <nav
      aria-label="App navigation"
      className="hidden md:flex flex-col items-end w-14 py-6 text-warm-text-on-dark"
    >
      <a
        href={buildHref(homeApp)}
        aria-label="Home"
        aria-current={isHomeActive ? 'page' : undefined}
        className={clsx(
          'flex items-center justify-center w-12 h-12 rounded-xl transition-colors',
          isHomeActive
            ? 'bg-warm-accent text-warm-bg'
            : 'text-warm-text-tertiary hover:bg-warm-bg-dark-muted hover:text-warm-text-on-dark'
        )}
      >
        <Home size={22} aria-hidden="true" />
      </a>

      <div className="h-6" aria-hidden />

      <ul className="flex flex-col items-end gap-[18px] flex-1 w-full">
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
                  'flex items-center justify-center w-12 h-12 rounded-[14px] transition-colors',
                  isActive
                    ? 'bg-warm-accent text-warm-bg'
                    : 'text-warm-text-tertiary hover:bg-warm-bg-dark-muted hover:text-warm-text-on-dark'
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
          className="flex flex-col items-center gap-1.5 mt-2 text-warm-text-tertiary hover:text-warm-text-on-dark"
        >
          <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-warm-bg-dark-muted">
            <LogOut size={18} aria-hidden="true" />
          </span>
          <span className="text-[11px]">Log Out</span>
        </button>
      ) : null}
    </nav>
  );
}
