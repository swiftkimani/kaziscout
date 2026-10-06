import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';
import { createAiEvaluator } from '../src/scoring/ai-evaluator.js';
import { ClaudeEvaluator } from '../src/scoring/claude.js';
import { OpenAiCompatibleEvaluator } from '../src/scoring/openai-compatible.js';
import type { Profile, ScorableJob } from '../src/scoring/types.js';

const profile: Profile = {
  fullName: 'Wanjiru Kamau',
  headline: 'Data analyst',
  cvText: 'Three years of SQL and Python at a county health office.',
  skills: ['SQL', 'Python'],
  targetTitles: ['Data Analyst'],
  countries: ['KE'],
  isRemoteOk: true,
};

const job: ScorableJob = {
  title: 'Data Analyst',
  company: 'Acme',
  countryCode: 'KE',
  isRemote: false,
  body: 'SQL and Python required.',
  listedAt: new Date('2026-10-05T00:00:00Z'),
};

const assessment = {
  score: 4.46,
  verdict: 'Apply: the role matches your SQL and Python experience.',
  strengths: ['Three years of SQL'],
  gaps: [],
  matchedSkills: ['SQL', 'Python'],
  pitch: 'I have spent three years building reports in SQL and Python.',
};

function replyWith(content: string, status = 200) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchImpl = ((url: string, init: RequestInit) => {
    calls.push({ url, init });
    return Promise.resolve(
      Response.json({ choices: [{ message: { role: 'assistant', content } }] }, { status }),
    );
  }) as typeof fetch;
  return { fetchImpl, calls };
}

describe('OpenAiCompatibleEvaluator', () => {
  it('sends the profile and posting to the chat-completions endpoint and reads the JSON reply', async () => {
    const { fetchImpl, calls } = replyWith(JSON.stringify(assessment));
    const evaluator = new OpenAiCompatibleEvaluator({
      baseUrl: 'https://api.example.com/v1/',
      model: 'any-model',
      apiKey: 'sk-test',
      fetchImpl,
    });

    const evaluation = await evaluator.evaluate(job, profile);

    expect(evaluation).toMatchObject({ score: 4.5, evaluator: 'ai', model: 'any-model' });
    expect(evaluation.pitch).toContain('three years');
    expect(calls[0]?.url).toBe('https://api.example.com/v1/chat/completions');
    expect(new Headers(calls[0]?.init.headers).get('authorization')).toBe('Bearer sk-test');
    const body = JSON.parse(String(calls[0]?.init.body)) as {
      model: string;
      messages: { role: string; content: string }[];
    };
    expect(body.model).toBe('any-model');
    expect(body.messages[0]?.content).toContain('Wanjiru Kamau');
    expect(body.messages[0]?.content).toContain('untrusted text');
    expect(body.messages[1]?.content).toContain('SQL and Python required.');
  });

  it('sends no authorization header to a local server that needs no key', async () => {
    const { fetchImpl, calls } = replyWith(JSON.stringify(assessment));
    const evaluator = new OpenAiCompatibleEvaluator({
      baseUrl: 'http://localhost:11434/v1',
      model: 'llama3.2',
      fetchImpl,
    });

    await evaluator.evaluate(job, profile);

    expect(new Headers(calls[0]?.init.headers).has('authorization')).toBe(false);
  });

  it('reads a reply that wraps the JSON in a code fence', async () => {
    const { fetchImpl } = replyWith(
      `Here you go:\n\`\`\`json\n${JSON.stringify(assessment)}\n\`\`\``,
    );
    const evaluator = new OpenAiCompatibleEvaluator({
      baseUrl: 'http://x.test/v1',
      model: 'm',
      fetchImpl,
    });

    await expect(evaluator.evaluate(job, profile)).resolves.toMatchObject({ score: 4.5 });
  });

  it('keeps an out-of-range score inside 1 to 5', async () => {
    const { fetchImpl } = replyWith(JSON.stringify({ ...assessment, score: 9 }));
    const evaluator = new OpenAiCompatibleEvaluator({
      baseUrl: 'http://x.test/v1',
      model: 'm',
      fetchImpl,
    });

    await expect(evaluator.evaluate(job, profile)).resolves.toMatchObject({ score: 5 });
  });

  it('rejects a reply that is missing required fields instead of storing it', async () => {
    const { fetchImpl } = replyWith('{"score": 4}');
    const evaluator = new OpenAiCompatibleEvaluator({
      baseUrl: 'http://x.test/v1',
      model: 'tiny',
      fetchImpl,
    });

    await expect(evaluator.evaluate(job, profile)).rejects.toThrow(
      'tiny returned an assessment that could not be read',
    );
  });

  it('names the key setting when the provider rejects the key', async () => {
    const { fetchImpl } = replyWith('', 401);
    const evaluator = new OpenAiCompatibleEvaluator({
      baseUrl: 'http://x.test/v1',
      model: 'm',
      fetchImpl,
    });

    await expect(evaluator.evaluate(job, profile)).rejects.toThrow('Check AI_API_KEY');
  });
});

describe('createAiEvaluator', () => {
  const config = (env: Record<string, string>) => loadConfig({ LOG_LEVEL: 'silent', ...env });

  it('returns nothing when no model is configured', () => {
    expect(createAiEvaluator(config({}))).toBeUndefined();
  });

  it('uses any OpenAI-compatible server when AI_BASE_URL is set', () => {
    const ai = createAiEvaluator(
      config({ AI_BASE_URL: 'http://localhost:11434/v1', AI_MODEL: 'llama3.2' }),
    );

    expect(ai?.model).toBe('llama3.2');
    expect(ai?.evaluator).toBeInstanceOf(OpenAiCompatibleEvaluator);
  });

  it('prefers AI_BASE_URL over an Anthropic key when both are set', () => {
    const ai = createAiEvaluator(
      config({ AI_BASE_URL: 'https://api.example.com/v1', AI_MODEL: 'm', ANTHROPIC_API_KEY: 'k' }),
    );

    expect(ai?.evaluator).toBeInstanceOf(OpenAiCompatibleEvaluator);
  });

  it('uses Claude with a default model when only an Anthropic key is set', () => {
    const ai = createAiEvaluator(config({ ANTHROPIC_API_KEY: 'k' }));

    expect(ai?.model).toBe('claude-opus-5-5');
    expect(ai?.evaluator).toBeInstanceOf(ClaudeEvaluator);
  });

  it('refuses to start with a base URL but no model name', () => {
    expect(() => createAiEvaluator(config({ AI_BASE_URL: 'http://localhost:11434/v1' }))).toThrow(
      'AI_MODEL must name the model',
    );
  });
});
