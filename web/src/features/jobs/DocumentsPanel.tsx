import { ClipboardCopy, PenLine, Printer } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useDocuments, useWriteDocuments } from '../../api/queries';
import { Button } from '../../components/ui/Button';
import { ErrorState, Skeleton } from '../../components/ui/Feedback';
import { useToast } from '../../components/ui/Toast';
import { formatDate } from './format';

function DocumentRow({
  title,
  markdown,
  printPath,
}: {
  title: string;
  markdown: string;
  printPath: string;
}) {
  const toast = useToast();
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(markdown);
      toast.success(`${title} copied.`);
    } catch (error) {
      toast.error(error, "Couldn't copy. Open it and copy the text by hand.");
    }
  };

  return (
    <div className="row-between">
      <h3>{title}</h3>
      <div className="row">
        <Button
          size="sm"
          icon={<ClipboardCopy size={14} aria-hidden />}
          onClick={() => void copy()}
        >
          Copy
        </Button>
        <Link className="btn btn--secondary btn--sm" to={printPath} target="_blank">
          <Printer size={14} aria-hidden />
          Open to print
        </Link>
      </div>
    </div>
  );
}

/** Cover letter and tailored CV for one job, written on request by the configured AI model. */
export function DocumentsPanel({ jobId, aiModel }: { jobId: string; aiModel: string | null }) {
  const documents = useDocuments(jobId);
  const write = useWriteDocuments(jobId);
  const toast = useToast();

  const writeNow = () =>
    write.mutate(undefined, {
      onSuccess: () =>
        toast.success('Cover letter and CV written. Read them before you send them.'),
      onError: (error) => toast.error(error, "Couldn't write the documents. Try again."),
    });

  return (
    <section className="panel" aria-labelledby="documents-heading">
      <h2 id="documents-heading">Documents</h2>

      {documents.isPending && <Skeleton height="var(--space-12)" />}
      {documents.isError && (
        <ErrorState error={documents.error} onRetry={() => void documents.refetch()} />
      )}

      {documents.data && (
        <div className="stack">
          <DocumentRow
            title="Cover letter"
            markdown={documents.data.coverLetterMd}
            printPath={`/jobs/${jobId}/print/cover-letter`}
          />
          <DocumentRow
            title="Tailored CV"
            markdown={documents.data.cvMd}
            printPath={`/jobs/${jobId}/print/cv`}
          />
          <p className="muted">
            Written by {documents.data.model} on {formatDate(documents.data.createdAt)}. Check every
            fact against your real CV before sending.
          </p>
        </div>
      )}

      {documents.isSuccess && !documents.data && (
        <p className="muted">
          {aiModel
            ? 'Have a cover letter and a CV tailored to this posting written from your own CV.'
            : 'Connect an AI model (see the README) to have a cover letter and tailored CV written from your own CV.'}
        </p>
      )}

      {aiModel && documents.isSuccess && (
        <div>
          <Button
            icon={<PenLine size={16} aria-hidden />}
            isBusy={write.isPending}
            onClick={writeNow}
          >
            {write.isPending
              ? 'Writing documents'
              : documents.data
                ? 'Write them again'
                : 'Write cover letter and CV'}
          </Button>
        </div>
      )}
    </section>
  );
}
