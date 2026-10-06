# ADR-0003: Local-first, with Firecrawl and Claude as optional upgrades

- Status: accepted
- Date: 2026-10-06
- Deciders: Benard Kimani

## Context

Two features benefit from paid services: converting messy pages to Markdown (Firecrawl) and
judging fit (an LLM). Many intended users are students without API budgets, so neither can be
required.

## Decision

Each feature has an interface with a free local implementation and a paid one chosen by
configuration:

- `PageConverter`: Mozilla Readability plus Turndown locally; Firecrawl when
  `FIRECRAWL_API_KEY` is set.
- `JobEvaluator`: a deterministic keyword scorer locally; Claude when `ANTHROPIC_API_KEY` is set.

Scans always use the local scorer. Claude is called only when the user asks for one job to be
assessed, so cost stays visible and bounded.

## Consequences

- Positive: the whole product works with no keys and no account. Paid calls are opt-in per job.
- Negative: the local converter cannot render JavaScript, and the keyword score is coarse.
- Follow-ups: a regex-only extraction was tried first and kept site menus (216,000 characters for
  one posting); Readability reduced the same page to 2,400.

## Alternatives considered

| Option                      | Why not                                                                    |
| --------------------------- | -------------------------------------------------------------------------- |
| Require Firecrawl           | Excludes users without a key from a core feature.                          |
| LLM-score every scanned job | A single scan can add 1,300 jobs; the cost is unbounded and mostly wasted. |
| Embeddings for matching     | A model download or another API for a ranking the user still has to read.  |
