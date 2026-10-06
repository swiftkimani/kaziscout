import { ClipboardPaste, FileUp } from 'lucide-react';
import { useRef, useState, type ChangeEvent } from 'react';
import { useImportCv, useMeta, type CvImportRequest } from '../../api/queries';
import type { CvImport } from '../../api/types';
import { ApiError } from '../../api/client';
import { Button } from '../../components/ui/Button';

const MAX_FILE_BYTES = 10 * 1024 * 1024;

/** Reads a file as base64 without its "data:…;base64," prefix. */
function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(new Error('The file could not be read.'));
    reader.readAsDataURL(file);
  });
}

/** Lets the person start their profile from a CV file or from CV text on the clipboard. */
export function ImportCvPanel({ onImported }: { onImported: (result: CvImport) => void }) {
  const meta = useMeta();
  const importCv = useImportCv();
  const fileInput = useRef<HTMLInputElement>(null);
  const [problem, setProblem] = useState('');
  const usesDesktop = meta.data?.features.desktopAssist === true;

  const run = (request: CvImportRequest) => {
    setProblem('');
    importCv.mutate(request, {
      onSuccess: onImported,
      onError: (error) =>
        setProblem(
          error instanceof ApiError ? error.message : "Couldn't reach KaziScout. Try again.",
        ),
    });
  };

  const onFileChosen = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Reset so choosing the same file again after fixing it still fires a change.
    event.target.value = '';
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) return setProblem('That file is larger than 10 MB.');
    try {
      run({ filename: file.name, contentBase64: await readAsBase64(file) });
    } catch {
      setProblem("That file couldn't be opened. Try another copy of it.");
    }
  };

  const fromClipboard = async () => {
    // With desktop assist on, the server reads the clipboard through computer-use-mcp, which
    // needs no browser permission prompt. Otherwise the browser reads it.
    if (usesDesktop) return run({ clipboard: true });
    try {
      run({ text: await navigator.clipboard.readText() });
    } catch {
      setProblem("The browser wouldn't share the clipboard. Paste your CV into the CV box below.");
    }
  };

  return (
    <section className="panel form" aria-labelledby="import-heading">
      <div className="stack-sm">
        <h2 id="import-heading">Start from your CV</h2>
        <p className="muted">
          Choose your CV and KaziScout fills in what it can, then asks about the rest. Nothing is
          saved until you press Save profile.
        </p>
      </div>
      <div className="row">
        <input
          ref={fileInput}
          type="file"
          className="visually-hidden"
          accept=".pdf,.docx,.txt,.md"
          aria-label="CV file"
          onChange={(event) => void onFileChosen(event)}
        />
        <Button
          variant="primary"
          icon={<FileUp size={16} aria-hidden />}
          isBusy={importCv.isPending}
          onClick={() => fileInput.current?.click()}
        >
          {importCv.isPending ? 'Reading your CV' : 'Choose CV file'}
        </Button>
        <Button
          icon={<ClipboardPaste size={16} aria-hidden />}
          isBusy={importCv.isPending}
          onClick={() => void fromClipboard()}
        >
          Use CV text I copied
        </Button>
      </div>
      <p className="field__hint">PDF, Word (.docx), text or Markdown, up to 10 MB.</p>
      {problem && (
        <p className="field__error" role="alert">
          {problem}
        </p>
      )}
    </section>
  );
}
