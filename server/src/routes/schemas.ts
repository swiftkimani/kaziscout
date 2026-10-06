import { z } from 'zod';
import { AFRICAN_COUNTRIES } from '../boards/countries.js';
import { ValidationError } from '../errors.js';
import { APPLICATION_STATUSES } from '../repositories/applications.js';

const countryCode = z
  .string()
  .toUpperCase()
  .refine((code) => code in AFRICAN_COUNTRIES, 'must be an African country code');

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

export const profileBody = z.object({
  fullName: z.string().trim().min(1, 'Enter your name').max(120),
  headline: z.string().trim().max(200).default(''),
  cvText: z.string().trim().max(50_000).default(''),
  skills: trimmedList(60, 60),
  targetTitles: trimmedList(15, 100),
  countries: z.array(countryCode).max(54),
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
