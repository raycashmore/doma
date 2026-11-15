// Paprika 4's unofficial sync API. Verified against a Paprika 4 account on
// 14 November 2026; see the agent notes on RAY-288. Errors never carry the
// request body, token or password.

const paprikaApiBase = 'https://www.paprikaapp.com/api';

export type PaprikaGroceryList = { uid: string; name: string; isDefault: boolean };

/** Paprika itself refused the email and password, or the stored token. `reason` is Paprika's own message. */
type Rejected = { status: 'rejected'; reason: string | null };
/**
 * Paprika could not be reached or answered with something other than its own API reply, such as a
 * block page. `httpStatus` is null when no response arrived.
 */
type Unavailable = { status: 'unavailable'; httpStatus: number | null };

export type PaprikaLoginResult = { status: 'ok'; token: string } | Rejected | Unavailable;
export type PaprikaGroceryListsResult = { status: 'ok'; lists: PaprikaGroceryList[] } | Rejected | Unavailable;

type Fetch = typeof fetch;

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

// Paprika refuses with its own JSON `{"error": {"message": ...}}`: HTTP 200 for a bad sign-in,
// 401 for a bad token. A 401 or 403 without that body comes from something in front of Paprika,
// such as a firewall blocking Doma's server, so it is not read as a wrong password.
function readRefusal(body: unknown): Rejected | null {
  if (!isRecord(body) || !('error' in body) || 'result' in body) return null;
  const message = isRecord(body.error) ? body.error.message : body.error;
  return { status: 'rejected', reason: typeof message === 'string' && message ? message : null };
}

function unavailable(response?: Response): Unavailable {
  return { status: 'unavailable', httpStatus: response?.status ?? null };
}

export async function loginToPaprika(
  { email, password }: { email: string; password: string },
  fetchImpl: Fetch = fetch
): Promise<PaprikaLoginResult> {
  let response: Response;
  try {
    // v1, not v2: v2's login answers "Unrecognized client." to anything but Paprika's own apps
    // (checked 15 November 2026). v1 accepts any client and its token works with the v2 sync reads.
    response = await fetchImpl(`${paprikaApiBase}/v1/account/login/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ email, password }).toString()
    });
  } catch {
    return unavailable();
  }

  const body = await readJson(response);
  const refusal = readRefusal(body);
  if (refusal) return refusal;
  if (!response.ok || !isRecord(body) || !isRecord(body.result)) return unavailable(response);

  const { token } = body.result;
  if (typeof token !== 'string' || !token) return unavailable(response);
  return { status: 'ok', token };
}

function parseGroceryList(value: unknown): PaprikaGroceryList | null {
  if (!isRecord(value)) return null;
  const { uid, name, is_default: isDefault } = value;
  if (typeof uid !== 'string' || typeof name !== 'string') return null;
  return { uid, name, isDefault: isDefault === true };
}

export async function fetchPaprikaGroceryLists(
  token: string,
  fetchImpl: Fetch = fetch
): Promise<PaprikaGroceryListsResult> {
  let response: Response;
  try {
    response = await fetchImpl(`${paprikaApiBase}/v2/sync/grocerylists/`, {
      headers: { Authorization: `Bearer ${token}` }
    });
  } catch {
    return unavailable();
  }

  const body = await readJson(response);
  const refusal = readRefusal(body);
  if (refusal) return refusal;
  if (!response.ok || !isRecord(body) || !Array.isArray(body.result)) return unavailable(response);

  const lists = body.result.map(parseGroceryList).filter((list): list is PaprikaGroceryList => list !== null);
  return { status: 'ok', lists };
}
