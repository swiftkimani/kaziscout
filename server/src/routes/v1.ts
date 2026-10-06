import type { FastifyInstance } from 'fastify';
import { AFRICAN_COUNTRIES, COUNTRIES } from '../boards/countries.js';
import { isScannable } from '../boards/registry.js';
import { NotFoundError } from '../errors.js';
import type { ApplicationRepository } from '../repositories/applications.js';
import type { BoardScanRepository } from '../repositories/board-scans.js';
import type { JobRepository } from '../repositories/jobs.js';
import type { ProfileRepository } from '../repositories/profile.js';
import type { ApplyService } from '../services/apply.js';
import type { CvImportService } from '../services/cv-import.js';
import type { DocumentService } from '../services/documents.js';
import type { EvaluationService } from '../services/evaluation.js';
import type { InsightService } from '../services/insights.js';
import type { MarkdownService } from '../services/markdown.js';
import type { ScanService } from '../services/scan.js';
import type { SourceCatalog, SourceService } from '../services/sources.js';
import type { TodayService } from '../services/today.js';
import {
  addJobBody,
  applicationCreateBody,
  applicationUpdateBody,
  assessmentBody,
  cvImportBody,
  evaluateBody,
  extractBody,
  idParam,
  jobListQuery,
  numericIdParam,
  parse,
  profileBody,
} from './schemas.js';

export interface RouteDeps {
  catalog: SourceCatalog;
  sourceService: SourceService;
  jobs: JobRepository;
  applications: ApplicationRepository;
  profiles: ProfileRepository;
  scans: BoardScanRepository;
  scanService: ScanService;
  evaluationService: EvaluationService;
  markdownService: MarkdownService;
  applyService: ApplyService;
  documentService: DocumentService;
  cvImportService: CvImportService;
  todayService: TodayService;
  insightService: InsightService;
  /** Name of the configured AI model, if any. */
  aiModel?: string;
  now?: () => Date;
}

// Outbound work (scans, page fetches, model calls) is limited harder than plain reads.
const EXPENSIVE = { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } };
const TRACKER_PAGE_SIZE = 500;

/** HTTP only: each handler validates input, calls one service or repository, and shapes output. */
export function registerV1Routes(app: FastifyInstance, deps: RouteDeps): void {
  const now = () => deps.now?.() ?? new Date();

  app.get('/v1/meta', () => ({
    countries: COUNTRIES,
    africanCountries: Object.keys(AFRICAN_COUNTRIES),
    // Countries that currently have jobs, so the filter offers only useful choices.
    jobCountries: deps.jobs.listCountryCodes(),
    features: {
      aiModel: deps.aiModel ?? null,
      desktopAssist: deps.applyService.isDesktopAssistAvailable,
      converter: deps.markdownService.converterName,
    },
  }));

  app.get('/v1/today', () => ({ data: deps.todayService.get() }));

  app.get('/v1/insights/skill-gaps', () => ({ data: deps.insightService.skillGaps() }));

  app.get('/v1/boards', () => {
    const lastScans = deps.scans.latestByBoard();
    const jobCounts = deps.jobs.countByBoard();
    return {
      data: deps.catalog.all().map((board) => ({
        isFollowed: deps.catalog.isFollowed(board.id),
        ...board,
        isScannable: isScannable(board),
        jobCount: jobCounts.get(board.id) ?? 0,
        lastScan: lastScans.get(board.id) ?? null,
      })),
    };
  });

  app.post('/v1/boards/:id/scan', EXPENSIVE, async (request) => {
    const { id } = parse(idParam, request.params);
    return { data: await deps.scanService.scanBoard(id) };
  });

  app.post('/v1/scans', EXPENSIVE, async () => ({ data: await deps.scanService.scanAll() }));

  app.get('/v1/jobs', (request) => {
    const query = parse(jobListQuery, request.query);
    const page = deps.jobs.list({
      search: query.search || undefined,
      boardId: query.board,
      countryCode: query.country,
      isRemote: query.remote === undefined ? undefined : query.remote === 'true',
      minScore: query.minScore,
      visibility: query.hidden === 'only' ? 'hidden' : 'visible',
      untrackedOnly: query.untracked === 'true',
      sort: query.sort,
      limit: query.limit,
      cursor: query.cursor,
    });
    return { data: page.data, next_cursor: page.nextCursor };
  });

  app.post('/v1/jobs', EXPENSIVE, async (request, reply) => {
    const { url } = parse(addJobBody, request.body);
    const job = await deps.markdownService.addJobFromUrl(url, now());
    void reply.code(201).header('location', `/v1/jobs/${job.id}`);
    // Score it straight away if there is a profile to score against.
    await deps.evaluationService.scoreNewJobs([job.id]);
    return {
      data: deps.jobs.findById(job.id),
      // When the link is from a hiring system KaziScout reads, offer to follow that employer.
      suggestedSource: deps.catalog.suggestFor(url) ?? null,
    };
  });

  app.post('/v1/sources', EXPENSIVE, async (request, reply) => {
    const { url } = parse(addJobBody, request.body);
    void reply.code(201);
    return { data: await deps.sourceService.follow(url) };
  });

  app.delete('/v1/sources/:id', (request, reply) => {
    const { id } = parse(idParam, request.params);
    deps.sourceService.unfollow(id);
    void reply.code(204);
    return null;
  });

  app.put('/v1/jobs/:id/evaluation', (request) => {
    const { id } = parse(idParam, request.params);
    const { model, ...assessment } = parse(assessmentBody, request.body);
    return { data: deps.evaluationService.recordAssessment(id, assessment, model) };
  });

  app.get('/v1/jobs/:id', (request) => {
    const { id } = parse(idParam, request.params);
    const job = deps.jobs.findById(id);
    if (!job) throw new NotFoundError('That job');
    return {
      data: {
        ...job,
        application: deps.applications.findByJobId(id) ?? null,
        requirements: deps.insightService.requirementsFor(job),
        // Other boards carrying this same role.
        alsoOn: deps.jobs.listCopiesOf(id),
      },
    };
  });

  app.put('/v1/jobs/:id/hidden', (request) => {
    const { id } = parse(idParam, request.params);
    if (!deps.jobs.setHidden(id, true, now())) throw new NotFoundError('That job');
    return { data: deps.jobs.findById(id) };
  });

  app.delete('/v1/jobs/:id/hidden', (request) => {
    const { id } = parse(idParam, request.params);
    if (!deps.jobs.setHidden(id, false, now())) throw new NotFoundError('That job');
    return { data: deps.jobs.findById(id) };
  });

  app.post('/v1/jobs/:id/evaluate', EXPENSIVE, async (request) => {
    const { id } = parse(idParam, request.params);
    const { evaluator } = parse(evaluateBody, request.body ?? {});
    return { data: await deps.evaluationService.evaluate(id, evaluator) };
  });

  app.post('/v1/jobs/:id/markdown', EXPENSIVE, async (request) => {
    const { id } = parse(idParam, request.params);
    return { data: await deps.markdownService.refreshJobDescription(id) };
  });

  app.get('/v1/jobs/:id/application-pack', (request) => {
    const { id } = parse(idParam, request.params);
    return { data: { pack: deps.applyService.getPack(id).pack } };
  });

  app.get('/v1/jobs/:id/documents', (request) => {
    const { id } = parse(idParam, request.params);
    return { data: deps.documentService.get(id) ?? null };
  });

  app.post('/v1/jobs/:id/documents', EXPENSIVE, async (request) => {
    const { id } = parse(idParam, request.params);
    return { data: await deps.documentService.write(id) };
  });

  app.post('/v1/jobs/:id/assist', EXPENSIVE, async (request) => {
    const { id } = parse(idParam, request.params);
    return { data: await deps.applyService.assist(id) };
  });

  app.post('/v1/extract', EXPENSIVE, async (request) => {
    const { url } = parse(extractBody, request.body);
    return { data: await deps.markdownService.convert(url) };
  });

  app.get('/v1/profile', () => ({ data: deps.profiles.get() ?? null }));

  app.put('/v1/profile', async (request) => {
    deps.profiles.save(parse(profileBody, request.body), now());
    const rescored = await deps.evaluationService.rescoreAll();
    return { data: deps.profiles.get(), rescored };
  });

  // Drafts a profile from a CV. Nothing is saved: the person reviews the draft, then PUTs it.
  app.post('/v1/profile/import', { ...EXPENSIVE, bodyLimit: 15 * 1024 * 1024 }, async (request) => {
    const body = parse(cvImportBody, request.body);
    if ('clipboard' in body)
      return { data: await deps.cvImportService.import({ kind: 'clipboard' }) };
    if ('text' in body)
      return { data: await deps.cvImportService.import({ kind: 'text', text: body.text }) };
    return {
      data: await deps.cvImportService.import({
        kind: 'file',
        filename: body.filename,
        bytes: Buffer.from(body.contentBase64, 'base64'),
      }),
    };
  });

  app.get('/v1/applications', () => ({ data: deps.applications.list(TRACKER_PAGE_SIZE) }));

  app.post('/v1/applications', (request, reply) => {
    const { jobId } = parse(applicationCreateBody, request.body);
    if (!deps.jobs.findById(jobId)) throw new NotFoundError('That job');
    // Saving the same job twice is a retry, not an error: return the existing application.
    const existing = deps.applications.findByJobId(jobId);
    if (existing) return { data: existing };
    const id = deps.applications.create(jobId, now());
    void reply.code(201).header('location', `/v1/applications/${id}`);
    return { data: deps.applications.findById(id) };
  });

  app.patch('/v1/applications/:id', (request) => {
    const { id } = parse(numericIdParam, request.params);
    const changes = parse(applicationUpdateBody, request.body);
    const current = deps.applications.findById(id);
    if (!current) throw new NotFoundError('That application');
    const isFirstApply = changes.status === 'applied' && !current.appliedAt;
    deps.applications.update(
      id,
      { ...changes, appliedAt: isFirstApply ? now().toISOString() : undefined },
      now(),
    );
    return { data: deps.applications.findById(id) };
  });

  app.delete('/v1/applications/:id', (request, reply) => {
    const { id } = parse(numericIdParam, request.params);
    if (!deps.applications.delete(id)) throw new NotFoundError('That application');
    void reply.code(204);
    return null;
  });
}
