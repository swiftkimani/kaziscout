# Credits

KaziScout was created and is maintained by **Benard Kimani**
([@swiftkimani](https://github.com/swiftkimani)), and is released under the
[MIT licence](LICENSE).

It is new code, but it stands on two open-source projects. Neither project's code is copied into
this repository; one is used as a dependency and the other shaped the design.

## Projects KaziScout builds on

### computer-use-mcp

- **Author:** James Karanja Maina, Zavora Technologies Ltd
- **Repository:** https://github.com/zavora-ai/computer-use-mcp
- **Licence:** MIT, Copyright (c) 2026 Zavora Technologies Ltd
- **How it is used:** as the npm dependency `@zavora-ai/computer-use-mcp`. KaziScout's desktop
  assist calls it to place your application pack on the clipboard, and the agent guide in
  `skills/kaziscout-apply/` pairs KaziScout with it so an AI agent can fill in an application
  form while you watch and press Submit.

### career-ops

- **Author:** Santiago Fernández de Valderrama
- **Repository:** https://github.com/career-ops-hq/career-ops
- **Licence:** MIT, Copyright (c) 2026 Santiago Fernández de Valderrama
- **How it is used:** as the design reference. KaziScout follows its core ideas: run locally,
  read only open no-login job sources, score every job from 1 to 5 against your CV before you
  apply, keep a tracker, and leave the final Submit to the human. Reading employers through the
  public APIs of their hiring systems (Greenhouse, Lever, Ashby) is also career-ops' approach;
  KaziScout's readers are written from those systems' public API responses.

## Services and data sources

- **Firecrawl** (https://firecrawl.dev) converts pages to Markdown when you supply your own API
  key. KaziScout is not affiliated with Firecrawl.
- **AI models.** Assessments are written by whichever model you connect with your own key or
  run locally. KaziScout is not affiliated with any model provider.
- **Job boards.** Every posting belongs to the board and employer that published it. KaziScout
  reads public RSS feeds and public APIs, stores a summary locally, and always links back to the
  original posting. The full list is in [docs/BOARDS.md](docs/BOARDS.md). Remote OK, Remotive,
  Himalayas and We Work Remotely ask API users to link back and credit them as the source, which
  KaziScout does on every job.

## Libraries

Fastify, Zod, fast-xml-parser, Turndown, Mozilla Readability, linkedom, React, Vite, TanStack
Query, React Router, react-markdown and Lucide icons. Their licences are in their packages.
