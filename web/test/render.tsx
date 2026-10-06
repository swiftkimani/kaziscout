import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { ToastProvider } from '../src/components/ui/Toast';

/** Renders a screen with the providers the real app wraps it in. */
export function renderApp(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <ToastProvider>{ui}</ToastProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

export interface RecordedRequest {
  method: string;
  path: string;
  body: unknown;
}

/**
 * Replaces fetch with a fake API. `routes` maps "METHOD /path" to the JSON to answer with, or to
 * a function of the request body. Unknown routes answer 404 so a missing stub is obvious.
 */
type RouteHandler = (body: unknown) => { status: number; json: unknown };

export function stubApi(routes: Record<string, object | RouteHandler>): RecordedRequest[] {
  const requests: RecordedRequest[] = [];
  vi.stubGlobal('fetch', (path: string, init: RequestInit = {}) => {
    const method = init.method ?? 'GET';
    const body: unknown = init.body ? JSON.parse(String(init.body)) : undefined;
    requests.push({ method, path, body });
    const route = routes[`${method} ${path}`];
    if (route === undefined) {
      return Promise.resolve(
        Response.json(
          { error: { code: 'NOT_FOUND', message: `No stub for ${path}` } },
          { status: 404 },
        ),
      );
    }
    const answer = typeof route === 'function' ? route(body) : { status: 200, json: route };
    return Promise.resolve(Response.json(answer.json, { status: answer.status }));
  });
  return requests;
}

export const META = {
  countries: { KE: 'Kenya', NG: 'Nigeria', DE: 'Germany', US: 'United States' },
  africanCountries: ['KE', 'NG'],
  jobCountries: ['KE'],
  features: { aiModel: null, desktopAssist: false, converter: 'local' },
};
