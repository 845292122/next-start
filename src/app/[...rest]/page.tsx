import { notFound } from 'next/navigation'

/**
 * Catch-all for unmatched URLs. Without it, Next resolves an unmatched path
 * against nothing and renders its own built-in 404 instead of
 * app/not-found.tsx — confirmed by e2e/shell.e2e.ts, not a guess: removing this
 * file (there being no more `[locale]` segment to blame) still breaks that test.
 */
export default function CatchAllPage(): never {
	notFound()
}
