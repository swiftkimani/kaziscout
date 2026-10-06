/** Shapes returned by the KaziScout API. Kept in step with server/src by hand. */

export interface Evaluation {
  score: number;
  evaluator: 'heuristic' | 'ai';
  model?: string;
  /** Each part of the keyword score from 0 to 1. Absent on AI assessments. */
  breakdown?: { title: number; skills: number; location: number; freshness: number };
  verdict: string;
  strengths: string[];
  gaps: string[];
  matchedSkills: string[];
  pitch?: string;
}

export const APPLICATION_STATUSES = [
  'saved',
  'applied',
  'interview',
  'offer',
  'rejected',
  'withdrawn',
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export interface Application {
  id: number;
  jobId: string;
  status: ApplicationStatus;
  notes: string;
  appliedAt?: string;
  updatedAt: string;
  job: { title: string; company?: string; url: string; boardId: string; score?: number };
}

export interface Job {
  id: string;
  boardId: string;
  title: string;
  company?: string;
  location?: string;
  countryCode?: string;
  isRemote: boolean;
  url: string;
  summary: string;
  descriptionMd?: string;
  postedAt?: string;
  /** When applications close, if the posting says. */
  closesAt?: string;
  listedAt: string;
  score?: number;
  evaluation?: Evaluation;
}

export interface JobDetail extends Job {
  application: Application | null;
}

export interface BoardScan {
  boardId: string;
  startedAt: string;
  outcome: 'ok' | 'error';
  jobsFound: number;
  jobsNew: number;
  errorMessage?: string;
}

export interface Board {
  id: string;
  name: string;
  url: string;
  countries: string[];
  category: string;
  language: string;
  access: { type: 'rss' | 'api' | 'ats' | 'workday' | 'listing' };
  status: 'live' | 'blocked' | 'down';
  checkedAt: string;
  note?: string;
  isScannable: boolean;
  /** An employer the person added, as opposed to one shipped in the registry. */
  isFollowed: boolean;
  jobCount: number;
  lastScan: BoardScan | null;
}

export interface Profile {
  fullName: string;
  email: string;
  phone: string;
  headline: string;
  cvText: string;
  skills: string[];
  targetTitles: string[];
  countries: string[];
  isRemoteOk: boolean;
}

export interface Meta {
  /** Every known country by ISO code. */
  countries: Record<string, string>;
  africanCountries: string[];
  /** Countries that currently have jobs. */
  jobCountries: string[];
  features: { aiModel: string | null; desktopAssist: boolean; converter: 'firecrawl' | 'local' };
}

export interface MarkdownPage {
  url: string;
  title?: string;
  markdown: string;
  converter: 'firecrawl' | 'local';
}

export interface ApplicationDocuments {
  jobId: string;
  coverLetterMd: string;
  cvMd: string;
  model: string;
  createdAt: string;
}

export interface FollowUpQuestion {
  field: keyof Profile;
  question: string;
  suggestion?: string;
}

/** A profile drafted from a CV, with the questions the CV left open. Not saved yet. */
export interface CvImport {
  draft: Profile;
  questions: FollowUpQuestion[];
  readBy: 'ai' | 'rules';
  characters: number;
}

export interface Today {
  newStrong: Job[];
  closingSoon: Job[];
  followUps: Application[];
  failedSources: { id: string; name: string; errorMessage: string }[];
}
