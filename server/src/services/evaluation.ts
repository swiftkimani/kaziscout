import { NotConfiguredError, NotFoundError, ValidationError } from '../errors.js';
import type { Job, JobRepository } from '../repositories/jobs.js';
import type { ProfileRepository } from '../repositories/profile.js';
import { toEvaluation, type Assessment } from '../scoring/assessment.js';
import type { Evaluation, JobEvaluator, Profile, ScorableJob } from '../scoring/types.js';

const RESCORE_BATCH = 500;

function toScorable(job: Job): ScorableJob {
  return {
    title: job.title,
    company: job.company,
    location: job.location,
    countryCode: job.countryCode,
    isRemote: job.isRemote,
    body: job.descriptionMd ?? job.summary,
    listedAt: new Date(job.listedAt),
  };
}

export class EvaluationService {
  constructor(
    private readonly deps: {
      jobs: JobRepository;
      profiles: ProfileRepository;
      heuristic: JobEvaluator;
      /** Absent when no AI model is configured. */
      ai?: JobEvaluator;
      now?: () => Date;
    },
  ) {}

  get isAiAvailable(): boolean {
    return this.deps.ai !== undefined;
  }

  private now(): Date {
    return this.deps.now?.() ?? new Date();
  }

  private requireProfile(): Profile {
    const profile = this.deps.profiles.get();
    if (!profile) {
      throw new ValidationError(
        'Fill in your profile first, so there is something to score against.',
      );
    }
    return profile;
  }

  /** Evaluates one job and stores the result. */
  async evaluate(jobId: string, evaluatorName: Evaluation['evaluator']): Promise<Job> {
    const job = this.deps.jobs.findById(jobId);
    if (!job) throw new NotFoundError('That job');
    const profile = this.requireProfile();

    let evaluator = this.deps.heuristic;
    if (evaluatorName === 'ai') {
      if (!this.deps.ai) {
        throw new NotConfiguredError(
          'No AI model is configured. Set AI_BASE_URL and AI_MODEL, or ANTHROPIC_API_KEY.',
        );
      }
      evaluator = this.deps.ai;
    }
    const evaluation = await evaluator.evaluate(toScorable(job), profile);
    this.deps.jobs.saveEvaluation(jobId, evaluation, this.now());
    return { ...job, score: evaluation.score, evaluation, evaluatedAt: this.now().toISOString() };
  }

  /**
   * Stores an assessment written outside KaziScout, by an AI coding tool working in the terminal.
   * This is how KaziScout runs on whatever model that tool uses, with no API key of its own.
   */
  recordAssessment(jobId: string, assessment: Assessment, model: string): Job {
    const job = this.deps.jobs.findById(jobId);
    if (!job) throw new NotFoundError('That job');
    const evaluation = toEvaluation(assessment, model);
    this.deps.jobs.saveEvaluation(jobId, evaluation, this.now());
    return { ...job, score: evaluation.score, evaluation, evaluatedAt: this.now().toISOString() };
  }

  /** Scores freshly scanned jobs offline. Does nothing until a profile exists. */
  async scoreNewJobs(jobIds: string[]): Promise<void> {
    const profile = this.deps.profiles.get();
    if (!profile) return;
    for (const id of jobIds) {
      const job = this.deps.jobs.findById(id);
      if (!job) continue;
      const evaluation = await this.deps.heuristic.evaluate(toScorable(job), profile);
      this.deps.jobs.saveEvaluation(id, evaluation, this.now());
    }
  }

  /**
   * Re-scores every job offline after the profile changes. Jobs assessed by an AI model keep
   * their assessment, because it took time or money and is not reproducible offline.
   */
  async rescoreAll(): Promise<number> {
    const profile = this.requireProfile();
    let rescored = 0;
    let afterId = '';
    for (;;) {
      const ids = this.deps.jobs.listIds(afterId, RESCORE_BATCH);
      const lastId = ids.at(-1);
      if (lastId === undefined) return rescored;
      for (const id of ids) {
        const job = this.deps.jobs.findById(id);
        if (!job || job.evaluation?.evaluator === 'ai') continue;
        const evaluation = await this.deps.heuristic.evaluate(toScorable(job), profile);
        this.deps.jobs.saveEvaluation(id, evaluation, this.now());
        rescored += 1;
      }
      afterId = lastId;
    }
  }
}
