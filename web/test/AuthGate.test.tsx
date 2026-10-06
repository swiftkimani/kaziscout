import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { AuthGate } from '../src/components/AuthGate';
import { renderApp, stubApi } from './render';

describe('AuthGate', () => {
  it('shows the app when no sign-in is required', async () => {
    stubApi({ 'GET /v1/session': { data: { required: false, authenticated: true } } });

    renderApp(<AuthGate>The app</AuthGate>);

    expect(await screen.findByText('The app')).toBeTruthy();
  });

  it('asks for the access token, and explains a wrong one', async () => {
    stubApi({
      'GET /v1/session': { data: { required: true, authenticated: false } },
      'POST /v1/session': () => ({
        status: 401,
        json: { error: { code: 'AUTH_REQUIRED', message: "That access token isn't right." } },
      }),
    });
    const user = userEvent.setup();
    renderApp(<AuthGate>The app</AuthGate>);

    await user.type(await screen.findByLabelText('Access token'), 'not-the-token');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText("That access token isn't right.")).toBeTruthy();
    expect(screen.queryByText('The app')).toBeNull();
  });

  it('shows the app after a successful sign-in', async () => {
    let signedIn = false;
    stubApi({
      'GET /v1/session': () => ({
        status: 200,
        json: { data: { required: true, authenticated: signedIn } },
      }),
      'POST /v1/session': () => {
        signedIn = true;
        return { status: 200, json: { data: { required: true, authenticated: true } } };
      },
    });
    const user = userEvent.setup();
    renderApp(<AuthGate>The app</AuthGate>);

    await user.type(await screen.findByLabelText('Access token'), 'correct-horse-battery-staple');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('The app')).toBeTruthy();
  });
});
