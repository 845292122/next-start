import { notFound } from 'next/navigation'

/**
 * Catch-all for unmatched locale-prefixed URLs. Without it, Next resolves an
 * unmatched path against the (missing) root app/not-found.tsx and renders its
 * built-in 404 instead of app/[locale]/not-found.tsx.
 */
export default function CatchAllPage(): never {
	notFound()
}
