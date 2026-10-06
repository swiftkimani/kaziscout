import { ExternalLink, Radar } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useBoards, useMeta, useScan } from '../../api/queries';
import type { Board } from '../../api/types';
import { Button } from '../../components/ui/Button';
import { Badge, EmptyState, ErrorState, Skeleton } from '../../components/ui/Feedback';
import { SelectField, TextField } from '../../components/ui/Field';
import { useToast } from '../../components/ui/Toast';
import { formatDate } from '../jobs/format';

function coverage(board: Board, countries: Record<string, string>): string {
  return board.countries
    .map((code) => {
      if (code === 'PAN') return 'Pan-African';
      if (code === 'REMOTE') return 'Remote';
      return countries[code] ?? code;
    })
    .join(', ');
}

function StatusBadge({ board }: { board: Board }) {
  if (board.lastScan?.outcome === 'error') return <Badge tone="danger">Last scan failed</Badge>;
  if (board.status === 'blocked') return <Badge tone="warning">Browser only</Badge>;
  if (board.status === 'down') return <Badge tone="danger">Not responding</Badge>;
  return <Badge tone="success">Live</Badge>;
}

export function BoardsPage() {
  const boards = useBoards();
  const meta = useMeta();
  const scan = useScan();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [access, setAccess] = useState('all');
  const countries = useMemo(() => meta.data?.countries ?? {}, [meta.data]);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (boards.data ?? []).filter((board) => {
      if (access === 'scanned' && !board.isScannable) return false;
      if (access === 'link-out' && board.isScannable) return false;
      return `${board.name} ${coverage(board, countries)} ${board.category}`
        .toLowerCase()
        .includes(needle);
    });
  }, [boards.data, search, access, countries]);

  const scanOne = (board: Board) =>
    scan.mutate(board.id, {
      onSuccess: ([result]) => {
        if (result?.outcome === 'ok') {
          toast.success(`${board.name}: ${result.jobsFound} jobs, ${result.jobsNew} new.`);
        } else {
          toast.error(undefined, `${board.name}: ${result?.errorMessage ?? 'the scan failed'}`);
        }
      },
      onError: (error) => toast.error(error, `Couldn't scan ${board.name}. Try again.`),
    });

  return (
    <div className="stack">
      <header className="stack-sm">
        <h1>Boards</h1>
        <p className="muted measure">
          Every board here was checked and found online. Boards with a public feed are scanned for
          you. The rest have no feed, so KaziScout links to them and never scrapes them.
        </p>
      </header>

      <form className="filters" role="search" onSubmit={(event) => event.preventDefault()}>
        <TextField
          label="Search"
          type="search"
          placeholder="Board, country or category"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <SelectField
          label="Access"
          value={access}
          onChange={(event) => setAccess(event.target.value)}
        >
          <option value="all">All boards</option>
          <option value="scanned">Scanned automatically</option>
          <option value="link-out">Link-out only</option>
        </SelectField>
      </form>

      {boards.isPending && (
        <div className="stack-sm" aria-busy="true" aria-label="Loading boards">
          {Array.from({ length: 8 }, (_, index) => (
            <Skeleton key={index} height="var(--space-12)" />
          ))}
        </div>
      )}
      {boards.isError && <ErrorState error={boards.error} onRetry={() => void boards.refetch()} />}
      {boards.isSuccess && visible.length === 0 && (
        <EmptyState title="No boards match">Try a different search or show all boards.</EmptyState>
      )}

      {visible.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <caption className="visually-hidden">Job boards</caption>
            <thead>
              <tr>
                <th scope="col">Board</th>
                <th scope="col">Coverage</th>
                <th scope="col">Status</th>
                <th scope="col">Jobs</th>
                <th scope="col">
                  <span className="visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((board) => (
                <tr key={board.id}>
                  <th scope="row">
                    <a href={board.url} target="_blank" rel="noreferrer" className="row">
                      {board.name}
                      <ExternalLink size={14} aria-hidden />
                    </a>
                    {board.note && <p className="table__note">{board.note}</p>}
                  </th>
                  <td>
                    {coverage(board, countries)}
                    <p className="table__note">{board.category}</p>
                  </td>
                  <td>
                    <StatusBadge board={board} />
                    <p className="table__note">
                      {board.lastScan
                        ? `Scanned ${formatDate(board.lastScan.startedAt)}`
                        : `Checked ${formatDate(board.checkedAt)}`}
                    </p>
                  </td>
                  <td>{board.isScannable ? board.jobCount : '–'}</td>
                  <td>
                    {board.isScannable && (
                      <Button
                        size="sm"
                        icon={<Radar size={14} aria-hidden />}
                        isBusy={scan.isPending && scan.variables === board.id}
                        onClick={() => scanOne(board)}
                        aria-label={`Scan ${board.name}`}
                      >
                        Scan
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
