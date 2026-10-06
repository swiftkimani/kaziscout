# CONTEXT — KaziScout

_Last updated: 2026-10-06 by Benard Kimani_

## Current goal

First public release: a working local job-search agent for Africa with a web UI.

## Status at a glance

| Area                        | State           | Notes                                                                                 |
| --------------------------- | --------------- | ------------------------------------------------------------------------------------- |
| Board registry              | done            | 98 boards checked on 2026-10-06; 25 scanned                                           |
| Scanners (RSS, remote APIs) | done            | 24 of 25 boards returned jobs on the first live scan; 1 timed out and passed on retry |
| Scoring                     | done            | Keyword scorer tested; Claude evaluator written but not run against the live API      |
| Page to Markdown            | done            | Local converter tested on live pages; Firecrawl client tested against a stub only     |
| Tracker                     | done            |                                                                                       |
| Web UI                      | done            | Checked by hand at desktop and 500 px widths                                          |
| Desktop assist              | partly verified | Clipboard write through computer-use-mcp verified on macOS                            |
| CI                          | written         | Not yet observed running on GitHub                                                    |

## Done

- 2026-10-06 Initial build: server, web UI, board registry, docs, brand.

## In progress

- Nothing.

## Next (ordered)

1. Run "Assess with Claude" against the live API with a real key and check the output quality.
2. Run the Firecrawl converter with a real key.
3. Apply for a ReliefWeb app name and add a ReliefWeb provider.
4. Web UI tests for the profile form and job filters.
5. Expose KaziScout's own tools as an MCP server so agents need no HTTP calls.
6. Scheduled scans, and "new since last visit" on the jobs list.

## Decisions

- ADR-0001 Scan only open feeds; link out to every other board
- ADR-0002 SQLite through Node's built-in module
- ADR-0003 Local-first, with Firecrawl and Claude as optional upgrades
- ADR-0004 The human presses Submit

## Assumptions (made without confirmation — revisit)

- The product is a job-search agent. The class session it came out of demonstrated career-ops
  with computer-use-mcp, and classmates asked for a Firecrawl-style page cleaner and for the
  sources of job links.
- "All maintained job boards in Africa" is read as: every board found online on the check date.
  The list is long but cannot be proven complete; additions are welcome.
- Light theme only (see AGENTS.md).

## Known issues / deferred

- The Claude evaluator does not opt in to server-side refusal fallbacks; a refused assessment is
  reported as an error and the keyword score stays.
- Boards without dates in their feed (iHarare Jobs, VacancyMail) are listed by first-seen time,
  so after a first scan they sort as "today".
- Corporate Staffing and Career Point Kenya feeds mix career articles with vacancies.
- Some Remote OK descriptions arrive with mis-encoded characters from the source.
- Himalayas returns only its 20 newest jobs per scan, and most are region-restricted, so it
  often contributes none.
- 23 boards refuse automated checks and are marked "blocked": confirmed reachable, not confirmed
  maintained.
- No web UI tests yet.
- No authentication. The server binds to 127.0.0.1 and must not be exposed.

## How to run right now

- Prereqs: Node 24, pnpm 11
- `pnpm install && pnpm dev`, then open http://localhost:5173
- Or `pnpm build && pnpm start`, then open http://127.0.0.1:8787

## Environment notes

- Built and tested on macOS (Apple silicon), Node 24.16.
