/**
 * Placeholder illustration for the sign-in page — a line-art figure, a few
 * sparkles and a potted plant.
 *
 * Everything is drawn with `currentColor`, so it inverts with the color scheme
 * for free: set `color` on the wrapper (or let it inherit the page's
 * `--foreground`) and the outlines follow. The "white" areas use HeroUI's
 * `--surface` token rather than a literal white for the same reason.
 *
 * Swap the whole thing for a real asset when there is one; nothing else depends
 * on it besides app/[locale]/(auth)/login/page.tsx.
 */

const OUTLINE = 3

/** Four-pointed sparkle: quadratics through the center pinch the sides in. */
function sparkle(cx: number, cy: number, r: number) {
	return [
		`M${cx} ${cy - r}`,
		`Q${cx} ${cy} ${cx + r} ${cy}`,
		`Q${cx} ${cy} ${cx} ${cy + r}`,
		`Q${cx} ${cy} ${cx - r} ${cy}`,
		`Q${cx} ${cy} ${cx} ${cy - r}`,
		'Z',
	].join(' ')
}

export function SignInArt({ label }: { label: string }) {
	return (
		<svg
			viewBox="0 0 320 440"
			role="img"
			aria-label={label}
			/*
			 * Fills whatever box the parent gives it. Both dimensions are 100% on
			 * purpose: the default preserveAspectRatio letterboxes the drawing
			 * inside, so a short viewport shrinks it instead of overflowing.
			 */
			style={{ width: '100%', height: '100%', display: 'block' }}
		>
			{/* Potted plant, kept faint so it reads as background */}
			<g fill="currentColor" opacity={0.16}>
				<ellipse
					cx={54}
					cy={306}
					rx={13}
					ry={30}
					transform="rotate(-26 54 306)"
				/>
				<ellipse
					cx={30}
					cy={330}
					rx={12}
					ry={27}
					transform="rotate(-58 30 330)"
				/>
				<ellipse
					cx={80}
					cy={330}
					rx={12}
					ry={27}
					transform="rotate(34 80 330)"
				/>
				<ellipse
					cx={44}
					cy={352}
					rx={11}
					ry={24}
					transform="rotate(-14 44 352)"
				/>
				<ellipse
					cx={70}
					cy={356}
					rx={10}
					ry={22}
					transform="rotate(22 70 356)"
				/>
				<path d="M16 372 h76 l-11 50 c-1 6 -6 10 -13 10 h-28 c-7 0 -12 -4 -13 -10 z" />
			</g>

			{/* Sparkles above the raised hand */}
			<g fill="currentColor">
				<path d={sparkle(258, 44, 26)} />
				<path d={sparkle(222, 26, 13)} />
				<path d={sparkle(288, 78, 9)} />
			</g>

			{/* Figure */}
			<g
				stroke="currentColor"
				strokeWidth={OUTLINE}
				strokeLinecap="round"
				strokeLinejoin="round"
			>
				{/* Trousers — solid, drawn before the shirt so the hem overlaps them */}
				<path
					fill="currentColor"
					d="M126 244 C122 300 128 350 134 396 L164 396 C166 340 167 296 169 244 Z"
				/>
				<path
					fill="currentColor"
					d="M175 244 C177 296 178 340 180 396 L210 396 C217 350 221 300 217 244 Z"
				/>
				{/* Torn knees */}
				<ellipse
					cx={145}
					cy={318}
					rx={13}
					ry={9}
					fill="var(--surface)"
					strokeWidth={0}
					transform="rotate(-8 145 318)"
				/>
				<ellipse
					cx={198}
					cy={318}
					rx={13}
					ry={9}
					fill="var(--surface)"
					strokeWidth={0}
					transform="rotate(8 198 318)"
				/>

				{/* Shoes */}
				<rect
					x={110}
					y={396}
					width={56}
					height={24}
					rx={12}
					fill="var(--surface)"
				/>
				<rect
					x={178}
					y={396}
					width={56}
					height={24}
					rx={12}
					fill="var(--surface)"
				/>

				{/* Hair, behind the face and shoulders */}
				<path
					fill="currentColor"
					strokeWidth={0}
					d="M170 48 a38 38 0 0 1 38 38 v34 c0 16 9 26 9 42 h-94 c0 -16 9 -26 9 -42 v-34 a38 38 0 0 1 38 -38 z"
				/>

				{/* Shirt */}
				<path
					fill="var(--surface)"
					d="M146 128 C128 134 118 156 114 184 L108 230 C106 242 114 250 126 250 L214 250 C226 250 234 242 232 230 L226 184 C222 156 212 134 194 128 Z"
				/>

				{/* Raised arm: outline stroke first, sleeve fill on top */}
				<path
					fill="none"
					stroke="currentColor"
					strokeWidth={24}
					d="M202 138 C228 134 248 114 252 88"
				/>
				<path
					fill="none"
					stroke="var(--surface)"
					strokeWidth={18}
					d="M202 138 C228 134 248 114 252 88"
				/>
				{/* Hand on the hip: same two-pass trick */}
				<path
					fill="none"
					stroke="currentColor"
					strokeWidth={24}
					d="M140 140 C120 158 116 186 126 206"
				/>
				<path
					fill="none"
					stroke="var(--surface)"
					strokeWidth={18}
					d="M140 140 C120 158 116 186 126 206"
				/>
				<circle
					cx={254}
					cy={74}
					r={12}
					fill="var(--surface)"
					stroke="currentColor"
					strokeWidth={OUTLINE}
				/>

				{/* Face */}
				<ellipse cx={170} cy={92} rx={25} ry={28} fill="var(--surface)" />
				<g fill="none" strokeWidth={2.5}>
					<path d="M156 89 Q161 83 166 89" />
					<path d="M174 89 Q179 83 184 89" />
					<path d="M163 103 Q170 110 177 103" />
				</g>
			</g>
		</svg>
	)
}
