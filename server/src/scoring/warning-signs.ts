/**
 * Signs that a posting may not be a genuine job. Each is a pattern seen in fee-charging and
 * advance-payment scams. A match is a reason to look closer, not proof of fraud.
 */
const SIGNS: ReadonlyArray<readonly [warning: string, pattern: RegExp]> = [
  [
    'Asks applicants to pay a fee. Genuine employers do not charge to apply.',
    /\b(?:registration|application|processing|training|interview|medical|placement|booking|facilitation)\s+fees?\b|\bfees?\s+of\s+(?:ksh|kes|ngn|ugx|tzs|ghs|zar|usd|\$|₦)|\bpay(?:ment)?\b[^.\n]{0,40}\b(?:to|before|in order to)\s+(?:apply|be considered|secure|attend|register)\b/i,
  ],
  [
    'Asks for money by mobile money or transfer.',
    /\b(?:send|deposit|pay|transfer)\b[^.\n]{0,40}\b(?:m-?pesa|mobile money|momo|airtel money|till number|paybill|western union|bank account)\b/i,
  ],
  [
    'Promises unusually easy or guaranteed earnings.',
    /\b(?:earn|make)\b[^.\n]{0,25}(?:\$|ksh|kes|usd)\s?\d[\d,]*\s*(?:\/|per|a)\s?(?:day|hour)\b[^.\n]{0,40}\b(?:no experience|from (?:your )?(?:phone|home))|\bguaranteed (?:income|job|placement|visa)\b/i,
  ],
];

// "No application fee", "we never charge a fee": a posting denying fees is doing the right thing.
const DENIAL = /\b(?:no|not|never|without|don'?t|doesn'?t|do not|does not|free of)\b[^.\n]{0,60}$/i;

/** Warnings for a posting, or an empty list when nothing looks wrong. */
export function findWarningSigns(text: string): string[] {
  return SIGNS.filter(([, pattern]) => {
    const match = pattern.exec(text);
    if (!match) return false;
    const before = text.slice(Math.max(0, match.index - 70), match.index);
    return !DENIAL.test(before);
  }).map(([warning]) => warning);
}
