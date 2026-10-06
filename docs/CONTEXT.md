# CONTEXT — KaziScout

_Last updated: 2026-10-06 by Benard Kimani_

## Current goal

First public release: a working local job-search agent for Africa with a web UI.

## Status at a glance

| Area                       | State                 | Notes                                                                                                                  |
| -------------------------- | --------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Source registry            | done                  | 126 sources checked on 2026-10-06; 55 scanned (25 boards, 30 employers)                                                |
| Scanners                   | done                  | RSS, Teamtailor feeds, 3 remote job APIs, 5 hiring systems. Full live scan: 54 of 55 sources, 3,225 jobs, 49 countries |
| Countries                  | done                  | 234 countries in profile, filter and detection; remote restrictions judged against the profile                         |
| Scoring                    | done                  | Keyword scorer tested. AI path run live against Ollama `qwen2.5:1.5b`. Claude path not run live.                       |
| Documents                  | done                  | Cover letter and tailored CV, run live against Ollama; output from that 1.5B model is unusable                         |
| Scheduled scans and alerts | done, partly verified | Unit tested; startup verified live. A real webhook delivery and a real timed run were not observed.                    |
| Sign-in                    | done                  | Access token; verified live with curl and unit tested                                                                  |
| Page to Markdown           | done                  | Local converter tested on live pages; Firecrawl client tested against a stub only                                      |
| Tracker                    | done                  |                                                                                                                        |
| Web UI                     | done                  | 18 tests; checked by hand at desktop and 500 px widths                                                                 |
| Desktop assist             | partly verified       | Clipboard write through computer-use-mcp verified on macOS                                                             |
| CI                         | done                  | Passing on GitHub Actions                                                                                              |

## Done

- 2026-10-06 Cover letter and tailored CV writing; print pages.
- 2026-10-06 Optional access-token sign-in; refusal to listen beyond loopback without it.
- 2026-10-06 Scheduled scans and webhook alerts.
- 2026-10-06 Worldwide countries; SmartRecruiters, Workable and Teamtailor sources; network retry.
- 2026-10-06 Relicensed to AGPL-3.0-or-later.
- 2026-10-06 Employer readers for Greenhouse, Lever and Ashby.
- 2026-10-06 AI assessment works with any OpenAI-compatible model, local or hosted.
- 2026-10-06 Initial build: server, web UI, board registry, docs, brand.

## In progress

- Nothing.

## Next (ordered)

1. Try AI assessment and document writing with a capable model (7B+ local, or hosted) and judge
   the quality. Everything so far was run on a 1.5B model.
2. Decide the contributor agreement before accepting outside pull requests (see ADR-0005).
3. Port more source types: Workday, Recruitee, Personio. No relevant employer was found to
   verify Recruitee or Personio against, so they were not written.
4. Add a country-to-continent table so region limits resolve for non-African profiles.
5. Observe one real scheduled scan and one real webhook delivery.
6. Run the Firecrawl converter and the Claude client with real keys.
7. Try the agent form-filling skill end to end on a real application form.
8. Apply for a ReliefWeb app name and add a ReliefWeb provider.
9. Expose KaziScout's own tools as an MCP server so agents need no HTTP calls.

## Decisions

- ADR-0001 Scan only open feeds; link out to every other board
- ADR-0002 SQLite through Node's built-in module
- ADR-0003 Local-first, with Firecrawl and any AI model as optional upgrades
- ADR-0004 The human presses Submit
- ADR-0005 AGPL-3.0-or-later, with the option of commercial licences
- ADR-0006 Any country in the profile; location judged at scoring time

## Assumptions (made without confirmation — revisit)

- The product is a job-search agent. The class session it came out of demonstrated career-ops
  with computer-use-mcp, and classmates asked for a Firecrawl-style page cleaner and for the
  sources of job links.
- "Job boards from 150+ countries as in career-ops" could not be found as a claim in career-ops.
  It was read as: support any country, and read employers through their hiring systems.
- "All maintained job boards in Africa" is read as: every board found online on the check date.
  The list is long but cannot be proven complete; additions are welcome.
- Light theme only (see AGENTS.md).
- Commits use the owner's personal identity, never the machine's NairoBits-Dev identity.

## Known issues / deferred

- Cannot be closed in code: BrighterMonday, Jobberman, Fuzu and other large boards publish no
  feed and are link-out only; ReliefWeb needs an approved app name; 23 sources refuse automated
  checks and are marked "blocked".
- Sign-in is one shared token for one owner. Multi-user accounts are deliberately left for the
  hosted product.
- A role located only as "Remote" is treated as open to everyone.
- "Georgia" in a location is read as the country, not the US state.
- Elastic's Greenhouse feed exceeds the 5 MB response cap, so it is not in the registry.
- SmartRecruiters postings arrive without descriptions; "Fetch full posting" fills them in.
  Wise is read 100 roles at a time.
- Boards without dates in their feed (iHarare Jobs, VacancyMail) are listed by first-seen time.
- Corporate Staffing and Career Point Kenya feeds mix career articles with vacancies.
- Some Remote OK descriptions arrive with mis-encoded characters from the source.
- The Claude client does not opt in to server-side refusal fallbacks; a refused request is
  reported as an error.
- Alerts fire only after scheduled scans, not manual ones.
- No tests for the jobs, boards, tracker or documents screens; the profile form, sign-in, API
  client and formatting are covered.

## How to run right now

- Prereqs: Node 24, pnpm 11
- `pnpm install && pnpm dev`, then open http://localhost:5173
- Or `pnpm build && pnpm start`, then open http://127.0.0.1:8787

## Environment notes

- Built and tested on macOS (Apple silicon), Node 24.16.
