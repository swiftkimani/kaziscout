import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { JobsPage } from '../src/features/jobs/JobsPage';
import { BOARD, JOB, META, renderApp, stubApi } from './render';

const base = { 'GET /v1/meta': META, 'GET /v1/boards': { data: [BOARD] } };

describe('JobsPage', () => {
  it('lists jobs with score, company, place, board and age', async () => {
    stubApi({ ...base, 'GET /v1/jobs?sort=newest': { data: [JOB], next_cursor: null } });

    renderApp(<JobsPage />);

    expect(await screen.findByRole('link', { name: 'Frontend Developer' })).toBeTruthy();
    expect(screen.getByText('4.6')).toBeTruthy();
    expect(screen.getByText('Acme')).toBeTruthy();
    expect(await screen.findByText('Kenya', { selector: 'span' })).toBeTruthy();
    expect(await screen.findByText('Jobweb Kenya', { selector: 'span' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Show more jobs' })).toBeNull();
  });

  it('explains what to do when nothing has been scanned yet', async () => {
    stubApi({ ...base, 'GET /v1/jobs?sort=newest': { data: [], next_cursor: null } });

    renderApp(<JobsPage />);

    expect(await screen.findByRole('heading', { name: 'No jobs yet' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'fill in your profile' })).toBeTruthy();
  });

  it('offers to clear the filters when they match nothing', async () => {
    stubApi({
      ...base,
      'GET /v1/jobs?sort=newest': { data: [JOB], next_cursor: null },
      'GET /v1/jobs?sort=newest&remote=true': { data: [], next_cursor: null },
    });
    const user = userEvent.setup();
    renderApp(<JobsPage />);

    await user.click(await screen.findByLabelText('Remote only'));

    expect(
      await screen.findByRole('heading', { name: 'No jobs match these filters' }),
    ).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(await screen.findByRole('link', { name: 'Frontend Developer' })).toBeTruthy();
  });

  it('loads the next page when asked', async () => {
    stubApi({
      ...base,
      'GET /v1/jobs?sort=newest': { data: [JOB], next_cursor: 'abc' },
      'GET /v1/jobs?sort=newest&cursor=abc': {
        data: [{ ...JOB, id: 'job2', title: 'Backend Developer' }],
        next_cursor: null,
      },
    });
    const user = userEvent.setup();
    renderApp(<JobsPage />);

    await user.click(await screen.findByRole('button', { name: 'Show more jobs' }));

    expect(await screen.findByRole('link', { name: 'Backend Developer' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Frontend Developer' })).toBeTruthy();
  });

  it('scans all boards and reports new jobs and boards that failed', async () => {
    stubApi({
      ...base,
      'GET /v1/jobs?sort=newest': { data: [], next_cursor: null },
      'POST /v1/scans': {
        data: [
          { boardId: 'a', outcome: 'ok', jobsFound: 10, jobsNew: 7 },
          { boardId: 'b', outcome: 'error', jobsFound: 0, jobsNew: 0, errorMessage: 'down' },
        ],
      },
    });
    const user = userEvent.setup();
    renderApp(<JobsPage />);

    await user.click((await screen.findAllByRole('button', { name: 'Scan all boards' }))[0]!);

    expect(
      await screen.findByText("Scan finished: 7 new jobs, 1 boards didn't answer."),
    ).toBeTruthy();
  });

  it('shows an error with a retry when the list cannot be loaded', async () => {
    stubApi({
      ...base,
      'GET /v1/jobs?sort=newest': () => ({
        status: 500,
        json: { error: { code: 'INTERNAL', message: 'Something went wrong on our side.' } },
      }),
    });

    renderApp(<JobsPage />);

    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByText('Something went wrong on our side.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
  });
});
