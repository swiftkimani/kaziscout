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

const REMOTE_ONLY_WORDS = /\b(fully |100% )?(remote|home[- ]based|work from home)\b/gi;
const WORLDWIDE_WORDS =
  /\b(worldwide|anywhere|global|international|all regions|no restrictions?)\b/i;
// Regions that include Africa, and regions that do not.
const AFRICA_REGION_WORDS = /\b(africa|emea|mena|ssa)\b/i;
const OTHER_REGION_WORDS =
  /\b(europe|european union|eu|eea|americas?|north america|latam|latin america|apac|asia|oceania|nordics?|dach)\b/i;

export type RemoteEligibility =
  /** No region restriction is stated. */
  | { kind: 'open' }
  /** The restriction names one of the person's countries, or a region containing one. */
  | { kind: 'match'; place: string }
  /** The restriction names places, none of which the person can work from. */
  | { kind: 'excluded'; place: string }
  /** The restriction is stated but could not be resolved for this person. */
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

  const named = detectCountries(meaningful, 'world');
  if (named.some((code) => profileCountries.includes(code))) return { kind: 'match', place };

  const hasAfricanCountry = profileCountries.some(isAfrican);
  if (AFRICA_REGION_WORDS.test(meaningful) && hasAfricanCountry) return { kind: 'match', place };

  const everyCountryIsAfrican = profileCountries.length > 0 && profileCountries.every(isAfrican);
  if (named.length > 0) return { kind: 'excluded', place };
  if (OTHER_REGION_WORDS.test(meaningful)) {
    // Without a continent table, a non-African profile cannot be placed in "Europe" or "APAC".
    return everyCountryIsAfrican ? { kind: 'excluded', place } : { kind: 'unclear', place };
  }
  return { kind: 'unclear', place };
}
