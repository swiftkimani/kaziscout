import type { Job } from '../../api/types';

const DAY_MS = 24 * 60 * 60 * 1000;
const dateFormat = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

/** "Today", "3 days ago", or a date for anything older than a month. */
export function formatListedAt(iso: string, now: Date = new Date()): string {
  const days = Math.floor((now.getTime() - new Date(iso).getTime()) / DAY_MS);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days <= 30) return `${days} days ago`;
  return dateFormat.format(new Date(iso));
}

export function formatDate(iso: string): string {
  return dateFormat.format(new Date(iso));
}

/** Where a job is, in words: the country, "Remote", or the board's own location text. */
export function describePlace(job: Job, countries: Record<string, string>): string {
  if (job.isRemote) return job.location ? `Remote · ${job.location}` : 'Remote';
  const country = job.countryCode ? countries[job.countryCode] : undefined;
  return country ?? job.location ?? 'Location not stated';
}
