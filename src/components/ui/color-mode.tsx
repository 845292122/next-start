'use client'

/**
 * Light/dark helpers on top of Mantine's colour-scheme hooks.
 *
 * Three states are kept: light / dark / auto (auto follows the OS). The API
 * matches the file of the same name in the sibling templates so code can be moved
 * between them — only the implementation underneath changes.
 */

import {
	ActionIcon,
	Tooltip,
	useComputedColorScheme,
	useMantineColorScheme,
} from '@mantine/core'
import { IconMoon, IconSun } from '@tabler/icons-react'

export type ColorMode = 'light' | 'dark'
/** What the user picked; auto means "follow the OS". */
export type ThemeMode = 'light' | 'dark' | 'auto'

export interface UseColorModeReturn {
	/** The mode actually in effect (auto is resolved to light or dark). */
	colorMode: ColorMode
	/** The mode the user picked, which may be auto. */
	mode: ThemeMode
	setMode: (mode: ThemeMode) => void
	setColorMode: (mode: ColorMode) => void
	toggleColorMode: () => void
}

export function useColorMode(): UseColorModeReturn {
	const { colorScheme, setColorScheme } = useMantineColorScheme()
	/*
	 * The resolved scheme, never 'auto'. Two reasons it needs its own hook rather
	 * than reading `colorScheme`:
	 *
	 *  - 'auto' can only be resolved against `prefers-color-scheme`, which the
	 *    server cannot see. `useComputedColorScheme` returns the default on the
	 *    first render and re-reads the media query in an effect, which is what
	 *    keeps the markup and the first client render in agreement.
	 *  - 'light' as that default matches the static `data-mantine-color-scheme`
	 *    that `mantineHtmlProps` puts on <html>, so the two can't disagree.
	 */
	const colorMode = useComputedColorScheme('light')

	return {
		colorMode,
		mode: colorScheme,
		setMode: setColorScheme,
		setColorMode: setColorScheme,
		// Off the *computed* scheme: toggling while on 'auto' has to flip away from
		// whatever the OS is currently showing, and `colorScheme` is the literal
		// string 'auto' there. (Mantine's own `toggleColorScheme` does the same
		// thing — it's spelled out because this hook's contract is the three-state
		// one and the two-state toggle is derived from it.)
		toggleColorMode: () =>
			setColorScheme(colorMode === 'dark' ? 'light' : 'dark'),
	}
}

export function useColorModeValue<T>(light: T, dark: T) {
	const { colorMode } = useColorMode()
	return colorMode === 'dark' ? dark : light
}

export function ColorModeIcon() {
	const { colorMode } = useColorMode()
	return colorMode === 'dark' ? <IconMoon size={18} /> : <IconSun size={18} />
}

/** The light/dark toggle that sits at the bottom of the rail. */
export function ColorModeButton() {
	const { colorMode, toggleColorMode } = useColorMode()
	const next = colorMode === 'dark' ? '浅色' : '深色'

	// The *label* legitimately differs between the server render and the first
	// client one: the server always renders the light-mode wording and the OS may
	// resolve to dark. Rendering the button only after mount would make the rail
	// jump, so the label is left to settle instead — it's an aria/tooltip string,
	// not layout.
	return (
		<Tooltip label={`切换到${next}`} position="right" openDelay={300}>
			<ActionIcon
				variant="subtle"
				color="gray"
				size="lg"
				aria-label={`切换到${next}模式`}
				onClick={toggleColorMode}
			>
				<ColorModeIcon />
			</ActionIcon>
		</Tooltip>
	)
}
