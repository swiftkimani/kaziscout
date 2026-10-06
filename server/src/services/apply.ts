import { NotConfiguredError, NotFoundError, UpstreamError, ValidationError } from '../errors.js';
import type { ApplicationRepository } from '../repositories/applications.js';
import type { Job, JobRepository } from '../repositories/jobs.js';
import type { ProfileRepository } from '../repositories/profile.js';
import type { Profile } from '../scoring/types.js';

/**
 * The part of the desktop KaziScout is allowed to touch. It hands the person their prepared
 * answers; it never fills a form or presses Submit on its own.
 */
export interface DesktopAssistant {
  copyToClipboard(text: string): Promise<void>;
  close(): Promise<void>;
}

/** Builds the text a person pastes from while filling in an application form. */
export function buildApplicationPack(job: Job, profile: Profile): string {
  const evaluation = job.evaluation;
  const lines = [
    `APPLICATION PACK: ${job.title}${job.company ? ` at ${job.company}` : ''}`,
    `Posting: ${job.url}`,
    '',
    `Name: ${profile.fullName}`,
    // A missing contact detail is stated, so nobody fills a form field with a guess.
    `Email: ${profile.email || 'not in profile'}`,
    `Phone: ${profile.phone || 'not in profile'}`,
    `Headline: ${profile.headline}`,
  ];
  if (evaluation?.pitch) lines.push('', 'Opening paragraph:', evaluation.pitch);
  if (evaluation && evaluation.matchedSkills.length > 0) {
    lines.push('', `Skills to lead with: ${evaluation.matchedSkills.join(', ')}`);
  }
  if (evaluation && evaluation.strengths.length > 0) {
    lines.push('', 'Why you fit:', ...evaluation.strengths.map((item) => `- ${item}`));
  }
  if (evaluation && evaluation.gaps.length > 0) {
    lines.push('', 'Be ready to address:', ...evaluation.gaps.map((item) => `- ${item}`));
  }
  return lines.join('\n');
}

export class ApplyService {
  constructor(
    private readonly deps: {
      jobs: JobRepository;
      profiles: ProfileRepository;
      applications: ApplicationRepository;
      /** Absent unless DESKTOP_ASSIST_ENABLED is true. */
      desktop?: DesktopAssistant;
      now?: () => Date;
    },
  ) {}

  get isDesktopAssistAvailable(): boolean {
    return this.deps.desktop !== undefined;
  }

  getPack(jobId: string): { pack: string; job: Job } {
    const job = this.deps.jobs.findById(jobId);
    if (!job) throw new NotFoundError('That job');
    const profile = this.deps.profiles.get();
    if (!profile) throw new ValidationError('Fill in your profile first.');
    return { pack: buildApplicationPack(job, profile), job };
  }

  /**
   * Copies the application pack to the clipboard and saves the job to the tracker. The person
   * opens the posting, pastes what they need and submits it themselves.
   */
  async assist(jobId: string): Promise<{ pack: string }> {
    if (!this.deps.desktop) {
      throw new NotConfiguredError(
        'Desktop assist is off. Set DESKTOP_ASSIST_ENABLED=true to turn it on.',
      );
    }
    const { pack } = this.getPack(jobId);
    try {
      await this.deps.desktop.copyToClipboard(pack);
    } catch (error) {
      if (error instanceof UpstreamError) throw error;
      const reason = error instanceof Error ? error.message : String(error);
      throw new UpstreamError("Couldn't reach the desktop. Check computer-use permissions.", {
        reason,
      });
    }
    if (!this.deps.applications.findByJobId(jobId)) {
      this.deps.applications.create(jobId, this.deps.now?.() ?? new Date());
    }
    return { pack };
  }
}
