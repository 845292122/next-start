import { describe, expect, test } from 'bun:test'
import {
	buildContentSecurityPolicy,
	buildStaticSecurityHeaders,
} from '@/core/security-headers'

function csp(isDev: boolean) {
	return buildContentSecurityPolicy({ nonce: 'TESTNONCE', isDev })
}

function directive(policy: string, name: string) {
	return policy
		.split('; ')
		.find((part) => part === name || part.startsWith(`${name} `))
}

describe('buildContentSecurityPolicy', () => {
	test('carries the nonce for scripts', () => {
		// Next parses the nonce back out of this header to tag its own scripts, so
		// the `nonce-` spelling is load-bearing, not cosmetic.
		expect(directive(csp(false), 'script-src')).toContain("'nonce-TESTNONCE'")
	})

	test('allows inline styles, and carries no nonce for them', () => {
		// Deliberate, and the two halves are inseparable. Mantine positions every
		// overlay through inline `style` attributes, which a nonce can never cover,
		// and the CSP spec says a directive containing a nonce *ignores*
		// 'unsafe-inline' — so adding a nonce here would refuse all of them. The
		// long note in security-headers.ts has the full reasoning.
		const styleSrc = directive(csp(false), 'style-src')

		expect(styleSrc).toBe("style-src 'self' 'unsafe-inline'")
		expect(styleSrc).not.toContain('nonce-')
	})

	test('the script policy stays strict, which is the part that matters', () => {
		// The trade above is only acceptable because this one holds: injected CSS
		// can deface a page, injected script owns it.
		const scriptSrc = directive(csp(false), 'script-src') ?? ''

		expect(scriptSrc).toContain("'nonce-TESTNONCE'")
		expect(scriptSrc).toContain("'strict-dynamic'")
		expect(scriptSrc).not.toContain("'unsafe-inline'")
		expect(scriptSrc).not.toContain("'unsafe-eval'")
	})

	test("'unsafe-eval' is development-only", () => {
		// React needs it in dev to rebuild server stacks in the browser. Shipping it
		// to production would undo much of the point of the policy.
		expect(csp(true)).toContain("'unsafe-eval'")
		expect(csp(false)).not.toContain("'unsafe-eval'")
	})

	test('upgrade-insecure-requests is production-only', () => {
		// On plain http://localhost it would rewrite dev requests to https.
		expect(csp(false)).toContain('upgrade-insecure-requests')
		expect(csp(true)).not.toContain('upgrade-insecure-requests')
	})

	test('locks down the dangerous defaults', () => {
		const policy = csp(false)

		expect(directive(policy, 'default-src')).toBe("default-src 'self'")
		expect(directive(policy, 'object-src')).toBe("object-src 'none'")
		expect(directive(policy, 'base-uri')).toBe("base-uri 'self'")
		expect(directive(policy, 'frame-ancestors')).toBe("frame-ancestors 'none'")
		expect(directive(policy, 'form-action')).toBe("form-action 'self'")
	})

	test('allows same-origin fetches, which Server Actions need', () => {
		// Server Action calls POST back to the page's own origin. A missing
		// connect-src would fall through to default-src, but it's stated explicitly
		// so widening it for a third-party API is an obvious edit.
		expect(directive(csp(false), 'connect-src')).toBe("connect-src 'self'")
	})
})

describe('buildStaticSecurityHeaders', () => {
	function headerMap(isDev: boolean) {
		return new Map(
			buildStaticSecurityHeaders({ isDev }).map((h) => [h.key, h.value]),
		)
	}

	test('sets nosniff, which matters most for JSON routes', () => {
		expect(headerMap(false).get('X-Content-Type-Options')).toBe('nosniff')
	})

	test('HSTS is production-only', () => {
		// Not a style choice: pinning `localhost` to https is a one-way trip that
		// breaks `bun run dev` until the pin is cleared in browser settings.
		expect(headerMap(false).get('Strict-Transport-Security')).toContain(
			'max-age=',
		)
		expect(headerMap(true).has('Strict-Transport-Security')).toBe(false)
	})

	test('HSTS does not claim preload', () => {
		// Preload means submitting the domain to a list baked into browsers, which is
		// painful to reverse. It should be a deliberate decision, not inherited.
		expect(headerMap(false).get('Strict-Transport-Security')).not.toContain(
			'preload',
		)
	})

	test('denies framing for browsers without frame-ancestors', () => {
		// Also the only clickjacking protection on /api responses, which the proxy —
		// and therefore the CSP — skips.
		expect(headerMap(false).get('X-Frame-Options')).toBe('DENY')
	})

	test('permissions policy is default-deny', () => {
		const value = headerMap(false).get('Permissions-Policy') ?? ''
		expect(value).toContain('camera=()')
		expect(value).toContain('geolocation=()')
	})

	test('every value is a non-empty string', () => {
		// A header sent with an empty value is worse than not sending it — some
		// proxies drop it, others forward it and browsers ignore the directive.
		for (const { key, value } of buildStaticSecurityHeaders({ isDev: false })) {
			expect(value.length, `${key} must have a value`).toBeGreaterThan(0)
		}
	})
})
