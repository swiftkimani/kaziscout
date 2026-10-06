import { z } from 'zod';
import { UpstreamError } from '../errors.js';
import type { FetchText } from '../providers/http.js';
import { extractTitle, pageToMarkdown } from './html-to-markdown.js';

export interface MarkdownPage {
  url: string;
  title?: string;
  markdown: string;
  /** Which converter produced the Markdown, shown to the user. */
  converter: 'firecrawl' | 'local';
}

/** Turns a web page into Markdown fit for an LLM. The URL is already validated as public. */
export interface PageConverter {
  readonly name: MarkdownPage['converter'];
  convert(url: URL): Promise<MarkdownPage>;
}

/** Built-in converter: fetches the page and converts its main content. No JavaScript rendering. */
export class LocalConverter implements PageConverter {
  readonly name = 'local';

  constructor(private readonly fetchText: FetchText) {}

  async convert(url: URL): Promise<MarkdownPage> {
    const html = await this.fetchText(url.href, { accept: 'text/html,application/xhtml+xml' });
    const markdown = pageToMarkdown(html);
    if (!markdown) {
      throw new UpstreamError(
        'The page has no readable text. It may need JavaScript; add a Firecrawl key to render it.',
        { url: url.href },
      );
    }
    return { url: url.href, title: extractTitle(html), markdown, converter: this.name };
  }
}

const firecrawlTitle = z
  .union([z.string(), z.array(z.string())])
  .transform((value) => (Array.isArray(value) ? value[0] : value));

const firecrawlResponse = z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    data: z.object({
      markdown: z.string(),
      metadata: z.object({ title: firecrawlTitle.optional() }).optional(),
    }),
  }),
  z.object({ success: z.literal(false), error: z.string() }),
]);

const FIRECRAWL_SCRAPE_URL = 'https://api.firecrawl.dev/v2/scrape';
const FIRECRAWL_TIMEOUT_MS = 60_000;

/** Firecrawl converter: renders JavaScript and cleans the page on Firecrawl's servers. */
export class FirecrawlConverter implements PageConverter {
  readonly name = 'firecrawl';

  constructor(
    private readonly apiKey: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async convert(url: URL): Promise<MarkdownPage> {
    let response: Response;
    try {
      response = await this.fetchImpl(FIRECRAWL_SCRAPE_URL, {
        method: 'POST',
        headers: { authorization: `Bearer ${this.apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({ url: url.href, formats: ['markdown'], onlyMainContent: true }),
        signal: AbortSignal.timeout(FIRECRAWL_TIMEOUT_MS),
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new UpstreamError("Couldn't reach Firecrawl.", { reason });
    }

    const parsed = firecrawlResponse.safeParse(await response.json().catch(() => undefined));
    if (!parsed.success) {
      throw new UpstreamError(`Firecrawl answered with HTTP ${response.status}.`);
    }
    if (!parsed.data.success) {
      throw new UpstreamError(`Firecrawl couldn't convert the page: ${parsed.data.error}`, {
        status: response.status,
      });
    }
    const { markdown, metadata } = parsed.data.data;
    return { url: url.href, title: metadata?.title, markdown, converter: this.name };
  }
}
