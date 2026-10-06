import { Readability } from '@mozilla/readability';
import { parseHTML } from 'linkedom';
import TurndownService from 'turndown';

const turndown = new TurndownService({
  headingStyle: 'atx',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
  emDelimiter: '*',
});

// Page furniture that carries no posting content and only costs an LLM tokens.
turndown.remove([
  'head',
  'title',
  'script',
  'style',
  'noscript',
  'template',
  'iframe',
  'svg',
  'canvas',
  'nav',
  'header',
  'footer',
  'aside',
  'form',
  'button',
  'select',
  'input',
  'textarea',
]);

// Below this, Readability has usually latched onto a teaser rather than the page body.
const MIN_ARTICLE_CHARS = 200;

/**
 * Finds the main content of a page with Mozilla Readability (the Firefox Reader View algorithm),
 * which scores blocks by text density and so copes with menus built from plain <div>s.
 * Returns undefined when the page has no article-like region.
 */
function extractMainContent(html: string): { title?: string; contentHtml: string } | undefined {
  const { document } = parseHTML(html);
  // linkedom implements the DOM surface Readability uses, but not the full Document type.
  const readable = document as unknown as ConstructorParameters<typeof Readability>[0];
  const article = new Readability(readable).parse();
  if (!article?.content || (article.textContent?.trim().length ?? 0) < MIN_ARTICLE_CHARS) {
    return undefined;
  }
  return { title: article.title?.trim() || undefined, contentHtml: article.content };
}

function tidy(markdown: string): string {
  return (
    markdown
      .replace(/[ \t]+$/gm, '')
      // Turndown pads list markers to four columns; one space reads better and costs fewer tokens.
      .replace(/^(\s*(?:[-*+]|\d+\.)) {2,}/gm, '$1 ')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  );
}

export function extractTitle(html: string): string | undefined {
  const raw = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1];
  if (!raw) return undefined;
  // Converting decodes entities; the Markdown escapes it adds are then undone for plain text.
  const title = turndown
    .turndown(raw)
    .replace(/\\([\\`*_{}[\]()#+\-.!|])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
  return title || undefined;
}

/** Converts an HTML fragment to Markdown without trying to find a main-content region. */
export function fragmentToMarkdown(html: string): string {
  return tidy(turndown.turndown(html));
}

/** Converts a whole HTML page to Markdown, keeping the main content and dropping page chrome. */
export function pageToMarkdown(html: string): string {
  const main = extractMainContent(html);
  if (!main) return fragmentToMarkdown(html);
  const body = fragmentToMarkdown(main.contentHtml);
  // Readability drops the page heading as a duplicate of the title, so it is put back.
  return main.title ? `# ${main.title}\n\n${body}` : body;
}

/** Reduces HTML to plain text on one line, for summaries and keyword matching. */
export function htmlToText(html: string): string {
  return fragmentToMarkdown(html)
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#*_`>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
