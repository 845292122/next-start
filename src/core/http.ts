import { unstable_rethrow } from 'next/navigation'
import type { z } from 'zod'
import {
	type AppErrorCode,
	isClientError,
	toAppError,
	ValidationError,
} from '@/core/errors'
import { loggablePath, requestLogger } from '@/core/logger'
import { REQUEST_ID_HEADER, resolveRequestId } from '@/core/request-id'
import { parseOrThrow } from '@/core/validation'

/**
 * The Route Handler counterpart to `core/action.ts`.
 *
 * Route Handlers in this project exist only for consumers *outside* the Next.js
 * app (see AGENTS.md), which is exactly why their error contract matters: those
 * callers can't read our source to find out that a 500 actually meant "your JSON
 * was malformed". `withHandler` maps the same `AppError` codes the Server Action
 * runner uses onto real status codes.
 */
const STATUS_BY_CODE: Record<AppErrorCode, number> = {
	VALIDATION: 400,
	UNAUTHORIZED: 401,
	FORBIDDEN: 403,
	NOT_FOUND: 404,
	CONFLICT: 409,
	RATE_LIMITED: 429,
	INTERNAL: 500,
}

/**
 * Wraps a Route Handler so anything it throws becomes a JSON error response with
 * a correct status.
 *
 * The context parameter is passed straight through. For a dynamic route, name it
 * with Next's generated `RouteContext<'/the/route'>` global so `params` stays
 * typed from the route path itself rather than a hand-written duplicate that can
 * drift — the same generated-types trick as `LayoutProps<'/[locale]'>` in
 * `app/[locale]/layout.tsx`:
 *
 * ```ts
 * export const GET = withHandler(async (request) => { ... })
 *
 * export const PATCH = withHandler<RouteContext<'/api/notes/[id]'>>(
 *   async (request, { params }) => { ... },
 * )
 * ```
 *
 * `unknown` is the default rather than `undefined` because Next's route-type
 * validator hands every handler a `{ params }` object even on a static route, and
 * a handler declaring `undefined` there fails `bun run typecheck`. `unknown`
 * accepts it (parameters are contravariant) without asserting a shape.
 */
export function withHandler<TContext = unknown>(
	handler: (request: Request, context: TContext) => Promise<Response>,
) {
	return async (request: Request, context: TContext): Promise<Response> => {
		// Minted here rather than taken from the proxy: the proxy's matcher excludes
		// /api, so a Route Handler never sees a proxy-injected id. An incoming one
		// (from a load balancer) still wins — see core/request-id.ts.
		const requestId = resolveRequestId(request.headers)

		try {
			const response = await handler(request, context)
			// Echoed so an external caller can quote it in a bug report, and so its
			// own logs join up with ours. Route Handlers are the external-consumer
			// interface, which is exactly who needs this.
			response.headers.set(REQUEST_ID_HEADER, requestId)
			return response
		} catch (error) {
			// First statement in the catch — see the same call in core/action.ts.
			// notFound() and redirect() throw internal Next errors that must pass
			// through untouched.
			unstable_rethrow(error)

			const appError = toAppError(error)
			const log = requestLogger(requestId)

			if (isClientError(appError.code)) {
				log.warn(
					{
						method: request.method,
						path: loggablePath(request.url),
						code: appError.code,
						fields: appError.fields,
					},
					appError.message,
				)
			} else {
				log.error(
					{
						method: request.method,
						path: loggablePath(request.url),
						err: appError,
					},
					'route handler failed',
				)
			}

			// Only the code and the field names travel. `appError.message` is
			// developer-facing text (and for INTERNAL it may quote a driver error),
			// so it stays in the log.
			return Response.json(
				{ error: appError.code, fields: appError.fields },
				{
					status: STATUS_BY_CODE[appError.code],
					headers: { [REQUEST_ID_HEADER]: requestId },
				},
			)
		}
	}
}

/**
 * Reads and validates a JSON request body.
 *
 * Handles the two ways this fails, both of which produced a 500 before: a body
 * that isn't JSON at all (`request.json()` throws a `SyntaxError` — an empty
 * POST body is enough to trigger it) and a body that parses but doesn't match
 * the schema.
 *
 * The `SyntaxError` is caught here rather than in `withHandler` on purpose: a
 * `SyntaxError` thrown anywhere else is a bug and should stay a 500.
 */
export async function readJson<TSchema extends z.ZodType>(
	request: Request,
	schema: TSchema,
): Promise<z.output<TSchema>> {
	let body: unknown
	try {
		body = await request.json()
	} catch (error) {
		throw new ValidationError('request body is not valid JSON', {
			cause: error,
		})
	}
	return parseOrThrow(schema, body)
}

/**
 * Validates a dynamic route segment against a schema.
 *
 * Route params arrive as arbitrary strings — `/api/notes/../../etc` puts
 * whatever the caller typed into `params.id`. Checking the shape here means a
 * malformed id is a 400 instead of reaching the database and coming back as an
 * empty result that some caller then reports as a 404 (or worse, a 500).
 */
export async function readParams<TSchema extends z.ZodType>(
	params: Promise<unknown>,
	schema: TSchema,
): Promise<z.output<TSchema>> {
	return parseOrThrow(schema, await params)
}
