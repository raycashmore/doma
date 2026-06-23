/**
 * Framework-agnostic service-worker registration with update handling.
 *
 * The apps register with `injectRegister: false`, so vite-plugin-pwa does not
 * bake `skipWaiting`/`clientsClaim` into the generated worker regardless of
 * `registerType` — the worker always installs and then waits for a
 * `SKIP_WAITING` message. This module owns the update lifecycle instead:
 * - When a new build is installed and waiting, we call `onNeedRefresh`. The
 *   caller decides whether to prompt the user or update immediately.
 * - `reload()` posts `SKIP_WAITING` to activate the waiting worker; the page
 *   then reloads via `controllerchange`.
 *
 * We poll `registration.update()` on an interval so a long-lived, foregrounded
 * PWA picks up new builds instead of waiting for the browser's own (~24h)
 * background check. The poll only runs while the page is open.
 */
export type RegisterServiceWorkerOptions = {
  /** URL of the generated service worker, e.g. `/sw.js` or `/lists/sw.js`. */
  swUrl: string;
  /** Worker scope, typically the app's base path. */
  scope: string;
  /** Called when a new version is installed and ready (prompt mode). */
  onNeedRefresh?: () => void;
  /** How often to check for a new build while the app is open. Default 1h. */
  updateIntervalMs?: number;
};

export type ServiceWorkerController = {
  /** Activate the waiting worker (prompt mode) and reload to the new build. */
  reload: () => void;
  /** Tear down the poll and listeners. */
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

  // Whether a worker already controls this page. On a first-ever visit this is
  // false; the initial `clientsClaim` controllerchange must NOT trigger a
  // reload, only a later update-driven takeover should.
  const hadController = Boolean(navigator.serviceWorker.controller);

  let registration: ServiceWorkerRegistration | undefined;
  let pollId: ReturnType<typeof setInterval> | undefined;
  let reloaded = false;
  // Set by dispose(). Guards the async `start()`: if the caller tears down
  // before registration resolves, we must not install a poll or listeners that
  // would then outlive dispose().
  let disposed = false;

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
    let reg: ServiceWorkerRegistration;
    try {
      reg = await navigator.serviceWorker.register(swUrl, { scope });
    } catch {
      return;
    }

    // The caller may have disposed while registration was in flight.
    if (disposed) return;
    registration = reg;

    // A waiting worker may already exist when we register.
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
      // If nothing is controlling the page, no controllerchange will fire — fall
      // back to a direct reload so the prompt still resolves.
      if (!hadController) reloadNow();
    },
    dispose: () => {
      disposed = true;
      if (pollId) clearInterval(pollId);
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
    }
  };
}
