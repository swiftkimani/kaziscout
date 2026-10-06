import {
  type ApiJob,
  CliError,
  clip,
  type Command,
  describePlace,
  formatScore,
  splitList,
} from './context.js';

export const jobs: Command = async ({ io, values, call }) => {
  const query = new URLSearchParams({
    sort: values.newest ? 'newest' : 'score',
    limit: values.limit,
  });
  if (values.search) query.set('search', values.search);
  if (values.country) query.set('country', values.country);
  if (values.remote) query.set('remote', 'true');
  if (values.min) query.set('minScore', values.min);

  const { data } = await call<{ data: ApiJob[] }>('GET', `/v1/jobs?${query.toString()}`);
  if (data.length === 0) {
    io.out('No jobs match. Run "./kazi scan" first, or loosen the filters.');
    return;
  }
  io.out(
    `${'FIT'.padEnd(4)} ${'TITLE'.padEnd(44)} ${'COMPANY'.padEnd(20)} ${'PLACE'.padEnd(24)} ID`,
  );
  for (const job of data) {
    io.out(
      `${formatScore(job.score).padEnd(4)} ${clip(job.title, 44)} ${clip(job.company ?? '', 20)} ${clip(describePlace(job), 24)} ${job.id}`,
    );
  }
  io.out(`\n${data.length} shown. See one with: ./kazi show <ID>`);
};

export const show: Command = async ({ io, need, call }) => {
  const id = encodeURIComponent(need('a job id'));
  const { data: job } = await call<{ data: ApiJob }>('GET', `/v1/jobs/${id}`);
  io.out(`${job.title}${job.company ? ` — ${job.company}` : ''}`);
  io.out(`${describePlace(job) || 'Location not stated'}  ·  ${job.url}`);
  if (job.evaluation) {
    const { evaluator, model, verdict, strengths, gaps } = job.evaluation;
    const by = evaluator === 'ai' ? `assessed by ${model ?? 'AI'}` : 'keyword score';
    io.out(`\nFit ${formatScore(job.score)} of 5 (${by}): ${verdict}`);
    const parts = job.evaluation.breakdown;
    if (parts) {
      const percent = (value: number) => `${Math.round(value * 100)}%`;
      io.out(
        `  title ${percent(parts.title)} · skills ${percent(parts.skills)} · location ${percent(parts.location)} · freshness ${percent(parts.freshness)}`,
      );
    }
    for (const item of strengths) io.out(`  + ${item}`);
    for (const item of gaps) io.out(`  - ${item}`);
  } else {
    io.out('\nNot scored yet. Create a profile to score jobs: ./kazi profile --name "Your Name" …');
  }
  io.out(`\n${job.descriptionMd ?? job.summary}`);
};

export const add: Command = async ({ io, need, call }) => {
  const link = need('a posting link');
  const { data: job, suggestedSource } = await call<{
    data: ApiJob;
    suggestedSource: { name: string; link: string } | null;
  }>('POST', '/v1/jobs', { url: link });
  io.out(`Added: ${job.title}`);
  io.out(
    `Fit ${formatScore(job.score)} of 5${job.evaluation ? `: ${job.evaluation.verdict}` : ' (no profile yet)'}`,
  );
  io.out(`\nSee it with: ./kazi show ${job.id}`);
  if (suggestedSource) {
    io.out(
      `\n${suggestedSource.name} posts its openings where KaziScout can read them.\nFollow all of them with: ./kazi follow ${link}`,
    );
  }
};

export const assess: Command = async ({ io, values, need, call }) => {
  const id = encodeURIComponent(need('a job id'));
  if (!values.score || !values.verdict || !values.model) {
    throw new CliError('An assessment needs --score, --verdict and --model.');
  }
  const { data: job } = await call<{ data: ApiJob }>('PUT', `/v1/jobs/${id}/evaluation`, {
    score: Number(values.score),
    verdict: values.verdict,
    model: values.model,
    // Reasons are sentences and may contain commas, so they are separated by "|".
    strengths: splitList(values.strengths, '|'),
    gaps: splitList(values.gaps, '|'),
    matchedSkills: splitList(values.matched),
    pitch: values.pitch ?? '',
  });
  io.out(`Saved: ${job.title} is now ${formatScore(job.score)} of 5, assessed by ${values.model}.`);
};

export const pack: Command = async ({ io, need, call }) => {
  const id = encodeURIComponent(need('a job id'));
  const { data } = await call<{ data: { pack: string } }>('GET', `/v1/jobs/${id}/application-pack`);
  io.out(data.pack);
};

export const track: Command = async ({ io, need, call }) => {
  await call('POST', '/v1/applications', { jobId: need('a job id') });
  io.out('Saved to your tracker.');
};

interface Tracked {
  status: string;
  jobId: string;
  job: { title: string; company?: string; score?: number };
}

export const tracker: Command = async ({ io, call }) => {
  const { data } = await call<{ data: Tracked[] }>('GET', '/v1/applications');
  if (data.length === 0) {
    io.out('Nothing tracked yet. Save a job with: ./kazi track <ID>');
    return;
  }
  for (const item of data) {
    io.out(
      `${clip(item.status, 10)} ${formatScore(item.job.score)}  ${clip(item.job.title, 44)} ${clip(item.job.company ?? '', 20)} ${item.jobId}`,
    );
  }
};
