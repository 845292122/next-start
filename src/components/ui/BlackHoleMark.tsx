import { cn } from '@heroui/react'

/**
 * The rail's brand mark: a black hole, drawn entirely in CSS.
 *
 * No JS and no image asset — three spans plus the `.blackhole*` rules in
 * app/globals.css, so it costs nothing at runtime and animates on the
 * compositor. Every color is a HeroUI token, so it inverts with the color
 * scheme instead of needing a second asset for dark mode.
 *
 * The two disks straddle the core in the stacking order (see the z-indexes in
 * globals.css), which is what makes the orbit read as depth rather than as a
 * flat spinning ellipse.
 *
 * `aria-hidden` because it carries no information the surrounding nav doesn't
 * already give — the <nav> owns the accessible label.
 */
export function BlackHoleMark({ className }: { className?: string }) {
	return (
		<div aria-hidden="true" className={cn('blackhole', className)}>
			<span className="blackhole__disk blackhole__disk--back" />
			<span className="blackhole__ring" />
			<span className="blackhole__core" />
			<span className="blackhole__disk blackhole__disk--front" />
		</div>
	)
}
