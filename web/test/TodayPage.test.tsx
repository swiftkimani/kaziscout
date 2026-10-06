import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TodayPage } from '../src/features/today/TodayPage';
import { BOARD, JOB, META, renderApp, stubApi } from './render';

const base = { 'GET /v1/meta': META, 'GET /v1/boards': { data: [BOARD] } };

describe('TodayPage', () => {
  it('shows each list that has something in it, with counts', async () => {
    stubApi({
      ...base,
      'GET /v1/today': {
        data: {
          newStrong: [JOB],
          closingSoon: [
            { ...JOB, id: 'job2', title: 'Data Analyst', closesAt: '2026-10-08T00:00:00.000Z' },
          ],
          followUps: [
            {
              id: 3,
              jobId: 'job3',
              status: 'applied',
              notes: '',
              appliedAt: '2026-09-25T09:00:00Z',
              updatedAt: '2026-09-25T09:00:00Z',
              job: { title: 'QA Engineer', company: 'Acme', url: 'https://x.test', boardId: 'b' },
            },
          ],
          failedSources: [
            { id: 'novojob', name: 'Novojob', errorMessage: "Couldn't reach www.novojob.com." },
          ],
        },
      },
    });

    renderApp(<TodayPage />);

    expect(await screen.findByRole('heading', { name: 'New strong matches (1)' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Closing within three days (1)' })).toBeTruthy();
    expect(screen.getByText(/^Closes /)).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'No reply for a week (1)' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'QA Engineer' })).toBeTruthy();
    expect(screen.getByText(/Couldn't reach www.novojob.com./)).toBeTruthy();
  });

  it('says so when nothing needs attention, and hides the empty lists', async () => {
    stubApi({
      ...base,
      'GET /v1/today': {
        data: { newStrong: [], closingSoon: [], followUps: [], failedSources: [] },
      },
    });

    renderApp(<TodayPage />);

    expect(await screen.findByRole('heading', { name: 'Nothing needs you today' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: /New strong matches/ })).toBeNull();
  });
});
