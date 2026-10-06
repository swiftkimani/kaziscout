import { describe, expect, it } from 'vitest';
import {
  COUNTRIES,
  COUNTRIES_WITH_A_REGION,
  detectCountry,
  findStatedRestriction,
  judgeRemoteRestriction,
} from '../src/boards/countries.js';
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

describe('pageToMarkdown on pages with consent banners', () => {
  const BANNER_PAGE = `<html><head><title>Product Manager - Acme</title></head><body>
<a href="#main-content">Skip to main content</a>
<div class="cookie-banner" role="dialog"><h2>This website uses cookies to ensure you get the best experience.</h2>
<p>Acme and our selected partners use cookies and similar technologies that are necessary to present this website, and to ensure you get the best experience of it. If you consent to it, we will also use cookies for analytics purposes.</p>
<p>You can withdraw and manage your consent at any time, by clicking Manage cookies at the bottom of each website page.</p></div>
<div id="main-content"><h1>Product Manager</h1>
<p>Our client is looking for a Product Manager to join their growth team, reporting to the Head of Product, and to shape the tools that partners rely on every day.</p>
<h2>Requirements</h2><ul><li>Three years in product</li><li>Comfortable reading JavaScript</li></ul>
<p>You will work closely with design, engineering and analytics to define requirements, support discovery and deliver features that help partners manage their inventory.</p></div>
</body></html>`;

  it('drops the cookie banner and skip link and keeps the posting', () => {
    const markdown = pageToMarkdown(BANNER_PAGE);

    expect(markdown).toContain('Our client is looking for a Product Manager');
    expect(markdown).toContain('- Three years in product');
    expect(markdown).not.toMatch(/cookie/i);
    expect(markdown).not.toContain('Skip to main content');
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

describe('detectCountry with world scope', () => {
  it.each([
    ['Remote - US', 'US'],
    ['London, UK', 'GB'],
    ['Berlin, Germany', 'DE'],
    ['São Paulo, Brazil', 'BR'],
    ['Lagos, Nigeria', 'NG'],
  ])('finds the country in "%s"', (text, code) => {
    expect(detectCountry(text, 'world')).toBe(code);
  });

  it('does not match countries outside Africa in the default scope', () => {
    expect(detectCountry('Berlin, Germany')).toBeUndefined();
  });

  it('knows more than 150 countries, each with a real name', () => {
    const entries = Object.entries(COUNTRIES);
    expect(entries.length).toBeGreaterThan(150);
    for (const [code, name] of entries) expect(name, code).not.toBe(code);
  });
});

describe('judgeRemoteRestriction', () => {
  const kenyan = ['KE'];

  it.each([
    ['', 'open'],
    ['Remote', 'open'],
    ['Worldwide', 'open'],
    ['Home based - Worldwide', 'open'],
    ['EMEA', 'match'],
    ['Home based - Africa, Europe', 'match'],
    ['Kenya, Nigeria', 'match'],
    ['Remote - US', 'excluded'],
    ['USA Only', 'excluded'],
    ['Europe, USA, Canada, APAC', 'excluded'],
    ['Americas', 'excluded'],
    ['Timezone UTC+2 to UTC+5', 'unclear'],
  ])('"%s" is %s for someone in Kenya', (restriction, kind) => {
    expect(judgeRemoteRestriction(restriction, kenyan).kind).toBe(kind);
  });

  it('matches a restriction that names a country outside Africa in the profile', () => {
    expect(judgeRemoteRestriction('Remote - Germany', ['DE']).kind).toBe('match');
  });

  it.each([
    ['Europe', ['DE'], 'match'],
    ['EMEA', ['AE'], 'match'],
    ['APAC', ['SG'], 'match'],
    ['LATAM', ['MX'], 'match'],
    ['North America', ['MX'], 'excluded'],
    ['Americas', ['BR'], 'match'],
    ['Europe', ['US'], 'excluded'],
    ['Nordics', ['SE'], 'match'],
  ] as const)('"%s" for a profile in %j is %s', (restriction, countries, kind) => {
    expect(judgeRemoteRestriction(restriction, countries).kind).toBe(kind);
  });

  it('places every known country in a region, so no profile is left unresolved', () => {
    const unplaced = Object.keys(COUNTRIES).filter((code) => !COUNTRIES_WITH_A_REGION.has(code));

    expect(unplaced).toEqual([]);
  });
});

describe('findStatedRestriction', () => {
  it.each([
    ['You must be based in the United States to apply.', 'United States to apply'],
    ['Candidates need to be located in Europe or the UK.', 'Europe or the UK'],
    ['This role is only open to candidates in Canada.', 'Canada'],
    [
      'Applicants must be authorized to work in the US without sponsorship.',
      'US without sponsorship',
    ],
    ['Fully remote (US-only). Great benefits.', 'US-only'],
    ['This position is available within EMEA time zones', 'EMEA time zones'],
  ])('finds the limit in "%s"', (text, place) => {
    expect(findStatedRestriction(text)).toBe(place);
  });

  it('finds nothing in a posting that states no limit', () => {
    expect(
      findStatedRestriction(
        'We are a remote-first team based in many countries. Work from anywhere.',
      ),
    ).toBeUndefined();
  });
});
