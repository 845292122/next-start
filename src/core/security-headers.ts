/**
 * Security response headers, in one place so the values can be unit tested
 * rather than eyeballed in a config file.
 *
 * Split across two delivery mechanisms, because they need different things:
 *
 * - **`next.config.ts`'s `headers()`** carries everything with a fixed value. It
 *   applies to *every* response, including `/api/*` and static assets — which the
 *   proxy's matcher deliberately excludes.
 * - **`src/proxy.ts`** carries the Content-Security-Policy, because it needs a
 *   fresh nonce per request and only the proxy can mint one.
 */

/**
 * Directives that need no nonce.
 *
 * `connect-src 'self'` is what allows Server Action calls (they POST back to the
 * page's own origin) and SWR's fetches. Widen it if you call a third-party API
 * from the browser.
 */
const STATIC_CSP_DIRECTIVES = [
	"default-src 'self'",
	"img-src 'self' blob: data:",
	"font-src 'self'",
	"connect-src 'self'",
	"object-src 'none'",
	"base-uri 'self'",
	// Restricts where forms may submit. Server Actions post to the same origin, so
	// 'self' is enough.
	"form-action 'self'",
	// The modern replacement for X-Frame-Options. Both are sent: this one wins
	// where it's supported, the other covers what doesn't.
	"frame-ancestors 'none'",
]

/**
 * Builds the CSP header value for one request.
 *
 * Three things here are load-bearing and easy to get wrong:
 *
 * 1. **Scripts are strict; styles are not.** `script-src` is nonce +
 *    `'strict-dynamic'`, which is the part that actually stops injected script
 *    from executing. `style-src` settles for `'unsafe-inline'`, and that is a
 *    deliberate trade rather than laziness — see the block below.
 * 2. **`'unsafe-eval'` in development only.** React uses `eval` in dev to
 *    reconstruct server-side error stacks in the browser. Production needs
 *    nothing of the sort — but note that **zod would otherwise need it in
 *    production too**, which is why `core/zod-config.ts` exists.
 * 3. **`upgrade-insecure-requests` is production-only.** Over plain http on
 *    localhost it rewrites dev requests to https and breaks them.
 *
 * ## Why `style-src` isn't nonce-based
 *
 * Mantine styles a lot of things through the `style` **attribute** rather than a
 * class: floating-ui writes every popover, tooltip and menu position there, and so
 * do `Progress` widths, `Slider` fills and every `Transition`. **A nonce can never
 * apply to an attribute** — it is a property of an element — so no amount of
 * nonce-plumbing covers this.
 *
 * The CSP spec then closes the obvious workaround: **when a directive contains a
 * nonce or a hash, `'unsafe-inline'` is ignored.** So `style-src` cannot be "nonce
 * for our `<style>` elements, `'unsafe-inline'` for the attributes" — within one
 * directive it's one or the other.
 *
 * That leaves three options, and this file takes the third:
 *
 * - **nonce only** → every inline `style` attribute is refused. Popovers stack at
 *   the top-left corner, sliders lose their fill. Loud, but comprehensively
 *   broken.
 * - **`style-src 'nonce-…'` plus `style-src-attr 'unsafe-inline'`** → the strictest
 *   arrangement that renders correctly, since `style-src-attr` is a separate
 *   directive with its own list. It fails on the *other* kind of inline style:
 *   `react-remove-scroll` (a Mantine dependency, used by `Modal` and `Drawer`)
 *   creates a `<style>` element in the browser to lock body scroll. It reads its
 *   nonce from `get-nonce`'s module-level `setNonce()`, which Mantine never calls,
 *   so that element is refused — and the symptom is that the page scrolls behind
 *   an open modal, which is easy to miss.
 * - **`'unsafe-inline'` for styles only** → what's here. Injected CSS can deface a
 *   page and exfiltrate some attribute values via selectors; it cannot execute
 *   script. Given `script-src` stays strict, this is the smaller risk, and it
 *   doesn't rot.
 *
 * `MantineProvider` is still handed a `getStyleNonce` (see
 * `components/providers/AppProviders.tsx`) so the one `<style>` element this app
 * *does* control carries the nonce. That has no effect under the policy above — it
 * exists so tightening `style-src` stays a one-line change here.
 *
 * `e2e/security.e2e.ts` asserts the app produces **no** CSP violations under the
 * production policy, so if this ever needs revisiting the test says so.
 */
export function buildContentSecurityPolicy({
	nonce,
	isDev,
}: {
	nonce: string
	isDev: boolean
}): string {
	const directives = [
		...STATIC_CSP_DIRECTIVES,
		// 'strict-dynamic' lets a nonce-approved script load further scripts, which
		// is how Next's runtime loads page chunks. Without it every chunk URL would
		// have to be allow-listed.
		`script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}`,
		// Same value in both environments — see the long note above on why this
		// isn't nonce-based. The deciding factor is inline `style` attributes, which
		// Mantine writes constantly (popover positioning, slider fills, progress
		// widths) and which nonces never apply to.
		"style-src 'self' 'unsafe-inline'",
	]

	if (!isDev) directives.push('upgrade-insecure-requests')

	return directives.join('; ')
}

/**
 * The fixed-value headers, for `next.config.ts`.
 *
 * `isDev` gates HSTS rather than the value being constant: telling a browser to
 * pin `localhost` to https is a **one-way trip**, and it breaks `bun run dev`
 * until the pin is manually cleared in browser settings. Browsers ignore HSTS
 * over plain http anyway, so nothing is lost by omitting it in development, and a
 * real footgun is avoided.
 *
 * No `preload` on HSTS on purpose: that means submitting the domain to a list
 * baked into browsers, which is slow and painful to reverse. Opt in deliberately
 * once you're sure, don't inherit it from a template.
 */
export function buildStaticSecurityHeaders({ isDev }: { isDev: boolean }) {
	const headers = [
		// Stops a browser from second-guessing Content-Type. Matters most for the
		// JSON that Route Handlers return: sniffed as HTML, a crafted response body
		// becomes a scripting vector.
		{ key: 'X-Content-Type-Options', value: 'nosniff' },
		// Send the full URL to ourselves, only the origin cross-site, nothing when
		// downgrading to http. Paths in this app can identify a resource, so they
		// shouldn't leak to third parties in a Referer.
		{ key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
		// Superseded by CSP's frame-ancestors, kept for browsers that lack it — and
		// for /api responses, which the proxy (and therefore the CSP) skips.
		{ key: 'X-Frame-Options', value: 'DENY' },
		// Deny features nothing here uses. An empty allowlist is the whole point:
		// this is a default-deny, so a future feature has to opt in explicitly.
		{
			key: 'Permissions-Policy',
			value: 'camera=(), microphone=(), geolocation=(), payment=()',
		},
		// Severs the window.opener link, so a page this app opens can't reach back
		// into it.
		{ key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
	]

	if (!isDev) {
		headers.push({
			key: 'Strict-Transport-Security',
			value: 'max-age=31536000; includeSubDomains',
		})
	}

	return headers
}
