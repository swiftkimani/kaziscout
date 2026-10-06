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

  const IMPORT = {
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
  };

  async function importCv(user: ReturnType<typeof userEvent.setup>) {
    const file = new File(['%PDF-1.4 sample'], 'cv.pdf', { type: 'application/pdf' });
    await user.upload(await screen.findByLabelText('CV file'), file);
  }

  it('asks the follow-up questions one at a time after a CV import, then saves the answers', async () => {
    const requests = stubApi({
      'GET /v1/profile': { data: null },
      'GET /v1/meta': META,
      'POST /v1/profile/import': IMPORT,
      'PUT /v1/profile': (body) => ({ status: 200, json: { data: body, rescored: 7 } }),
    });
    const user = userEvent.setup();
    renderApp(<ProfilePage />);
    await importCv(user);

    expect(
      await screen.findByRole('heading', { name: 'Which job titles are you looking for?' }),
    ).toBeTruthy();
    expect(screen.getByText('Question 1 of 2')).toBeTruthy();
    expect(screen.getByLabelText('Your answer')).toHaveProperty('value', 'Data Analyst');
    expect(requests.some((request) => request.method === 'PUT')).toBe(false);

    await user.type(screen.getByLabelText('Your answer'), ', BI Developer');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(await screen.findByRole('button', { name: 'No, on-site only' }));
    await user.click(screen.getByRole('button', { name: 'Save profile' }));

    expect(await screen.findByText('Profile saved. 7 jobs re-scored.')).toBeTruthy();
    expect(requests.find((request) => request.method === 'PUT')?.body).toMatchObject({
      fullName: 'Wanjiru Kamau',
      targetTitles: ['Data Analyst', 'BI Developer'],
      isRemoteOk: false,
      skills: ['SQL'],
    });
  });

  it('lets the person leave the questions for the full form, keeping what was read', async () => {
    stubApi({
      'GET /v1/profile': { data: null },
      'GET /v1/meta': META,
      'POST /v1/profile/import': IMPORT,
    });
    const user = userEvent.setup();
    renderApp(<ProfilePage />);
    await importCv(user);

    await user.click(await screen.findByRole('button', { name: 'Edit everything in one form' }));

    expect(await screen.findByLabelText('Full name')).toHaveProperty('value', 'Wanjiru Kamau');
    expect(screen.getByLabelText('Roles you want')).toHaveProperty('value', 'Data Analyst');
    expect(screen.getByText(/A few things to confirm/)).toBeTruthy();
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
