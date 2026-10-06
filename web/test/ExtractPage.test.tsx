import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ExtractPage } from '../src/features/extract/ExtractPage';
import { META, renderApp, stubApi } from './render';

describe('ExtractPage', () => {
  it('asks for an address before sending anything', async () => {
    const requests = stubApi({ 'GET /v1/meta': META });
    const user = userEvent.setup();
    renderApp(<ExtractPage />);

    await user.click(screen.getByRole('button', { name: 'Convert page' }));

    expect(await screen.findByText('Paste the address of a page')).toBeTruthy();
    expect(requests.some((request) => request.method === 'POST')).toBe(false);
  });

  it('shows the Markdown, its title, size and which converter produced it', async () => {
    const requests = stubApi({
      'GET /v1/meta': META,
      'POST /v1/extract': {
        data: {
          url: 'https://x.test/job',
          title: 'Data Analyst',
          markdown: '# Data Analyst',
          converter: 'local',
        },
      },
    });
    const user = userEvent.setup();
    renderApp(<ExtractPage />);

    await user.type(screen.getByLabelText('Page address'), 'https://x.test/job');
    await user.click(screen.getByRole('button', { name: 'Convert page' }));

    expect(await screen.findByRole('heading', { name: 'Data Analyst' })).toBeTruthy();
    expect(screen.getByText('# Data Analyst')).toBeTruthy();
    expect(screen.getByText('Local converter')).toBeTruthy();
    expect(screen.getByText('14 characters')).toBeTruthy();
    expect(requests.find((request) => request.method === 'POST')?.body).toEqual({
      url: 'https://x.test/job',
    });
  });

  it("shows the server's reason when a page cannot be fetched", async () => {
    stubApi({
      'GET /v1/meta': META,
      'POST /v1/extract': () => ({
        status: 400,
        json: {
          error: {
            code: 'UNSAFE_URL',
            message: "That address can't be fetched: it points to a private or local network.",
          },
        },
      }),
    });
    const user = userEvent.setup();
    renderApp(<ExtractPage />);

    await user.type(screen.getByLabelText('Page address'), 'http://127.0.0.1/');
    await user.click(screen.getByRole('button', { name: 'Convert page' }));

    expect(await screen.findByText(/private or local network/)).toBeTruthy();
  });
});
