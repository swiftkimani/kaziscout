# ADR-0005: AGPL-3.0-or-later, with the option of commercial licences

- Status: accepted
- Date: 2026-10-06
- Deciders: Benard Kimani

## Context

KaziScout was first published under MIT. The owner intends to build a business on it: a hosted
service with alerts, managed AI and dashboards for training programmes. MIT lets anyone host the
project as a competing closed service and give nothing back.

## Decision

Everything after commit `ee2a0d6` is licensed AGPL-3.0-or-later. Earlier versions remain MIT.
The copyright holder can also grant commercial licences to organisations that cannot meet the
AGPL's terms.

## Consequences

- Positive: anyone who runs a modified KaziScout as a network service must publish their changes,
  so hosted forks stay open. Individuals, students and self-hosters are unaffected.
- Negative: some companies do not allow AGPL software, which may slow adoption there. That is
  what the commercial licence is for.
- Follow-ups: outside contributions need an agreement (a CLA, or a DCO plus licence grant) that
  lets the project keep offering commercial licences. Decide before accepting the first one.
  Registering "KaziScout" as a trademark is optional and separate.

## Third-party work

Unaffected. computer-use-mcp is an MIT dependency and career-ops is an MIT design reference; MIT
is compatible with AGPL, no code from either is copied into this repository, and both stay
credited in `CREDITS.md`.

## Alternatives considered

| Option                             | Why not                                                                                  |
| ---------------------------------- | ---------------------------------------------------------------------------------------- |
| Stay on MIT                        | No protection against a closed hosted copy.                                              |
| Business Source Licence or similar | Not open source, which would cost the trust and contributions the project depends on.    |
| GPL-3.0                            | Does not cover network use, which is exactly the case that matters for a hosted service. |
