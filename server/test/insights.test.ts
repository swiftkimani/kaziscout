import { describe, expect, it } from 'vitest';
import { migrate, openDb } from '../src/db/client.js';
import { JobRepository } from '../src/repositories/jobs.js';
import { ProfileRepository } from '../src/repositories/profile.js';
import { findSkillsIn } from '../src/scoring/skill-vocabulary.js';
import { InsightService } from '../src/services/insights.js';

const NOW = new Date('2026-10-06T12:00:00Z');

function setUp() {
  const db = openDb(':memory:');
  migrate(db);
  const jobs = new JobRepository(db);
  const profiles = new ProfileRepository(db);
  const add = (title: string, score: number, description: string) => {
    const { id } = jobs.upsert(
      {
        boardId: 'b',
        externalId: title,
        title,
        company: 'Acme',
        isRemote: false,
        url: `https://x.test/${title}`,
        summary: '',
        descriptionMd: description,
      },
      NOW,
    );
    jobs.saveEvaluation(
      id,
      { score, evaluator: 'heuristic', verdict: '', strengths: [], gaps: [], matchedSkills: [] },
      NOW,
    );
    return id;
  };
  const saveProfile = (skills: string[], cvText = '') =>
    profiles.save(
      {
        fullName: 'Wanjiru',
        email: '',
        phone: '',
        headline: '',
        cvText,
        skills,
        targetTitles: [],
        countries: ['KE'],
        isRemoteOk: true,
      },
      NOW,
    );
  return { jobs, add, saveProfile, insights: new InsightService({ jobs, profiles }) };
}

describe('findSkillsIn', () => {
  it('finds named skills as whole words', () => {
    expect(findSkillsIn('We use TypeScript, Node.js and PostgreSQL on AWS, with CI/CD.')).toEqual([
      'TypeScript',
      'Node.js',
      'PostgreSQL',
      'AWS',
      'CI/CD',
    ]);
  });

  it.each([
    ['Java inside JavaScript', 'Strong JavaScript required.', ['JavaScript']],
    ['C inside C++ or C#', 'C++ and C# experience.', ['C#', 'C++']],
    ['the word "go" in a sentence', 'You will go to client sites and R&D labs.', []],
    ['Go named as a language', 'Backend services in Golang.', ['Go']],
    [
      'R named beside other analysis tools',
      'Analysis in R, Python or SQL.',
      ['Python', 'R', 'SQL'],
    ],
  ])('handles %s', (_label, text, expected) => {
    expect(findSkillsIn(text)).toEqual(expected);
  });
});

describe('InsightService', () => {
  it('marks each skill a posting names as shown or not shown by the profile and CV', () => {
    const { jobs, add, saveProfile, insights } = setUp();
    saveProfile(['React'], 'Built reporting dashboards in Power BI.');
    const id = add('Analyst', 3.5, 'React, Power BI and Tableau needed.');

    expect(insights.requirementsFor(jobs.findById(id)!)).toEqual([
      { skill: 'React', inProfile: true },
      { skill: 'Power BI', inProfile: true },
      { skill: 'Tableau', inProfile: false },
    ]);
  });

  it('ranks the skills missing most often across near-miss jobs', () => {
    const { add, saveProfile, insights } = setUp();
    saveProfile(['React']);
    add('one', 3.2, 'React and PostgreSQL and Docker');
    add('two', 3.6, 'React with PostgreSQL');
    add('three', 3.9, 'PostgreSQL, AWS');
    add('already-strong', 4.5, 'Kubernetes everywhere');
    add('too-weak', 2.0, 'Kubernetes everywhere');

    const report = insights.skillGaps();

    expect(report.jobsConsidered).toBe(3);
    expect(report.gaps.map((gap) => [gap.skill, gap.jobs])).toEqual([
      ['PostgreSQL', 3],
      ['AWS', 1],
      ['Docker', 1],
    ]);
    expect(report.gaps[0]?.examples).toHaveLength(2);
    expect(report.gaps.some((gap) => gap.skill === 'React' || gap.skill === 'Kubernetes')).toBe(
      false,
    );
  });

  it('reports nothing before there is a profile', () => {
    const { add, insights } = setUp();
    add('one', 3.5, 'PostgreSQL');

    expect(insights.skillGaps()).toEqual({ gaps: [], jobsConsidered: 0 });
  });
});
