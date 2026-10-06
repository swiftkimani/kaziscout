import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Bookmark, ClipboardCopy, FileDown, Share2, Sparkles } from 'lucide-react';
import { jobActions, useApplicationMutations } from '../../api/queries';
import type { JobDetail, Meta } from '../../api/types';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toast';
import { formatDate } from './format';

export function JobActions({ job, features }: { job: JobDetail; features?: Meta['features'] }) {
  const client = useQueryClient();
  const toast = useToast();
  const applications = useApplicationMutations();
  const refresh = () => client.invalidateQueries({ queryKey: ['jobs'] });

  const evaluate = useMutation({
    mutationFn: () => jobActions.evaluate(job.id, 'ai'),
    onSuccess: async () => {
      await refresh();
      toast.success(`${features?.aiModel ?? 'The AI model'} assessed this job.`);
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

  /** A short message about this job, ready to paste into a chat group. */
  const share = async () => {
    const lines = [
      `${job.title}${job.company ? ` at ${job.company}` : ''}`,
      job.closesAt ? `Closes ${formatDate(job.closesAt)}` : '',
      job.url,
    ].filter(Boolean);
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      toast.success('Copied. Paste it into a chat to share this job.');
    } catch (error) {
      toast.error(error, "Couldn't copy. Share the link from the original posting instead.");
    }
  };

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
      <Button icon={<Share2 size={16} aria-hidden />} onClick={() => void share()}>
        Share
      </Button>
      {features?.aiModel && (
        <Button
          icon={<Sparkles size={16} aria-hidden />}
          isBusy={evaluate.isPending}
          onClick={() => evaluate.mutate()}
        >
          Assess with AI
        </Button>
      )}
    </div>
  );
}
