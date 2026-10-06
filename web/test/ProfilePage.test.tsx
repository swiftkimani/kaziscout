import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ProfilePage } from '../src/features/profile/ProfilePage';
import { META, renderApp, stubApi } from './render';

const SAVED = {
  fullName: 'Wanjiru Kamau',
  email: 'wanjiru@example.com',
  phone: '',
  headline: 'Data analyst',
  cvText: '',
  skills: ['SQL'],
  targetTitles: ['Data Analyst'],
  countries: ['KE'],
  isRemoteOk: true,
};

describe('ProfilePage', () => {
  it('shows the saved profile', async () => {
    stubApi({ 'GET /v1/profile': { data: SAVED }, 'GET /v1/meta': META });

    renderApp(<ProfilePage />);

    expect(await screen.findByLabelText('Full name')).toHaveProperty('value', 'Wanjiru Kamau');
    expect(screen.getByLabelText('Email address')).toHaveProperty('value', 'wanjiru@example.com');
    expect(await screen.findByText('Selected: Kenya')).toBeTruthy();
    expect(screen.getByLabelText('Kenya')).toHaveProperty('checked', true);
  });

  it('asks for a name before sending anything', async () => {
    const requests = stubApi({ 'GET /v1/profile': { data: null }, 'GET /v1/meta': META });
    const user = userEvent.setup();
    renderApp(<ProfilePage />);

    await user.click(await screen.findByRole('button', { name: 'Save profile' }));

    expect(await screen.findByText('Enter your name')).toBeTruthy();
    expect(requests.some((request) => request.method === 'PUT')).toBe(false);
  });

  it('saves skills and roles as lists, and reports how many jobs were re-scored', async () => {
    const requests = stubApi({
      'GET /v1/profile': { data: null },
      'GET /v1/meta': META,
      'PUT /v1/profile': (body) => ({ status: 200, json: { data: body, rescored: 12 } }),
    });
    const user = userEvent.setup();
    renderApp(<ProfilePage />);

    await user.type(await screen.findByLabelText('Full name'), 'Wanjiru Kamau');
    await user.type(screen.getByLabelText('Skills'), 'SQL, Python ,, Excel');
    await user.type(screen.getByLabelText('Roles you want'), 'Data Analyst{Enter}BI Developer');
    await user.click(await screen.findByLabelText('Nigeria'));
    await user.click(screen.getByRole('button', { name: 'Save profile' }));

    expect(await screen.findByText('Profile saved. 12 jobs re-scored.')).toBeTruthy();
    const saved = requests.find((request) => request.method === 'PUT')?.body;
    expect(saved).toMatchObject({
      fullName: 'Wanjiru Kamau',
      skills: ['SQL', 'Python', 'Excel'],
      targetTitles: ['Data Analyst', 'BI Developer'],
      countries: ['NG'],
    });
  });

  it("shows the server's message beside the field it rejects", async () => {
    stubApi({
      'GET /v1/profile': { data: SAVED },
      'GET /v1/meta': META,
      'PUT /v1/profile': () => ({
        status: 400,
        json: {
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Some of the details sent are not valid.',
            details: { fields: { headline: ['Too long'] } },
          },
        },
      }),
    });
    const user = userEvent.setup();
    renderApp(<ProfilePage />);

    await user.click(await screen.findByRole('button', { name: 'Save profile' }));

    expect(await screen.findByText('Too long')).toBeTruthy();
  });

  it('fills the form from an imported CV, shows the follow-up questions, and saves nothing yet', async () => {
    const requests = stubApi({
      'GET /v1/profile': { data: null },
      'GET /v1/meta': META,
      'POST /v1/profile/import': {
        data: {
          draft: { ...SAVED, targetTitles: [], cvText: 'Wanjiru Kamau, Data Analyst…' },
          questions: [
            {
              field: 'targetTitles',
              question: 'Which job titles are you looking for?',
              suggestion: 'Data Analyst',
            },
            { field: 'isRemoteOk', question: 'Are you open to remote work?', suggestion: 'yes' },
          ],
          readBy: 'rules',
          characters: 629,
        },
      },
    });
    const user = userEvent.setup();
    renderApp(<ProfilePage />);

    const file = new File(['%PDF-1.4 sample'], 'cv.pdf', { type: 'application/pdf' });
    await user.upload(await screen.findByLabelText('CV file'), file);

    expect(await screen.findByText(/A few things to confirm/)).toBeTruthy();
    expect(screen.getByText('Which job titles are you looking for?')).toBeTruthy();
    expect(screen.getByText('Suggested: Data Analyst')).toBeTruthy();
    expect(screen.getByLabelText('Full name')).toHaveProperty('value', 'Wanjiru Kamau');
    expect(screen.getByLabelText('Skills')).toHaveProperty('value', 'SQL');
    const sent = requests.find((request) => request.path === '/v1/profile/import')?.body;
    expect(sent).toMatchObject({ filename: 'cv.pdf', contentBase64: expect.any(String) });
    expect(requests.some((request) => request.method === 'PUT')).toBe(false);
  });

  it("reads the CV from the desktop clipboard when desktop assist is on, and shows the server's reason on failure", async () => {
    const requests = stubApi({
      'GET /v1/profile': { data: null },
      'GET /v1/meta': { ...META, features: { ...META.features, desktopAssist: true } },
      'POST /v1/profile/import': () => ({
        status: 400,
        json: {
          error: {
            code: 'VALIDATION_FAILED',
            message:
              "The clipboard doesn't hold a CV. Open your CV, select all the text, copy it, then try again.",
          },
        },
      }),
    });
    const user = userEvent.setup();
    renderApp(<ProfilePage />);

    await screen.findByLabelText('Kenya');
    await user.click(screen.getByRole('button', { name: 'Use CV text I copied' }));

    expect(await screen.findByText(/The clipboard doesn't hold a CV/)).toBeTruthy();
    expect(requests.find((request) => request.path === '/v1/profile/import')?.body).toEqual({
      clipboard: true,
    });
  });

  it('narrows the country list as you type, across Africa and the rest of the world', async () => {
    stubApi({ 'GET /v1/profile': { data: null }, 'GET /v1/meta': META });
    const user = userEvent.setup();
    renderApp(<ProfilePage />);

    await user.type(await screen.findByLabelText('Find a country'), 'ger');

    await waitFor(() => expect(screen.queryByLabelText('Kenya')).toBeNull());
    expect(screen.getByLabelText('Nigeria')).toBeTruthy();
    expect(screen.getByLabelText('Germany')).toBeTruthy();
  });
});
