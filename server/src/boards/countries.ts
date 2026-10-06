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

/** Alternative spellings seen in job postings, mapped to their country code. */
const ALIASES: Readonly<Record<string, string>> = {
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

function normalise(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z]+/g, ' ')
    .trim();
}

const LOOKUP: ReadonlyArray<readonly [pattern: RegExp, code: string]> = [
  ...Object.entries(AFRICAN_COUNTRIES).map(([code, name]) => [normalise(name), code] as const),
  ...Object.entries(ALIASES),
]
  // Longest names first so "South Sudan" wins over "Sudan" and "Guinea-Bissau" over "Guinea".
  .sort((a, b) => b[0].length - a[0].length)
  .map(([name, code]) => [new RegExp(`(?:^| )${name}(?: |$)`), code] as const);

/** Finds the first African country named in free text, or undefined when none is. */
export function detectCountry(text: string): string | undefined {
  const haystack = normalise(text);
  if (!haystack) return undefined;
  return LOOKUP.find(([pattern]) => pattern.test(haystack))?.[1];
}

const OPEN_REGIONS =
  /\b(worldwide|anywhere|global|international|africa|emea|all regions|no restrictions?)\b/i;

/**
 * Decides whether a remote role is open to someone in Africa from its location restriction.
 * An empty restriction means the employer set none.
 */
export function isOpenToAfrica(restriction: string | undefined): boolean {
  const text = restriction?.trim() ?? '';
  if (!text) return true;
  return OPEN_REGIONS.test(text) || detectCountry(text) !== undefined;
}
