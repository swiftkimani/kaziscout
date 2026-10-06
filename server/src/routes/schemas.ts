import { z } from 'zod';
import { COUNTRIES } from '../boards/countries.js';
import { ValidationError } from '../errors.js';
import { APPLICATION_STATUSES } from '../repositories/applications.js';

const countryCode = z
  .string()
  .toUpperCase()
  .refine((code) => code in COUNTRIES, 'must be a known country code');

const trimmedList = (maxItems: number, maxLength: number) =>
  z
    .array(z.string().trim().min(1).max(maxLength))
    .max(maxItems)
    .transform((items) => [...new Set(items)]);

export const jobListQuery = z.object({
  search: z.string().trim().max(100).optional(),
  board: z.string().max(60).optional(),
  country: countryCode.optional(),
  remote: z.enum(['true', 'false']).optional(),
  minScore: z.coerce.number().min(1).max(5).optional(),
  sort: z.enum(['newest', 'score']).default('newest'),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  cursor: z.string().max(300).optional(),
});

export const idParam = z.object({ id: z.string().min(1).max(60) });
export const numericIdParam = z.object({ id: z.coerce.number().int().positive() });

export const evaluateBody = z.object({
  evaluator: z.enum(['heuristic', 'ai']).default('heuristic'),
});

export const addJobBody = z.object({ url: z.string().trim().min(1).max(2000) });

/** An assessment written by an outside agent. Same shape the built-in AI evaluator must return. */
export const assessmentBody = z.object({
  score: z.number().min(1).max(5),
  verdict: z.string().trim().min(1).max(600),
  strengths: z.array(z.string().trim().min(1).max(300)).max(8).default([]),
  gaps: z.array(z.string().trim().min(1).max(300)).max(8).default([]),
  matchedSkills: z.array(z.string().trim().min(1).max(60)).max(40).default([]),
  pitch: z.string().trim().max(1500).default(''),
  model: z.string().trim().min(1).max(80),
});

export const profileBody = z.object({
  fullName: z.string().trim().min(1, 'Enter your name').max(120),
  // Optional, but when given they must be usable on a form.
  email: z.union([z.literal(''), z.email('Enter a valid email address')]).default(''),
  phone: z
    .string()
    .trim()
    .max(30)
    .regex(/^[+\d][\d\s()-]*$|^$/, 'Use digits, spaces and + only')
    .default(''),
  headline: z.string().trim().max(200).default(''),
  cvText: z.string().trim().max(50_000).default(''),
  skills: trimmedList(60, 60),
  targetTitles: trimmedList(15, 100),
  countries: z.array(countryCode).max(60),
  isRemoteOk: z.boolean(),
});

export const extractBody = z.object({ url: z.string().trim().min(1).max(2000) });

export const applicationCreateBody = z.object({ jobId: z.string().min(1).max(60) });

export const applicationUpdateBody = z
  .object({
    status: z.enum(APPLICATION_STATUSES).optional(),
    notes: z.string().max(5000).optional(),
  })
  .refine((body) => body.status !== undefined || body.notes !== undefined, {
    message: 'Send a status or notes to change',
  });

/** Parses request input, turning schema failures into the API's validation error. */
export function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  throw new ValidationError('Some of the details sent are not valid.', {
    fields: z.flattenError(result.error).fieldErrors,
    form: z.flattenError(result.error).formErrors,
  });
}
