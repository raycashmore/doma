import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { createFileRoute } from '@tanstack/react-router';
import { QRCodeSVG } from 'qrcode.react';
import { ExternalLink, RefreshCw, Unplug } from 'lucide-react';
import type { ReactNode } from 'react';

export const Route = createFileRoute('/settings/notifications')({
  component: NotificationsSettingsRoute
});

const hasClerkKey = Boolean(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);

type PendingAction = 'create' | 'status' | 'unlink' | null;

type PairingLink = {
  deepLink: string;
  expiresAt: number;
};

type LinkStatus = {
  pairingEnabled: boolean;
  linked: boolean;
  provider?: 'telegram';
  displayLabel?: string;
};

function NotificationsSettingsRoute() {
  if (!hasClerkKey) {
    return (
      <SettingsShell
        status="Auth unavailable"
        description="Notification pairing needs Clerk auth. Start Home with a Clerk publishable key to connect Telegram."
      />
    );
  }

  return <AuthenticatedNotificationsSettings />;
}

function AuthenticatedNotificationsSettings() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [linkStatus, setLinkStatus] = useState<LinkStatus | null>(null);
  const [pairingLink, setPairingLink] = useState<PairingLink | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    if (!isSignedIn) {
      setPendingAction(null);
      setLinkStatus(null);
      setPairingLink(null);
      setError(null);
      return;
    }

    let cancelled = false;

    const loadLinkStatus = async () => {
      setPendingAction('status');
      setError(null);

      try {
        const nextLinkStatus = await fetchLinkStatus(getToken);

        if (cancelled) {
          return;
        }

        setLinkStatus(nextLinkStatus);

        if (nextLinkStatus.linked || !nextLinkStatus.pairingEnabled) {
          setPairingLink(null);
        }
      } catch (caught) {
        if (cancelled) {
          return;
        }

        setLinkStatus(null);
        setPairingLink(null);
        setError(caught instanceof Error ? caught.message : 'Could not load notification settings.');
      } finally {
        if (!cancelled) {
          setPendingAction(null);
        }
      }
    };

    void loadLinkStatus();

    return () => {
      cancelled = true;
    };
  }, [getToken, isLoaded, isSignedIn]);

  const refreshLinkStatus = async () => {
    if (!isLoaded || !isSignedIn) {
      return;
    }

    setPendingAction('status');
    setError(null);

    try {
      const nextLinkStatus = await fetchLinkStatus(getToken);

      setLinkStatus(nextLinkStatus);

      if (nextLinkStatus.linked || !nextLinkStatus.pairingEnabled) {
        setPairingLink(null);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load notification settings.');
    } finally {
      setPendingAction(null);
    }
  };

  const requestPairingLink = async () => {
    if (!isLoaded) return;

    if (!isSignedIn) {
      setPairingLink(null);
      setError('Sign in to connect Telegram.');
      return;
    }

    setPendingAction('create');
    setError(null);

    try {
      const nextPairingLink = await createPairingLink(getToken);

      setPairingLink(nextPairingLink);
      setLinkStatus({
        linked: false,
        pairingEnabled: true
      });
    } catch (caught) {
      setPairingLink(null);
      setError(caught instanceof Error ? caught.message : 'Could not create a Telegram pairing link.');
    } finally {
      setPendingAction(null);
    }
  };

  const unlinkTelegram = async () => {
    if (!isLoaded || !isSignedIn) {
      return;
    }

    setPendingAction('unlink');
    setError(null);

    try {
      await unlinkTelegramLink(getToken);
      setPairingLink(null);
      setLinkStatus({
        linked: false,
        pairingEnabled: true
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not disconnect Telegram.');
    } finally {
      setPendingAction(null);
    }
  };

  const isLoadingStatus = pendingAction === 'status';
  const isCreating = pendingAction === 'create';
  const isUnlinking = pendingAction === 'unlink';
  const pairingUnavailable = linkStatus?.pairingEnabled === false;
  const isLinked = linkStatus?.linked === true;
  const expiresAtLabel = pairingLink
    ? new Intl.DateTimeFormat(undefined, {
        hour: 'numeric',
        minute: '2-digit'
      }).format(new Date(pairingLink.expiresAt))
    : null;
  const shellStatus = !isLoaded
    ? 'Loading settings'
    : !isSignedIn
      ? 'Sign in required'
      : pairingUnavailable
        ? 'Unavailable outside production'
        : isLinked
          ? 'Connected'
          : pairingLink
            ? 'Ready to pair'
            : error
              ? 'Pairing unavailable'
              : 'Not connected';
  const shellDescription = !isLoaded
    ? 'Loading your Telegram notification settings.'
    : !isSignedIn
      ? 'Sign in to view and manage Telegram notifications for this account.'
      : pairingUnavailable
        ? 'Telegram pairing is only enabled on the production Doma app.'
        : isLinked
          ? 'Telegram notifications are active for this account.'
          : 'Create a Telegram pairing code for this account.';

  return (
    <SettingsShell status={shellStatus} description={shellDescription}>
      {pairingUnavailable ? (
        <div className="rounded-lg border border-warm-border bg-warm-bg-dark-muted p-5 text-sm text-warm-text-tertiary">
          Telegram pairing and unlinking are disabled in Preview and local environments. Open the production Doma app to
          manage Telegram notifications.
        </div>
      ) : isLinked ? (
        <div className="flex flex-col gap-5 rounded-lg border border-warm-border bg-warm-bg-dark-muted p-5 sm:flex-row sm:items-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-warm-bg-dark text-warm-accent">
            <Unplug size={28} aria-hidden="true" />
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-4">
            <div>
              <h3 className="text-lg font-semibold text-warm-text-on-dark">Telegram connected</h3>
              <p className="mt-1 max-w-xl text-sm leading-6 text-warm-text-tertiary">
                Notifications will be delivered to your linked Telegram chat. Disconnect it here if you want to stop
                delivery.
              </p>
            </div>

            {linkStatus.displayLabel ? (
              <p className="text-sm text-warm-text-secondary">Linked account: @{linkStatus.displayLabel}</p>
            ) : null}

            {error ? (
              <p role="alert" className="text-sm text-red-300">
                {error}
              </p>
            ) : null}

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={refreshLinkStatus}
                disabled={!isLoaded || isLoadingStatus || isUnlinking}
                className="inline-flex items-center justify-center gap-2 rounded-md border border-warm-border px-4 py-2 text-sm font-semibold text-warm-text-on-dark transition hover:bg-warm-bg-dark disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCw size={16} aria-hidden="true" className={isLoadingStatus ? 'animate-spin' : undefined} />
                {isLoadingStatus ? 'Checking' : 'Refresh status'}
              </button>

              <button
                type="button"
                onClick={unlinkTelegram}
                disabled={!isLoaded || isLoadingStatus || isUnlinking}
                className="inline-flex items-center justify-center gap-2 rounded-md bg-warm-accent px-4 py-2 text-sm font-semibold text-warm-bg transition hover:bg-warm-accent/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Unplug size={16} aria-hidden="true" />
                {isUnlinking ? 'Disconnecting' : 'Disconnect Telegram'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-5 rounded-lg border border-warm-border bg-warm-bg-dark-muted p-5 sm:flex-row sm:items-center">
          <div className="flex h-52 w-full items-center justify-center rounded-md bg-white p-4 sm:w-52">
            {pairingLink ? (
              <QRCodeSVG
                value={pairingLink.deepLink}
                size={176}
                level="M"
                marginSize={2}
                title="Telegram pairing QR code"
              />
            ) : (
              <div className="text-center text-sm text-warm-text-tertiary">No pairing code yet</div>
            )}
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-4">
            <div>
              <h3 className="text-lg font-semibold text-warm-text-on-dark">Telegram</h3>
              <p className="mt-1 max-w-xl text-sm leading-6 text-warm-text-tertiary">
                Scan the code with your phone, or open Telegram on this device. Pairing links expire after a short time.
              </p>
            </div>

            {expiresAtLabel ? (
              <p className="text-sm text-warm-text-secondary">Expires around {expiresAtLabel}.</p>
            ) : null}

            {error ? (
              <p role="alert" className="text-sm text-red-300">
                {error}
              </p>
            ) : null}

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={requestPairingLink}
                disabled={!isLoaded || isCreating || isLoadingStatus}
                className="inline-flex items-center justify-center gap-2 rounded-md bg-warm-accent px-4 py-2 text-sm font-semibold text-warm-bg transition hover:bg-warm-accent/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCw size={16} aria-hidden="true" className={isCreating ? 'animate-spin' : undefined} />
                {isCreating ? 'Creating' : pairingLink ? 'Refresh code' : 'Create code'}
              </button>

              <button
                type="button"
                onClick={refreshLinkStatus}
                disabled={!isLoaded || isCreating || isLoadingStatus}
                className="inline-flex items-center justify-center gap-2 rounded-md border border-warm-border px-4 py-2 text-sm font-semibold text-warm-text-on-dark transition hover:bg-warm-bg-dark disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCw size={16} aria-hidden="true" className={isLoadingStatus ? 'animate-spin' : undefined} />
                {isLoadingStatus ? 'Checking' : 'Check status'}
              </button>

              {pairingLink ? (
                <a
                  href={pairingLink.deepLink}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-md border border-warm-border px-4 py-2 text-sm font-semibold text-warm-text-on-dark transition hover:bg-warm-bg-dark"
                >
                  <ExternalLink size={16} aria-hidden="true" />
                  Open Telegram
                </a>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </SettingsShell>
  );
}

function SettingsShell({
  status,
  description,
  children
}: {
  status: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-2 py-8">
      <header className="flex flex-col gap-2 border-b border-warm-border pb-5">
        <p className="text-sm font-medium text-warm-accent">{status}</p>
        <h2 className="text-[26px] font-warm-display text-warm-text-on-dark">Notification settings</h2>
        <p className="max-w-2xl text-sm leading-6 text-warm-text-tertiary">{description}</p>
      </header>

      {children ?? (
        <div className="rounded-lg border border-warm-border bg-warm-bg-dark-muted p-5 text-sm text-warm-text-tertiary">
          Telegram pairing is disabled in this environment.
        </div>
      )}
    </div>
  );
}

function parsePairingLink(body: unknown): PairingLink | null {
  if (!body || typeof body !== 'object') return null;

  const maybePairing = body as Partial<PairingLink>;

  if (typeof maybePairing.deepLink !== 'string' || !maybePairing.deepLink.startsWith('https://t.me/')) {
    return null;
  }

  if (typeof maybePairing.expiresAt !== 'number' || !Number.isFinite(maybePairing.expiresAt)) {
    return null;
  }

  return {
    deepLink: maybePairing.deepLink,
    expiresAt: maybePairing.expiresAt
  };
}

function parseLinkStatus(body: unknown): LinkStatus | null {
  if (!body || typeof body !== 'object') {
    return null;
  }

  const maybeStatus = body as Partial<Omit<LinkStatus, 'provider'>> & { provider?: unknown };

  if (typeof maybeStatus.pairingEnabled !== 'boolean' || typeof maybeStatus.linked !== 'boolean') {
    return null;
  }

  if (maybeStatus.provider !== undefined && maybeStatus.provider !== 'telegram') {
    return null;
  }

  if (maybeStatus.displayLabel !== undefined && typeof maybeStatus.displayLabel !== 'string') {
    return null;
  }

  return {
    pairingEnabled: maybeStatus.pairingEnabled,
    linked: maybeStatus.linked,
    provider: maybeStatus.provider,
    displayLabel: maybeStatus.displayLabel
  };
}

async function fetchBotJson(path: string, init: RequestInit, getToken: () => Promise<string | null>) {
  const token = await getToken();

  if (!token) {
    throw new Error('Missing auth token.');
  }

  const response = await fetch(path, {
    ...init,
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${token}`,
      ...init.headers
    }
  });

  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(readBotError(response.status, body));
  }

  return body;
}

async function fetchLinkStatus(getToken: () => Promise<string | null>) {
  const body = await fetchBotJson('/api/bot/linking/status', { method: 'GET' }, getToken);
  const linkStatus = parseLinkStatus(body);

  if (!linkStatus) {
    throw new Error('The notification settings response was not usable.');
  }

  return linkStatus;
}

async function createPairingLink(getToken: () => Promise<string | null>) {
  const body = await fetchBotJson('/api/bot/linking/pairing-token', { method: 'POST' }, getToken);
  const pairingLink = parsePairingLink(body);

  if (!pairingLink) {
    throw new Error('The pairing response was not usable.');
  }

  return pairingLink;
}

async function unlinkTelegramLink(getToken: () => Promise<string | null>) {
  await fetchBotJson('/api/bot/linking/unlink', { method: 'POST' }, getToken);
}

function readBotError(status: number, body: unknown) {
  if (status === 403 && body && typeof body === 'object' && (body as { error?: string }).error === 'pairing_disabled') {
    return 'Telegram pairing is only available in the production Doma app.';
  }

  return status === 401
    ? 'Sign in to manage Telegram notifications.'
    : 'Could not reach the Telegram notification service.';
}
