import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export const SESSION_COOKIE = 'kazi_session';
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

function digest(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}

/** Compares two secrets without leaking, through timing, how much of a guess was right. */
export function secretsMatch(given: string, expected: string): boolean {
  return timingSafeEqual(digest(given), digest(expected));
}

function sign(expiresAt: number, accessToken: string): string {
  return createHmac('sha256', digest(accessToken)).update(String(expiresAt)).digest('base64url');
}

/**
 * A session is a signed expiry time, so the server keeps no session state and any restart or
 * second instance still recognises it. Changing the access token invalidates every session.
 */
export function createSession(accessToken: string, now: Date): string {
  const expiresAt = now.getTime() + SESSION_MAX_AGE_SECONDS * 1000;
  return `${expiresAt}.${sign(expiresAt, accessToken)}`;
}

export function isSessionValid(session: string, accessToken: string, now: Date): boolean {
  const [expiry, signature] = session.split('.');
  const expiresAt = Number(expiry);
  if (!signature || !Number.isSafeInteger(expiresAt) || expiresAt <= now.getTime()) return false;
  return secretsMatch(signature, sign(expiresAt, accessToken));
}

export function readCookie(header: string | undefined, name: string): string | undefined {
  for (const part of (header ?? '').split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return rest.join('=');
  }
  return undefined;
}
