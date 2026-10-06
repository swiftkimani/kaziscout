import { describe, expect, it } from 'vitest';
import { scoreHeuristically } from '../src/scoring/heuristic.js';
import type { Profile, ScorableJob } from '../src/scoring/types.js';

const NOW = new Date('2026-10-06T12:00:00Z');

const profile: Profile = {
  fullName: 'Wanjiru Kamau',
  email: '',
  phone: '',
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
    expect(evaluation.breakdown).toEqual({ title: 1, skills: 1, location: 1, freshness: 1 });
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

  it('scores a remote role limited to another country below one open to the person', () => {
    const usOnly = scoreHeuristically(job({ isRemote: true, location: 'USA Only' }), profile, NOW);
    const emea = scoreHeuristically(job({ isRemote: true, location: 'EMEA' }), profile, NOW);

    expect(usOnly.score).toBeLessThanOrEqual(2);
    expect(emea.score).toBeGreaterThanOrEqual(4);
    expect(usOnly.gaps).toContain('Remote, but limited to USA Only');
    expect(emea.strengths).toContain('Remote role open to EMEA');
  });

  it('reads a location limit from the posting when the location says only "Remote"', () => {
    const usOnly = scoreHeuristically(
      job({
        isRemote: true,
        location: 'Remote',
        body: 'React and TypeScript. You must be based in the United States.',
      }),
      profile,
      NOW,
    );
    const open = scoreHeuristically(
      job({
        isRemote: true,
        location: 'Remote',
        body: 'React and TypeScript. Work from anywhere.',
      }),
      profile,
      NOW,
    );

    expect(usOnly.score).toBeLessThanOrEqual(2);
    expect(usOnly.gaps).toContain('Remote, but the posting asks for: United States');
    expect(open.strengths).toContain('Remote role with no region limit stated');
  });

  it('names a country outside Africa when the job is based there', () => {
    const evaluation = scoreHeuristically(job({ countryCode: 'DE' }), profile, NOW);

    expect(evaluation.gaps).toContain('Based in Germany, which is not in your profile');
    expect(evaluation.breakdown?.location).toBe(0);
  });

  it('says what would raise a middling score, and says nothing for a strong one', () => {
    const middling = scoreHeuristically(
      job({ title: 'Office Administrator', body: 'Filing, scheduling and some React.' }),
      profile,
      NOW,
    );

    expect(middling.score).toBeGreaterThanOrEqual(2.5);
    expect(middling.score).toBeLessThan(4);
    expect(middling.advice).toBe(
      'To raise this: add this kind of role to the titles you want, if it interests you; add any of its skills you really have to your profile.',
    );
    expect(scoreHeuristically(job(), profile, NOW).advice).toBeUndefined();
  });

  it('warns about a posting that asks applicants for a fee', () => {
    const evaluation = scoreHeuristically(
      job({
        body: 'React developer needed. A registration fee of KSh 1,500 is payable via M-Pesa.',
      }),
      profile,
      NOW,
    );

    expect(evaluation.warnings).toEqual([
      'Asks applicants to pay a fee. Genuine employers do not charge to apply.',
    ]);
    expect(evaluation.verdict).toContain('Check this one carefully.');
  });

  it('stays within 1 to 5 for an empty profile', () => {
    const empty: Profile = { ...profile, skills: [], targetTitles: [], countries: [] };

    const evaluation = scoreHeuristically(job(), empty, NOW);

    expect(evaluation.score).toBeGreaterThanOrEqual(1);
    expect(evaluation.score).toBeLessThanOrEqual(5);
  });
});
