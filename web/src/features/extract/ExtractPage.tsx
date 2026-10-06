import { ClipboardCopy } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useExtract, useMeta } from '../../api/queries';
import { Button } from '../../components/ui/Button';
import { Badge, ErrorState } from '../../components/ui/Feedback';
import { TextField } from '../../components/ui/Field';
import { useToast } from '../../components/ui/Toast';

export function ExtractPage() {
  const meta = useMeta();
  const extract = useExtract();
  const toast = useToast();
  const [url, setUrl] = useState('');
  const [urlError, setUrlError] = useState('');
  const usesFirecrawl = meta.data?.features.converter === 'firecrawl';

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!url.trim()) return setUrlError('Paste the address of a page');
    setUrlError('');
    extract.mutate(url.trim());
  };

  const copy = async (markdown: string) => {
    try {
      await navigator.clipboard.writeText(markdown);
      toast.success('Markdown copied.');
    } catch (error) {
      toast.error(error, "Couldn't copy. Select the text and copy it by hand.");
    }
  };

  return (
    <div className="stack">
      <header className="stack-sm">
        <h1>Page to Markdown</h1>
        <p className="muted measure">
          Turn a cluttered job page into clean Markdown you can read or hand to an AI model.{' '}
          {usesFirecrawl
            ? 'Pages are converted by Firecrawl, which also renders JavaScript.'
            : 'Pages are converted on this computer. Add a Firecrawl key for pages that need JavaScript.'}
        </p>
      </header>

      <form className="extract-form" onSubmit={submit} noValidate>
        <TextField
          label="Page address"
          type="url"
          inputMode="url"
          autoComplete="url"
          placeholder="https://"
          value={url}
          error={urlError}
          onChange={(event) => setUrl(event.target.value)}
        />
        <Button type="submit" variant="primary" isBusy={extract.isPending}>
          {extract.isPending ? 'Converting page' : 'Convert page'}
        </Button>
      </form>

      {extract.isError && (
        <ErrorState error={extract.error} onRetry={() => extract.mutate(url.trim())} />
      )}

      {extract.isSuccess && (
        <section className="panel stack" aria-labelledby="result-heading">
          <div className="row-between">
            <div className="stack-sm">
              <h2 id="result-heading">{extract.data.title ?? 'Converted page'}</h2>
              <p className="row">
                <Badge tone="info">
                  {extract.data.converter === 'firecrawl' ? 'Firecrawl' : 'Local converter'}
                </Badge>
                <span className="muted">
                  {extract.data.markdown.length.toLocaleString()} characters
                </span>
              </p>
            </div>
            <Button
              icon={<ClipboardCopy size={16} aria-hidden />}
              onClick={() => void copy(extract.data.markdown)}
            >
              Copy Markdown
            </Button>
          </div>
          <pre className="markdown-output" tabIndex={0}>
            {extract.data.markdown}
          </pre>
        </section>
      )}
    </div>
  );
}
