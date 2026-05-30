import clsx from 'clsx';
import { APPS, getAppHref, type AppDescriptor, type AppId } from './apps';
import { useUrlAuth } from './auth';

const homeApp = APPS.find((a) => a.id === 'home')!;

export type MobileNavProps = {
  activeAppId: AppId;
  isDev: boolean;
};

export function MobileNav({ activeAppId, isDev }: MobileNavProps) {
  const urlAuth = useUrlAuth();
  const buildHref = (app: AppDescriptor) => {
    const href = getAppHref(app, isDev);
    return urlAuth && href.startsWith('http') ? urlAuth(href) : href;
  };

  const items = [homeApp, ...APPS.filter((a) => a.id !== 'home' && a.enabled)];

  return (
    <nav
      aria-label="App navigation"
      className="flex items-stretch justify-around border-t border-warm-border bg-warm-bg-dark px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:hidden"
    >
      {items.map((app) => {
        const Icon = app.icon;
        const isActive = activeAppId === app.id;
        return (
          <a
            key={app.id}
            href={buildHref(app)}
            aria-label={app.label}
            aria-current={isActive ? 'page' : undefined}
            className={clsx(
              'flex flex-1 flex-col items-center gap-1 rounded-xl py-1.5 text-[10px] transition-colors',
              isActive
                ? 'text-warm-accent'
                : 'text-warm-text-tertiary hover:text-warm-text-on-dark'
            )}
          >
            <Icon size={20} aria-hidden="true" />
            <span>{app.label}</span>
          </a>
        );
      })}
    </nav>
  );
}
