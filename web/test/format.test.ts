import { describe, expect, it } from 'vitest';
import type { Job } from '../src/api/types';
import { describePlace, formatListedAt } from '../src/features/jobs/format';

const NOW = new Date('2026-10-06T12:00:00Z');
const job = (overrides: Partial<Job>): Job => ({
  id: '1',
  boardId: 'b',
  title: 't',
  isRemote: false,
  url: 'https://example.com',
  summary: '',
  listedAt: NOW.toISOString(),
  ...overrides,
});

describe('formatListedAt', () => {
  it.each([
    ['2026-10-06T08:00:00Z', 'Today'],
    ['2026-10-05T10:00:00Z', 'Yesterday'],
    ['2026-09-26T12:00:00Z', '10 days ago'],
  ])('%s reads as %s', (iso, expected) => {
    expect(formatListedAt(iso, NOW)).toBe(expected);
  });

  it('shows a date once a posting is over a month old', () => {
    expect(formatListedAt('2026-07-01T12:00:00Z', NOW)).toMatch(/2026/);
  });
});

describe('describePlace', () => {
  const countries = { KE: 'Kenya' };

  it('names the country of an on-site job', () => {
    expect(describePlace(job({ countryCode: 'KE', location: 'Nairobi' }), countries)).toBe('Kenya');
  });

  it('shows the restriction of a remote job', () => {
    expect(describePlace(job({ isRemote: true, location: 'EMEA' }), countries)).toBe(
      'Remote · EMEA',
    );
  });

  it('falls back to the board location text, then to a plain statement', () => {
    expect(describePlace(job({ location: 'Bauchi' }), countries)).toBe('Bauchi');
    expect(describePlace(job({}), countries)).toBe('Location not stated');
  });
});
