import { useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { createFileRoute } from '@tanstack/react-router';
import { QRCodeSVG } from 'qrcode.react';
import { ExternalLink, RefreshCw } from 'lucide-react';
import type { ReactNode } from 'react';

export const Route = createFileRoute('/settings/notifications')({
  component: NotificationsSettingsRoute
});

const hasClerkKey = Boolean(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);

type PairingStatus = 'empty' | 'loading' | 'success' | 'error';

interface PairingLink {
  deepLink: string;
  expiresAt: number;
}

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
  const [status, setStatus] = useState<PairingStatus>('empty');
  const [pairingLink, setPairingLink] = useState<PairingLink | null>(null);
  const [error, setError] = useState<string | null>(null);

  const requestPairingLink = async () => {
    if (!isLoaded) return;

    if (!isSignedIn) {
      setStatus('error');
      setPairingLink(null);
      setError('Sign in to connect Telegram.');
      return;
    }

    setStatus('loading');
    setError(null);

    try {
      const token = await getToken();

      if (!token) {
        throw new Error('Missing auth token.');
      }

      const response = await fetch('/api/bot/linking/pairing-token', {
        method: 'POST',
        cache: 'no-store',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Could not create a Telegram pairing link.');
      }

      const body: unknown = await response.json();
      const nextPairingLink = parsePairingLink(body);

      if (!nextPairingLink) {
        throw new Error('The pairing response was not usable.');
      }

      setPairingLink(nextPairingLink);
      setStatus('success');
    } catch (caught) {
      setPairingLink(null);
      setStatus('error');
      setError(
        caught instanceof Error
          ? caught.message
          : 'Could not create a Telegram pairing link.'
      );
    }
  };

  const isLoading = status === 'loading';
  const expiresAtLabel = pairingLink
    ? new Intl.DateTimeFormat(undefined, {
        hour: 'numeric',
        minute: '2-digit'
      }).format(new Date(pairingLink.expiresAt))
    : null;

  return (
    <SettingsShell
      status={
        status === 'success'
          ? 'Ready to pair'
          : status === 'error'
            ? 'Pairing unavailable'
            : 'Not connected'
      }
      description="Create a Telegram pairing code for this account."
    >
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
            <div className="text-center text-sm text-warm-text-tertiary">
              No pairing code yet
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <div>
            <h3 className="text-lg font-semibold text-warm-text-on-dark">
              Telegram
            </h3>
            <p className="mt-1 max-w-xl text-sm leading-6 text-warm-text-tertiary">
              Scan the code with your phone, or open Telegram on this device.
              Pairing links expire after a short time.
            </p>
          </div>

          {expiresAtLabel ? (
            <p className="text-sm text-warm-text-secondary">
              Expires around {expiresAtLabel}.
            </p>
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
              disabled={!isLoaded || isLoading}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-warm-accent px-4 py-2 text-sm font-semibold text-warm-bg transition hover:bg-warm-accent/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw
                size={16}
                aria-hidden="true"
                className={isLoading ? 'animate-spin' : undefined}
              />
              {isLoading
                ? 'Creating'
                : pairingLink
                  ? 'Refresh code'
                  : 'Create code'}
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
        <h2 className="text-3xl font-warm-display text-warm-text-on-dark">
          Notification settings
        </h2>
        <p className="max-w-2xl text-sm leading-6 text-warm-text-tertiary">
          {description}
        </p>
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

  if (
    typeof maybePairing.deepLink !== 'string' ||
    !maybePairing.deepLink.startsWith('https://t.me/')
  ) {
    return null;
  }

  if (
    typeof maybePairing.expiresAt !== 'number' ||
    !Number.isFinite(maybePairing.expiresAt)
  ) {
    return null;
  }

  return {
    deepLink: maybePairing.deepLink,
    expiresAt: maybePairing.expiresAt
  };
}
