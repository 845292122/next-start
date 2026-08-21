import { z } from 'zod'
import { ValidationError } from '@/core/errors'

/**
 * Its own module rather than living in `core/action.ts`: `core/http.ts` needs it
 * too, and importing it from there would make the HTTP layer depend on the
 * Server Action layer (and drag in the Auth.js + database import chain that
 * `core/action.ts` carries) for one three-line function.
 */

/**
 * `safeParse` rather than `parse`.
 *
 * A raw `ZodError` escaping to the caller is how a 400-shaped failure ends up
 * looking like a 500 — `schema.parse()` in a Route Handler or a Server Action was
 * exactly that bug.
 */
export function parseOrThrow<TSchema extends z.ZodType>(
	schema: TSchema,
	input: unknown,
): z.output<TSchema> {
	const parsed = schema.safeParse(input)
	if (parsed.success) return parsed.data

	// Only the field *names* are kept. Zod's built-in messages are English, and
	// schemas in this project deliberately carry no locale-specific text (see
	// `core/auth/schema.ts`) — the client renders its own translated string keyed
	// off which field failed. The full error still reaches the log as `cause`,
	// where language doesn't matter.
	const fieldErrors = z.flattenError(parsed.error).fieldErrors
	throw new ValidationError('input failed schema validation', {
		fields: Object.keys(fieldErrors),
		cause: parsed.error,
	})
}
