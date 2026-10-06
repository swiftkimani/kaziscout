import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Bookmark, ClipboardCopy, FileDown, Sparkles } from 'lucide-react';
import { jobActions, useApplicationMutations } from '../../api/queries';
import type { JobDetail, Meta } from '../../api/types';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toast';

export function JobActions({ job, features }: { job: JobDetail; features?: Meta['features'] }) {
  const client = useQueryClient();
  const toast = useToast();
  const applications = useApplicationMutations();
  const refresh = () => client.invalidateQueries({ queryKey: ['jobs'] });

  const evaluate = useMutation({
    mutationFn: () => jobActions.evaluate(job.id, 'claude'),
    onSuccess: async () => {
      await refresh();
      toast.success('Claude assessed this job.');
    },
    onError: (error) => toast.error(error, "Couldn't assess this job. Try again."),
  });

  const fetchPosting = useMutation({
    mutationFn: () => jobActions.fetchFullPosting(job.id),
    onSuccess: async (result) => {
      await refresh();
      toast.success(
        `Full posting loaded${result.data.converter === 'firecrawl' ? ' with Firecrawl' : ''}.`,
      );
    },
    onError: (error) => toast.error(error, "Couldn't load the full posting. Try again."),
  });

  const copyPack = useMutation({
    // With desktop assist on, the server copies through computer-use-mcp and notifies you;
    // otherwise the browser copies directly.
    mutationFn: async () => {
      if (features?.desktopAssist) return jobActions.assist(job.id);
      await navigator.clipboard.writeText(await jobActions.getPack(job.id));
    },
    onSuccess: async () => {
      await refresh();
      toast.success('Application pack copied. Paste from it as you fill in the form.');
    },
    onError: (error) => toast.error(error, "Couldn't copy the application pack. Try again."),
  });

  const save = () =>
    applications.save.mutate(job.id, {
      onSuccess: () => toast.success('Saved to your tracker.'),
      onError: (error) => toast.error(error, "Couldn't save this job. Try again."),
    });

  return (
    <div className="row" role="group" aria-label="Job actions">
      {!job.application && (
        <Button
          variant="primary"
          icon={<Bookmark size={16} aria-hidden />}
          isBusy={applications.save.isPending}
          onClick={save}
        >
          Save to tracker
        </Button>
      )}
      <Button
        icon={<ClipboardCopy size={16} aria-hidden />}
        isBusy={copyPack.isPending}
        onClick={() => copyPack.mutate()}
      >
        Copy application pack
      </Button>
      <Button
        icon={<FileDown size={16} aria-hidden />}
        isBusy={fetchPosting.isPending}
        onClick={() => fetchPosting.mutate()}
      >
        Fetch full posting
      </Button>
      {features?.claude && (
        <Button
          icon={<Sparkles size={16} aria-hidden />}
          isBusy={evaluate.isPending}
          onClick={() => evaluate.mutate()}
        >
          Assess with Claude
        </Button>
      )}
    </div>
  );
}
