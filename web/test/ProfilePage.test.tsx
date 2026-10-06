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
