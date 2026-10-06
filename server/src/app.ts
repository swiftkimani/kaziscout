import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyInstance } from 'fastify';
import type { Board } from './boards/registry.js';
import type { Config } from './config.js';
import type { Db } from './db/client.js';
import { registerAuth } from './auth/routes.js';
import { AppError } from './errors.js';
import { FirecrawlConverter, LocalConverter, type PageConverter } from './extract/converters.js';
import type { ResolveHost } from './extract/safe-url.js';
import { fetchText as defaultFetchText, type FetchText } from './providers/http.js';
import { ApplicationRepository } from './repositories/applications.js';
import { BoardScanRepository } from './repositories/board-scans.js';
import { JobRepository } from './repositories/jobs.js';
import { DocumentRepository } from './repositories/documents.js';
import { FollowedSourceRepository } from './repositories/followed-sources.js';
import { ProfileRepository } from './repositories/profile.js';
import { registerV1Routes } from './routes/v1.js';
import { createAiClient, type AiClient } from './ai/client.js';
import { AiJobEvaluator } from './scoring/ai-evaluator.js';
import { HeuristicEvaluator } from './scoring/heuristic.js';
import { AlertService } from './services/alerts.js';
import { ApplyService, type DesktopAssistant } from './services/apply.js';
import { BriefScheduler } from './services/brief-scheduler.js';
import { ComputerUseDesktop } from './services/computer-use-desktop.js';
import { CvImportService } from './services/cv-import.js';
import { DocumentService } from './services/documents.js';
import { EvaluationService } from './services/evaluation.js';
import { InsightService } from './services/insights.js';
import { MarkdownService } from './services/markdown.js';
import { PostingCompleter } from './services/posting-completer.js';
import { ScanService } from './services/scan.js';
import { ScanScheduler } from './services/scheduler.js';
import { SourceCatalog, SourceService } from './services/sources.js';
import { TodayService } from './services/today.js';

export interface AppOptions {
  config: Config;
  db: Db;
  boards: Board[];
  /** Overrides for tests; production uses the real network, clock and desktop. */
  fetchText?: FetchText;
  resolveHost?: ResolveHost;
  ai?: AiClient;
  desktop?: DesktopAssistant;
  now?: () => Date;
}

const WEB_DIST = fileURLToPath(new URL('../../web/dist', import.meta.url));

/** Wires repositories, services and routes into a Fastify app. Nothing here listens on a port. */
export async function buildApp(options: AppOptions): Promise<FastifyInstance> {
  const { config, db, boards, now } = options;
  const fetchText = options.fetchText ?? defaultFetchText;

  const app = Fastify({
    logger: {
      level: config.LOG_LEVEL,
      redact: ['req.headers.authorization', 'req.headers.cookie'],
    },
    bodyLimit: 256 * 1024,
  });
  await app.register(rateLimit, { max: 300, timeWindow: '1 minute' });
  registerAuth(app, { accessToken: config.ACCESS_TOKEN, now: now ?? (() => new Date()) });

  const jobs = new JobRepository(db);
  const applications = new ApplicationRepository(db);
  const profiles = new ProfileRepository(db);
  const scans = new BoardScanRepository(db);
  const followed = new FollowedSourceRepository(db);
  const catalog = new SourceCatalog(boards, followed);

  const ai = options.ai ?? createAiClient(config);
  const desktop =
    options.desktop ?? (config.DESKTOP_ASSIST_ENABLED ? new ComputerUseDesktop() : undefined);
  const converter: PageConverter = config.FIRECRAWL_API_KEY
    ? new FirecrawlConverter(config.FIRECRAWL_API_KEY)
    : new LocalConverter(fetchText);

  const evaluationService = new EvaluationService({
    jobs,
    profiles,
    heuristic: new HeuristicEvaluator(now),
    ai: ai ? new AiJobEvaluator(ai) : undefined,
    now,
  });
  const markdownService = new MarkdownService({
    converter,
    jobs,
    resolveHost: options.resolveHost,
  });
  const completer = new PostingCompleter({
    jobs,
    markdown: markdownService,
    evaluation: evaluationService,
    logger: app.log,
  });
  const scanService = new ScanService({
    db,
    boards: () => catalog.all(),
    jobs,
    scans,
    evaluation: evaluationService,
    completer,
    providerContext: { fetchText, now },
    logger: app.log,
    now,
  });
  const documentService = new DocumentService({
    jobs,
    profiles,
    documents: new DocumentRepository(db),
    ai,
    now,
  });
  const todayService = new TodayService({
    jobs,
    applications,
    scans,
    boards: () => catalog.all(),
    now,
  });
  const applyService = new ApplyService({ jobs, profiles, applications, desktop, now });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      return reply.code(error.statusCode).send({
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
          request_id: request.id,
        },
      });
    }
    const statusCode = (error as { statusCode?: number }).statusCode;
    if (statusCode !== undefined && statusCode >= 400 && statusCode < 500) {
      // Fastify's own client errors: malformed JSON, payload too large, rate limited.
      return reply.code(statusCode).send({
        error: {
          code: statusCode === 429 ? 'RATE_LIMITED' : 'BAD_REQUEST',
          message:
            statusCode === 429
              ? 'Too many requests. Wait a minute and try again.'
              : 'The request could not be read.',
          details: {},
          request_id: request.id,
        },
      });
    }
    request.log.error({ err: error }, 'unhandled error');
    return reply.code(500).send({
      error: {
        code: 'INTERNAL',
        message: 'Something went wrong on our side. Your data is safe; try again.',
        details: {},
        request_id: request.id,
      },
    });
  });

  app.get('/health', () => {
    db.prepare('SELECT 1').get();
    return { status: 'ok' };
  });

  registerV1Routes(app, {
    catalog,
    sourceService: new SourceService({ catalog, followed, scans: scanService, now }),
    jobs,
    applications,
    profiles,
    scans,
    scanService,
    evaluationService,
    markdownService,
    applyService,
    documentService,
    todayService,
    insightService: new InsightService({ jobs, profiles }),
    cvImportService: new CvImportService({ ai, desktop }),
    aiModel: ai?.model,
    now,
  });

  // In production the built web app is served by this process; in dev, Vite serves it.
  if (existsSync(WEB_DIST)) {
    await app.register(fastifyStatic, { root: WEB_DIST });
    app.setNotFoundHandler((request, reply) => {
      if (request.method === 'GET' && !request.url.startsWith('/v1/')) {
        return reply.sendFile('index.html');
      }
      return reply.code(404).send({
        error: {
          code: 'NOT_FOUND',
          message: 'That address does not exist.',
          details: {},
          request_id: request.id,
        },
      });
    });
  }

  const alerts = config.ALERT_WEBHOOK_URL
    ? new AlertService({
        jobs,
        webhookUrl: config.ALERT_WEBHOOK_URL,
        minScore: config.ALERT_MIN_SCORE,
        logger: app.log,
      })
    : undefined;
  const scheduler =
    config.SCAN_INTERVAL_MINUTES > 0
      ? new ScanScheduler({
          scans: scanService,
          alerts,
          intervalMinutes: config.SCAN_INTERVAL_MINUTES,
          logger: app.log,
        })
      : undefined;
  const briefs =
    alerts && config.BRIEF_TIME
      ? new BriefScheduler({
          today: todayService,
          alerts,
          time: config.BRIEF_TIME,
          logger: app.log,
          now,
        })
      : undefined;
  app.addHook('onReady', () => {
    scheduler?.start();
    briefs?.start();
  });

  app.addHook('onClose', async () => {
    scheduler?.stop();
    briefs?.stop();
    await desktop?.close();
  });

  return app;
}
