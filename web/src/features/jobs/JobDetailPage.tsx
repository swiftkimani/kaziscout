import { ArrowLeft, ExternalLink } from 'lucide-react';
import Markdown from 'react-markdown';
import { Link, useParams } from 'react-router-dom';
import { useBoards, useJob, useMeta } from '../../api/queries';
import { Badge, ErrorState, ScoreBadge, Skeleton } from '../../components/ui/Feedback';
import { EvaluationPanel } from './EvaluationPanel';
import { describePlace, formatListedAt } from './format';
import { JobActions } from './JobActions';

export function JobDetailPage() {
  const { id = '' } = useParams();
  const job = useJob(id);
  const meta = useMeta();
  const boards = useBoards();

  if (job.isPending) {
    return (
      <div className="stack" aria-busy="true" aria-label="Loading job">
        <Skeleton width="60%" height="var(--space-8)" />
        <Skeleton width="40%" height="var(--space-4)" />
        <Skeleton height="var(--space-16)" />
        <Skeleton height="var(--space-16)" />
      </div>
    );
  }
  if (job.isError) return <ErrorState error={job.error} onRetry={() => void job.refetch()} />;

  const data = job.data;
  const board = boards.data?.find((candidate) => candidate.id === data.boardId);

  return (
    <div className="stack">
      <Link to="/jobs" className="row">
        <ArrowLeft size={16} aria-hidden />
        All jobs
      </Link>

      <header className="job-detail__header">
        <ScoreBadge score={data.score} />
        <div className="stack-sm">
          <h1>{data.title}</h1>
          <p className="job-card__meta">
            {data.company && <span>{data.company}</span>}
            <span>{describePlace(data, meta.data?.countries ?? {})}</span>
            <span>Listed {formatListedAt(data.listedAt).toLowerCase()}</span>
          </p>
          <p className="row">
            <Badge>{board?.name ?? data.boardId}</Badge>
            {data.application && <Badge tone="info">In tracker: {data.application.status}</Badge>}
            <a href={data.url} target="_blank" rel="noreferrer" className="row">
              Open original posting
              <ExternalLink size={14} aria-hidden />
            </a>
          </p>
        </div>
      </header>

      <JobActions job={data} features={meta.data?.features} />

      <div className="job-detail__columns">
        <section className="panel" aria-labelledby="posting-heading">
          <h2 id="posting-heading">Posting</h2>
          {data.descriptionMd ? (
            <div className="prose">
              <Markdown>{data.descriptionMd}</Markdown>
            </div>
          ) : (
            <p className="muted">
              The board gave no description. Use &quot;Fetch full posting&quot; to read it from the
              original page.
            </p>
          )}
        </section>
        <EvaluationPanel evaluation={data.evaluation} />
      </div>
    </div>
  );
}
