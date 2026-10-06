import { describe, expect, it } from 'vitest';
import { scoreHeuristically } from '../src/scoring/heuristic.js';
import type { Profile, ScorableJob } from '../src/scoring/types.js';

const NOW = new Date('2026-10-06T12:00:00Z');

const profile: Profile = {
  fullName: 'Wanjiru Kamau',
  headline: 'Full-stack developer',
  cvText: '',
  skills: ['React', 'TypeScript', 'Node.js', 'Java'],
  targetTitles: ['Frontend Developer', 'Full-Stack Engineer'],
  countries: ['KE'],
  isRemoteOk: true,
};

const job = (overrides: Partial<ScorableJob> = {}): ScorableJob => ({
  title: 'Frontend Developer',
  countryCode: 'KE',
  isRemote: false,
  body: 'We build with React and TypeScript on a Node.js backend.',
  listedAt: new Date('2026-10-05T12:00:00Z'),
  ...overrides,
});

describe('scoreHeuristically', () => {
  it('gives a top score to a fresh local job matching title and skills', () => {
    const evaluation = scoreHeuristically(job(), profile, NOW);

    expect(evaluation.score).toBe(5);
    expect(evaluation.matchedSkills).toEqual(['React', 'TypeScript', 'Node.js']);
    expect(evaluation.verdict).toContain('Strong match');
  });

  it('gives the lowest scores to an unrelated job in another country', () => {
    const evaluation = scoreHeuristically(
      job({
        title: 'Registered Nurse',
        countryCode: 'NG',
        body: 'Ward duties and patient care.',
        listedAt: new Date('2026-07-01T00:00:00Z'),
      }),
      profile,
      NOW,
    );

    expect(evaluation.score).toBeLessThan(1.5);
    expect(evaluation.gaps).toContain('Based in Nigeria, which is not in your profile');
    expect(evaluation.gaps).toContain('Listed more than 30 days ago, so it may be closed');
  });

  it('does not count "Java" as matched when the posting only says "JavaScript"', () => {
    const evaluation = scoreHeuristically(
      job({ body: 'Strong JavaScript required.' }),
      profile,
      NOW,
    );

    expect(evaluation.matchedSkills).toEqual([]);
  });

  it('matches skills containing punctuation such as "Node.js"', () => {
    const evaluation = scoreHeuristically(job({ body: 'Experience with Node.js.' }), profile, NOW);

    expect(evaluation.matchedSkills).toEqual(['Node.js']);
  });

  it('treats a remote job as a location match only when the person accepts remote work', () => {
    const remote = job({ isRemote: true, countryCode: undefined });

    const open = scoreHeuristically(remote, profile, NOW);
    const onsiteOnly = scoreHeuristically(remote, { ...profile, isRemoteOk: false }, NOW);

    expect(open.score).toBeGreaterThan(onsiteOnly.score);
    expect(onsiteOnly.gaps).toContain('Remote role, but your profile says on-site only');
  });

  it('stays within 1 to 5 for an empty profile', () => {
    const empty: Profile = { ...profile, skills: [], targetTitles: [], countries: [] };

    const evaluation = scoreHeuristically(job(), empty, NOW);

    expect(evaluation.score).toBeGreaterThanOrEqual(1);
    expect(evaluation.score).toBeLessThanOrEqual(5);
  });
});
