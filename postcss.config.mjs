/*
 * Mantine's PostCSS preset. Unlike Tailwind — which was one plugin and needed no
 * config at all — Mantine's CSS features are opt-in through PostCSS:
 *
 * - `light-dark(a, b)` compiles to a plain declaration plus a
 *   `[data-mantine-color-scheme='dark']` override, which is the *only* practical
 *   way to write scheme-aware CSS in a stylesheet (the attribute is written by
 *   `ColorSchemeScript` before first paint).
 * - `rem()` / `em()` convert px, and `rem()` multiplies by `--mantine-scale` so
 *   the whole UI still responds to the theme's `scale`.
 * - `@mixin hover`, `@mixin smaller-than`, `@mixin light-root` / `dark-root`.
 *
 * `postcss-simple-vars` exists purely to supply the `$mantine-breakpoint-*`
 * variables that `smaller-than` / `larger-than` accept. The values below are
 * Mantine's defaults — change them here *and* in the theme's `breakpoints`, or
 * media queries in CSS and `visibleFrom`/`hiddenFrom` in JSX will disagree.
 */
export default {
	plugins: {
		'postcss-preset-mantine': {},
		'postcss-simple-vars': {
			variables: {
				'mantine-breakpoint-xs': '36em',
				'mantine-breakpoint-sm': '48em',
				'mantine-breakpoint-md': '62em',
				'mantine-breakpoint-lg': '75em',
				'mantine-breakpoint-xl': '88em',
			},
		},
	},
}
