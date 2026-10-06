import { z } from 'zod';
import { UpstreamError } from '../errors.js';
import type { Provider, RawJob } from './types.js';

function parseJson<T>(body: string, schema: z.ZodType<T>, source: string): T {
  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    throw new UpstreamError(`${source} did not return JSON.`);
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    throw new UpstreamError(`${source} changed its response format.`, {
      issues: z.prettifyError(parsed.error),
    });
  }
  return parsed.data;
}

const remotiveSchema = z.object({
  jobs: z.array(
    z.object({
      id: z.number(),
      url: z.url(),
      title: z.string(),
      company_name: z.string(),
      publication_date: z.string(),
      candidate_required_location: z.string().default(''),
      description: z.string().default(''),
    }),
  ),
});

export const remotiveProvider: Provider = async (_board, { fetchText }) => {
  const body = await fetchText('https://remotive.com/api/remote-jobs', {
    accept: 'application/json',
  });
  return parseJson(body, remotiveSchema, 'Remotive').jobs.map((job): RawJob => ({
    externalId: String(job.id),
    title: job.title,
    company: job.company_name,
    location: job.candidate_required_location || 'Worldwide',
    url: job.url,
    bodyHtml: job.description,
    // Remotive publishes naive timestamps in UTC.
    postedAt: new Date(`${job.publication_date}Z`),
    isRemote: true,
  }));
};

const himalayasSchema = z.object({
  jobs: z.array(
    z.object({
      guid: z.string(),
      title: z.string(),
      companyName: z.string(),
      applicationLink: z.url(),
      locationRestrictions: z.array(z.string()).default([]),
      description: z.string().default(''),
      pubDate: z.number(),
    }),
  ),
});

export const himalayasProvider: Provider = async (_board, { fetchText }) => {
  // The newest page only: scans run often, and paging the full 100k-job feed would be abusive.
  const body = await fetchText('https://himalayas.app/jobs/api?limit=20', {
    accept: 'application/json',
  });
  return parseJson(body, himalayasSchema, 'Himalayas').jobs.map((job): RawJob => ({
    externalId: job.guid,
    title: job.title,
    company: job.companyName,
    location: job.locationRestrictions.join(', ') || 'Worldwide',
    url: job.applicationLink,
    bodyHtml: job.description,
    postedAt: new Date(job.pubDate * 1000),
    isRemote: true,
  }));
};

const remoteOkJobSchema = z.object({
  id: z.coerce.string(),
  position: z.string(),
  company: z.string(),
  url: z.url(),
  location: z.string().default(''),
  description: z.string().default(''),
  date: z.string(),
});

export const remoteOkProvider: Provider = async (_board, { fetchText }) => {
  const body = await fetchText('https://remoteok.com/api', { accept: 'application/json' });
  // The first array element is a legal notice, not a job.
  const entries = parseJson(body, z.array(z.unknown()), 'Remote OK').slice(1);
  return z
    .array(remoteOkJobSchema)
    .parse(entries)
    .map((job): RawJob => ({
      externalId: job.id,
      title: job.position,
      company: job.company,
      location: job.location || 'Worldwide',
      url: job.url,
      bodyHtml: job.description,
      postedAt: new Date(job.date),
      isRemote: true,
    }));
};
