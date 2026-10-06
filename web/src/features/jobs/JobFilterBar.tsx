import { useBoards, useMeta, type JobFilters } from '../../api/queries';
import { Checkbox, SelectField, TextField } from '../../components/ui/Field';

export function JobFilterBar({
  filters,
  onChange,
}: {
  filters: JobFilters;
  onChange: (filters: JobFilters) => void;
}) {
  const meta = useMeta();
  const boards = useBoards();
  const set = <K extends keyof JobFilters>(key: K, value: JobFilters[K]) =>
    onChange({ ...filters, [key]: value });

  const names = meta.data?.countries ?? {};
  const countries = (meta.data?.jobCountries ?? [])
    .map((code) => [code, names[code] ?? code] as const)
    .sort((a, b) => a[1].localeCompare(b[1]));
  const scannedBoards = (boards.data ?? []).filter((board) => board.jobCount > 0);

  return (
    <form className="filters" role="search" onSubmit={(event) => event.preventDefault()}>
      <TextField
        label="Search"
        type="search"
        placeholder="Title or company"
        value={filters.search}
        onChange={(event) => set('search', event.target.value)}
      />
      <SelectField
        label="Country"
        value={filters.country}
        onChange={(event) => set('country', event.target.value)}
      >
        <option value="">All countries</option>
        {countries.map(([code, name]) => (
          <option key={code} value={code}>
            {name}
          </option>
        ))}
      </SelectField>
      <SelectField
        label="Board"
        value={filters.board}
        onChange={(event) => set('board', event.target.value)}
      >
        <option value="">All boards</option>
        {scannedBoards.map((board) => (
          <option key={board.id} value={board.id}>
            {board.name}
          </option>
        ))}
      </SelectField>
      <SelectField
        label="Fit"
        value={filters.minScore}
        onChange={(event) => set('minScore', event.target.value)}
      >
        <option value="">Any score</option>
        <option value="4">Strong (4 and up)</option>
        <option value="3">Fair (3 and up)</option>
      </SelectField>
      <SelectField
        label="Sort by"
        value={filters.sort}
        onChange={(event) => set('sort', event.target.value === 'score' ? 'score' : 'newest')}
      >
        <option value="newest">Newest first</option>
        <option value="score">Best fit first</option>
      </SelectField>
      <Checkbox
        label="Remote only"
        checked={filters.remoteOnly}
        onChange={(event) => set('remoteOnly', event.target.checked)}
      />
    </form>
  );
}
