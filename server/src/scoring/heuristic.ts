import { COUNTRIES, findStatedRestriction, judgeRemoteRestriction } from '../boards/countries.js';
import type { Evaluation, JobEvaluator, Profile, ScorableJob } from './types.js';

const WEIGHTS = { title: 0.35, skills: 0.35, location: 0.2, freshness: 0.1 } as const;
const DAY_MS = 24 * 60 * 60 * 1000;
// A job the person cannot take because of where it is can never rank as a good match.
const UNREACHABLE_LOCATION_CAP = 2;
// Words too common in job titles to count as a match on their own.
const STOP_WORDS = new Set(['and', 'the', 'of', 'for', 'to', 'in', 'a', 'an', 'at', 'with', 'or']);

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9+#.]+/)
    .filter((word) => word.length > 1 && !STOP_WORDS.has(word));
}

/** True when `phrase` appears in `haystack` as whole words ("java" must not match "javascript"). */
function containsPhrase(haystack: string, phrase: string): boolean {
  const escaped = phrase
    .trim()
    .toLowerCase()
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (!escaped) return false;
  return new RegExp(`(?<![a-z0-9])${escaped}(?![a-z0-9])`).test(haystack);
}

/** Best overlap between the job title and any one of the titles the person is targeting. */
function scoreTitle(jobTitle: string, targetTitles: string[]): number {
  const jobWords = new Set(tokens(jobTitle));
  let best = 0;
  for (const target of targetTitles) {
    const targetWords = tokens(target);
    if (targetWords.length === 0) continue;
    const hits = targetWords.filter((word) => jobWords.has(word)).length;
    best = Math.max(best, hits / targetWords.length);
  }
  return best;
}

function scoreRemoteLocation(
  job: ScorableJob,
  profile: Profile,
): { value: number; reason: string } {
  if (!profile.isRemoteOk) {
    return { value: 0.2, reason: 'Remote role, but your profile says on-site only' };
  }
  const eligibility = judgeRemoteRestriction(job.location, profile.countries);
  switch (eligibility.kind) {
    case 'open':
      return scoreUnrestrictedRemote(job, profile);
    case 'match':
      return { value: 1, reason: `Remote role open to ${eligibility.place}` };
    case 'excluded':
      return { value: 0, reason: `Remote, but limited to ${eligibility.place}` };
    case 'unclear':
      return {
        value: 0.5,
        reason: `Remote, limited to "${eligibility.place}". Check that you qualify`,
      };
  }
}

/** A role located only as "Remote" may still state a limit in its text, so that is checked too. */
function scoreUnrestrictedRemote(
  job: ScorableJob,
  profile: Profile,
): { value: number; reason: string } {
  const stated = findStatedRestriction(job.body);
  const eligibility = stated ? judgeRemoteRestriction(stated, profile.countries) : undefined;
  if (eligibility?.kind === 'excluded') {
    return { value: 0, reason: `Remote, but the posting asks for: ${stated}` };
  }
  if (eligibility?.kind === 'match') {
    return { value: 1, reason: `Remote role, and the posting asks for: ${stated}` };
  }
  return { value: 1, reason: 'Remote role with no region limit stated' };
}

function scoreLocation(job: ScorableJob, profile: Profile): { value: number; reason: string } {
  if (job.isRemote) return scoreRemoteLocation(job, profile);
  if (!job.countryCode) return { value: 0.5, reason: 'The posting does not state a country' };
  const country = COUNTRIES[job.countryCode] ?? job.countryCode;
  return profile.countries.includes(job.countryCode)
    ? { value: 1, reason: `Based in ${country}, one of your countries` }
    : { value: 0, reason: `Based in ${country}, which is not in your profile` };
}

function scoreFreshness(listedAt: Date, now: Date): number {
  const ageDays = (now.getTime() - listedAt.getTime()) / DAY_MS;
  if (ageDays <= 7) return 1;
  if (ageDays <= 30) return 0.6;
  return 0.2;
}

function verdictFor(score: number): string {
  if (score >= 4) return 'Strong match. Worth applying.';
  if (score >= 3) return 'Reasonable match. Read the posting before deciding.';
  if (score >= 2) return 'Weak match. Probably not worth your time.';
  return 'Poor match.';
}

/** Scores a job with keyword overlap only. Pure, offline, and the same input gives the same score. */
export function scoreHeuristically(job: ScorableJob, profile: Profile, now: Date): Evaluation {
  const haystack = `${job.title}\n${job.body}`.toLowerCase();
  const matchedSkills = profile.skills.filter((skill) => containsPhrase(haystack, skill));
  const skillsValue = profile.skills.length > 0 ? matchedSkills.length / profile.skills.length : 0;
  // Postings list a handful of skills, so matching half of a long skills list is already strong.
  const skillsScore = Math.min(1, skillsValue * 2);
  const titleScore = scoreTitle(job.title, profile.targetTitles);
  const location = scoreLocation(job, profile);
  const freshness = scoreFreshness(job.listedAt, now);

  const total =
    WEIGHTS.title * titleScore +
    WEIGHTS.skills * skillsScore +
    WEIGHTS.location * location.value +
    WEIGHTS.freshness * freshness;
  const uncapped = Math.round((1 + 4 * total) * 10) / 10;
  const score = location.value === 0 ? Math.min(uncapped, UNREACHABLE_LOCATION_CAP) : uncapped;

  const strengths: string[] = [];
  const gaps: string[] = [];
  if (titleScore >= 0.5) strengths.push('The title is close to a role you are targeting');
  else gaps.push('The title is not close to any role you are targeting');
  if (matchedSkills.length > 0) strengths.push(`Mentions ${matchedSkills.join(', ')}`);
  else gaps.push('None of your listed skills appear in the posting');
  (location.value >= 0.5 ? strengths : gaps).push(location.reason);
  if (freshness < 0.6) gaps.push('Listed more than 30 days ago, so it may be closed');

  return {
    score,
    evaluator: 'heuristic',
    breakdown: {
      title: titleScore,
      skills: skillsScore,
      location: location.value,
      freshness,
    },
    verdict: verdictFor(score),
    strengths,
    gaps,
    matchedSkills,
  };
}

export class HeuristicEvaluator implements JobEvaluator {
  constructor(private readonly now: () => Date = () => new Date()) {}

  evaluate(job: ScorableJob, profile: Profile): Promise<Evaluation> {
    return Promise.resolve(scoreHeuristically(job, profile, this.now()));
  }
}
