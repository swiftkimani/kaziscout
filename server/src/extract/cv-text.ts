import { extname } from 'node:path';
import mammoth from 'mammoth';
import { extractText, getDocumentProxy } from 'unpdf';
import { ValidationError } from '../errors.js';

export const CV_FILE_TYPES = ['.pdf', '.docx', '.txt', '.md'] as const;

/** Collapses the ragged whitespace PDF and Word extraction leave behind, keeping line breaks. */
function tidy(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t\u00a0]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Reads the text out of a CV file. PDF and Word files are parsed; text and Markdown are read as
 * they are. A scanned PDF holds pictures of text, not text, and comes back empty.
 */
export async function extractCvText(filename: string, bytes: Uint8Array): Promise<string> {
  const type = extname(filename).toLowerCase();
  let text: string;
  try {
    if (type === '.pdf') {
      const pdf = await getDocumentProxy(new Uint8Array(bytes));
      text = (await extractText(pdf, { mergePages: true })).text;
    } else if (type === '.docx') {
      text = (await mammoth.extractRawText({ buffer: Buffer.from(bytes) })).value;
    } else if (type === '.txt' || type === '.md') {
      text = new TextDecoder().decode(bytes);
    } else {
      throw new ValidationError(
        `KaziScout can't read ${type || 'that kind of'} files. Use PDF, Word (.docx), text or Markdown.`,
      );
    }
  } catch (error) {
    if (error instanceof ValidationError) throw error;
    throw new ValidationError(
      "That file couldn't be read. It may be damaged or password-protected.",
    );
  }

  const tidied = tidy(text);
  if (!tidied) {
    throw new ValidationError(
      'No text was found in that file. If it is a scanned document, export it as text or paste the text instead.',
    );
  }
  return tidied;
}
