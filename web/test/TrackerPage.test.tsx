import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { TrackerPage } from '../src/features/tracker/TrackerPage';
import { renderApp, stubApi } from './render';

const APPLICATION = {
  id: 7,
  jobId: 'job1',
  status: 'saved',
  notes: '',
  updatedAt: '2026-10-06T09:00:00Z',
  job: {
    title: 'Frontend Developer',
    company: 'Acme',
    url: 'https://x.test',
    boardId: 'b',
    score: 4.6,
  },
};

describe('TrackerPage', () => {
  it('says how to start when nothing is tracked', async () => {
    stubApi({ 'GET /v1/applications': { data: [] } });

    renderApp(<TrackerPage />);

    expect(await screen.findByRole('heading', { name: 'Nothing tracked yet' })).toBeTruthy();
  });

  it('groups applications by status with a count', async () => {
    stubApi({
      'GET /v1/applications': {
        data: [
          APPLICATION,
          { ...APPLICATION, id: 8, status: 'interview', appliedAt: '2026-10-01T09:00:00Z' },
        ],
      },
    });

    renderApp(<TrackerPage />);

    expect(await screen.findByRole('heading', { name: 'Saved (1)' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Interview (1)' })).toBeTruthy();
    expect(screen.getByText(/^Applied /)).toBeTruthy();
  });

  it('sends a status change', async () => {
    const requests = stubApi({
      'GET /v1/applications': { data: [APPLICATION] },
      'PATCH /v1/applications/7': { data: { ...APPLICATION, status: 'applied' } },
    });
    const user = userEvent.setup();
    renderApp(<TrackerPage />);

    await user.selectOptions(await screen.findByLabelText('Status'), 'applied');

    const patch = requests.find((request) => request.method === 'PATCH');
    expect(patch?.body).toEqual({ status: 'applied' });
  });

  it('saves notes when leaving the field, and only if they changed', async () => {
    const requests = stubApi({
      'GET /v1/applications': { data: [APPLICATION] },
      'PATCH /v1/applications/7': { data: APPLICATION },
    });
    const user = userEvent.setup();
    renderApp(<TrackerPage />);

    const notes = await screen.findByLabelText('Notes');
    await user.click(notes);
    await user.tab();
    expect(requests.filter((request) => request.method === 'PATCH')).toHaveLength(0);

    await user.type(notes, 'Emailed the recruiter');
    await user.tab();
    expect(requests.find((request) => request.method === 'PATCH')?.body).toEqual({
      notes: 'Emailed the recruiter',
    });
  });

  it('removes an application and confirms it', async () => {
    const requests = stubApi({
      'GET /v1/applications': { data: [APPLICATION] },
      'DELETE /v1/applications/7': () => ({ status: 200, json: {} }),
    });
    const user = userEvent.setup();
    renderApp(<TrackerPage />);

    await user.click(
      await screen.findByRole('button', { name: 'Remove Frontend Developer from tracker' }),
    );

    expect(await screen.findByText('Removed from your tracker.')).toBeTruthy();
    expect(requests.some((request) => request.method === 'DELETE')).toBe(true);
  });
});
