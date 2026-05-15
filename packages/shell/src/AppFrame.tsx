import type { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import type { AppId } from './apps';

export interface AppFrameProps {
  appId: AppId;
  title: string;
  actions?: ReactNode;
  children: ReactNode;
  onSignOut?: () => void;
}

export function AppFrame({
  appId,
  title,
  actions,
  children,
  onSignOut
}: AppFrameProps) {
  // Each app declares its own appId — that's authoritative for sidebar
  // active state. We used to derive it from window.location.pathname, but
  // that breaks in dev where each app serves at `/` on its own port (and
  // would always look like "home").
  return (
    <div className="flex h-screen bg-neutral-50">
      <Sidebar activeAppId={appId} onSignOut={onSignOut} />
      <div className="flex flex-col flex-1 min-w-0">
        <Header title={title} actions={actions} />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
