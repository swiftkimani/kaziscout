import { UpstreamError } from '../errors.js';

export const USER_AGENT = 'KaziScout/0.1 (+https://github.com/swiftkimani/kaziscout)';

const DEFAULT_TIMEOUT_MS = 20_000;
// Feeds and job pages are small; anything larger is not something we want to parse.
const MAX_BODY_BYTES = 5 * 1024 * 1024;
const NETWORK_ATTEMPTS = 2;
const RETRY_DELAY_MS = 1_000;

export type FetchText = (url: string, init?: { accept?: string }) => Promise<string>;

interface Fetched {
  status: number;
  ok: boolean;
  body: ArrayBuffer;
}

async function fetchOnce(url: string, accept: string): Promise<Fetched> {
  const response = await fetch(url, {
    headers: { 'user-agent': USER_AGENT, accept },
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    redirect: 'follow',
  });
  // The timeout also covers the body: a server can send headers and then stall.
  const body = response.ok ? await response.arrayBuffer() : new ArrayBuffer(0);
  return { status: response.status, ok: response.ok, body };
}

/**
 * Fetches a URL as text with a timeout, an identifying user agent and a size cap. A network
 * failure is retried once, because boards drop the odd connection; an HTTP error is not.
 */
export const fetchText: FetchText = async (url, init = {}) => {
  const host = new URL(url).host;
  let fetched: Fetched | undefined;
  let reason = '';
  for (let attempt = 1; attempt <= NETWORK_ATTEMPTS && !fetched; attempt += 1) {
    if (attempt > 1) await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    try {
      fetched = await fetchOnce(url, init.accept ?? '*/*');
    } catch (error) {
      reason = error instanceof Error ? error.message : String(error);
    }
  }
  if (!fetched) throw new UpstreamError(`Couldn't reach ${host}.`, { url, reason });
  if (!fetched.ok) {
    throw new UpstreamError(`${host} answered with HTTP ${fetched.status}.`, {
      url,
      status: fetched.status,
    });
  }
  if (fetched.body.byteLength > MAX_BODY_BYTES) {
    throw new UpstreamError(`${host} sent more data than expected.`, {
      url,
      bytes: fetched.body.byteLength,
    });
  }
  return new TextDecoder().decode(fetched.body);
};
