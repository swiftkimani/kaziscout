import type { Job } from '../repositories/jobs.js';

function escapeText(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/[,;]/g, '\\$&').replace(/\r?\n/g, '\\n');
}

function dateOnly(iso: string): string {
  return iso.slice(0, 10).replace(/-/g, '');
}

/**
 * The closing dates of tracked jobs as an iCalendar file, which any calendar app can import or
 * subscribe to. Each deadline is an all-day event on the day applications close.
 */
export function toCalendar(jobs: Job[], now: Date): string {
  const stamp = `${now.toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`;
  const events = jobs.flatMap((job) => {
    if (!job.closesAt) return [];
    const day = dateOnly(job.closesAt);
    const next = dateOnly(
      new Date(new Date(job.closesAt).getTime() + 24 * 60 * 60 * 1000).toISOString(),
    );
    return [
      'BEGIN:VEVENT',
      `UID:${job.id}@kaziscout`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${day}`,
      `DTEND;VALUE=DATE:${next}`,
      `SUMMARY:${escapeText(`Closes: ${job.title}${job.company ? ` at ${job.company}` : ''}`)}`,
      `DESCRIPTION:${escapeText(job.url)}`,
      `URL:${job.url}`,
      'END:VEVENT',
    ];
  });
  // iCalendar requires CRLF line endings.
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//KaziScout//Deadlines//EN',
    'CALSCALE:GREGORIAN',
    ...events,
    'END:VCALENDAR',
    '',
  ].join('\r\n');
}
