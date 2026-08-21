import { sql } from 'drizzle-orm'
import { db } from '@/core/db/client'
import { withHandler } from '@/core/http'

/**
 * Health check for a container orchestrator, load balancer or uptime monitor.
 *
 * Also the template's smallest example of the **external-consumer** Route Handler
 * path (see AGENTS.md): nothing inside the app calls this, and the caller isn't a
 * browser.
 *
 * Deliberately **unauthenticated** — whatever probes this has no session — so it
 * must not leak anything. Hence a fixed shape: status, and nothing about
 * versions, paths, or why a failure happened. The reason goes to the log.
 *
 * `force-dynamic` because the whole point is to run the check now. Without it a
 * route with no request-time inputs can be answered from cache, which would make
 * a dead database report as healthy.
 */
export const dynamic = 'force-dynamic'

export const GET = withHandler(async () => {
	// A real query, not just "the process is up": this is what separates a
	// readiness check from a liveness one. `select 1` is enough to prove the driver
	// can open the file and round-trip a statement.
	//
	// A failure here becomes a 500 `{ error: 'INTERNAL' }` with the real reason in
	// the log — which is exactly the right behaviour for a probe. `withHandler`
	// also puts the request id on the response, so there's nothing to add here.
	await db.run(sql`select 1`)

	return Response.json({ status: 'ok' })
})
