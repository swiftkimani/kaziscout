import { Bookmark, EyeOff, SkipForward } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import Markdown from 'react-markdown';
import { Link } from 'react-router-dom';
import { useApplicationMutations, useHideJob, useMeta, useTriageQueue } from '../../api/queries';
import { Button } from '../../components/ui/Button';
import { EmptyState, ErrorState, ScoreBadge, Skeleton } from '../../components/ui/Feedback';
import { useToast } from '../../components/ui/Toast';
import { describePlace } from '../jobs/format';

type Decision = 'save' | 'skip' | 'hide';

/**
 * One job at a time, with three choices. Built for going through many new matches quickly:
 * S saves to the tracker, K skips for now, H hides for good.
 */
export function TriagePage() {
  const queue = useTriageQueue();
  const meta = useMeta();
  const { save } = useApplicationMutations();
  const hide = useHideJob();
  const toast = useToast();
  const [position, setPosition] = useState(0);
  const jobs = queue.data ?? [];
  const job = jobs[position];

  const decide = useCallback(
    (decision: Decision) => {
      if (!job) return;
      const onError = (error: unknown) => toast.error(error, "That didn't save. Try again.");
      if (decision === 'save') save.mutate(job.id, { onError });
      if (decision === 'hide') hide.mutate(job.id, { onError });
      setPosition((current) => current + 1);
    },
    [job, save, hide, toast],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      // Typing in a field, or a shortcut with a modifier, is never a triage decision.
      const target = event.target as HTMLElement | null;
      const isTyping = target?.closest('input, textarea, select, [contenteditable]') !== null;
      if (isTyping || event.metaKey || event.ctrlKey || event.altKey) return;
      const decision = ({ s: 'save', k: 'skip', h: 'hide' } as const)[event.key.toLowerCase()];
      if (decision) decide(decision);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [decide]);

  if (queue.isPending) {
    return (
      <div className="stack" aria-busy="true" aria-label="Loading jobs to review">
        <Skeleton width="50%" height="var(--space-8)" />
        <Skeleton height="var(--space-16)" />
      </div>
    );
  }
  if (queue.isError) return <ErrorState error={queue.error} onRetry={() => void queue.refetch()} />;

  if (!job) {
    return (
      <div className="stack">
        <h1>Review</h1>
        <EmptyState
          title={jobs.length === 0 ? 'Nothing to review' : 'All caught up'}
          action={
            jobs.length > 0 && (
              <Button
                onClick={() => {
                  setPosition(0);
                  void queue.refetch();
                }}
              >
                Review the next batch
              </Button>
            )
          }
        >
          {jobs.length === 0
            ? 'Scan the sources and save a profile, and your best untracked matches appear here.'
            : `You went through ${jobs.length} jobs.`}{' '}
          <Link to="/jobs">See all jobs</Link>
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="stack">
      <header className="row-between">
        <h1>Review</h1>
        <p className="muted" aria-live="polite">
          {position + 1} of {jobs.length}
        </p>
      </header>

      <article className="panel" aria-labelledby="triage-title">
        <div className="job-detail__header">
          <ScoreBadge score={job.score} />
          <div className="stack-sm">
            <h2 id="triage-title">
              <Link to={`/jobs/${job.id}`}>{job.title}</Link>
            </h2>
            <p className="job-card__meta">
              {job.company && <span>{job.company}</span>}
              <span>{describePlace(job, meta.data?.countries ?? {})}</span>
            </p>
          </div>
        </div>
        {job.evaluation && (
          <ul className="points">
            {job.evaluation.strengths.map((item) => (
              <li key={item}>{item}</li>
            ))}
            {job.evaluation.gaps.map((item) => (
              <li key={item} className="muted">
                {item}
              </li>
            ))}
          </ul>
        )}
        <div className="prose triage__posting">
          <Markdown>{job.descriptionMd ?? job.summary}</Markdown>
        </div>
      </article>

      <div className="triage__actions" role="group" aria-label="Decide on this job">
        <Button
          variant="primary"
          icon={<Bookmark size={16} aria-hidden />}
          onClick={() => decide('save')}
        >
          Save <kbd>S</kbd>
        </Button>
        <Button icon={<SkipForward size={16} aria-hidden />} onClick={() => decide('skip')}>
          Skip <kbd>K</kbd>
        </Button>
        <Button
          variant="danger"
          icon={<EyeOff size={16} aria-hidden />}
          onClick={() => decide('hide')}
        >
          Hide <kbd>H</kbd>
        </Button>
      </div>
    </div>
  );
}
