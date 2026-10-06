# ADR-0003: Local-first, with Firecrawl and any AI model as optional upgrades

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
- `JobEvaluator`: a deterministic keyword scorer locally; an AI model when one is configured.
  `AI_BASE_URL` selects any server that speaks the OpenAI chat-completions protocol (OpenAI,
  Gemini, DeepSeek, Groq, OpenRouter, Ollama, LM Studio); otherwise `ANTHROPIC_API_KEY` selects
  Claude. Replies are validated against one schema whichever model wrote them.

Scans always use the local scorer. A model is called only when the user asks for one job to be
assessed, so cost stays visible and bounded.

## Consequences

- Positive: the whole product works with no keys and no account. Paid calls are opt-in per job.
- Negative: the local converter cannot render JavaScript, and the keyword score is coarse.
- Follow-ups: a regex-only extraction was tried first and kept site menus (216,000 characters for
  one posting); Readability reduced the same page to 2,400.

## Alternatives considered

| Option                        | Why not                                                                         |
| ----------------------------- | ------------------------------------------------------------------------------- |
| Require Firecrawl             | Excludes users without a key from a core feature.                               |
| Support one model vendor only | Users on free local models or other providers would be shut out of the feature. |
| LLM-score every scanned job   | A single scan can add 1,300 jobs; the cost is unbounded and mostly wasted.      |
| Embeddings for matching       | A model download or another API for a ranking the user still has to read.       |
