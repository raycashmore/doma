export type PairingLink = {
  deepLink: string;
  expiresAt: number;
};

export type LinkStatus = {
  pairingEnabled: boolean;
  linked: boolean;
  provider?: 'telegram';
  displayLabel?: string;
};

type FetchImplementation = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

type NotificationClientOptions = {
  getToken: () => Promise<string | null>;
  fetch?: FetchImplementation;
};

export function createNotificationClient({
  getToken,
  fetch: fetchImplementation = globalThis.fetch
}: NotificationClientOptions) {
  async function fetchBotJson(path: string, init: RequestInit) {
    const token = await getToken();
    if (!token) throw new Error('Missing auth token.');

    const response = await fetchImplementation(path, {
      ...init,
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${token}`,
        ...(init.headers as Record<string, string> | undefined)
      }
    });
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) throw new Error(readBotError(response.status, body));
    return body;
  }

  return {
    async fetchLinkStatus() {
      const status = parseLinkStatus(await fetchBotJson('/api/bot/linking/status', { method: 'GET' }));
      if (!status) throw new Error('The notification settings response was not usable.');
      return status;
    },
    async createPairingLink() {
      const pairing = parsePairingLink(await fetchBotJson('/api/bot/linking/pairing-token', { method: 'POST' }));
      if (!pairing) throw new Error('The pairing response was not usable.');
      return pairing;
    },
    async unlinkTelegram() {
      await fetchBotJson('/api/bot/linking/unlink', { method: 'POST' });
    }
  };
}

function parsePairingLink(body: unknown): PairingLink | null {
  if (!body || typeof body !== 'object') return null;
  const pairing = body as Partial<PairingLink>;
  if (typeof pairing.deepLink !== 'string' || !pairing.deepLink.startsWith('https://t.me/')) return null;
  if (typeof pairing.expiresAt !== 'number' || !Number.isFinite(pairing.expiresAt)) return null;
  return { deepLink: pairing.deepLink, expiresAt: pairing.expiresAt };
}

function parseLinkStatus(body: unknown): LinkStatus | null {
  if (!body || typeof body !== 'object') return null;
  const status = body as Partial<Omit<LinkStatus, 'provider'>> & { provider?: unknown };
  if (typeof status.pairingEnabled !== 'boolean' || typeof status.linked !== 'boolean') return null;
  if (status.provider !== undefined && status.provider !== 'telegram') return null;
  if (status.displayLabel !== undefined && typeof status.displayLabel !== 'string') return null;
  return {
    pairingEnabled: status.pairingEnabled,
    linked: status.linked,
    provider: status.provider,
    displayLabel: status.displayLabel
  };
}

function readBotError(status: number, body: unknown) {
  if (status === 403 && body && typeof body === 'object' && (body as { error?: string }).error === 'pairing_disabled') {
    return 'Telegram pairing is only available in the production Doma app.';
  }

  return status === 401
    ? 'Sign in to manage Telegram notifications.'
    : 'Could not reach the Telegram notification service.';
}
