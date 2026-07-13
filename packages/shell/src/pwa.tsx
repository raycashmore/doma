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
 * from a user-facing {@link PwaUpdateToast} or automatically (see the `autoReload`
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
  /** Reload as soon as a new build is ready while keeping the toast as a fallback. */
  autoReload?: boolean;
};

/** Drop-in service-worker updater: registers the worker and, when a new build
 * is ready, shows a "new version available" toast and can reload immediately
 * when `autoReload` is enabled. */
export function PwaUpdater({ autoReload = false, ...options }: PwaUpdaterProps) {
  const { needRefresh, reload } = usePwaUpdate(options);

  useEffect(() => {
    if (autoReload && needRefresh) reload();
  }, [autoReload, needRefresh, reload]);

  return <PwaUpdateToast show={needRefresh} onReload={reload} />;
}
