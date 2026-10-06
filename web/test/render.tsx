import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi } from 'vitest';
import { ToastProvider } from '../src/components/ui/Toast';

/**
 * Renders a screen with the providers the real app wraps it in. Pass `at` and `path` for screens
 * that read parameters from the address, such as a job id.
 */
export function renderApp(ui: ReactElement, route?: { at: string; path: string }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[route?.at ?? '/']}>
        <ToastProvider>
          <Routes>
            <Route path={route?.path ?? '*'} element={ui} />
          </Routes>
        </ToastProvider>
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

export const BOARD = {
  id: 'jobwebkenya',
  name: 'Jobweb Kenya',
  url: 'https://jobwebkenya.com',
  countries: ['KE'],
  category: 'general',
  language: 'en',
  access: { type: 'rss' },
  status: 'live',
  checkedAt: '2026-10-06',
  isScannable: true,
  isFollowed: false,
  jobCount: 2,
  lastScan: null,
};

export const JOB = {
  id: 'job1',
  boardId: 'jobwebkenya',
  title: 'Frontend Developer',
  company: 'Acme',
  countryCode: 'KE',
  isRemote: false,
  url: 'https://jobwebkenya.com/jobs/frontend-developer',
  summary: 'Build interfaces with React.',
  descriptionMd: '## Requirements\n\n- React',
  listedAt: '2026-10-06T08:00:00.000Z',
  score: 4.6,
  evaluation: {
    score: 4.6,
    evaluator: 'heuristic',
    breakdown: { title: 1, skills: 0.5, location: 1, freshness: 1 },
    verdict: 'Strong match. Worth applying.',
    strengths: ['Mentions React'],
    gaps: [],
    matchedSkills: ['React'],
  },
};
