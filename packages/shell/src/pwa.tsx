'use client';

import { registerServiceWorker, type ServiceWorkerController } from '@repo/pwa';
import { useEffect, useRef, useState } from 'react';

import { PwaUpdateToast } from './PwaUpdateToast';

export type UsePwaUpdateOptions = {
  swUrl: string;
  scope: string;
  /** Register only when true (e.g. in production). Default true. */
  enabled?: boolean;
};

/**
 * Registers the service worker and reports when a new build is ready.
 *
 * In `autoUpdate` apps the page reloads on its own, so `needRefresh` is mainly
 * useful for `prompt` apps that render a {@link PwaUpdateToast}.
 */
export function usePwaUpdate({ swUrl, scope, enabled = true }: UsePwaUpdateOptions) {
  const [needRefresh, setNeedRefresh] = useState(false);
  const controllerRef = useRef<ServiceWorkerController | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const controller = registerServiceWorker({
      swUrl,
      scope,
      onNeedRefresh: () => setNeedRefresh(true)
    });
    controllerRef.current = controller;
    return () => {
      controller.dispose();
      controllerRef.current = null;
    };
  }, [enabled, swUrl, scope]);

  return {
    needRefresh,
    reload: () => controllerRef.current?.reload()
  };
}

export type PwaUpdaterProps = UsePwaUpdateOptions & {
  /** Reload silently instead of showing the toast (for `autoUpdate` apps). */
  silent?: boolean;
};

/** Drop-in service-worker updater: registers the worker and, unless silent,
 * shows a "new version available" toast. */
export function PwaUpdater({ silent = false, ...options }: PwaUpdaterProps) {
  const { needRefresh, reload } = usePwaUpdate(options);
  if (silent) return null;
  return <PwaUpdateToast show={needRefresh} onReload={reload} />;
}
