import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { BoardsPage } from '../src/features/boards/BoardsPage';
import { BOARD, META, renderApp, stubApi } from './render';

const LINK_OUT = {
  ...BOARD,
  id: 'fuzu',
  name: 'Fuzu',
  url: 'https://www.fuzu.com',
  access: { type: 'listing' },
  status: 'blocked',
  isScannable: false,
  jobCount: 0,
};
const FAILED = {
  ...BOARD,
  id: 'novojob',
  name: 'Novojob',
  countries: ['PAN'],
  lastScan: {
    boardId: 'novojob',
    startedAt: '2026-10-06T09:00:00Z',
    outcome: 'error',
    jobsFound: 0,
    jobsNew: 0,
  },
};

describe('BoardsPage', () => {
  it('shows each board with its coverage, status and a scan button only where scanning works', async () => {
    stubApi({ 'GET /v1/meta': META, 'GET /v1/boards': { data: [BOARD, LINK_OUT, FAILED] } });

    renderApp(<BoardsPage />);

    const jobweb = (await screen.findByRole('link', { name: /Jobweb Kenya/ })).closest('tr')!;
    expect(within(jobweb).getByText('Live')).toBeTruthy();
    expect(within(jobweb).getByRole('button', { name: 'Scan Jobweb Kenya' })).toBeTruthy();

    const fuzu = screen.getByRole('link', { name: /Fuzu/ }).closest('tr')!;
    expect(within(fuzu).getByText('Browser only')).toBeTruthy();
    expect(within(fuzu).queryByRole('button')).toBeNull();

    const novojob = screen.getByRole('link', { name: /Novojob/ }).closest('tr')!;
    expect(within(novojob).getByText('Last scan failed')).toBeTruthy();
    expect(within(novojob).getByText('Pan-African')).toBeTruthy();
  });

  it('filters by search text and by access type', async () => {
    stubApi({ 'GET /v1/meta': META, 'GET /v1/boards': { data: [BOARD, LINK_OUT] } });
    const user = userEvent.setup();
    renderApp(<BoardsPage />);

    await user.selectOptions(await screen.findByLabelText('Access'), 'link-out');
    expect(screen.queryByRole('link', { name: /Jobweb Kenya/ })).toBeNull();
    expect(screen.getByRole('link', { name: /Fuzu/ })).toBeTruthy();

    await user.type(screen.getByLabelText('Search'), 'zzz');
    expect(await screen.findByRole('heading', { name: 'No boards match' })).toBeTruthy();
  });

  it('scans one board and reports what it found', async () => {
    const requests = stubApi({
      'GET /v1/meta': META,
      'GET /v1/boards': { data: [BOARD] },
      'POST /v1/boards/jobwebkenya/scan': {
        data: { boardId: 'jobwebkenya', outcome: 'ok', jobsFound: 10, jobsNew: 3 },
      },
    });
    const user = userEvent.setup();
    renderApp(<BoardsPage />);

    await user.click(await screen.findByRole('button', { name: 'Scan Jobweb Kenya' }));

    expect(await screen.findByText('Jobweb Kenya: 10 jobs, 3 new.')).toBeTruthy();
    expect(
      requests.some((r) => r.method === 'POST' && r.path === '/v1/boards/jobwebkenya/scan'),
    ).toBe(true);
  });
});
