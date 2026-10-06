import { UpstreamError } from '../errors.js';

export const USER_AGENT = 'KaziScout/0.1 (+https://github.com/swiftkimani/kaziscout)';

const DEFAULT_TIMEOUT_MS = 20_000;
// Feeds and job pages are small; anything larger is not something we want to parse.
const MAX_BODY_BYTES = 5 * 1024 * 1024;

export type FetchText = (url: string, init?: { accept?: string }) => Promise<string>;

/** Fetches a URL as text with a timeout, an identifying user agent and a size cap. */
export const fetchText: FetchText = async (url, init = {}) => {
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { 'user-agent': USER_AGENT, accept: init.accept ?? '*/*' },
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
      redirect: 'follow',
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new UpstreamError(`Couldn't reach ${new URL(url).host}.`, { url, reason });
  }
  if (!response.ok) {
    throw new UpstreamError(`${new URL(url).host} answered with HTTP ${response.status}.`, {
      url,
      status: response.status,
    });
  }
  const body = await response.arrayBuffer();
  if (body.byteLength > MAX_BODY_BYTES) {
    throw new UpstreamError(`${new URL(url).host} sent more data than expected.`, {
      url,
      bytes: body.byteLength,
    });
  }
  return new TextDecoder().decode(body);
};
