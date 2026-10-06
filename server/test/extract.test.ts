import { describe, expect, it } from 'vitest';
import { detectCountry, isOpenToAfrica } from '../src/boards/countries.js';
import { FirecrawlConverter, LocalConverter } from '../src/extract/converters.js';
import { htmlToText, pageToMarkdown } from '../src/extract/html-to-markdown.js';
import { assertPublicHttpUrl } from '../src/extract/safe-url.js';

const MESSY_PAGE = `<!doctype html><html><head><title>Data Analyst &amp; Reporter | Acme Jobs</title>
<style>.x{color:red}</style><script>track()</script></head><body>
<header><a href="/">Acme Jobs</a></header>
<nav><ul><li><a href="/jobs">All jobs</a></li></ul></nav>
<main><h1>Data Analyst</h1>
<p>Acme is hiring a <strong>Data Analyst</strong> in Nairobi to build dashboards for county
health teams and to keep the reporting pipeline accurate, documented and on time every month.</p>
<h2>Requirements</h2><ul><li>SQL and Python</li><li>3 years of experience</li></ul>
<p>Apply through <a href="https://acme.example/apply">the form</a> before the closing date. Only
shortlisted candidates will be contacted, and Acme never charges applicants a fee.</p>
<form><input name="email"><button>Subscribe</button></form></main>
<aside>Similar jobs</aside><footer>Copyright Acme</footer></body></html>`;

describe('pageToMarkdown', () => {
  it('keeps the posting and drops scripts, navigation, forms and footers', () => {
    const markdown = pageToMarkdown(MESSY_PAGE);

    expect(markdown).toContain('# Data Analyst');
    expect(markdown).toContain('## Requirements');
    expect(markdown).toContain('- SQL and Python');
    expect(markdown).toContain('[the form](https://acme.example/apply)');
    for (const noise of [
      'track()',
      'All jobs',
      'Subscribe',
      'Similar jobs',
      'Copyright',
      'color:red',
    ]) {
      expect(markdown).not.toContain(noise);
    }
  });
});

describe('htmlToText', () => {
  it('flattens markup to one line of plain text', () => {
    expect(htmlToText('<p>Hello <b>world</b></p><ul><li><a href="/x">Apply</a></li></ul>')).toBe(
      'Hello world - Apply',
    );
  });
});

describe('LocalConverter', () => {
  it('returns the page title and Markdown', async () => {
    const converter = new LocalConverter(() => Promise.resolve(MESSY_PAGE));

    const page = await converter.convert(new URL('https://acme.example/jobs/1'));

    expect(page).toMatchObject({
      title: 'Data Analyst & Reporter | Acme Jobs',
      converter: 'local',
    });
    expect(page.markdown).toContain('# Data Analyst');
  });

  it('explains when a page has no readable text', async () => {
    const converter = new LocalConverter(() =>
      Promise.resolve('<html><body><script>render()</script></body></html>'),
    );

    await expect(converter.convert(new URL('https://acme.example/'))).rejects.toThrow(
      'no readable text',
    );
  });
});

describe('FirecrawlConverter', () => {
  const respond = (status: number, body: unknown) =>
    (() => Promise.resolve(Response.json(body, { status }))) as typeof fetch;

  it('sends the key as a bearer token and returns the Markdown', async () => {
    let sent: { url: string; init: RequestInit } | undefined;
    const fetchImpl = ((url: string, init: RequestInit) => {
      sent = { url, init };
      return Promise.resolve(
        Response.json({ success: true, data: { markdown: '# Hi', metadata: { title: 'Hi' } } }),
      );
    }) as typeof fetch;

    const page = await new FirecrawlConverter('fc-test', fetchImpl).convert(
      new URL('https://acme.example/jobs/1'),
    );

    expect(page).toEqual({
      url: 'https://acme.example/jobs/1',
      title: 'Hi',
      markdown: '# Hi',
      converter: 'firecrawl',
    });
    expect(sent?.url).toBe('https://api.firecrawl.dev/v2/scrape');
    expect(new Headers(sent?.init.headers).get('authorization')).toBe('Bearer fc-test');
    expect(JSON.parse(String(sent?.init.body))).toMatchObject({
      url: 'https://acme.example/jobs/1',
      formats: ['markdown'],
    });
  });

  it("passes on Firecrawl's own error message", async () => {
    const converter = new FirecrawlConverter(
      'fc-test',
      respond(402, { success: false, error: 'Payment required to access this resource.' }),
    );

    await expect(converter.convert(new URL('https://acme.example/'))).rejects.toThrow(
      'Payment required',
    );
  });
});

describe('assertPublicHttpUrl', () => {
  const resolvesTo = (address: string) => () => Promise.resolve([address]);

  it('accepts a public https address', async () => {
    const url = await assertPublicHttpUrl('https://example.com/jobs', resolvesTo('93.184.216.34'));
    expect(url.hostname).toBe('example.com');
  });

  it.each([
    ['a non-http scheme', 'file:///etc/passwd'],
    ['a loopback address', 'http://127.0.0.1:8787/v1/profile'],
    ['a private network address', 'http://192.168.1.1/'],
    ['the cloud metadata address', 'http://169.254.169.254/latest/meta-data/'],
    ['an IPv6 loopback address', 'http://[::1]/'],
    ['embedded credentials', 'https://user:pass@example.com/'],
    ['text that is not an address', 'not a url'],
  ])('rejects %s', async (_label, address) => {
    await expect(assertPublicHttpUrl(address, resolvesTo('93.184.216.34'))).rejects.toThrow(
      "can't be fetched",
    );
  });

  it('rejects a public name that resolves to a private address', async () => {
    await expect(
      assertPublicHttpUrl('https://internal.example.com/', resolvesTo('10.0.0.5')),
    ).rejects.toThrow('private or local network');
  });
});

describe('detectCountry', () => {
  it.each([
    ['Nurse Manager – Niger (French & English Speaking)', 'NE'],
    ['Accountant, Lagos, Nigeria', 'NG'],
    ['Programme Lead in South Sudan', 'SS'],
    ['Expert Genre, Abidjan', 'CI'],
    ['Offre à Côte d’Ivoire', 'CI'],
    ['Field Officer, Guinea-Bissau', 'GW'],
  ])('finds the country in "%s"', (text, code) => {
    expect(detectCountry(text)).toBe(code);
  });

  it('returns undefined when no African country is named', () => {
    expect(detectCountry('Senior Engineer, Berlin')).toBeUndefined();
  });
});

describe('isOpenToAfrica', () => {
  it.each([
    ['', true],
    ['Worldwide', true],
    ['EMEA', true],
    ['Kenya, Nigeria', true],
    ['USA Only', false],
    ['Europe, USA, Canada, APAC', false],
  ])('"%s" -> %s', (restriction, expected) => {
    expect(isOpenToAfrica(restriction)).toBe(expected);
  });
});
