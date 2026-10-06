import type { Job, JobRepository } from '../repositories/jobs.js';
import type { ProfileRepository } from '../repositories/profile.js';
import { findSkillsIn } from '../scoring/skill-vocabulary.js';
import type { Profile } from '../scoring/types.js';

/** One skill a posting names, and whether the person's profile or CV shows it. */
export interface Requirement {
  skill: string;
  inProfile: boolean;
}

export interface SkillGap {
  skill: string;
  /** How many near-miss jobs ask for it. */
  jobs: number;
  /** A couple of those jobs, so the number is not abstract. */
  examples: { id: string; title: string; company?: string }[];
}

export interface SkillGapReport {
  gaps: SkillGap[];
  /** How many jobs were looked at to produce the list. */
  jobsConsidered: number;
}

// Jobs the person nearly matches: fair, but not yet strong. These are where one more skill counts.
const NEAR_MISS_FROM = 3;
const NEAR_MISS_BELOW = 4;
const MAX_JOBS_CONSIDERED = 1500;
const MAX_GAPS = 12;
const EXAMPLES_PER_GAP = 2;

function profileSkills(profile: Profile): Set<string> {
  const stated = profile.skills.map((skill) => skill.toLowerCase());
  const inCv = findSkillsIn(`${profile.headline}\n${profile.cvText}`).map((skill) =>
    skill.toLowerCase(),
  );
  return new Set([...stated, ...inCv]);
}

function postingText(job: Job): string {
  return `${job.title}\n${job.descriptionMd ?? job.summary}`;
}

export class InsightService {
  constructor(private readonly deps: { jobs: JobRepository; profiles: ProfileRepository }) {}

  /** What a posting asks for, each marked as shown or not shown by the person's profile and CV. */
  requirementsFor(job: Job): Requirement[] {
    const profile = this.deps.profiles.get();
    const has = profile ? profileSkills(profile) : new Set<string>();
    return findSkillsIn(postingText(job)).map((skill) => ({
      skill,
      inProfile: has.has(skill.toLowerCase()),
    }));
  }

  /**
   * The skills most often missing across jobs the person nearly matches. It answers "what should
   * I learn next?" from the postings themselves.
   */
  skillGaps(): SkillGapReport {
    const profile = this.deps.profiles.get();
    if (!profile) return { gaps: [], jobsConsidered: 0 };
    const has = profileSkills(profile);
    const nearMisses = this.deps.jobs.listScoredBetween(
      NEAR_MISS_FROM,
      NEAR_MISS_BELOW,
      MAX_JOBS_CONSIDERED,
    );

    const bySkill = new Map<string, SkillGap>();
    for (const job of nearMisses) {
      for (const skill of findSkillsIn(postingText(job))) {
        if (has.has(skill.toLowerCase())) continue;
        const gap = bySkill.get(skill) ?? { skill, jobs: 0, examples: [] };
        gap.jobs += 1;
        if (gap.examples.length < EXAMPLES_PER_GAP) {
          gap.examples.push({ id: job.id, title: job.title, company: job.company });
        }
        bySkill.set(skill, gap);
      }
    }
    const gaps = [...bySkill.values()]
      .sort((a, b) => b.jobs - a.jobs || a.skill.localeCompare(b.skill))
      .slice(0, MAX_GAPS);
    return { gaps, jobsConsidered: nearMisses.length };
  }
}
