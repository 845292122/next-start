'use client'

/**
 * Light/dark helpers on top of next-themes.
 *
 * Three states are kept: light / dark / auto (auto follows the OS). The API
 * matches the file of the same name in the sibling templates so code can be
 * moved between them — only the implementation underneath changes.
 */

import { Button, Tooltip } from '@heroui/react'
import { Moon, Sun } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useTheme } from 'next-themes'

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

// next-themes spells the follow-the-OS option "system"; the API above calls it
// "auto". Translating at this boundary keeps every call site on one vocabulary.
function toThemeMode(theme: string | undefined): ThemeMode {
	return theme === 'system' || theme === undefined
		? 'auto'
		: (theme as ThemeMode)
}

export function useColorMode(): UseColorModeReturn {
	const { theme, resolvedTheme, setTheme } = useTheme()

	// resolvedTheme is undefined until next-themes has read the DOM on the
	// client. Defaulting to light keeps the first render deterministic, which is
	// what the blocking script in <head> has already made true anyway.
	const colorMode: ColorMode = resolvedTheme === 'dark' ? 'dark' : 'light'

	return {
		colorMode,
		mode: toThemeMode(theme),
		setMode: (next) => setTheme(next === 'auto' ? 'system' : next),
		setColorMode: setTheme,
		toggleColorMode: () => setTheme(colorMode === 'dark' ? 'light' : 'dark'),
	}
}

export function useColorModeValue<T>(light: T, dark: T) {
	const { colorMode } = useColorMode()
	return colorMode === 'dark' ? dark : light
}

export function ColorModeIcon() {
	const { colorMode } = useColorMode()
	return colorMode === 'dark' ? (
		<Moon className="size-4.5" />
	) : (
		<Sun className="size-4.5" />
	)
}

/** The light/dark toggle that sits at the bottom of the rail. */
export function ColorModeButton() {
	const t = useTranslations('ColorMode')
	const { colorMode, toggleColorMode } = useColorMode()
	const next = colorMode === 'dark' ? t('light') : t('dark')

	// suppressHydrationWarning is not enough for the *label*: the server renders
	// the light-mode wording and next-themes may resolve to dark, so the tooltip
	// text differs on the first client render. Rendering the button only after
	// mount would make the rail jump, so the label is left to settle instead —
	// it's an aria/tooltip string, not layout.
	return (
		<Tooltip delay={300}>
			<Button
				variant="ghost"
				isIconOnly
				aria-label={t('switchToAria', { mode: next })}
				onPress={toggleColorMode}
			>
				<ColorModeIcon />
			</Button>
			<Tooltip.Content placement="right">
				{t('switchTo', { mode: next })}
			</Tooltip.Content>
		</Tooltip>
	)
}
