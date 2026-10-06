import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useToday } from '../../api/queries';
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/Feedback';
import { JobCard } from '../jobs/JobCard';
import { formatDate } from '../jobs/format';
import { SkillGapsPanel } from './SkillGapsPanel';

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: ReactNode;
}) {
  if (count === 0) return null;
  const id = `today-${title.toLowerCase().replace(/\W+/g, '-')}`;
  return (
    <section className="stack-sm" aria-labelledby={id}>
      <h2 id={id}>
        {title} <span className="muted">({count})</span>
      </h2>
      {children}
    </section>
  );
}

/** The short answer to "what should I do today?", in place of the full job list. */
export function TodayPage() {
  const today = useToday();

  if (today.isPending) {
    return (
      <div className="stack" aria-busy="true" aria-label="Loading today">
        <Skeleton width="40%" height="var(--space-8)" />
        <Skeleton height="var(--space-16)" />
        <Skeleton height="var(--space-16)" />
      </div>
    );
  }
  if (today.isError) return <ErrorState error={today.error} onRetry={() => void today.refetch()} />;

  const { newStrong, closingSoon, followUps, failedSources } = today.data;
  const isQuiet =
    newStrong.length + closingSoon.length + followUps.length + failedSources.length === 0;

  return (
    <div className="stack">
      <header className="stack-sm">
        <h1>Today</h1>
        <p className="muted">What is new, what is closing, and what is waiting on you.</p>
      </header>

      {isQuiet && (
        <EmptyState title="Nothing needs you today">
          No new strong matches, nothing closing soon and no follow-ups due.{' '}
          <Link to="/jobs">Browse all jobs</Link> or scan the sources for fresh postings.
        </EmptyState>
      )}

      <Section title="New strong matches" count={newStrong.length}>
        <ul className="job-list">
          {newStrong.map((job) => (
            <li key={job.id}>
              <JobCard job={job} />
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Closing within three days" count={closingSoon.length}>
        <ul className="job-list">
          {closingSoon.map((job) => (
            <li key={job.id}>
              <JobCard job={job} />
            </li>
          ))}
        </ul>
      </Section>

      <Section title="No reply for a week" count={followUps.length}>
        <ul className="job-list">
          {followUps.map((application) => (
            <li key={application.id} className="today-row">
              <Link to={`/jobs/${application.jobId}`}>{application.job.title}</Link>
              <span className="muted">
                {application.job.company ? `${application.job.company} · ` : ''}applied{' '}
                {formatDate(application.appliedAt ?? application.updatedAt)}. Consider following up.
              </span>
            </li>
          ))}
        </ul>
      </Section>

      <SkillGapsPanel />

      <Section title="Sources that failed their last scan" count={failedSources.length}>
        <ul className="job-list">
          {failedSources.map((source) => (
            <li key={source.id} className="today-row">
              <span>{source.name}</span>
              <span className="muted">
                {source.errorMessage} <Link to="/boards">Scan it again</Link>
              </span>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
