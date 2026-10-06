# Contributing to KaziScout

Thank you for helping. Read [AGENTS.md](AGENTS.md) for the project rules first; they apply to
people as much as to AI agents.

## Branches

| Branch | Purpose                                        | How changes arrive                                     |
| ------ | ---------------------------------------------- | ------------------------------------------------------ |
| `dev`  | Integration branch and the repository default. | Pull requests from feature branches or forks.          |
| `main` | Released, always working.                      | Pull requests from `dev` only, opened by a maintainer. |

Nobody pushes to `dev` or `main` directly, maintainers included. CI enforces the rest: a pull
request into `main` from anywhere other than `dev` fails the `source-branch (main)` check.

## Making a change

1. Fork the repository, or create a branch from `dev`: `feat/short-name`, `fix/short-name`.
2. Make the change with tests. Run `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`.
3. Commit using [Conventional Commits](https://www.conventionalcommits.org):
   `feat(providers): read jobs from Recruitee`.
4. Open a pull request against `dev` and fill in the template.
5. CI must pass before it can be merged.

## Adding a job board or employer

See "Adding a job board" in the [README](README.md). Run `pnpm boards:verify` and commit the
regenerated `docs/BOARDS.md` with your change.

## Licence of contributions

KaziScout is licensed under AGPL-3.0-or-later and the maintainer also offers commercial licences
(see [NOTICE](NOTICE) and [ADR-0005](docs/adr/0005-agpl-licence.md)). So that both stay possible,
contributors agree to the [Contributor Licence Agreement](CLA.md). You keep your copyright; you
grant the maintainer the right to license your contribution.

To agree, add this line to the description of your first pull request:

> I have read the KaziScout Contributor Licence Agreement (CLA.md, version 0.1) and I agree to it.

## Reporting a security problem

Do not open a public issue. Use GitHub's "Report a vulnerability" on the repository's Security tab.
