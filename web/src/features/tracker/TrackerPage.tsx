import { Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useApplicationMutations, useApplications } from '../../api/queries';
import { APPLICATION_STATUSES, type Application, type ApplicationStatus } from '../../api/types';
import { Button } from '../../components/ui/Button';
import { EmptyState, ErrorState, ScoreBadge, Skeleton } from '../../components/ui/Feedback';
import { SelectField, TextAreaField } from '../../components/ui/Field';
import { useToast } from '../../components/ui/Toast';
import { formatDate } from '../jobs/format';

const STATUS_LABELS: Record<ApplicationStatus, string> = {
  saved: 'Saved',
  applied: 'Applied',
  interview: 'Interview',
  offer: 'Offer',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
};

function ApplicationRow({ application }: { application: Application }) {
  const { update, remove } = useApplicationMutations();
  const toast = useToast();
  const onError = (error: unknown) => toast.error(error, "Couldn't save that change. Try again.");

  return (
    <li className="tracker-row">
      <ScoreBadge score={application.job.score} />
      <div className="stack-sm tracker-row__main">
        <h3>
          <Link to={`/jobs/${application.jobId}`}>{application.job.title}</Link>
        </h3>
        <p className="job-card__meta">
          {application.job.company && <span>{application.job.company}</span>}
          <span>
            {application.appliedAt
              ? `Applied ${formatDate(application.appliedAt)}`
              : `Updated ${formatDate(application.updatedAt)}`}
          </span>
        </p>
        <TextAreaField
          label="Notes"
          rows={2}
          defaultValue={application.notes}
          onBlur={(event) => {
            if (event.target.value === application.notes) return;
            update.mutate({ id: application.id, notes: event.target.value }, { onError });
          }}
        />
      </div>
      <div className="tracker-row__controls">
        <SelectField
          label="Status"
          value={application.status}
          onChange={(event) =>
            update.mutate(
              { id: application.id, status: event.target.value as ApplicationStatus },
              { onError },
            )
          }
        >
          {APPLICATION_STATUSES.map((status) => (
            <option key={status} value={status}>
              {STATUS_LABELS[status]}
            </option>
          ))}
        </SelectField>
        <Button
          variant="danger"
          size="sm"
          icon={<Trash2 size={14} aria-hidden />}
          isBusy={remove.isPending}
          onClick={() =>
            remove.mutate(application.id, {
              onSuccess: () => toast.success('Removed from your tracker.'),
              onError,
            })
          }
          aria-label={`Remove ${application.job.title} from tracker`}
        >
          Remove
        </Button>
      </div>
    </li>
  );
}

export function TrackerPage() {
  const applications = useApplications();

  return (
    <div className="stack">
      <header className="stack-sm">
        <h1>Tracker</h1>
        <p className="muted">
          Jobs you saved, and where each application stands.{' '}
          <a href="/v1/calendar.ics" download="kaziscout-deadlines.ics">
            Add closing dates to your calendar
          </a>
        </p>
      </header>

      {applications.isPending && (
        <div className="stack-sm" aria-busy="true" aria-label="Loading tracker">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} height="var(--space-16)" />
          ))}
        </div>
      )}
      {applications.isError && (
        <ErrorState error={applications.error} onRetry={() => void applications.refetch()} />
      )}
      {applications.isSuccess && applications.data.length === 0 && (
        <EmptyState title="Nothing tracked yet">
          Open a job and choose &quot;Save to tracker&quot;. <Link to="/jobs">Browse jobs</Link>
        </EmptyState>
      )}

      {APPLICATION_STATUSES.map((status) => {
        const group = (applications.data ?? []).filter((item) => item.status === status);
        if (group.length === 0) return null;
        return (
          <section key={status} className="stack-sm" aria-labelledby={`status-${status}`}>
            <h2 id={`status-${status}`}>
              {STATUS_LABELS[status]} <span className="muted">({group.length})</span>
            </h2>
            <ul className="tracker-list">
              {group.map((application) => (
                <ApplicationRow key={application.id} application={application} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
