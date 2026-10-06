import { describe, expect, it } from 'vitest';
import { findWarningSigns } from '../src/scoring/warning-signs.js';

describe('findWarningSigns', () => {
  it.each([
    ['a named fee', 'Successful candidates will pay a registration fee before the interview.'],
    ['a fee with an amount', 'There is a fee of KSh 2,000 for the training materials.'],
    ['payment in order to apply', 'Payment of 500 is required in order to apply.'],
  ])('flags %s', (_label, text) => {
    expect(findWarningSigns(text)).toContain(
      'Asks applicants to pay a fee. Genuine employers do not charge to apply.',
    );
  });

  it('flags a request to send money by mobile money', () => {
    expect(findWarningSigns('Send 300 to our M-Pesa till number to book your slot.')).toContain(
      'Asks for money by mobile money or transfer.',
    );
  });

  it('flags promised easy earnings', () => {
    expect(findWarningSigns('Earn $200 per day from your phone, no experience needed!')).toContain(
      'Promises unusually easy or guaranteed earnings.',
    );
  });

  it.each([
    [
      'a posting that denies charging fees',
      'Acme never charges applicants an application fee at any stage.',
    ],
    ['a posting that says there is no fee', 'There is no registration fee to apply for this role.'],
    ['an ordinary posting', 'We are hiring a data analyst. Salary KSh 120,000 per month.'],
    [
      'a finance role that handles payments',
      'You will process supplier payments and reconcile the bank account.',
    ],
  ])('does not flag %s', (_label, text) => {
    expect(findWarningSigns(text)).toEqual([]);
  });
});
