import { unstable_rethrow } from 'next/navigation'
import type { Session } from 'next-auth'
import type { z } from 'zod'
import type { ActionResult } from '@/core/action-result'
import { getRequiredSession } from '@/core/auth/session'
import { isClientError, toAppError } from '@/core/errors'
import { requestLogger } from '@/core/logger'
import { currentRequestId } from '@/core/request-id'
import { parseOrThrow } from '@/core/validation'

/**
 * The runner behind every Server Action. See `core/action-result.ts` for why the
 * contract is a return value rather than a thrown error.
 *
 * A Server Action written on top of this does session check, input validation,
 * error mapping and logging identically to every other one, which is the whole
 * point: those four things are where hand-written actions drift apart.
 *
 * Usage — note that the exported action is still a plain `async function`, and
 * only its body delegates here. A `'use server'` module may only export async
 * functions, so `export const foo = someWrapper(...)` is not available to us:
 *
 * ```ts
 * 'use server'
 *
 * export async function createNoteAction(
 *   input: CreateNoteValues,
 * ): Promise<ActionResult<NoteDTO>> {
 *   return runAction({
 *     name: 'createNote',
 *     schema: createNoteSchema,
 *     input,
 *     handler: async (parsed, session) => { ... },
 *   })
 * }
 * ```
 */
export async function runAction<TSchema extends z.ZodType, TData>(options: {
	/** Used only for log correlation, e.g. 'createNote'. */
	name: string
	schema: TSchema
	input: unknown
	handler: (input: z.output<TSchema>, session: Session) => Promise<TData>
}): Promise<ActionResult<TData>> {
	return execute(options.name, async () => {
		// Session first, before the input is even looked at: an unauthenticated
		// caller should learn nothing about which inputs would have been valid.
		const session = await getRequiredSession()
		const parsed = parseOrThrow(options.schema, options.input)
		return options.handler(parsed, session)
	})
}

/**
 * `runAction` for the handful of actions that must work without a session —
 * sending a login code, say.
 *
 * A separate function rather than an `auth: false` option so that "which actions
 * are reachable by anyone" is answerable with one grep, instead of hiding in an
 * options object.
 */
export async function runPublicAction<
	TSchema extends z.ZodType,
	TData,
>(options: {
	name: string
	schema: TSchema
	input: unknown
	handler: (input: z.output<TSchema>) => Promise<TData>
}): Promise<ActionResult<TData>> {
	return execute(options.name, async () => {
		const parsed = parseOrThrow(options.schema, options.input)
		return options.handler(parsed)
	})
}

async function execute<TData>(
	name: string,
	run: () => Promise<TData>,
): Promise<ActionResult<TData>> {
	try {
		return { ok: true, data: await run() }
	} catch (error) {
		// Must be the first statement in the catch. `redirect()`, `notFound()` and
		// friends work by throwing an internal Next error, so a wrapper this broad
		// would otherwise swallow them and the navigation would silently not
		// happen. See node_modules/next/dist/docs/01-app/03-api-reference/
		// 04-functions/unstable_rethrow.md.
		unstable_rethrow(error)

		const appError = toAppError(error)
		// Tags the line with the id the proxy injected, so this failure and the
		// `onRequestError` entry for the same request can be pulled out together.
		const log = requestLogger(await currentRequestId())

		if (isClientError(appError.code)) {
			// Expected, caller-caused failure: no stack, and warn rather than error.
			// Logging validation failures at error level is how an error log stops
			// being worth reading.
			log.warn(
				{ action: name, code: appError.code, fields: appError.fields },
				appError.message,
			)
		} else {
			// A genuine fault. `err` gets pino's serializer, so the stack of the
			// original throw (attached as `cause` by toAppError) lands in the log —
			// which is the only place it lands. The client gets the code and nothing
			// else.
			log.error({ action: name, err: appError }, 'action failed')
		}

		return { ok: false, code: appError.code, fields: appError.fields }
	}
}
