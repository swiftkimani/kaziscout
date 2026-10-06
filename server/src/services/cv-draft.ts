import { detectCountries } from '../boards/countries.js';
import type { Profile } from '../scoring/types.js';

/** A question to put to the person because the CV did not answer it. */
export interface FollowUpQuestion {
  field: keyof Profile;
  question: string;
  /** What KaziScout would guess, if anything, shown as a starting point. */
  suggestion?: string;
}

const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/;
// A phone number: optional +, then 9 to 15 digits with common separators.
const PHONE = /(?:\+|\b0)\d[\d\s().-]{7,17}\d/;
const SECTION_HEADING =
  /^(?:#+\s*)?(profile|summary|about|objective|(?:work |professional )?experience|employment(?: history)?|education|(?:technical |key |core )?(?:skills|competencies)|expertise|technologies|tools|(?:selected )?projects|certifications|languages|interests|references|additional experience|awards)\s*:?$/i;
const SKILLS_HEADING =
  /^(?:#+\s*)?(?:(?:technical |key |core )?(?:skills|competencies)|expertise|technologies)\s*:?$/i;
// "Integration and Development: JavaScript, …" — a category label in front of a list of skills.
const CATEGORY_LABEL = /(?:^|[.;]\s+)\p{Lu}[^:.,;]{2,45}:\s*/gu;
const NOT_A_NAME = /curriculum|vitae|resume|résumé|\bcv\b|@|\d|https?:/i;
const MAX_SKILLS = 40;

function lines(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

/** The first line that looks like a person's name: two to four capitalised words. */
function findName(cvLines: string[]): string {
  const candidate = cvLines.slice(0, 8).find((line) => {
    const words = line.replace(/\s+[—–|-]\s+.*$/, '').split(/\s+/);
    return (
      !NOT_A_NAME.test(line) &&
      words.length >= 2 &&
      words.length <= 4 &&
      words.every((word) => /^\p{Lu}[\p{L}'’.-]*$/u.test(word))
    );
  });
  return candidate?.replace(/\s+[—–|-]\s+.*$/, '').trim() ?? '';
}

/** A short line near the top that is neither the name nor a contact detail, such as a job title. */
function findHeadline(cvLines: string[], name: string): string {
  const start = name ? cvLines.findIndex((line) => line.startsWith(name)) + 1 : 0;
  const candidate = cvLines.slice(start, start + 4).find((line) => {
    const isContact = EMAIL.test(line) || PHONE.test(line) || /https?:|linkedin|github/i.test(line);
    return !isContact && !SECTION_HEADING.test(line) && line.length >= 4 && line.length <= 90;
  });
  return candidate ?? '';
}

/** Items listed under a skills heading, up to the next section heading. */
function findSkills(cvLines: string[]): string[] {
  const start = cvLines.findIndex((line) => SKILLS_HEADING.test(line));
  if (start === -1) return [];
  const nextHeading = cvLines.findIndex(
    (line, index) => index > start && SECTION_HEADING.test(line),
  );
  const section = cvLines.slice(start + 1, nextHeading === -1 ? start + 12 : nextHeading);
  // PDF text wraps mid-list, so the section is rejoined before it is split into items.
  const skills = section
    .join(' ')
    .replace(CATEGORY_LABEL, ', ')
    .split(/[,;•·|]|\.\s/)
    .map((item) =>
      item
        .replace(/\s*\([^)]*\)/g, '')
        .replace(/^[-–*\s]+|[.\s]+$/g, '')
        .trim(),
    )
    // A skill is a short phrase; anything longer is a sentence about the person.
    .filter((item) => item.length >= 2 && item.length <= 30 && item.split(' ').length <= 3);
  return [...new Set(skills)].slice(0, MAX_SKILLS);
}

/**
 * Drafts a profile from CV text using fixed rules, and lists what it could not find as questions.
 * It is a starting point for the person to correct, never saved as it stands.
 */
export function draftProfileFromCv(cvText: string): {
  draft: Profile;
  questions: FollowUpQuestion[];
} {
  const cvLines = lines(cvText);
  const fullName = findName(cvLines);
  const headline = findHeadline(cvLines, fullName);
  // The contact block at the top is where a home country appears; the body names many places.
  const countries = detectCountries(cvLines.slice(0, 10).join(' '), 'world').slice(0, 3);

  const draft: Profile = {
    fullName,
    email: EMAIL.exec(cvText)?.[0] ?? '',
    phone: PHONE.exec(cvLines.slice(0, 12).join('\n'))?.[0].trim() ?? '',
    headline,
    cvText,
    skills: findSkills(cvLines),
    targetTitles: [],
    countries,
    isRemoteOk: true,
  };
  return { draft, questions: followUpQuestions(draft) };
}

/** The questions still open for a drafted profile. Roles and remote work are always asked. */
export function followUpQuestions(draft: Profile): FollowUpQuestion[] {
  const questions: FollowUpQuestion[] = [];
  if (!draft.fullName) {
    questions.push({
      field: 'fullName',
      question: "What is your full name? I couldn't find it in the CV.",
    });
  }
  questions.push({
    field: 'targetTitles',
    question: 'Which job titles are you looking for? List up to five.',
    suggestion: draft.targetTitles.join(', ') || draft.headline || undefined,
  });
  if (draft.countries.length === 0) {
    questions.push({ field: 'countries', question: 'Which countries can you work in?' });
  } else {
    questions.push({
      field: 'countries',
      question: 'Which countries can you work in? I found these in your CV; add or remove any.',
      suggestion: draft.countries.join(', '),
    });
  }
  questions.push({
    field: 'isRemoteOk',
    question: 'Are you open to remote work?',
    suggestion: 'yes',
  });
  if (draft.skills.length < 3) {
    questions.push({
      field: 'skills',
      question: "What are your main skills? I couldn't find a skills section in the CV.",
      suggestion: draft.skills.join(', ') || undefined,
    });
  }
  if (!draft.email) {
    questions.push({ field: 'email', question: 'What email address should go on applications?' });
  }
  if (!draft.phone) {
    questions.push({
      field: 'phone',
      question: 'What phone number should go on applications? Include the country code.',
    });
  }
  return questions;
}
