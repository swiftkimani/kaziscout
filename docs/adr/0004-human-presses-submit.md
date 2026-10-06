# ADR-0004: The human presses Submit

- Status: accepted
- Date: 2026-10-06
- Deciders: Benard Kimani

## Context

computer-use-mcp can click, type and fill forms on a real desktop, so KaziScout could apply to
jobs automatically.

## Decision

It does not. KaziScout's own use of computer-use-mcp is limited to placing the application pack
on the clipboard. The agent guide in `skills/kaziscout-apply/` lets an AI agent fill in a form,
and tells it to stop before any submit control.

## Consequences

- Positive: no application goes out that the person has not read; no mass-applying that harms
  both the applicant's reputation and the boards.
- Negative: applying still takes a few minutes per job.

## Alternatives considered

| Option                       | Why not                                                                         |
| ---------------------------- | ------------------------------------------------------------------------------- |
| Fully automatic applications | Errors are sent to real employers under the user's name and cannot be recalled. |
| No desktop integration       | Loses the main time saving: not retyping the same details into every form.      |
