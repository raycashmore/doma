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
    <div className="min-h-screen bg-warm-bg p-0 md:p-8 font-warm-body text-warm-text-primary">
      <div className="flex h-[calc(100vh-0px)] md:h-[calc(100vh-4rem)] overflow-hidden rounded-none md:rounded-[32px] bg-warm-bg-dark">
        <Sidebar activeAppId={appId} onSignOut={onSignOut} />
        <div className="flex flex-col flex-1 min-w-0">
          <Header title={title} actions={actions} />
          <main className="flex-1 overflow-auto px-7 pb-7">{children}</main>
        </div>
      </div>
    </div>
  );
}
