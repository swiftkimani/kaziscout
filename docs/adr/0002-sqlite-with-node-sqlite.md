# ADR-0002: SQLite through Node's built-in module

- Status: accepted
- Date: 2026-10-06
- Deciders: Benard Kimani

## Context

KaziScout is a single-user tool that runs on a laptop. It needs filtering, sorting and pagination
over a few thousand jobs, plus a small tracker.

## Decision

Store everything in one SQLite file using `node:sqlite`, with versioned SQL migrations applied on
start. No ORM; repositories hold parameterised SQL.

## Consequences

- Positive: no database server to install, no native module to compile, one file to back up.
- Negative: requires Node 24. `node:sqlite` is synchronous, which is fine for one user and wrong
  for a multi-user server.
- Follow-ups: if KaziScout is ever hosted for many users, move to Postgres behind the same
  repository classes.

## Alternatives considered

| Option                                           | Why not                                                               |
| ------------------------------------------------ | --------------------------------------------------------------------- |
| Markdown files as the store (as career-ops does) | Filtering and keyset pagination over thousands of jobs needs indexes. |
| better-sqlite3                                   | A native dependency for something Node now ships.                     |
| Postgres                                         | A server to run for a single-user local tool.                         |
