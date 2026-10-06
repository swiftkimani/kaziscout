import { describe, expect, it, vi } from 'vitest';
import { api, ApiError } from '../src/api/client';

describe('api', () => {
  it('returns the JSON body of a successful response', async () => {
    vi.stubGlobal('fetch', () => Promise.resolve(Response.json({ data: [1] })));

    await expect(api('/v1/jobs')).resolves.toEqual({ data: [1] });
  });

  it("throws the server's message and per-field errors from the error envelope", async () => {
    vi.stubGlobal('fetch', () =>
      Promise.resolve(
        Response.json(
          {
            error: {
              code: 'VALIDATION_FAILED',
              message: 'Some of the details sent are not valid.',
              details: { fields: { fullName: ['Enter your name'] } },
            },
          },
          { status: 400 },
        ),
      ),
    );

    const failure = await api('/v1/profile', { method: 'PUT', body: {} }).catch((e: unknown) => e);

    expect(failure).toBeInstanceOf(ApiError);
    expect((failure as ApiError).message).toBe('Some of the details sent are not valid.');
    expect((failure as ApiError).fieldErrors).toEqual({ fullName: 'Enter your name' });
  });

  it('copes with an error response that is not JSON', async () => {
    vi.stubGlobal('fetch', () => Promise.resolve(new Response('Bad gateway', { status: 502 })));

    await expect(api('/v1/jobs')).rejects.toMatchObject({ code: 'UNKNOWN', status: 502 });
  });
});
