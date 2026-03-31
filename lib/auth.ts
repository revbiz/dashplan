const COOKIE_NAME = 'dashboard_auth';

export function getAuthCookieName() {
  return COOKIE_NAME;
}

export function getExpectedCookieValue() {
  const token = process.env.DASHBOARD_AUTH_TOKEN;
  if (!token) return null;
  return token;
}

export function isValidPassword(password: string) {
  const expected = process.env.DASHBOARD_PASSWORD;
  if (!expected) return false;

  return password === expected;
}
