/** The 54 African Union member states by ISO 3166-1 alpha-2 code. */
export const AFRICAN_COUNTRIES: Readonly<Record<string, string>> = {
  DZ: 'Algeria',
  AO: 'Angola',
  BJ: 'Benin',
  BW: 'Botswana',
  BF: 'Burkina Faso',
  BI: 'Burundi',
  CV: 'Cabo Verde',
  CM: 'Cameroon',
  CF: 'Central African Republic',
  TD: 'Chad',
  KM: 'Comoros',
  CG: 'Congo',
  CD: 'DR Congo',
  CI: "Côte d'Ivoire",
  DJ: 'Djibouti',
  EG: 'Egypt',
  GQ: 'Equatorial Guinea',
  ER: 'Eritrea',
  SZ: 'Eswatini',
  ET: 'Ethiopia',
  GA: 'Gabon',
  GM: 'Gambia',
  GH: 'Ghana',
  GN: 'Guinea',
  GW: 'Guinea-Bissau',
  KE: 'Kenya',
  LS: 'Lesotho',
  LR: 'Liberia',
  LY: 'Libya',
  MG: 'Madagascar',
  MW: 'Malawi',
  ML: 'Mali',
  MR: 'Mauritania',
  MU: 'Mauritius',
  MA: 'Morocco',
  MZ: 'Mozambique',
  NA: 'Namibia',
  NE: 'Niger',
  NG: 'Nigeria',
  RW: 'Rwanda',
  ST: 'São Tomé and Príncipe',
  SN: 'Senegal',
  SC: 'Seychelles',
  SL: 'Sierra Leone',
  SO: 'Somalia',
  ZA: 'South Africa',
  SS: 'South Sudan',
  SD: 'Sudan',
  TZ: 'Tanzania',
  TG: 'Togo',
  TN: 'Tunisia',
  UG: 'Uganda',
  ZM: 'Zambia',
  ZW: 'Zimbabwe',
};

// Every other inhabited ISO 3166-1 country and territory. Names come from the runtime's own
// locale data, so there is no second list of names to keep correct.
const OTHER_COUNTRY_CODES =
  'AD AE AF AG AI AL AM AR AS AT AU AW AX AZ BA BB BD BE BG BH BL BM BN BO BQ BR BS BT BY BZ ' +
  'CA CH CK CL CN CO CR CU CW CY CZ DE DK DM DO EC EE ES FI FJ FK FM FO FR GB GD GE GF GG GI GL ' +
  'GP GR GT GU GY HK HN HR HT HU ID IE IL IM IN IQ IR IS IT JE JM JO JP KG KH KI KN KP KR KW KY ' +
  'KZ LA LB LC LI LK LT LU LV MC MD ME MF MH MK MM MN MO MP MQ MS MT MV MX MY NC NI NL NO NP NR ' +
  'NU NZ OM PA PE PF PG PH PK PL PM PR PS PT PW PY QA RE RO RS RU SA SB SE SG SI SK SM SR SV SX ' +
  'SY TC TH TJ TL TM TO TR TT TV TW UA US UY UZ VA VC VE VG VI VN VU WF WS YE YT';

const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });

/** Every country KaziScout knows, by ISO code. African countries use the names above. */
export const COUNTRIES: Readonly<Record<string, string>> = Object.fromEntries(
  [
    ...Object.entries(AFRICAN_COUNTRIES),
    ...OTHER_COUNTRY_CODES.split(' ').map((code) => [code, regionNames.of(code) ?? code] as const),
  ].sort((a, b) => a[1].localeCompare(b[1])),
);

export function isAfrican(code: string): boolean {
  return code in AFRICAN_COUNTRIES;
}

/** Alternative spellings and major cities of African countries, mapped to their country code. */
const AFRICAN_ALIASES: Readonly<Record<string, string>> = {
  'cote d ivoire': 'CI',
  'ivory coast': 'CI',
  'democratic republic of the congo': 'CD',
  drc: 'CD',
  'congo kinshasa': 'CD',
  'cape verde': 'CV',
  swaziland: 'SZ',
  'the gambia': 'GM',
  'sao tome': 'ST',
  // Capital and major cities, since many postings name only the city.
  nairobi: 'KE',
  mombasa: 'KE',
  kisumu: 'KE',
  lagos: 'NG',
  abuja: 'NG',
  accra: 'GH',
  kumasi: 'GH',
  kampala: 'UG',
  'dar es salaam': 'TZ',
  dodoma: 'TZ',
  kigali: 'RW',
  'addis ababa': 'ET',
  johannesburg: 'ZA',
  'cape town': 'ZA',
  durban: 'ZA',
  pretoria: 'ZA',
  harare: 'ZW',
  bulawayo: 'ZW',
  lusaka: 'ZM',
  lilongwe: 'MW',
  blantyre: 'MW',
  gaborone: 'BW',
  windhoek: 'NA',
  maputo: 'MZ',
  luanda: 'AO',
  cairo: 'EG',
  casablanca: 'MA',
  tunis: 'TN',
  algiers: 'DZ',
  dakar: 'SN',
  abidjan: 'CI',
  douala: 'CM',
  yaounde: 'CM',
  kinshasa: 'CD',
  banjul: 'GM',
  mogadishu: 'SO',
  khartoum: 'SD',
  juba: 'SS',
  sandton: 'ZA',
  pemba: 'MZ',
  lodwar: 'KE',
  kano: 'NG',
  ibadan: 'NG',
  'port harcourt': 'NG',
  arusha: 'TZ',
  entebbe: 'UG',
};

/** Common ways job postings name countries outside Africa. */
const WORLD_ALIASES: Readonly<Record<string, string>> = {
  usa: 'US',
  us: 'US',
  'united states of america': 'US',
  uk: 'GB',
  'great britain': 'GB',
  england: 'GB',
  scotland: 'GB',
  wales: 'GB',
  uae: 'AE',
  turkey: 'TR',
  'czech republic': 'CZ',
  'hong kong': 'HK',
  macau: 'MO',
  burma: 'MM',
  holland: 'NL',
  'the netherlands': 'NL',
  'south korea': 'KR',
  korea: 'KR',
  russia: 'RU',
  vietnam: 'VN',
  palestine: 'PS',
};

function normalise(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z]+/g, ' ')
    .trim();
}

type Lookup = ReadonlyArray<readonly [pattern: RegExp, code: string]>;

function buildLookup(names: Readonly<Record<string, string>>[]): Lookup {
  return (
    names
      .flatMap((group) => Object.entries(group))
      .map(([key, value]) =>
        // Country tables are code -> name; alias tables are name -> code.
        /^[A-Z]{2}$/.test(key) ? ([normalise(value), key] as const) : ([key, value] as const),
      )
      // Longest names first so "South Sudan" wins over "Sudan" and "Guinea-Bissau" over "Guinea".
      .sort((a, b) => b[0].length - a[0].length)
      .map(([name, code]) => [new RegExp(`(?:^| )${name}(?: |$)`), code] as const)
  );
}

const AFRICA_LOOKUP = buildLookup([AFRICAN_COUNTRIES, AFRICAN_ALIASES]);
const WORLD_LOOKUP = buildLookup([COUNTRIES, AFRICAN_ALIASES, WORLD_ALIASES]);

/**
 * Finds every country named in free text, in the order the lookup matches them.
 * Use scope "world" only on short location text: names such as Georgia, Jordan and Chad are
 * also ordinary words and would match by accident in a job description.
 */
export function detectCountries(text: string, scope: 'africa' | 'world' = 'africa'): string[] {
  let haystack = normalise(text);
  if (!haystack) return [];
  const found: string[] = [];
  for (const [pattern, code] of scope === 'world' ? WORLD_LOOKUP : AFRICA_LOOKUP) {
    if (!pattern.test(haystack)) continue;
    if (!found.includes(code)) found.push(code);
    // Remove the match so "Guinea-Bissau" is not also counted as "Guinea".
    haystack = haystack.replace(new RegExp(pattern.source, 'g'), '  ').trim();
  }
  return found;
}

/** The first country named in free text, or undefined when none is. */
export function detectCountry(
  text: string,
  scope: 'africa' | 'world' = 'africa',
): string | undefined {
  return detectCountries(text, scope)[0];
}

// Continents, for resolving region limits such as "Europe" or "APAC". Africa is AFRICAN_COUNTRIES.
const EUROPE =
  'AD AL AT AX BA BE BG BY CH CY CZ DE DK EE ES FI FO FR GB GG GI GR HR HU IE IM IS IT JE LI LT LU ' +
  'LV MC MD ME MK MT NL NO PL PT RO RS RU SE SI SK SM UA VA';
const MIDDLE_EAST = 'AE BH IL IQ IR JO KW LB OM PS QA SA SY TR YE';
const ASIA_OTHER =
  'AF AM AZ BD BN BT CN GE HK ID IN JP KG KH KP KR KZ LA LK MM MN MO MV MY NP PH PK SG TH TJ TL ' +
  'TM TW UZ VN';
const NORTH_AMERICA = 'BM CA GL PM US';
// Mexico, Central America and the Caribbean: "LATAM" and "Americas", never "North America".
const LATIN_NORTH =
  'AG AI AW BB BL BQ BS BZ CR CU CW DM DO GD GP GT HN HT JM KN KY LC MF MQ MS MX NI PA PR SV SX ' +
  'TC TT VC VG VI';
const SOUTH_AMERICA = 'AR BO BR CL CO EC FK GF GY PE PY SR UY VE';
const OCEANIA = 'AS AU CK FJ FM GU KI MH MP NC NR NU NZ PF PG PW SB TO TV VU WF WS';
const INDIAN_OCEAN_FRANCE = 'RE YT';
const NORTH_AFRICA = 'DZ EG LY MA SD TN';

const codes = (...lists: string[]): ReadonlySet<string> => new Set(lists.join(' ').split(' '));
const AFRICA = codes(Object.keys(AFRICAN_COUNTRIES).join(' '), INDIAN_OCEAN_FRANCE);
const AMERICAS = codes(NORTH_AMERICA, LATIN_NORTH, SOUTH_AMERICA);

/** The countries each region word stands for. Patterns are tried in order; all that match count. */
const REGIONS: ReadonlyArray<readonly [word: RegExp, members: ReadonlySet<string>]> = [
  [/\bemea\b/i, codes(EUROPE, MIDDLE_EAST, [...AFRICA].join(' '))],
  [/\bmena\b/i, codes(MIDDLE_EAST, NORTH_AFRICA)],
  [/\b(africa|ssa)\b/i, AFRICA],
  [/\b(europe|european union|eu|eea)\b/i, codes(EUROPE)],
  [/\bnordics?\b/i, codes('DK FI IS NO SE')],
  [/\bdach\b/i, codes('AT CH DE')],
  [/\bmiddle east\b/i, codes(MIDDLE_EAST)],
  [/\bnorth america\b/i, codes(NORTH_AMERICA)],
  [/\b(latam|latin america|south america)\b/i, codes(LATIN_NORTH, SOUTH_AMERICA)],
  [/\bamericas\b/i, AMERICAS],
  [/\bapac\b/i, codes(ASIA_OTHER, OCEANIA)],
  [/\basia\b/i, codes(ASIA_OTHER, MIDDLE_EAST)],
  [/\boceania\b/i, codes(OCEANIA)],
];

/** Every country assigned to a continent above, for the test that none is left out. */
export const COUNTRIES_WITH_A_REGION: ReadonlySet<string> = codes(
  [...AFRICA].join(' '),
  EUROPE,
  MIDDLE_EAST,
  ASIA_OTHER,
  [...AMERICAS].join(' '),
  OCEANIA,
);

const REMOTE_ONLY_WORDS = /\b(fully |100% )?(remote|home[- ]based|work from home)\b/gi;
const WORLDWIDE_WORDS =
  /\b(worldwide|anywhere|global|international|all regions|no restrictions?)\b/i;

export type RemoteEligibility =
  /** No region restriction is stated. */
  | { kind: 'open' }
  /** The restriction names one of the person's countries, or a region containing one. */
  | { kind: 'match'; place: string }
  /** The restriction names places, none of which the person can work from. */
  | { kind: 'excluded'; place: string }
  /** The restriction is stated but names no country or region KaziScout recognises. */
  | { kind: 'unclear'; place: string };

/**
 * Decides whether a remote role's location restriction lets someone work from one of their
 * countries. The restriction is the free text a board publishes, such as "EMEA" or "US only".
 */
export function judgeRemoteRestriction(
  restriction: string | undefined,
  profileCountries: readonly string[],
): RemoteEligibility {
  const place = (restriction ?? '').trim();
  const meaningful = place
    .replace(REMOTE_ONLY_WORDS, '')
    .replace(/[\s,;()/|-]+/g, ' ')
    .trim();
  if (!meaningful || WORLDWIDE_WORDS.test(meaningful)) return { kind: 'open' };

  const namedCountries = detectCountries(meaningful, 'world');
  const namedRegions = REGIONS.filter(([word]) => word.test(meaningful)).map(
    ([, members]) => members,
  );
  if (namedCountries.length === 0 && namedRegions.length === 0) return { kind: 'unclear', place };

  const isAllowed = (code: string) =>
    namedCountries.includes(code) || namedRegions.some((members) => members.has(code));
  return profileCountries.some(isAllowed) ? { kind: 'match', place } : { kind: 'excluded', place };
}

// Phrases postings use to limit where a "Remote" role can be done. Each captures the place.
const STATED_RESTRICTIONS: readonly RegExp[] = [
  /\b(?:must|need to|required to|should)\s+(?:be\s+)?(?:based|located|residing|reside|live|living)\s+in\s+(?:the\s+)?([^.;:!?\n]{2,60})/i,
  /\b(?:only|exclusively)\s+(?:open|available)\s+to\s+(?:candidates|applicants|residents|people|those)\s+(?:in|from|based in|located in|residing in)\s+(?:the\s+)?([^.;:!?\n]{2,60})/i,
  /\b(?:authori[sz]ed|eligible|legally\s+(?:able|authori[sz]ed|permitted)|have\s+the\s+right)\s+to\s+work\s+in\s+(?:the\s+)?([^.;:!?\n]{2,60})/i,
  /\bthis\s+(?:role|position|job)\s+is\s+(?:only\s+)?(?:open|available)\s+(?:to\s+(?:candidates|applicants|residents)\s+)?(?:in|from|within)\s+(?:the\s+)?([^.;:!?\n]{2,60})/i,
  /\b((?:US|U\.S\.|USA|UK|EU|Canada|Europe)[- ](?:only|based only|residents only))\b/i,
];
// Restrictions appear in the summary or requirements, not deep in boilerplate.
const BODY_SEARCH_LENGTH = 6000;

/**
 * Looks in a posting's text for a sentence limiting where the role can be done, for roles whose
 * location says only "Remote". Returns the place named, or undefined when nothing is stated.
 */
export function findStatedRestriction(body: string): string | undefined {
  const text = body.slice(0, BODY_SEARCH_LENGTH);
  for (const pattern of STATED_RESTRICTIONS) {
    const place = pattern.exec(text)?.[1]?.trim();
    if (place) return place;
  }
  return undefined;
}
