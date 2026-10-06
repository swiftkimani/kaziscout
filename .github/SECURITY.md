# Security policy

## Reporting a vulnerability

Please do not open a public issue. Use **Report a vulnerability** on this repository's Security
tab, which opens a private advisory visible only to the maintainer.

Include what you found, how to reproduce it, and what an attacker could do with it. You will get
an acknowledgement within seven days.

## What is in scope

- The server's handling of untrusted input: job postings, feed content, and addresses given to
  the page-to-Markdown endpoint (which must never reach private networks).
- Sign-in and session handling when `ACCESS_TOKEN` is set.
- Anything that would let KaziScout submit an application, or act on the desktop, without the
  person asking.

## What to know before deploying

KaziScout has no user accounts. With no `ACCESS_TOKEN` it must only listen on `127.0.0.1`, and it
refuses to start otherwise. Treat the access token like a password: it protects your CV.
