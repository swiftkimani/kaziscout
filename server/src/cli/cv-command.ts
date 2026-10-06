import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { CliError, type CliIo, type Command, splitList } from './context.js';

interface Draft {
  fullName: string;
  email: string;
  phone: string;
  headline: string;
  cvText: string;
  skills: string[];
  targetTitles: string[];
  countries: string[];
  isRemoteOk: boolean;
}

interface Question {
  field: keyof Draft;
  question: string;
  suggestion?: string;
}

interface CvImport {
  draft: Draft;
  questions: Question[];
  readBy: 'ai' | 'rules';
  characters: number;
}

/** The flag that answers each question later, for when the questions cannot be asked now. */
const FLAG_FOR: Partial<Record<keyof Draft, string>> = {
  fullName: '--name "Your Name"',
  targetTitles: '--roles "Job Title, Another"',
  countries: '--countries KE,UG',
  isRemoteOk: '--onsite-only (only if you do not want remote work)',
  skills: '--skills "Skill, Another"',
  email: '--email you@example.com',
  phone: '--phone "+254 …"',
};

/** Writes one answer into the draft, in the shape that field holds. */
function applyAnswer(draft: Draft, field: keyof Draft, answer: string): Draft {
  switch (field) {
    case 'targetTitles':
    case 'skills':
      return { ...draft, [field]: splitList(answer) };
    case 'countries':
      return { ...draft, countries: splitList(answer).map((code) => code.toUpperCase()) };
    case 'isRemoteOk':
      return { ...draft, isRemoteOk: !/^n/i.test(answer.trim()) };
    default:
      return { ...draft, [field]: answer.trim() };
  }
}

async function askQuestions(
  draft: Draft,
  questions: Question[],
  ask: NonNullable<CliIo['ask']>,
): Promise<Draft> {
  let answered = draft;
  for (const { field, question, suggestion } of questions) {
    const reply = await ask(`${question}${suggestion ? ` [${suggestion}]` : ''} `);
    // Pressing Enter accepts the suggestion; with no suggestion it leaves the field as it is.
    const answer = reply.trim() || suggestion;
    if (answer) answered = applyAnswer(answered, field, answer);
  }
  return answered;
}

function describe(io: CliIo, draft: Draft): void {
  io.out(`  Name:      ${draft.fullName || '(not found)'}`);
  io.out(`  Headline:  ${draft.headline || '(not found)'}`);
  io.out(`  Contact:   ${[draft.email, draft.phone].filter(Boolean).join(' · ') || '(not found)'}`);
  io.out(`  Countries: ${draft.countries.join(', ') || '(not found)'}`);
  io.out(
    `  Skills:    ${draft.skills.slice(0, 12).join(', ') || '(not found)'}${draft.skills.length > 12 ? ` and ${draft.skills.length - 12} more` : ''}`,
  );
}

/** Reads a CV file, drafts the profile from it, asks what the CV left open, and saves. */
export const cv: Command = async ({ io, need, call }) => {
  const path = need('the path to your CV (PDF, Word, text or Markdown)');
  let bytes: Buffer;
  try {
    bytes = readFileSync(path);
  } catch {
    throw new CliError(`Couldn't read the CV file at ${path}.`);
  }
  const { data } = await call<{ data: CvImport }>('POST', '/v1/profile/import', {
    filename: basename(path),
    contentBase64: bytes.toString('base64'),
  });
  io.out(
    `Read ${data.characters.toLocaleString('en')} characters from ${basename(path)} (${data.readBy === 'ai' ? 'with the AI model' : 'with built-in rules'}).\n`,
  );
  describe(io, data.draft);

  if (!io.ask) {
    // No one to ask (a script or an AI tool is running this): save what was found, list the rest.
    if (!data.draft.fullName) {
      throw new CliError(
        `The CV does not state a name clearly. Run: ./kazi profile --name "Your Name" --cv-file ${path}`,
      );
    }
    const saved = await call<{ rescored: number }>('PUT', '/v1/profile', data.draft);
    io.out(`\nProfile saved. ${saved.rescored} jobs re-scored.`);
    io.out('\nStill to answer, with ./kazi profile:');
    for (const { field, question } of data.questions) {
      io.out(`  ${question}\n    ${FLAG_FOR[field] ?? ''}`);
    }
    return;
  }

  io.out('\nA few questions. Press Enter to accept a suggestion shown in [brackets].\n');
  const answered = await askQuestions(data.draft, data.questions, io.ask);
  if (!answered.fullName) throw new CliError('A profile needs a name. Run the command again.');
  const saved = await call<{ rescored: number }>('PUT', '/v1/profile', answered);
  io.out(`\nProfile saved. ${saved.rescored} jobs re-scored.`);
  io.out('Next: ./kazi scan, then ./kazi jobs --min 4');
};
