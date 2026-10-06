import { describe, expect, it } from 'vitest';
import type { Board } from '../src/boards/registry.js';
import type { RawJob } from '../src/providers/types.js';
import { normaliseJob } from '../src/services/scan.js';

const board = (countries: string[]): Board => ({
  id: 'employer',
  name: 'Employer',
  url: 'https://example.com',
  countries,
  category: 'employer',
  language: 'en',
  access: { type: 'listing' },
  status: 'live',
  checkedAt: '2026-10-06',
});

const raw = (overrides: Partial<RawJob>): RawJob => ({
  externalId: '1',
  title: 'Analyst',
  url: 'https://example.com/1',
  bodyHtml: '',
  isRemote: false,
  ...overrides,
});

describe('normaliseJob country detection', () => {
  it.each([
    ['Absa Headquarters (KE)', 'KE'],
    ['Sandton', 'ZA'],
    ['Pune, India', 'IN'],
    ['Aleppo, Syria', 'SY'],
    ['Lagos', 'NG'],
  ])('reads "%s" as %s on a multi-country board', (location, code) => {
    expect(normaliseJob(board(['PAN']), raw({ location })).countryCode).toBe(code);
  });

  it("uses a national board's own country whatever the posting says", () => {
    expect(normaliseJob(board(['KE']), raw({ location: 'Head office' })).countryCode).toBe('KE');
  });

  it('leaves the country empty for a remote role, whose location is a restriction', () => {
    expect(
      normaliseJob(board(['REMOTE']), raw({ location: 'USA Only', isRemote: true })).countryCode,
    ).toBeUndefined();
  });

  it('ignores a bracketed code that is not a country', () => {
    expect(
      normaliseJob(board(['PAN']), raw({ location: 'Office (HQ)' })).countryCode,
    ).toBeUndefined();
  });
});
