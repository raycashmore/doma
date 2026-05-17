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
  return (
    <div className="min-h-screen bg-warm-bg-dark font-warm-body text-warm-text-primary md:h-screen md:overflow-hidden">
      <div className="flex h-screen overflow-hidden bg-warm-bg-dark md:h-full">
        <Sidebar activeAppId={appId} onSignOut={onSignOut} />
        <div className="flex min-h-0 flex-1 flex-col">
          <Header title={title} actions={actions} />
          <main className="min-h-0 flex-1 overflow-auto px-7 pb-7 md:overflow-hidden">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
