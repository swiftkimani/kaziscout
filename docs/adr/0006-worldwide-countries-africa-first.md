# ADR-0006: Any country in the profile; location judged at scoring time

- Status: accepted
- Date: 2026-10-06
- Deciders: Benard Kimani
- Supersedes part of ADR-0001 (dropping non-African remote roles at scan time)

## Context

The first version knew only the 54 African countries and discarded, during the scan, any remote
role not open to Africa. That made the tool useless for anyone outside Africa and threw away
information: a role limited to "Europe" is wrong for a Kenyan and right for a German.

## Decision

- The country list is every inhabited ISO 3166-1 country (234), named from the runtime's locale
  data. Africa keeps its curated names, aliases and city list.
- Scans keep every role. A role's location text is stored as published.
- Whether a role suits the person is decided when scoring, against the profile's countries.
  A remote restriction is judged open, matching, excluded or unclear. A job the person cannot
  take because of location is capped at a score of 2.
- Countries outside Africa are detected only in the short location field, never in titles or
  descriptions, because names such as Georgia, Jordan and Chad are also ordinary words.

## Consequences

- Positive: one database serves any profile; changing your countries re-ranks everything without
  re-scanning.
- Negative: scans store more jobs (about 3,200 instead of 1,900 on the test run). Region words
  such as "Europe" or "APAC" cannot be resolved for non-African profiles without a continent
  table, so those are marked "check that you qualify".
- Follow-ups: add a country-to-continent table to resolve regions for every profile.

## Alternatives considered

| Option                                  | Why not                                                             |
| --------------------------------------- | ------------------------------------------------------------------- |
| Keep filtering at scan time, by profile | Changing the profile would require re-scanning every source.        |
| A bundled countries package             | The runtime already names every country; a dependency adds nothing. |
