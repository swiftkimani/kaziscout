import { useState } from 'react';
import type { Meta } from '../../api/types';
import { Checkbox, TextField } from '../../components/ui/Field';

/** Checkbox list of every country, with Africa first and a filter box for the long tail. */
export function CountryPicker({
  meta,
  selected,
  onChange,
}: {
  meta?: Meta;
  selected: string[];
  onChange: (codes: string[]) => void;
}) {
  const [search, setSearch] = useState('');
  const needle = search.trim().toLowerCase();
  const african = new Set(meta?.africanCountries ?? []);
  const all = Object.entries(meta?.countries ?? {}).sort((a, b) => a[1].localeCompare(b[1]));
  const matching = all.filter(([, name]) => name.toLowerCase().includes(needle));

  const toggle = (code: string, isChecked: boolean) =>
    onChange(isChecked ? [...selected, code] : selected.filter((existing) => existing !== code));

  const group = (title: string, countries: typeof all) =>
    countries.length > 0 && (
      <div className="stack-sm">
        <h3>{title}</h3>
        <div className="country-grid">
          {countries.map(([code, name]) => (
            <Checkbox
              key={code}
              label={name}
              checked={selected.includes(code)}
              onChange={(event) => toggle(code, event.target.checked)}
            />
          ))}
        </div>
      </div>
    );

  return (
    <fieldset className="fieldset stack-sm">
      <legend className="field__label">Countries you can work in</legend>
      <p className="field__hint">
        {selected.length === 0
          ? 'None selected yet.'
          : `Selected: ${selected.map((code) => meta?.countries[code] ?? code).join(', ')}`}
      </p>
      <TextField
        label="Find a country"
        type="search"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      <div className="country-picker">
        {group(
          'Africa',
          matching.filter(([code]) => african.has(code)),
        )}
        {group(
          'Rest of the world',
          matching.filter(([code]) => !african.has(code)),
        )}
        {matching.length === 0 && <p className="muted">No country matches that search.</p>}
      </div>
    </fieldset>
  );
}
