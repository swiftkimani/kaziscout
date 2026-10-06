import type { parseArgs } from 'node:util';

/** Where the CLI writes; tests pass their own to capture output. */
export interface CliIo {
  out: (line: string) => void;
  err: (line: string) => void;
}

/** A problem to show the person as one line, with a non-zero exit code. */
export class CliError extends Error {}

export const CLI_OPTIONS = {
  search: { type: 'string' },
  country: { type: 'string' },
  remote: { type: 'boolean', default: false },
  min: { type: 'string' },
  newest: { type: 'boolean', default: false },
  limit: { type: 'string', default: '15' },
  scanned: { type: 'boolean', default: false },
  name: { type: 'string' },
  headline: { type: 'string' },
  email: { type: 'string' },
  phone: { type: 'string' },
  roles: { type: 'string' },
  skills: { type: 'string' },
  countries: { type: 'string' },
  'onsite-only': { type: 'boolean' },
  'cv-file': { type: 'string' },
  'show-cv': { type: 'boolean', default: false },
  score: { type: 'string' },
  verdict: { type: 'string' },
  model: { type: 'string' },
  strengths: { type: 'string' },
  gaps: { type: 'string' },
  matched: { type: 'string' },
  pitch: { type: 'string' },
} as const;

/** The option values exactly as node:util's parseArgs types them for the options above. */
export type CliValues = ReturnType<typeof parseArgs<{ options: typeof CLI_OPTIONS }>>['values'];

/** What every command receives. */
export interface CliContext {
  io: CliIo;
  values: CliValues;
  /** The word after the command, such as a job id or a web address. */
  argument: string | undefined;
  /** Returns the argument, or stops with a message saying what was expected. */
  need: (what: string) => string;
  /** Calls one of the app's own routes in-process and returns its JSON body. */
  call: <T>(method: 'GET' | 'POST' | 'PUT', url: string, payload?: object) => Promise<T>;
}

export type Command = (context: CliContext) => Promise<void>;

export interface ApiJob {
  id: string;
  title: string;
  company?: string;
  location?: string;
  countryCode?: string;
  isRemote: boolean;
  url: string;
  score?: number;
  descriptionMd?: string;
  summary: string;
  evaluation?: {
    verdict: string;
    strengths: string[];
    gaps: string[];
    evaluator: string;
    model?: string;
  };
}

/** Pads or truncates text to exactly `width` columns. */
export function clip(text: string, width: number): string {
  return text.length <= width ? text.padEnd(width) : `${text.slice(0, width - 1)}…`;
}

export function formatScore(value: number | undefined): string {
  return value === undefined ? ' – ' : value.toFixed(1);
}

export function describePlace(job: ApiJob): string {
  if (job.isRemote) return job.location ? `Remote · ${job.location}` : 'Remote';
  return job.location ?? job.countryCode ?? '';
}

/** Splits "a, b ,c" (or "a | b" with another separator) into trimmed, non-empty parts. */
export function splitList(text: string | undefined, separator = ','): string[] {
  return (text ?? '')
    .split(separator)
    .map((item) => item.trim())
    .filter(Boolean);
}
