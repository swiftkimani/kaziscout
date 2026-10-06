import type { AlertService } from './alerts.js';
import type { ScanLogger, ScanService } from './scan.js';

/** Scans every board on a fixed interval while the server runs, and alerts on strong matches. */
export class ScanScheduler {
  private timer: NodeJS.Timeout | undefined;
  private isRunning = false;

  constructor(
    private readonly deps: {
      scans: ScanService;
      alerts?: AlertService;
      intervalMinutes: number;
      logger: ScanLogger;
    },
  ) {}

  start(): void {
    this.timer = setInterval(() => void this.runOnce(), this.deps.intervalMinutes * 60_000);
    // The timer alone should not keep the process alive during shutdown.
    this.timer.unref();
    this.deps.logger.info({ intervalMinutes: this.deps.intervalMinutes }, 'scheduled scans on');
  }

  stop(): void {
    clearInterval(this.timer);
    this.timer = undefined;
  }

  /** Runs one scheduled scan. A scan still in progress is not started again. */
  async runOnce(): Promise<{ newJobs: number; alerted: number } | undefined> {
    if (this.isRunning) return undefined;
    this.isRunning = true;
    try {
      const { newJobIds } = await this.deps.scans.scanAllCollectingNewJobs();
      const alerted = (await this.deps.alerts?.notifyNewJobs(newJobIds)) ?? 0;
      this.deps.logger.info({ newJobs: newJobIds.length, alerted }, 'scheduled scan finished');
      return { newJobs: newJobIds.length, alerted };
    } finally {
      this.isRunning = false;
    }
  }
}
