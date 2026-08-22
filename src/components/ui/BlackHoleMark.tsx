import { Box, type BoxProps } from '@mantine/core'
import classes from './BlackHoleMark.module.css'

/**
 * The rail's brand mark: a black hole, drawn entirely in CSS.
 *
 * No JS and no image asset — four spans plus `BlackHoleMark.module.css`, so it
 * costs nothing at runtime and animates on the compositor. Every colour is a
 * Mantine CSS variable, so it inverts with the colour scheme instead of needing a
 * second asset for dark mode.
 *
 * The two disks straddle the core in the stacking order (see the z-indexes in the
 * stylesheet), which is what makes the orbit read as depth rather than as a flat
 * spinning ellipse.
 *
 * `aria-hidden` because it carries no information the surrounding nav doesn't
 * already give — the <nav> owns the accessible label.
 */
export function BlackHoleMark({
	size = 48,
	...others
}: { size?: number } & BoxProps) {
	// A Box, so callers can pass Mantine style props (`mb="xl"`) instead of this
	// component having to grow a prop per layout need. `size` stays explicit
	// because the mark is square by definition and the mask percentages assume it.
	return (
		<Box
			aria-hidden="true"
			className={classes.root}
			w={size}
			h={size}
			{...others}
		>
			<span className={`${classes.disk} ${classes.diskBack}`} />
			<span className={classes.ring} />
			<span className={classes.core} />
			<span className={`${classes.disk} ${classes.diskFront}`} />
		</Box>
	)
}
