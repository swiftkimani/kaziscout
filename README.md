<p align="center">
  <img src="brand/logo.svg" alt="KaziScout" width="320">
</p>

<p align="center"><strong>Find work worth your while, across Africa.</strong></p>

KaziScout is a job-search agent that runs on your own computer. It scans African job boards,
scores every posting from 1 to 5 against your profile, turns cluttered job pages into clean
Markdown, and tracks your applications. You review each one and press Submit yourself.

"Kazi" is Swahili for work.

![The KaziScout jobs screen, ranked by fit](docs/assets/jobs.jpg)

## What it does

|                              |                                                                                                                                                                                                                         |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Scans African job boards** | Reads 25 boards through their public RSS feeds and APIs: Kenya, Nigeria, Ghana, Zimbabwe, Zambia, Malawi, Botswana, the Gambia, francophone and pan-African boards, and remote boards filtered to roles open to Africa. |
| **Lists the rest**           | A directory of 98 checked boards covering 27 countries plus pan-African and remote sources. Boards without a public feed are linked, never scraped. See [docs/BOARDS.md](docs/BOARDS.md).                               |
| **Scores each job 1 to 5**   | Offline keyword scoring on title, skills, location and freshness, with the reasons shown. Add an Anthropic API key and Claude writes a fuller assessment and a suggested opening paragraph.                             |
| **Page to Markdown**         | Paste any job page and get clean Markdown for reading or for an AI model. Uses Mozilla Readability locally, or [Firecrawl](https://firecrawl.dev) when you add a key (which also renders JavaScript).                   |
| **Tracks applications**      | Saved, applied, interview, offer, rejected, withdrawn, with notes.                                                                                                                                                      |
| **Helps you apply**          | Builds an application pack (your details, matching skills, gaps to address) and copies it to your clipboard, through [computer-use-mcp](https://github.com/zavora-ai/computer-use-mcp) if you enable it.                |

Everything is stored in one SQLite file on your machine. Nothing leaves it except the requests
you trigger: board scans, page fetches, and Claude or Firecrawl calls if you configure them.

![The board directory](docs/assets/boards.jpg)

## Architecture

```mermaid
flowchart LR
  UI[Web UI<br/>React + Vite] -->|/v1 JSON| API[Fastify routes]
  API --> S[Services<br/>scan · evaluate · markdown · apply]
  S --> R[Repositories] --> DB[(SQLite)]
  S --> P[Providers<br/>RSS · Remotive · Himalayas · Remote OK] --> Boards[(Job boards)]
  S --> C[Page converter<br/>Readability or Firecrawl]
  S --> E[Evaluator<br/>keyword or Claude]
  S --> D[Desktop assist<br/>computer-use-mcp]
  Reg[data/boards.json<br/>board registry] --> S
```

Routes handle HTTP only, services hold the rules, repositories hold the SQL. The board registry
is a JSON file in the repo, so adding a board is a pull request, not a database change. Decisions
are recorded in [docs/adr](docs/adr).

## Prerequisites

- Node.js 24 or newer (KaziScout uses the built-in `node:sqlite`)
- pnpm 11 (`corepack enable` provides it)

## Setup

```sh
git clone https://github.com/swiftkimani/kaziscout.git
cd kaziscout
pnpm install
cp .env.example .env   # optional: add API keys
```

## Run

Development, with live reload (API on 8787, UI on 5173):

```sh
pnpm dev
```

Production, one process serving both:

```sh
pnpm build
pnpm start             # http://127.0.0.1:8787
```

Then:

1. Open **Boards** or **Jobs** and choose **Scan all boards**.
2. Fill in **Profile**. Every job is scored as soon as you save.
3. Sort **Jobs** by best fit, open one, and save it to your tracker.

## Test

```sh
pnpm test          # 62 server tests; no network needed
pnpm typecheck
pnpm lint
pnpm format:check
```

## Configuration

All settings are optional. See [.env.example](.env.example).

| Variable                 | Default                  | Purpose                                                     |
| ------------------------ | ------------------------ | ----------------------------------------------------------- |
| `PORT`                   | `8787`                   | Port the server listens on                                  |
| `HOST`                   | `127.0.0.1`              | Interface to bind. Keep it local; there is no login.        |
| `LOG_LEVEL`              | `info`                   | `debug`, `info`, `warn`, `error` or `silent`                |
| `DATABASE_PATH`          | `./var/kaziscout.sqlite` | SQLite file, relative to `server/`                          |
| `FIRECRAWL_API_KEY`      | none                     | Convert pages with Firecrawl instead of the local converter |
| `ANTHROPIC_API_KEY`      | none                     | Enables "Assess with Claude"                                |
| `AI_MODEL`               | `claude-opus-5-5`        | Claude model used for assessments                           |
| `DESKTOP_ASSIST_ENABLED` | `false`                  | Copy application packs through computer-use-mcp             |

## API

The UI is a client of a small versioned API, which you can also call directly.

| Method and path                                                          | Purpose                                                                                           |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| `GET /v1/boards`                                                         | Board directory with last scan result and job counts                                              |
| `POST /v1/scans`                                                         | Scan every board that has a public feed                                                           |
| `POST /v1/boards/:id/scan`                                               | Scan one board                                                                                    |
| `GET /v1/jobs`                                                           | List jobs. Filters: `search`, `board`, `country`, `remote`, `minScore`, `sort`, `limit`, `cursor` |
| `GET /v1/jobs/:id`                                                       | One job with its evaluation and tracker entry                                                     |
| `POST /v1/jobs/:id/evaluate`                                             | Score a job. Body: `{"evaluator": "heuristic" \| "claude"}`                                       |
| `POST /v1/jobs/:id/markdown`                                             | Replace the job's description with its full posting page                                          |
| `GET /v1/jobs/:id/application-pack`                                      | The text pack for applying                                                                        |
| `POST /v1/jobs/:id/assist`                                               | Copy the pack to the clipboard through computer-use-mcp                                           |
| `POST /v1/extract`                                                       | Convert any public page to Markdown. Body: `{"url": "..."}`                                       |
| `GET` / `PUT /v1/profile`                                                | Read or save the profile                                                                          |
| `GET` / `POST /v1/applications`, `PATCH` / `DELETE /v1/applications/:id` | The tracker                                                                                       |
| `GET /health`                                                            | Liveness check                                                                                    |

Errors use one envelope:
`{"error": {"code": "NOT_FOUND", "message": "...", "details": {}, "request_id": "..."}}`.

## Using KaziScout with an AI agent

KaziScout prepares; an agent with desktop control can do the typing. Connect
[computer-use-mcp](https://github.com/zavora-ai/computer-use-mcp) to your agent (Claude Code,
OpenCode, Codex and others), start KaziScout, and point the agent at
[skills/kaziscout-apply/SKILL.md](skills/kaziscout-apply/SKILL.md). The skill tells the agent to
fetch the application pack from the API, fill in the form through the accessibility tools, and
stop before Submit so you can check it.

## Project structure

```
server/
  data/boards.json      board registry (source of truth for boards)
  src/boards/           registry loader, country detection, board verifier
  src/providers/        one reader per kind of source (RSS, remote job APIs)
  src/extract/          page to Markdown, Firecrawl client, URL safety check
  src/scoring/          keyword scorer and Claude evaluator
  src/repositories/     SQL
  src/services/         scan, evaluation, markdown, apply
  src/routes/           HTTP handlers and request schemas
  src/db/               SQLite client and migrations
  test/                 tests and recorded feed fixtures
web/
  src/components/ui/    primitives (the only place raw styling lives)
  src/features/         jobs, boards, tracker, profile, extract
  src/styles/tokens.css design tokens
brand/                  logo and brand notes
docs/                   board list, decisions, handoff journal
skills/                 agent guide for assisted applications
```

## Adding a job board

1. Add an entry to `server/data/boards.json`. Use `"access": {"type": "rss", "feedUrl": "..."}`
   if the board has a feed, or `{"type": "listing"}` if it does not.
2. Run `pnpm boards:verify`. It checks every board and regenerates `docs/BOARDS.md`.
3. Open a pull request.

Only add boards that publish a feed or API meant for reuse. KaziScout does not scrape HTML
listings or sources that need a login.

## Troubleshooting

| Problem                                     | What to do                                                                                                                                      |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `No such built-in module: node:sqlite`      | Upgrade to Node.js 24 or newer.                                                                                                                 |
| A board shows "Last scan failed"            | Boards time out now and then. Scan it again; if it keeps failing, run `pnpm boards:verify`.                                                     |
| Page to Markdown returns "no readable text" | The page is drawn by JavaScript. Add `FIRECRAWL_API_KEY`.                                                                                       |
| "That address can't be fetched"             | Only public http and https pages are fetched; local and private addresses are refused on purpose.                                               |
| Jobs show a dash instead of a score         | Save your profile. Scores need something to compare against.                                                                                    |
| Desktop assist fails on macOS               | Grant your terminal Accessibility permission, as [computer-use-mcp describes](https://github.com/zavora-ai/computer-use-mcp#set-up-your-agent). |

## Limits, stated plainly

- The keyword score is a filter, not a judgement. It cannot tell "5 years required" from
  "5 years preferred". Use it to rank, then read the posting.
- Board feeds carry what the board chooses to publish: often the latest 10 to 50 postings, and
  some feeds mix in career articles.
- KaziScout never submits an application. That is deliberate.

## Credits

Created by **Benard Kimani** ([@swiftkimani](https://github.com/swiftkimani)).

KaziScout builds on two open-source projects, with thanks to their authors:

- [computer-use-mcp](https://github.com/zavora-ai/computer-use-mcp) by **James Karanja Maina**
  (Zavora Technologies Ltd), used as a dependency for desktop control.
- [career-ops](https://github.com/career-ops-hq/career-ops) by
  **Santiago Fernández de Valderrama**, the design reference for local, human-in-the-loop job
  search.

Full acknowledgements, including data sources, are in [CREDITS.md](CREDITS.md).

## Contributing

Read [AGENTS.md](AGENTS.md) for the project rules and [docs/CONTEXT.md](docs/CONTEXT.md) for the
current state of the work. Commits follow Conventional Commits.

## Licence

[MIT](LICENSE) © 2026 Benard Kimani
