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

  it('adds a job from a link and offers to follow its employer', async () => {
    const requests = stubApi({
      ...base,
      'GET /v1/jobs?sort=newest': { data: [], next_cursor: null },
      'POST /v1/jobs': () => ({
        status: 201,
        json: {
          data: { ...JOB, id: 'added', title: 'Data Engineer' },
          suggestedSource: { name: 'Acme', link: 'https://job-boards.greenhouse.io/acme/jobs/1' },
        },
      }),
      'POST /v1/sources': () => ({
        status: 201,
        json: {
          data: { board: BOARD, scan: { boardId: 'x', outcome: 'ok', jobsFound: 12, jobsNew: 12 } },
        },
      }),
    });
    const user = userEvent.setup();
    renderApp(<JobsPage />);

    await user.type(
      screen.getByLabelText('Add a job you found yourself'),
      'https://job-boards.greenhouse.io/acme/jobs/1',
    );
    await user.click(screen.getByRole('button', { name: 'Add job' }));
    await user.click(await screen.findByRole('button', { name: 'Follow all Acme openings' }));

    expect(await screen.findByText('Following Acme: 12 openings found.')).toBeTruthy();
    expect(requests.find((request) => request.path === '/v1/sources')?.body).toEqual({
      url: 'https://job-boards.greenhouse.io/acme/jobs/1',
    });
  });

  it("shows the server's reason when a link cannot be added", async () => {
    stubApi({
      ...base,
      'GET /v1/jobs?sort=newest': { data: [], next_cursor: null },
      'POST /v1/jobs': () => ({
        status: 400,
        json: {
          error: {
            code: 'UNSAFE_URL',
            message: "That address can't be fetched: it is not a valid web address.",
          },
        },
      }),
    });
    const user = userEvent.setup();
    renderApp(<JobsPage />);

    await user.type(screen.getByLabelText('Add a job you found yourself'), 'nope');
    await user.click(screen.getByRole('button', { name: 'Add job' }));

    expect(await screen.findByText(/not a valid web address/)).toBeTruthy();
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
