const MONTHS: Readonly<Record<string, number>> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

const LABEL =
  /(?:closing date|deadline(?: for applications?)?|application deadline|apply before|apply by|applications? (?:close|closes|closing)(?: on)?|expiry date|closes on)\s*[:\-–]?\s*/i;
const DAY = String.raw`(\d{1,2})(?:st|nd|rd|th)?`;
const MONTH = String.raw`([A-Za-z]{3,9})\.?`;
const YEAR = String.raw`(\d{4})`;

function utcDate(year: number, month: number, day: number): Date | undefined {
  const date = new Date(Date.UTC(year, month, day));
  // Rejects impossible dates such as 31 February, which Date would roll forward.
  return date.getUTCMonth() === month && date.getUTCDate() === day ? date : undefined;
}

/** Parses the date at the start of `text` in the forms postings use. */
function parseLeadingDate(text: string): Date | undefined {
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (iso) return utcDate(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));

  const dayFirst = new RegExp(`^${DAY}\\s+${MONTH},?\\s+${YEAR}`).exec(text);
  if (dayFirst) {
    const month = MONTHS[dayFirst[2]?.slice(0, 3).toLowerCase() ?? ''];
    if (month !== undefined) return utcDate(Number(dayFirst[3]), month, Number(dayFirst[1]));
  }
  const monthFirst = new RegExp(`^${MONTH}\\s+${DAY},?\\s+${YEAR}`).exec(text);
  if (monthFirst) {
    const month = MONTHS[monthFirst[1]?.slice(0, 3).toLowerCase() ?? ''];
    if (month !== undefined) return utcDate(Number(monthFirst[3]), month, Number(monthFirst[2]));
  }
  const slashed = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(text);
  if (slashed) {
    const [first, second, year] = [Number(slashed[1]), Number(slashed[2]), Number(slashed[3])];
    // 19/10 can only be day/month and 10/19 only month/day. 05/06 could be either, so it is
    // left unread rather than guessed.
    if (first > 12 && second <= 12) return utcDate(year, second - 1, first);
    if (second > 12 && first <= 12) return utcDate(year, first - 1, second);
  }
  return undefined;
}

/**
 * Finds a stated closing date in posting text: "Closing Date: October 26, 2026",
 * "Apply Before: 10/19/2026", "Expiry Date: 2026-10-19". Returns undefined when none is stated
 * or the date is ambiguous.
 */
export function findClosingDate(text: string): Date | undefined {
  const pattern = new RegExp(LABEL.source, 'gi');
  for (let match = pattern.exec(text); match; match = pattern.exec(text)) {
    const date = parseLeadingDate(
      text.slice(match.index + match[0].length).replace(/^[*_\s]+/, ''),
    );
    if (date) return date;
  }
  return undefined;
}
