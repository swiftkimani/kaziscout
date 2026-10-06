import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { AppError } from '../errors.js';
import { parse } from '../routes/schemas.js';
import {
  createSession,
  isSessionValid,
  readCookie,
  secretsMatch,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
} from './session.js';

const SESSION_PATH = '/v1/session';
const signInBody = z.object({ token: z.string().min(1).max(500) });

class AuthRequiredError extends AppError {
  constructor(message = 'Sign in to use KaziScout.') {
    super('AUTH_REQUIRED', 401, message);
  }
}

function cookie(value: string, maxAge: number, request: FastifyRequest): string {
  const secure = request.protocol === 'https' ? '; Secure' : '';
  return `${SESSION_COOKIE}=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${secure}`;
}

/**
 * Optional single-owner sign-in. With no access token configured the API is open, which is only
 * safe on a loopback address. With one, every /v1 route needs a session cookie (browsers) or an
 * `Authorization: Bearer <token>` header (scripts and agents).
 */
export function registerAuth(
  app: FastifyInstance,
  options: { accessToken?: string; now: () => Date },
): void {
  const { accessToken, now } = options;

  const isAuthenticated = (request: FastifyRequest): boolean => {
    if (!accessToken) return true;
    const bearer = /^Bearer (.+)$/.exec(request.headers.authorization ?? '')?.[1];
    if (bearer && secretsMatch(bearer, accessToken)) return true;
    const session = readCookie(request.headers.cookie, SESSION_COOKIE);
    return session !== undefined && isSessionValid(session, accessToken, now());
  };

  app.addHook('onRequest', async (request) => {
    const path = request.url.split('?')[0] ?? '';
    if (!path.startsWith('/v1/') || path === SESSION_PATH) return;
    if (!isAuthenticated(request)) throw new AuthRequiredError();
  });

  app.get(SESSION_PATH, (request) => ({
    data: { required: accessToken !== undefined, authenticated: isAuthenticated(request) },
  }));

  app.post(
    SESSION_PATH,
    { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    (request, reply) => {
      const { token } = parse(signInBody, request.body);
      if (accessToken && !secretsMatch(token, accessToken)) {
        throw new AuthRequiredError("That access token isn't right.");
      }
      if (accessToken) {
        void reply.header(
          'set-cookie',
          cookie(createSession(accessToken, now()), SESSION_MAX_AGE_SECONDS, request),
        );
      }
      return { data: { required: accessToken !== undefined, authenticated: true } };
    },
  );

  app.delete(SESSION_PATH, (request, reply) => {
    void reply.header('set-cookie', cookie('', 0, request)).code(204);
    return null;
  });
}
