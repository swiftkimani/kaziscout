# ADR-0001: Scan only open feeds; link out to every other board

- Status: accepted
- Date: 2026-10-06
- Deciders: Benard Kimani

## Context

"All maintained job boards in Africa" covers about a hundred sites. A check of 120 candidates on
2026-10-06 found roughly 80 online, of which about 20 publish a working RSS feed with fresh
postings. The large commercial boards (BrighterMonday, Jobberman, Fuzu, Careers24, Wuzzuf) publish
no feed, and many block automated requests outright.

## Decision

A board is scanned only when it offers an RSS feed or a public API. Every other live board is
kept in the registry as a link-out entry: listed, searchable, opened in the user's browser, never
fetched for listings. The registry is a JSON file in the repository, checked by
`pnpm boards:verify`.

## Consequences

- Positive: no terms-of-service or bot-detection fights; scans are one polite request per board;
  adding a board is a small pull request anyone can review.
- Negative: the biggest boards contribute no postings to the ranked list. Users open them by hand.
- Follow-ups: ReliefWeb has a public API but requires an approved app name; add it once approved.

## Alternatives considered

| Option                                                    | Why not                                                                                       |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Scrape HTML listings                                      | Breaks on every redesign, violates several boards' terms, and gets blocked.                   |
| Drive a real browser through computer-use for every board | Slow, fragile, and indistinguishable from scraping to the board.                              |
| Store boards in the database                              | Hides the list from review and makes "which boards do you cover?" unanswerable from the repo. |
