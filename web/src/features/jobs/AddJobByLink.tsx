import { Link2, Plus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError } from '../../api/client';
import { useAddJob, useFollowSource } from '../../api/queries';
import { Button } from '../../components/ui/Button';
import { TextField } from '../../components/ui/Field';
import { useToast } from '../../components/ui/Toast';

/** Adds a job the person found themselves, and offers to follow its employer when that is possible. */
export function AddJobByLink() {
  const addJob = useAddJob();
  const follow = useFollowSource();
  const toast = useToast();
  const navigate = useNavigate();
  const [link, setLink] = useState('');
  const [problem, setProblem] = useState('');
  const added = addJob.data;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!link.trim()) return setProblem('Paste the link to a job posting');
    setProblem('');
    addJob.mutate(link.trim(), {
      onSuccess: () => setLink(''),
      onError: (error) =>
        setProblem(error instanceof ApiError ? error.message : "Couldn't add that job. Try again."),
    });
  };

  const followEmployer = (employerLink: string, name: string) =>
    follow.mutate(employerLink, {
      onSuccess: (result) => {
        toast.success(`Following ${name}: ${result.scan.jobsFound} openings found.`);
        addJob.reset();
      },
      onError: (error) => toast.error(error, `Couldn't follow ${name}. Try again.`),
    });

  return (
    <section className="stack-sm" aria-label="Add a job by link">
      <form className="extract-form" onSubmit={submit} noValidate>
        <TextField
          label="Add a job you found yourself"
          type="url"
          inputMode="url"
          placeholder="https://"
          hint="Paste the link to any job posting. It is scored like the rest."
          value={link}
          error={problem}
          onChange={(event) => setLink(event.target.value)}
        />
        <Button type="submit" icon={<Plus size={16} aria-hidden />} isBusy={addJob.isPending}>
          {addJob.isPending ? 'Adding job' : 'Add job'}
        </Button>
      </form>

      {added && (
        <div className="panel followups" role="status">
          <p>
            Added <strong>{added.data.title}</strong>.
          </p>
          <div className="row">
            <Button size="sm" onClick={() => void navigate(`/jobs/${added.data.id}`)}>
              Open it
            </Button>
            {added.suggestedSource && (
              <Button
                size="sm"
                variant="primary"
                icon={<Link2 size={14} aria-hidden />}
                isBusy={follow.isPending}
                onClick={() =>
                  added.suggestedSource &&
                  followEmployer(added.suggestedSource.link, added.suggestedSource.name)
                }
              >
                Follow all {added.suggestedSource.name} openings
              </Button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
