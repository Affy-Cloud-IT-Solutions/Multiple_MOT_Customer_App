import { requestTokenRefresh, msUntilAccessTokenRefresh, isTokenExpired, decodeToken } from '../authSession';

const BASE = 'https://api.test/api';

// Minimal unsigned JWT with the given payload (only the payload is read client-side)
const makeJwt = (payload: object) => {
  const b64url = (obj: object) =>
    (globalThis as any).Buffer.from(JSON.stringify(obj)).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url(payload)}.signature`;
};

const respond = (status: number, body: any) =>
  jest.fn(async () => ({ ok: status >= 200 && status < 300, status, json: async () => body })) as any;

describe('requestTokenRefresh', () => {
  it('returns the new access + rotated refresh token on success', async () => {
    const fetchImpl = respond(200, { accessToken: 'new-access', refreshToken: 'new-refresh', user: { id: 'u1' } });
    const outcome = await requestTokenRefresh(BASE, 'old-refresh', fetchImpl);
    expect(outcome).toEqual({ status: 'ok', accessToken: 'new-access', refreshToken: 'new-refresh', user: { id: 'u1' } });
    expect(fetchImpl).toHaveBeenCalledWith(`${BASE}/auth/refresh-token`, expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ refreshToken: 'old-refresh' }),
    }));
  });

  it('keeps the current refresh token when the server does not rotate it', async () => {
    const outcome = await requestTokenRefresh(BASE, 'rt', respond(200, { token: 'new-access' }));
    expect(outcome).toMatchObject({ status: 'ok', accessToken: 'new-access', refreshToken: 'rt' });
  });

  it.each([
    [401, { code: 'REFRESH_TOKEN_EXPIRED' }],
    [403, { code: 'REFRESH_TOKEN_REVOKED' }],
    [400, { error: 'Refresh token is required.' }],
  ])('treats HTTP %i from the refresh endpoint as an invalid session (log in again)', async (status, body) => {
    const outcome = await requestTokenRefresh(BASE, 'rt', respond(status, body));
    expect(outcome.status).toBe('invalid');
  });

  it('is "invalid" when there is no refresh token at all', async () => {
    const fetchImpl = respond(200, {});
    expect((await requestTokenRefresh(BASE, null, fetchImpl)).status).toBe('invalid');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('treats network errors as transient (session kept)', async () => {
    const fetchImpl = jest.fn(async () => {
      throw new Error('Network request failed');
    }) as any;
    expect(await requestTokenRefresh(BASE, 'rt', fetchImpl)).toEqual({ status: 'transient', reason: 'Network request failed' });
  });

  it.each([500, 502, 503, 429])('treats HTTP %i as transient (session kept)', async status => {
    expect((await requestTokenRefresh(BASE, 'rt', respond(status, { error: 'busy' }))).status).toBe('transient');
  });

  it('treats a 200 without an access token or a non-JSON body as transient', async () => {
    expect((await requestTokenRefresh(BASE, 'rt', respond(200, {}))).status).toBe('transient');
    const nonJson = jest.fn(async () => ({ ok: false, status: 502, json: async () => { throw new Error('html'); } })) as any;
    expect((await requestTokenRefresh(BASE, 'rt', nonJson)).status).toBe('transient');
  });
});

describe('access token timing', () => {
  const now = 1_800_000_000_000;

  it('schedules the refresh one minute before the access token expires', () => {
    const token = makeJwt({ exp: (now + 15 * 60 * 1000) / 1000 });
    expect(msUntilAccessTokenRefresh(token, now)).toBe(14 * 60 * 1000);
  });

  it('refreshes immediately when the token is already expired or inside the lead window', () => {
    expect(msUntilAccessTokenRefresh(makeJwt({ exp: (now - 1000) / 1000 }), now)).toBe(0);
    expect(msUntilAccessTokenRefresh(makeJwt({ exp: (now + 30 * 1000) / 1000 }), now)).toBe(0);
  });

  it('returns null for tokens without a readable expiry', () => {
    expect(msUntilAccessTokenRefresh(null, now)).toBeNull();
    expect(msUntilAccessTokenRefresh('not-a-jwt', now)).toBeNull();
    expect(msUntilAccessTokenRefresh(makeJwt({ sub: 'x' }), now)).toBeNull();
  });

  it('decodes payloads and flags expired tokens', () => {
    const fresh = makeJwt({ exp: Math.floor(Date.now() / 1000) + 600, role: 'customer' });
    const stale = makeJwt({ exp: Math.floor(Date.now() / 1000) - 10 });
    expect(decodeToken(fresh)).toMatchObject({ role: 'customer' });
    expect(isTokenExpired(fresh)).toBe(false);
    expect(isTokenExpired(stale)).toBe(true);
    expect(isTokenExpired(null)).toBe(true);
  });
});
