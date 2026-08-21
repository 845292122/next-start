import type { AppErrorCode } from '@/core/errors'

/**
 * The wire shape every Server Action returns.
 *
 * This module is deliberately types-only and imports nothing but a type: it's
 * the half of the action contract that Client Components are allowed to touch.
 * The runner that produces these values (`core/action.ts`) pulls in the Auth.js
 * config and the database client, so importing *that* from a Client Component
 * breaks the Turbopack build. Same split, and the same reason, as
 * `core/auth/schema.ts` vs `core/auth/otp.ts`.
 *
 * ## Why a return value instead of a thrown error
 *
 * In a production build Next replaces any uncaught Server Action error with a
 * generic message plus a digest, so a thrown error cannot tell the client
 * *anything* — "not signed in", "title too long" and "the database is down" all
 * arrive identically. Modelling expected failures as return values is also what
 * the Next docs prescribe (see `01-getting-started/10-error-handling.md`,
 * "Handling expected errors").
 *
 * Genuine bugs still throw, get logged with a stack, and surface as
 * `code: 'INTERNAL'`.
 */
export type ActionResult<TData> = ActionSuccess<TData> | ActionFailure

export type ActionSuccess<TData> = {
	ok: true
	data: TData
}

export type ActionFailure = {
	ok: false
	code: AppErrorCode
	/**
	 * Which form fields the failure belongs to, when it's attributable.
	 *
	 * Field *names* only — no messages. Schemas in this project carry no
	 * locale-specific text on purpose (see `core/auth/schema.ts`), so the client
	 * looks at these names and renders its own translated string. A server-sent
	 * message would be in one fixed language and zod's built-in messages are
	 * English.
	 */
	fields?: string[]
}
