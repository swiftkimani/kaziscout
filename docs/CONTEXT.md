# CONTEXT — KaziScout

_Last updated: 2026-10-06 by Benard Kimani_

## Current goal

First public release: a working local job-search agent for Africa with a web UI.

## Status at a glance

| Area                       | State           | Notes                                                                                                                      |
| -------------------------- | --------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Source registry            | done            | 131 sources checked on 2026-10-06; 60 scanned (25 boards, 35 employers)                                                    |
| Scanners                   | done            | RSS, Teamtailor feeds, 3 remote job APIs, 7 hiring systems. Every employer was scanned live.                               |
| Countries and regions      | done            | 234 countries; region limits resolve for every profile; limits stated in posting text are read                             |
| Scoring                    | done            | Keyword scorer tested. AI path run live against Ollama `qwen2.5:1.5b`. Claude path not run live.                           |
| Documents                  | done            | Cover letter and tailored CV, run live against Ollama; output from that 1.5B model is unusable                             |
| Scheduled scans and alerts | done, observed  | A 15-minute schedule fired on time; 55 of 55 sources answered and a webhook message listing 17 strong matches was received |
| Sign-in                    | done            | Access token; verified live with curl and unit tested                                                                      |
| Terminal interface         | done            | `./kazi`; run live against a scanned database                                                                              |
| Agent skill                | done, run once  | Run end to end on the practice form with a browser tool; never on a real employer form                                     |
| Page to Markdown           | done            | Local converter tested on live pages; Firecrawl client tested against a stub only                                          |
| Tracker                    | done            |                                                                                                                            |
| Web UI                     | done            | 41 tests across every screen; checked by hand at desktop and 500 px widths                                                 |
| Desktop assist             | partly verified | Clipboard write through computer-use-mcp verified on macOS                                                                 |
| CI and branches            | done            | CI required on `dev` and `main`; `main` only takes pull requests from `dev`                                                |

## Done

- 2026-10-06 Profile set up from a CV with follow-up questions; desktop assist on under `pnpm dev`.
- 2026-10-06 Skill for AI coding tools; add a job by link; store an outside assessment.
- 2026-10-06 Terminal interface; practice application form; email and phone in the profile.
- 2026-10-06 Workday and Recruitee readers; continent table; limits read from posting text.
- 2026-10-06 Tests for every web screen; draft contributor licence agreement.
- 2026-10-06 Branch protection: pull requests into `dev`, `dev` into `main`.
- 2026-10-06 Cover letter and tailored CV writing; print pages.
- 2026-10-06 Optional access-token sign-in; refusal to listen beyond loopback without it.
- 2026-10-06 Scheduled scans and webhook alerts.
- 2026-10-06 Worldwide countries; SmartRecruiters, Workable and Teamtailor sources; network retry.
- 2026-10-06 Relicensed to AGPL-3.0-or-later.
- 2026-10-06 AI assessment works with any OpenAI-compatible model; employer readers.
- 2026-10-06 Initial build: server, web UI, board registry, docs, brand.

## In progress

- Nothing.

## Next (ordered)

These need something only the owner can supply.

1. Try the built-in AI assessment and document writing with a capable model (7B+ local, or a
   hosted one with a key). The built-in path has only run on a 1.5B model. The terminal skill
   path has run on a capable model and judged a job sensibly.
2. Run the Firecrawl converter and the Claude client with real keys.
3. Have a lawyer review `CLA.md` before relying on it for a commercial licence.
4. Apply for a ReliefWeb app name (https://apidoc.reliefweb.int/parameters#appname), then add a
   ReliefWeb provider.
5. Try the agent skill on one real application form, with the owner watching.

Can be done by anyone:

6. Expose KaziScout's own tools as an MCP server so agents need no HTTP calls.
7. More source types from career-ops, each verified against a real employer first.

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

- Dependencies added for CV reading: `unpdf` (MIT, no dependencies, PDF text) and `mammoth`
  (BSD-2-Clause, Word text). Node has no built-in reader for either format.
- The rule-based CV reader takes the first country near the top of the CV as home, and reads
  skills only from a section headed Skills, Competencies, Expertise or Technologies.
- Cannot be closed in code: BrighterMonday, Jobberman, Fuzu and other large boards publish no
  feed and are link-out only; ReliefWeb needs an approved app name; 23 sources refuse automated
  checks and are marked "blocked".
- Sign-in is one shared token for one owner. Multi-user accounts are deliberately left for the
  hosted product.
- A role located only as "Remote" whose text states no limit is treated as open to everyone.
- "Georgia" in a location is read as the country, not the US state.
- Personio was not added: the only tenants that answered returned an identical placeholder.
- Workday is read 20 roles at a time and SmartRecruiters 100, both without descriptions;
  "Fetch full posting" fills a description in. Elastic's Greenhouse feed exceeds the 5 MB cap.
- Boards without dates in their feed (iHarare Jobs, VacancyMail) are listed by first-seen time.
- Corporate Staffing and Career Point Kenya feeds mix career articles with vacancies.
- Some Remote OK descriptions arrive with mis-encoded characters from the source.
- The Claude client does not opt in to server-side refusal fallbacks.
- Alerts fire only after scheduled scans, not manual ones.
- Desktop accessibility tools cannot see web form fields in Chromium browsers; the agent skill
  says to use a browser tool for web forms.
- On push events the CI run lists a skipped job with an unresolved name; it is cosmetic.

## How to run right now

- Prereqs: Node 24, pnpm 11
- `pnpm install && pnpm dev`, then open http://localhost:5173
- Or `pnpm build && pnpm start`, then open http://127.0.0.1:8787

## Environment notes

- Built and tested on macOS (Apple silicon), Node 24.16.
