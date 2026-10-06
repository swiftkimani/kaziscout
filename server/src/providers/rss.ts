import { XMLParser } from 'fast-xml-parser';
import { UpstreamError } from '../errors.js';
import { findClosingDate } from './closing-date.js';
import type { Provider, RawJob } from './types.js';

const parser = new XMLParser({
  ignoreAttributes: true,
  htmlEntities: true,
  // Force arrays so a feed with a single item parses the same as one with many.
  isArray: (name) => name === 'item',
});

// WordPress job boards publish titles as "Role at Company".
const TITLE_AT_COMPANY = /^(?<role>.+)\s+at\s+(?<company>[^|]+)$/i;
// We Work Remotely publishes titles as "Company: Role".
const COMPANY_COLON_ROLE = /^(?<company>[^:]{2,60}):\s+(?<role>.+)$/;
// Zimbabwean boards append "- Expiry Date: 2026-10-19" to every title.
const EXPIRY_SUFFIX = /\s+-\s+Expiry Date:.*$/i;

function text(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return String(value);
  // A guid with attributes parses as an object whose text sits under '#text'.
  if (value && typeof value === 'object' && '#text' in value) return text(value['#text']);
  return '';
}

function parseDate(value: string): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value.includes('T') || /[A-Za-z]/.test(value) ? value : `${value}Z`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export function splitTitle(
  rawTitle: string,
  style: 'role-at-company' | 'company-colon-role' = 'role-at-company',
): { title: string; company?: string } {
  const cleaned = rawTitle.replace(EXPIRY_SUFFIX, '').replace(/\s+/g, ' ').trim();
  const pattern = style === 'company-colon-role' ? COMPANY_COLON_ROLE : TITLE_AT_COMPANY;
  const match = pattern.exec(cleaned);
  const role = match?.groups?.role?.trim();
  const company = match?.groups?.company?.trim();
  return role && company ? { title: role, company } : { title: cleaned };
}

/** Teamtailor career feeds carry the place in their own <tt:locations> element. */
function teamtailorLocation(item: Record<string, unknown>): string {
  const locations = (item['tt:locations'] as { 'tt:location'?: unknown } | undefined)?.[
    'tt:location'
  ];
  const first = (Array.isArray(locations) ? locations[0] : locations) as
    Record<string, unknown> | undefined;
  if (!first) return '';
  return [text(first['tt:city']), text(first['tt:country'])].filter(Boolean).join(', ');
}

/** Parses an RSS 2.0 document into raw jobs. Items without a title or link are skipped. */
export function parseRss(xml: string, options: { isRemoteBoard: boolean }): RawJob[] {
  const document: unknown = parser.parse(xml);
  const channel = (document as { rss?: { channel?: { item?: unknown[] } } }).rss?.channel;
  if (!channel) throw new UpstreamError('The feed is not valid RSS.');

  const jobs: RawJob[] = [];
  for (const entry of channel.item ?? []) {
    const item = entry as Record<string, unknown>;
    const url = text(item.link);
    const rawTitle = text(item.title);
    if (!url || !rawTitle) continue;

    const location = text(item.region) || teamtailorLocation(item);
    const isRemote = options.isRemoteBoard || text(item.remoteStatus) === 'fully';

    jobs.push({
      externalId: text(item.guid) || url,
      ...splitTitle(rawTitle, options.isRemoteBoard ? 'company-colon-role' : 'role-at-company'),
      location: location || undefined,
      url,
      bodyHtml: text(item['content:encoded']) || text(item.description),
      postedAt: parseDate(text(item.pubDate)),
      // Zimbabwean boards put the deadline in the title; elsewhere it is found in the body later.
      closesAt: findClosingDate(rawTitle),
      isRemote,
    });
  }
  return jobs;
}

export const rssProvider: Provider = async (board, { fetchText }) => {
  if (board.access.type !== 'rss') throw new Error(`${board.id} is not an RSS board`);
  const xml = await fetchText(board.access.feedUrl, {
    accept: 'application/rss+xml, application/xml, text/xml',
  });
  const jobs = parseRss(xml, {
    isRemoteBoard: board.countries.includes('REMOTE') && board.category !== 'employer',
  });
  // An employer's own feed does not repeat the employer's name on every item.
  return board.category === 'employer'
    ? jobs.map((job) => ({ ...job, company: job.company ?? board.name }))
    : jobs;
};
