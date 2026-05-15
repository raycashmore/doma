import { useEffect, useState, type ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { getActiveAppId, type AppId } from './apps';

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
  const [activeAppId, setActiveAppId] = useState<AppId>(appId);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setActiveAppId(getActiveAppId(window.location.pathname));
    }
  }, []);

  return (
    <div className="flex h-screen bg-neutral-50">
      <Sidebar activeAppId={activeAppId} onSignOut={onSignOut} />
      <div className="flex flex-col flex-1 min-w-0">
        <Header title={title} actions={actions} />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
