import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { TriagePage } from '../src/features/triage/TriagePage';
import { JOB, META, renderApp, stubApi } from './render';

const QUEUE = 'GET /v1/jobs?sort=score&untracked=true&limit=30';
const three = [
  { ...JOB, id: 'a', title: 'First job' },
  { ...JOB, id: 'b', title: 'Second job' },
  { ...JOB, id: 'c', title: 'Third job' },
];

describe('TriagePage', () => {
  it('goes through jobs one at a time with the keyboard: save, skip, hide', async () => {
    const requests = stubApi({
      'GET /v1/meta': META,
      [QUEUE]: { data: three },
      'POST /v1/applications': () => ({ status: 201, json: { data: { id: 1 } } }),
      'PUT /v1/jobs/c/hidden': { data: { ...JOB, id: 'c', isHidden: true } },
    });
    const user = userEvent.setup();
    renderApp(<TriagePage />);

    expect(await screen.findByRole('link', { name: 'First job' })).toBeTruthy();
    expect(screen.getByText('1 of 3')).toBeTruthy();

    await user.keyboard('s');
    expect(await screen.findByRole('link', { name: 'Second job' })).toBeTruthy();
    await user.keyboard('k');
    expect(await screen.findByRole('link', { name: 'Third job' })).toBeTruthy();
    await user.keyboard('h');

    expect(await screen.findByRole('heading', { name: 'All caught up' })).toBeTruthy();
    expect(requests.find((request) => request.path === '/v1/applications')?.body).toEqual({
      jobId: 'a',
    });
    expect(
      requests.some((request) => request.method === 'PUT' && request.path === '/v1/jobs/c/hidden'),
    ).toBe(true);
    expect(requests.some((request) => request.path.includes('/jobs/b/'))).toBe(false);
  });

  it('offers the same three choices as buttons', async () => {
    stubApi({
      'GET /v1/meta': META,
      [QUEUE]: { data: three },
      'PUT /v1/jobs/a/hidden': { data: { ...JOB, id: 'a', isHidden: true } },
    });
    const user = userEvent.setup();
    renderApp(<TriagePage />);

    await user.click(await screen.findByRole('button', { name: /Hide/ }));

    expect(await screen.findByRole('link', { name: 'Second job' })).toBeTruthy();
  });

  it('says how to get jobs to review when there are none', async () => {
    stubApi({ 'GET /v1/meta': META, [QUEUE]: { data: [] } });

    renderApp(<TriagePage />);

    expect(await screen.findByRole('heading', { name: 'Nothing to review' })).toBeTruthy();
  });
});
