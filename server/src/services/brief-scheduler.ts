import type { AlertService } from './alerts.js';
import type { ScanLogger } from './scan.js';
import { formatBrief, type TodayService } from './today.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Milliseconds from `now` until the next time the clock reads `time` ("07:30"), local time. */
export function millisecondsUntil(time: string, now: Date): number {
  const [hours = 0, minutes = 0] = time.split(':').map(Number);
  const next = new Date(now);
  next.setHours(hours, minutes, 0, 0);
  if (next.getTime() <= now.getTime()) next.setTime(next.getTime() + DAY_MS);
  return next.getTime() - now.getTime();
}

/**
 * Sends the morning brief once a day at a set local time while the server runs. A server that is
 * off at that time skips the day rather than sending a late brief when it next starts.
 */
export class BriefScheduler {
  private timer: NodeJS.Timeout | undefined;

  constructor(
    private readonly deps: {
      today: TodayService;
      alerts: AlertService;
      time: string;
      logger: ScanLogger;
      now?: () => Date;
    },
  ) {}

  start(): void {
    this.scheduleNext();
    this.deps.logger.info({ time: this.deps.time }, 'morning brief on');
  }

  stop(): void {
    clearTimeout(this.timer);
    this.timer = undefined;
  }

  /** Sends today's brief now. Returns whether the webhook accepted it. */
  sendNow(): Promise<boolean> {
    return this.deps.alerts.sendBrief(formatBrief(this.deps.today.get()));
  }

  private scheduleNext(): void {
    const delay = millisecondsUntil(this.deps.time, this.deps.now?.() ?? new Date());
    this.timer = setTimeout(() => {
      void this.sendNow().finally(() => this.scheduleNext());
    }, delay);
    this.timer.unref();
  }
}
