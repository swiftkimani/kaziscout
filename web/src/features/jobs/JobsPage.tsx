import { Radar } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useJobs, useScan, type JobFilters } from '../../api/queries';
import { Button } from '../../components/ui/Button';
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/Feedback';
import { useToast } from '../../components/ui/Toast';
import { AddJobByLink } from './AddJobByLink';
import { JobCard } from './JobCard';
import { JobFilterBar } from './JobFilterBar';
import { useDebounced } from './use-debounced';

const DEFAULT_FILTERS: JobFilters = {
  search: '',
  board: '',
  country: '',
  remoteOnly: false,
  minScore: '',
  sort: 'newest',
};

function isFiltered(filters: JobFilters): boolean {
  return Boolean(
    filters.search || filters.board || filters.country || filters.remoteOnly || filters.minScore,
  );
}

export function JobsPage() {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  // Typing in the search box should not send a request per keystroke.
  const search = useDebounced(filters.search, 300);
  const appliedFilters = { ...filters, search };
  const jobs = useJobs(appliedFilters);
  const scan = useScan();
  const toast = useToast();

  const scanAll = () =>
    scan.mutate(undefined, {
      onSuccess: (results) => {
        const added = results.reduce((total, result) => total + result.jobsNew, 0);
        const failed = results.filter((result) => result.outcome === 'error').length;
        toast.success(
          `Scan finished: ${added} new jobs${failed > 0 ? `, ${failed} boards didn't answer` : ''}.`,
        );
      },
      onError: (error) => toast.error(error, "The scan didn't finish. Try again."),
    });

  const loaded = jobs.data?.pages.flatMap((page) => page.data) ?? [];

  return (
    <div className="stack">
      <header className="row-between">
        <div className="stack-sm">
          <h1>Jobs</h1>
          <p className="muted">Postings from African job boards, ranked against your profile.</p>
        </div>
        <Button
          variant="primary"
          icon={<Radar size={16} aria-hidden />}
          isBusy={scan.isPending}
          onClick={scanAll}
        >
          {scan.isPending ? 'Scanning boards' : 'Scan all boards'}
        </Button>
      </header>

      <AddJobByLink />

      <JobFilterBar filters={filters} onChange={setFilters} />

      {jobs.isPending && (
        <div className="stack-sm" aria-busy="true" aria-label="Loading jobs">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} height="var(--space-16)" />
          ))}
        </div>
      )}

      {jobs.isError && <ErrorState error={jobs.error} onRetry={() => void jobs.refetch()} />}

      {jobs.isSuccess && loaded.length === 0 && isFiltered(appliedFilters) && (
        <EmptyState
          title="No jobs match these filters"
          action={<Button onClick={() => setFilters(DEFAULT_FILTERS)}>Clear filters</Button>}
        >
          Try a broader search, or clear the filters to see everything.
        </EmptyState>
      )}

      {jobs.isSuccess && loaded.length === 0 && !isFiltered(appliedFilters) && (
        <EmptyState
          title="No jobs yet"
          action={
            <Button variant="primary" isBusy={scan.isPending} onClick={scanAll}>
              Scan all boards
            </Button>
          }
        >
          Scan the boards to pull in current postings. Then{' '}
          <Link to="/profile">fill in your profile</Link> so each job gets a fit score.
        </EmptyState>
      )}

      {loaded.length > 0 && (
        <>
          <ul className="job-list">
            {loaded.map((job) => (
              <li key={job.id}>
                <JobCard job={job} />
              </li>
            ))}
          </ul>
          {jobs.hasNextPage && (
            <div>
              <Button isBusy={jobs.isFetchingNextPage} onClick={() => void jobs.fetchNextPage()}>
                Show more jobs
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
