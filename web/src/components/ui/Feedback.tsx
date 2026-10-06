import { CircleAlert, Inbox } from 'lucide-react';
import type { ReactNode } from 'react';
import { ApiError } from '../../api/client';
import { Button } from './Button';

export function Badge({
  tone = 'neutral',
  children,
}: {
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info';
  children: ReactNode;
}) {
  return <span className={`badge${tone === 'neutral' ? '' : ` badge--${tone}`}`}>{children}</span>;
}

/** A job's fit score out of 5, or a dash before it has been scored. */
export function ScoreBadge({ score }: { score?: number }) {
  if (score === undefined) {
    return (
      <span className="score" title="Not scored yet. Fill in your profile to score jobs.">
        <span className="score__value" aria-hidden>
          –
        </span>
        <span className="visually-hidden">Not scored yet</span>
      </span>
    );
  }
  const tone = score >= 4 ? ' score--strong' : score >= 3 ? ' score--fair' : '';
  return (
    <span className={`score${tone}`}>
      <span className="score__value">{score.toFixed(1)}</span>
      <span className="score__scale" aria-hidden>
        of 5
      </span>
      <span className="visually-hidden">out of 5</span>
    </span>
  );
}

export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="state">
      <Inbox className="state__icon" size={24} aria-hidden />
      <h2>{title}</h2>
      <p className="muted">{children}</p>
      {action}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message =
    error instanceof ApiError
      ? error.message
      : "Couldn't reach KaziScout. Check that the server is running, then try again.";
  return (
    <div className="state state--error" role="alert">
      <CircleAlert className="state__icon" size={24} aria-hidden />
      <h2>That didn&apos;t load</h2>
      <p>{message}</p>
      {onRetry && <Button onClick={onRetry}>Try again</Button>}
    </div>
  );
}

/** Placeholder block shaped like the content it stands in for. */
export function Skeleton({ width = '100%', height }: { width?: string; height: string }) {
  return <div className="skeleton" style={{ width, height }} aria-hidden />;
}
