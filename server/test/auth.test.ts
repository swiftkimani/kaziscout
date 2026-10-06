import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { createSession, isSessionValid } from '../src/auth/session.js';
import { loadConfig } from '../src/config.js';
import { migrate, openDb, type Db } from '../src/db/client.js';

const TOKEN = 'correct-horse-battery-staple';
const NOW = new Date('2026-10-06T12:00:00Z');

let db: Db | undefined;
let app: FastifyInstance | undefined;

async function start(env: Record<string, string>): Promise<FastifyInstance> {
  db = openDb(':memory:');
  migrate(db);
  app = await buildApp({
    config: loadConfig({ LOG_LEVEL: 'silent', ...env }),
    db,
    boards: [],
    now: () => NOW,
  });
  return app;
}

// Only the suites that start a server have one to close.
afterEach(async () => {
  await app?.close();
  db?.close();
  app = undefined;
  db = undefined;
});

describe('with no access token configured', () => {
  let server: FastifyInstance;
  beforeEach(async () => {
    server = await start({});
  });

  it('serves the API without sign-in and says none is required', async () => {
    const session = await server.inject({ method: 'GET', url: '/v1/session' });
    const boards = await server.inject({ method: 'GET', url: '/v1/boards' });

    expect(session.json()).toEqual({ data: { required: false, authenticated: true } });
    expect(boards.statusCode).toBe(200);
  });
});

describe('with an access token configured', () => {
  let server: FastifyInstance;
  beforeEach(async () => {
    server = await start({ ACCESS_TOKEN: TOKEN });
  });

  it('refuses API requests that carry no credentials', async () => {
    const response = await server.inject({ method: 'GET', url: '/v1/profile' });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ error: { code: 'AUTH_REQUIRED' } });
  });

  it('reports the session state without requiring sign-in', async () => {
    const response = await server.inject({ method: 'GET', url: '/v1/session' });

    expect(response.json()).toEqual({ data: { required: true, authenticated: false } });
  });

  it('rejects a wrong token and sets no cookie', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/v1/session',
      payload: { token: 'wrong-token-wrong-token' },
    });

    expect(response.statusCode).toBe(401);
    expect(response.headers['set-cookie']).toBeUndefined();
  });

  it('signs in with the right token and then accepts the session cookie', async () => {
    const signIn = await server.inject({
      method: 'POST',
      url: '/v1/session',
      payload: { token: TOKEN },
    });
    const setCookie = String(signIn.headers['set-cookie']);
    const cookie = setCookie.split(';')[0] ?? '';

    expect(signIn.statusCode).toBe(200);
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('SameSite=Strict');

    const authed = await server.inject({ method: 'GET', url: '/v1/profile', headers: { cookie } });
    expect(authed.statusCode).toBe(200);
  });

  it('accepts the token as a bearer header, for scripts and agents', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/v1/boards',
      headers: { authorization: `Bearer ${TOKEN}` },
    });

    expect(response.statusCode).toBe(200);
  });

  it('keeps the health check open so uptime monitors work', async () => {
    const response = await server.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
  });
});

describe('sessions', () => {
  it('expire after thirty days', () => {
    const session = createSession(TOKEN, NOW);
    const dayThirtyOne = new Date(NOW.getTime() + 31 * 24 * 60 * 60 * 1000);

    expect(isSessionValid(session, TOKEN, NOW)).toBe(true);
    expect(isSessionValid(session, TOKEN, dayThirtyOne)).toBe(false);
  });

  it('are rejected when tampered with or when the token has changed', () => {
    const session = createSession(TOKEN, NOW);
    const [expiry = '', signature = ''] = session.split('.');
    const extended = `${Number(expiry) + 1000}.${signature}`;

    expect(isSessionValid(extended, TOKEN, NOW)).toBe(false);
    expect(isSessionValid(session, 'a-different-access-token', NOW)).toBe(false);
    expect(isSessionValid('garbage', TOKEN, NOW)).toBe(false);
  });
});

describe('configuration', () => {
  it('rejects an access token too short to be safe', () => {
    expect(() => loadConfig({ ACCESS_TOKEN: 'short' })).toThrow('at least 16 characters');
  });

  it('rejects a scan interval that would hammer the boards', () => {
    expect(() => loadConfig({ SCAN_INTERVAL_MINUTES: '5' })).toThrow('between 15 and 10080');
  });
});
