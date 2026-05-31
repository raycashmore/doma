'use client';

import type { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { MobileNav } from './MobileNav';
import type { AppId } from './apps';

export type AppFrameProps = {
  appId: AppId;
  title: string;
  isDev: boolean;
  actions?: ReactNode;
  children: ReactNode;
  onSignOut?: () => void;
  headerClassName?: string;
  mainClassName?: string;
};

export function AppFrame({
  appId,
  title,
  isDev,
  actions,
  children,
  onSignOut,
  headerClassName,
  mainClassName
}: AppFrameProps) {
  return (
    <div className="min-h-screen bg-warm-bg-dark font-warm-body text-warm-text-primary md:h-screen md:overflow-hidden">
      <div className="flex h-screen overflow-hidden bg-warm-bg-dark md:h-full">
        <Sidebar activeAppId={appId} isDev={isDev} onSignOut={onSignOut} />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <Header title={title} actions={actions} className={headerClassName} />
          <main
            className={`min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 pb-4 md:overflow-hidden ${mainClassName ?? ''}`}
          >
            {children}
          </main>
          <MobileNav activeAppId={appId} isDev={isDev} />
        </div>
      </div>
    </div>
  );
}
