import { afterEach, describe, expect, it, vi } from 'vitest';
import { UpstreamError } from '../src/errors.js';
import { fetchText } from '../src/providers/http.js';

afterEach(() => vi.unstubAllGlobals());

describe('fetchText', () => {
  it('returns the body of a successful response', async () => {
    vi.stubGlobal('fetch', () => Promise.resolve(new Response('<rss/>')));

    await expect(fetchText('https://board.example/feed')).resolves.toBe('<rss/>');
  });

  it('reports an HTTP error with the host and status', async () => {
    vi.stubGlobal('fetch', () => Promise.resolve(new Response('no', { status: 503 })));

    await expect(fetchText('https://board.example/feed')).rejects.toThrow(
      'board.example answered with HTTP 503.',
    );
  });

  it('retries once when the connection drops, then returns the body', async () => {
    let calls = 0;
    vi.stubGlobal('fetch', () => {
      calls += 1;
      return calls === 1
        ? Promise.reject(new TypeError('fetch failed'))
        : Promise.resolve(new Response('<rss/>'));
    });

    await expect(fetchText('https://board.example/feed')).resolves.toBe('<rss/>');
    expect(calls).toBe(2);
  });

  it('does not retry an HTTP error', async () => {
    let calls = 0;
    vi.stubGlobal('fetch', () => {
      calls += 1;
      return Promise.resolve(new Response('no', { status: 404 }));
    });

    await expect(fetchText('https://board.example/feed')).rejects.toThrow('HTTP 404');
    expect(calls).toBe(1);
  });

  it('reports a board that stalls while sending its body as unreachable, not as a crash', async () => {
    const stalled = new ReadableStream({
      start(controller) {
        controller.error(
          new DOMException('The operation was aborted due to timeout', 'TimeoutError'),
        );
      },
    });
    vi.stubGlobal('fetch', () => Promise.resolve(new Response(stalled)));

    const failure = await fetchText('https://board.example/feed').catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(UpstreamError);
    expect((failure as UpstreamError).message).toBe("Couldn't reach board.example.");
  });
});
