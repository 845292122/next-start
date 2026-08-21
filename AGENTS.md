<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project conventions (outside the managed block above — `next dev` won't touch this)

- **Default to Server Actions.** Form submits, mutations, and most client-side interaction
  (search, optimistic updates, etc.) go through `src/features/<domain>/actions.ts`. A Server
  Action can be called directly from a Client Component (`useTransition` for pending state) or
  used as an SWR fetcher — needing client-triggered fetching is not a reason to reach for a
  Route Handler.
- **Route Handlers are for consumers outside this Next.js app only** — third-party callers,
  mobile clients, webhooks, or framework-mandated callbacks (`api/auth/[...nextauth]`).
- **Never write SQL in a page, Route Handler, or Server Action.** All data access goes through
  `src/core/services/`; everything else only calls those functions.
- Full rationale and the one documented exception (`notes`' `NoteList`, a legacy demo of the
  SWR + Route Handler path) are in [DEVELOPMENT.md § 分层与依赖方向](DEVELOPMENT.md#分层与依赖方向).
