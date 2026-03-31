type SessionResponse = {
  response: {
    token: string;
  };
};

let cachedToken: string | null = null;
let tokenCreatedAtMs = 0;

function getBaseUrl() {
  const host = process.env.FILEMAKER_HOST;
  if (!host) throw new Error('Missing env FILEMAKER_HOST');
  return host.replace(/\/$/, '');
}

function getDatabaseInternal() {
  const db = process.env.FILEMAKER_DATABASE;
  if (!db) throw new Error('Missing env FILEMAKER_DATABASE');
  return db;
}

function getCredentials() {
  const username = process.env.FILEMAKER_USERNAME;
  const password = process.env.FILEMAKER_PASSWORD;
  if (!username) throw new Error('Missing env FILEMAKER_USERNAME');
  if (!password) throw new Error('Missing env FILEMAKER_PASSWORD');
  return { username, password };
}

function getAuthHeader() {
  const { username, password } = getCredentials();
  const basic = Buffer.from(`${username}:${password}`).toString('base64');
  return `Basic ${basic}`;
}

async function createSessionToken() {
  const url = `${getBaseUrl()}/fmi/data/vLatest/databases/${encodeURIComponent(
    getDatabaseInternal(),
  )}/sessions`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: getAuthHeader(),
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: '{}',
    cache: 'no-store',
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`FileMaker session login failed (${res.status}): ${text}`);
  }

  const json = (await res.json()) as SessionResponse;
  cachedToken = json.response.token;
  tokenCreatedAtMs = Date.now();
  return cachedToken;
}

async function getSessionToken() {
  const maxAgeMs = 10 * 60 * 1000;
  if (cachedToken && Date.now() - tokenCreatedAtMs < maxAgeMs) {
    return cachedToken;
  }

  return createSessionToken();
}

export async function fileMakerFetch(path: string, init?: RequestInit) {
  const url = `${getBaseUrl()}${path}`;

  const token = await getSessionToken();
  const headers = new Headers(init?.headers);
  headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(url, {
    ...init,
    headers,
    cache: 'no-store',
  });

  if (res.status !== 401) return res;

  cachedToken = null;
  const token2 = await getSessionToken();
  const headers2 = new Headers(init?.headers);
  headers2.set('Authorization', `Bearer ${token2}`);

  return fetch(url, {
    ...init,
    headers: headers2,
    cache: 'no-store',
  });
}

export function getDatabase() {
  return getDatabaseInternal();
}

export function getDefaultLayout() {
  const layout = process.env.FILEMAKER_LAYOUT;
  if (!layout) throw new Error('Missing env FILEMAKER_LAYOUT');
  return layout;
}
