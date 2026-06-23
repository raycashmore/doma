'use client';

import { registerServiceWorker, type ServiceWorkerController } from '@repo/pwa';
import { useCallback, useEffect, useRef, useState } from 'react';

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
 * The generated worker always waits for a `SKIP_WAITING` message (see
 * `@repo/pwa`), so the page never reloads until `reload()` is called — either
 * from a user-facing {@link PwaUpdateToast} or automatically (see the `silent`
 * option on {@link PwaUpdater}).
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

  const reload = useCallback(() => controllerRef.current?.reload(), []);

  return { needRefresh, reload };
}

export type PwaUpdaterProps = UsePwaUpdateOptions & {
  /** Reload as soon as a new build is ready instead of showing the toast. */
  silent?: boolean;
};

/** Drop-in service-worker updater: registers the worker and, when a new build
 * is ready, either reloads immediately (`silent`) or shows a "new version
 * available" toast. */
export function PwaUpdater({ silent = false, ...options }: PwaUpdaterProps) {
  const { needRefresh, reload } = usePwaUpdate(options);

  useEffect(() => {
    if (silent && needRefresh) reload();
  }, [silent, needRefresh, reload]);

  if (silent) return null;
  return <PwaUpdateToast show={needRefresh} onReload={reload} />;
}
