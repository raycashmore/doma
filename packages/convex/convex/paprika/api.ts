// Paprika 4's unofficial sync API. Verified against a Paprika 4 account on
// 14 November 2026; see the agent notes on RAY-288. Errors never carry the
// request body, token or password.

const paprikaApiBase = 'https://www.paprikaapp.com/api';

export type PaprikaGroceryList = { uid: string; name: string; isDefault: boolean };

/** Paprika refused the email and password, or the stored token. */
type Rejected = { status: 'rejected' };
/** Paprika could not be reached or answered with something unexpected. */
type Unavailable = { status: 'unavailable' };

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

// The API is undocumented, so a refusal is recognised by status code or by an
// `error` body without a result, whichever Paprika sends.
function isRefusal(response: Response, body: unknown) {
  if (response.status === 401 || response.status === 403) return true;
  return isRecord(body) && 'error' in body && !('result' in body);
}

export async function loginToPaprika(
  { email, password }: { email: string; password: string },
  fetchImpl: Fetch = fetch
): Promise<PaprikaLoginResult> {
  let response: Response;
  try {
    response = await fetchImpl(`${paprikaApiBase}/v2/account/login/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ email, password }).toString()
    });
  } catch {
    return { status: 'unavailable' };
  }

  const body = await readJson(response);
  if (isRefusal(response, body)) return { status: 'rejected' };
  if (!response.ok || !isRecord(body) || !isRecord(body.result)) return { status: 'unavailable' };

  const { token } = body.result;
  if (typeof token !== 'string' || !token) return { status: 'unavailable' };
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
    return { status: 'unavailable' };
  }

  const body = await readJson(response);
  if (isRefusal(response, body)) return { status: 'rejected' };
  if (!response.ok || !isRecord(body) || !Array.isArray(body.result)) return { status: 'unavailable' };

  const lists = body.result.map(parseGroceryList).filter((list): list is PaprikaGroceryList => list !== null);
  return { status: 'ok', lists };
}
