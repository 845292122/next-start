import { headers } from 'next/headers'
import { unstable_rethrow } from 'next/navigation'

/**
 * The per-request correlation id.
 *
 * Without one, an interleaved log is a pile of unrelated lines: a Server Action's
 * failure and the `onRequestError` entry for the same request can't be tied
 * together, and a user reporting "it broke" gives you nothing to grep for.
 *
 * ## Where the id comes from
 *
 * Three sources, in order of preference:
 *
 * 1. **An incoming `x-request-id`.** A load balancer, CDN or reverse proxy in
 *    front of the app usually sets one; honouring it means our logs join up with
 *    theirs. This is why the value is read before it's generated.
 * 2. **`src/proxy.ts`**, for page requests, which generates one when (1) is
 *    absent and forwards it upstream so the render sees it.
 * 3. **`core/http.ts`'s `withHandler`**, for Route Handlers. It has to generate
 *    its own because **the proxy's matcher excludes `/api`** — so a Route Handler
 *    never sees a proxy-injected id.
 */
export const REQUEST_ID_HEADER = 'x-request-id'

/** Reads the id from a `Headers`, or mints one. */
export function resolveRequestId(source: Headers): string {
	return source.get(REQUEST_ID_HEADER) ?? crypto.randomUUID()
}

/**
 * The current request's id, for code that has no `Request` object to hand —
 * Server Actions and Server Components.
 *
 * Returns `undefined` rather than throwing when there is no request scope at all,
 * which is what makes `runAction` usable from a unit test. Note the
 * `unstable_rethrow`: `headers()` also throws Next's own
 * "you used a dynamic API in a static render" signal, and swallowing *that* would
 * turn a build-time diagnostic into a silently mis-rendered page.
 */
export async function currentRequestId(): Promise<string | undefined> {
	try {
		return (await headers()).get(REQUEST_ID_HEADER) ?? undefined
	} catch (error) {
		unstable_rethrow(error)
		return undefined
	}
}
