import { Link } from 'react-router-dom';
import { useBoards, useMeta } from '../../api/queries';
import type { Job } from '../../api/types';
import { ScoreBadge } from '../../components/ui/Feedback';
import { describePlace, formatListedAt } from './format';

export function JobCard({ job }: { job: Job }) {
  const meta = useMeta();
  const boards = useBoards();
  const boardName = boards.data?.find((board) => board.id === job.boardId)?.name ?? job.boardId;

  return (
    <article className="job-card">
      <ScoreBadge score={job.score} />
      <div className="job-card__body">
        <h2 className="job-card__title">
          <Link to={`/jobs/${job.id}`}>{job.title}</Link>
        </h2>
        <p className="job-card__meta">
          {job.company && <span>{job.company}</span>}
          <span>{describePlace(job, meta.data?.countries ?? {})}</span>
          <span>{boardName}</span>
          <span>{formatListedAt(job.listedAt)}</span>
        </p>
        {job.summary && <p className="job-card__summary">{job.summary}</p>}
      </div>
    </article>
  );
}
