import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { AiClient, GenerateRequest } from '../src/ai/client.js';
import { UpstreamError } from '../src/errors.js';
import { extractCvText } from '../src/extract/cv-text.js';
import { draftProfileFromCv } from '../src/services/cv-draft.js';
import { CvImportService } from '../src/services/cv-import.js';

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url));
const CV_TEXT = fixture('sample-cv.txt').toString('utf8');

describe('extractCvText', () => {
  it.each(['sample-cv.txt', 'sample-cv.docx', 'sample-cv.pdf'])(
    'reads the text of %s',
    async (file) => {
      const text = await extractCvText(file, fixture(file));

      expect(text).toContain('Wanjiru Kamau');
      expect(text).toContain('Turkana County Health Office');
    },
  );

  it('names the file types it can read when given another', async () => {
    await expect(extractCvText('cv.pages', new Uint8Array([1, 2, 3]))).rejects.toThrow(
      "can't read .pages files. Use PDF, Word (.docx), text or Markdown.",
    );
  });

  it('explains a file that cannot be parsed', async () => {
    await expect(extractCvText('cv.pdf', new TextEncoder().encode('not a pdf'))).rejects.toThrow(
      "couldn't be read",
    );
  });

  it('explains a file with no text in it', async () => {
    await expect(extractCvText('cv.txt', new TextEncoder().encode('  \n '))).rejects.toThrow(
      'No text was found',
    );
  });
});

describe('draftProfileFromCv', () => {
  it('finds the name, headline, contact details, country and skills', () => {
    const { draft } = draftProfileFromCv(CV_TEXT);

    expect(draft).toMatchObject({
      fullName: 'Wanjiru Kamau',
      headline: 'Data Analyst',
      email: 'wanjiru.kamau@example.com',
      phone: '+254 712 345 678',
      countries: ['KE'],
      isRemoteOk: true,
    });
    expect(draft.skills).toEqual([
      'SQL',
      'Python',
      'Excel',
      'Power BI',
      'dashboard design',
      'PostgreSQL',
      'Airflow',
      'data cleaning',
    ]);
    expect(draft.cvText).toBe(CV_TEXT);
  });

  it('always asks about roles and remote work, suggesting what it can', () => {
    const { questions } = draftProfileFromCv(CV_TEXT);

    expect(questions.map((question) => question.field)).toEqual([
      'targetTitles',
      'countries',
      'isRemoteOk',
    ]);
    expect(questions[0]?.suggestion).toBe('Data Analyst');
    expect(questions[1]?.suggestion).toBe('KE');
  });

  it('asks for everything a bare CV leaves out, and invents nothing', () => {
    const { draft, questions } = draftProfileFromCv(
      'curriculum vitae\n\nI have worked in several shops and offices over the last ten years and I am looking for work.',
    );

    expect(draft).toMatchObject({ fullName: '', email: '', phone: '', skills: [], countries: [] });
    expect(questions.map((question) => question.field)).toEqual([
      'fullName',
      'targetTitles',
      'countries',
      'isRemoteOk',
      'skills',
      'email',
      'phone',
    ]);
  });
});

describe('CvImportService', () => {
  const desktopHolding = (clipboard: string) => ({
    copyToClipboard: () => Promise.resolve(),
    readClipboard: () => Promise.resolve(clipboard),
    close: () => Promise.resolve(),
  });

  it('reads a CV from the desktop clipboard through computer use', async () => {
    const service = new CvImportService({ desktop: desktopHolding(CV_TEXT) });

    const result = await service.import({ kind: 'clipboard' });

    expect(result).toMatchObject({ readBy: 'rules', draft: { fullName: 'Wanjiru Kamau' } });
  });

  it('says how to copy the CV when the clipboard holds something else', async () => {
    const service = new CvImportService({ desktop: desktopHolding('https://example.com') });

    await expect(service.import({ kind: 'clipboard' })).rejects.toThrow(
      'Open your CV, select all the text, copy it',
    );
  });

  it('says how to turn desktop assist on when it is off', async () => {
    await expect(new CvImportService({}).import({ kind: 'clipboard' })).rejects.toThrow(
      'Reading the clipboard needs desktop assist',
    );
  });

  it('uses the AI model for roles when one is configured, but copies contact details from the CV', async () => {
    const ai: AiClient = {
      model: 'fake',
      generate: <T>(request: GenerateRequest<T>) =>
        Promise.resolve(
          request.schema.parse({
            fullName: 'Wanjiru Kamau',
            email: 'made-up@example.org',
            phone: '',
            headline: 'Data Analyst',
            skills: ['SQL', 'Python'],
            suggestedRoles: ['Data Analyst', 'BI Analyst'],
            countryCodes: ['ke', 'ZZ'],
          }),
        ),
    };

    const { draft, readBy } = await new CvImportService({ ai }).import({
      kind: 'text',
      text: CV_TEXT,
    });

    expect(readBy).toBe('ai');
    expect(draft.targetTitles).toEqual(['Data Analyst', 'BI Analyst']);
    expect(draft.countries).toEqual(['KE']);
    expect(draft.email).toBe('wanjiru.kamau@example.com');
    expect(draft.phone).toBe('+254 712 345 678');
  });

  it('falls back to the fixed rules when the model fails', async () => {
    const ai: AiClient = {
      model: 'fake',
      generate: () => Promise.reject(new UpstreamError('model is down')),
    };

    const result = await new CvImportService({ ai }).import({ kind: 'text', text: CV_TEXT });

    expect(result).toMatchObject({ readBy: 'rules', draft: { fullName: 'Wanjiru Kamau' } });
  });
});
