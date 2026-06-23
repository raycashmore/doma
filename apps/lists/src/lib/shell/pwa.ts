/**
 * Service-worker registration with update handling for the Lists PWA.
 *
 * The worker is built in vite-plugin-pwa `prompt` mode, so a new build installs
 * and waits until we post `SKIP_WAITING`. We surface `onNeedRefresh` so the UI
 * can offer a "Reload" prompt, then `reload()` activates the waiting worker and
 * the page reloads via `controllerchange`.
 *
 * We also poll `registration.update()` on an interval so a long-lived,
 * foregrounded install picks up new builds instead of waiting for the browser's
 * own (~24h) background check. The poll only runs while the page is open.
 */
export type RegisterServiceWorkerOptions = {
  swUrl: string;
  scope: string;
  onNeedRefresh?: () => void;
  updateIntervalMs?: number;
};

export type ServiceWorkerController = {
  reload: () => void;
  dispose: () => void;
};

const noopController: ServiceWorkerController = {
  reload: () => {},
  dispose: () => {}
};

export function registerServiceWorker(options: RegisterServiceWorkerOptions): ServiceWorkerController {
  const { swUrl, scope, onNeedRefresh, updateIntervalMs = 60 * 60 * 1000 } = options;

  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return noopController;
  }

  const hadController = Boolean(navigator.serviceWorker.controller);

  let registration: ServiceWorkerRegistration | undefined;
  let pollId: ReturnType<typeof setInterval> | undefined;
  let reloaded = false;

  const reloadNow = () => {
    if (reloaded) return;
    reloaded = true;
    window.location.reload();
  };

  const onControllerChange = () => {
    if (!hadController) return;
    reloadNow();
  };
  navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

  const notifyIfWaiting = () => {
    if (registration?.waiting && navigator.serviceWorker.controller) {
      onNeedRefresh?.();
    }
  };

  const start = async () => {
    try {
      registration = await navigator.serviceWorker.register(swUrl, { scope });
    } catch {
      return;
    }

    notifyIfWaiting();

    registration.addEventListener('updatefound', () => {
      const installing = registration?.installing;
      if (!installing) return;
      installing.addEventListener('statechange', () => {
        if (installing.state === 'installed') notifyIfWaiting();
      });
    });

    pollId = setInterval(() => {
      registration?.update().catch(() => {});
    }, updateIntervalMs);
  };

  if (document.readyState === 'complete') {
    void start();
  } else {
    window.addEventListener('load', () => void start(), { once: true });
  }

  return {
    reload: () => {
      const waiting = registration?.waiting;
      if (waiting) {
        waiting.postMessage({ type: 'SKIP_WAITING' });
      }
      if (!hadController) reloadNow();
    },
    dispose: () => {
      if (pollId) clearInterval(pollId);
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
    }
  };
}
