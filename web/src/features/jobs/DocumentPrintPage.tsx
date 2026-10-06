import { Printer } from 'lucide-react';
import Markdown from 'react-markdown';
import { useParams } from 'react-router-dom';
import { useDocuments } from '../../api/queries';
import { Button } from '../../components/ui/Button';
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/Feedback';

/** One document on a clean page. Printing it, or saving as PDF, leaves out the toolbar. */
export function DocumentPrintPage() {
  const { id = '', kind } = useParams();
  const documents = useDocuments(id);
  const isCoverLetter = kind === 'cover-letter';

  if (documents.isPending) {
    return (
      <main className="document" aria-busy="true" aria-label="Loading document">
        <Skeleton height="var(--space-16)" />
      </main>
    );
  }
  if (documents.isError) {
    return (
      <main className="document">
        <ErrorState error={documents.error} onRetry={() => void documents.refetch()} />
      </main>
    );
  }
  if (!documents.data) {
    return (
      <main className="document">
        <EmptyState title="Nothing written yet">
          Open the job in KaziScout and choose &quot;Write cover letter and CV&quot; first.
        </EmptyState>
      </main>
    );
  }

  return (
    <main className="document">
      <div className="document__bar">
        <p className="muted">
          {isCoverLetter ? 'Cover letter' : 'Tailored CV'}. In the print dialog, choose &quot;Save
          as PDF&quot; to keep a file.
        </p>
        <Button
          variant="primary"
          icon={<Printer size={16} aria-hidden />}
          onClick={() => window.print()}
        >
          Print or save as PDF
        </Button>
      </div>
      <article className="prose">
        <Markdown>{isCoverLetter ? documents.data.coverLetterMd : documents.data.cvMd}</Markdown>
      </article>
    </main>
  );
}
