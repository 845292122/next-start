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
- **Never make a route accept both a cookie and a Bearer token.** `/api/v1/*` is Bearer-only
  (`getRequiredBearerSession`) and that is what makes it CSRF-free by construction; everything
  else is cookie-only. Merging them silently reopens a CSRF surface — see
  `src/core/auth/verify.ts` and the assertion in `e2e/api-v1.e2e.ts`.
- **Never write SQL in a page, Route Handler, or Server Action.** All data access goes through
  `src/core/services/`; everything else only calls those functions.
- **Never log a raw URL, and never put user data in an exception message.** Paths go through
  `loggablePath()` (`src/core/logger.ts`) because OAuth callbacks carry an exchangeable `code` in
  the query string; pino's key-based redaction cannot see inside a string. Same reason messages
  must stay free of PII — `phone` is this app's login identity.
- **A strict CSP is enforced — check `src/core/security-headers.ts` before adding anything
  inline.** Scripts are nonce + `'strict-dynamic'`; there is no `'unsafe-eval'` in production, so
  any library that compiles code at runtime will be refused (this is why
  `src/core/zod-config.ts` disables zod's JIT in the browser). A third-party inline `<script>`
  needs the nonce forwarded from `app/[locale]/layout.tsx`, the way next-themes' is.
  `e2e/security.e2e.ts` fails on any CSP violation — don't loosen the policy to make it pass
  without reading the reasoning in `DEVELOPMENT.md § 安全`.
- **Errors have a contract — don't hand-roll one.** Services throw the typed errors in
  `src/core/errors.ts`. A Server Action is an `export async function` whose body is one
  `runAction({...})` call (`src/core/action.ts`) and returns `ActionResult<T>`; a Route Handler
  is wrapped in `withHandler` and reads input via `readJson` / `readParams`
  (`src/core/http.ts`). Never `throw new Error('...')`, never `schema.parse()` on untrusted
  input, never a hand-written `if (!session) return 401`. If you write your own try/catch
  wrapper, `unstable_rethrow(error)` must be its first statement or `redirect()` and
  `notFound()` break silently.
- There is **no exception** to the rule above. `notes`' `NoteList` does search-as-you-type and
  optimistic updates entirely through Server Actions (`listNotesAction` is its SWR fetcher);
  `src/app/api/notes/` is kept only as the worked example of the external-consumer path and
  nothing in the app calls it. Full rationale in
  [DEVELOPMENT.md § 分层与依赖方向](DEVELOPMENT.md#分层与依赖方向).
