import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { PracticeFormPage } from '../src/features/practice/PracticeFormPage';
import { renderApp, stubApi } from './render';

describe('PracticeFormPage', () => {
  it('shows what was entered and which fields were left blank, and sends nothing', async () => {
    const requests = stubApi({});
    const user = userEvent.setup();
    renderApp(<PracticeFormPage />);

    await user.type(screen.getByLabelText('Full name'), 'Wanjiru Kamau');
    await user.click(screen.getByRole('button', { name: 'Submit application' }));

    expect(await screen.findByRole('heading', { name: 'Practice form submitted' })).toBeTruthy();
    expect(screen.getByText('Wanjiru Kamau')).toBeTruthy();
    expect(screen.getAllByText('(left blank)')).toHaveLength(4);
    expect(requests).toEqual([]);
  });
});
