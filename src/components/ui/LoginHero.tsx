/**
 * Decorative left panel for the sign-in screen: a halftone dot texture, a
 * brand mark, a couple of floating card mockups, and a headline. Nothing else
 * depends on it besides app/[locale]/(auth)/login/page.tsx — swap the whole
 * thing out when there's real brand art.
 *
 * The dot texture is a self-contained SVG (a tiled `<pattern>` behind a
 * radial-gradient `<mask>` that fades the density toward one corner) rather
 * than an image asset — no files to ship, and `currentColor` means it follows
 * the color scheme and the accent color for free.
 */

import { Chip } from '@heroui/react'
import {
	Database,
	Languages,
	Palette,
	Rocket,
	ShieldCheck,
	Sparkles,
} from 'lucide-react'
import { useTranslations } from 'next-intl'

const TAGS = [
	{ key: 'tagAuth', icon: ShieldCheck },
	{ key: 'tagDb', icon: Database },
	{ key: 'tagI18n', icon: Languages },
	{ key: 'tagTheme', icon: Palette },
] as const

export function LoginHero() {
	const t = useTranslations('LoginHero')

	return (
		<div className="bg-surface-secondary relative h-full w-full overflow-hidden rounded-2xl">
			<svg
				aria-hidden="true"
				className="absolute inset-0 h-full w-full text-foreground/35"
			>
				<defs>
					<pattern
						id="login-hero-dots"
						width="9"
						height="9"
						patternUnits="userSpaceOnUse"
					>
						<circle cx="4.5" cy="4.5" r="1.3" fill="currentColor" />
					</pattern>
					<radialGradient id="login-hero-fade" cx="15%" cy="92%" r="90%">
						<stop offset="0%" stopColor="white" stopOpacity="1" />
						<stop offset="60%" stopColor="white" stopOpacity="0.55" />
						<stop offset="100%" stopColor="white" stopOpacity="0" />
					</radialGradient>
					<mask id="login-hero-mask">
						<rect width="100%" height="100%" fill="url(#login-hero-fade)" />
					</mask>
				</defs>
				<rect
					width="100%"
					height="100%"
					fill="url(#login-hero-dots)"
					mask="url(#login-hero-mask)"
				/>
			</svg>

			{/* Brand mark */}
			<div className="absolute top-6 left-6 flex items-center gap-2">
				<div className="bg-surface flex size-9 items-center justify-center rounded-lg shadow-sm">
					<Rocket className="size-5" />
				</div>
				<span className="font-serif text-lg font-semibold tracking-wide">
					{t('brand')}
				</span>
			</div>

			{/* Floating decorative chip, top area */}
			<div
				aria-hidden="true"
				className="absolute top-24 left-10 flex items-center gap-2"
			>
				<div className="bg-surface flex size-11 items-center justify-center rounded-xl shadow-md">
					<Sparkles className="text-accent size-5" />
				</div>
				<div className="bg-accent/60 h-px w-16" />
			</div>

			{/* Main feature card */}
			<div className="bg-surface absolute inset-x-8 top-1/2 -translate-y-1/2 rounded-2xl p-5 shadow-lg md:inset-x-10">
				{/* Plain spans, not buttons: this is a static mockup, not a real tab
				    switcher — making it look interactive would mislead a11y. */}
				<div className="flex gap-2">
					<span className="bg-accent-soft text-accent-soft-foreground rounded-full px-3 py-1 text-xs font-medium">
						{t('tabPrimary')}
					</span>
					<span className="text-muted rounded-full px-3 py-1 text-xs font-medium">
						{t('tabSecondary')}
					</span>
				</div>
				<p className="mt-3 text-sm leading-relaxed">{t('cardBody')}</p>
				<div className="mt-4 flex flex-wrap gap-2">
					{TAGS.map(({ key, icon: Icon }) => (
						<Chip key={key} size="sm" variant="soft">
							<Icon className="size-3.5" />
							{t(key)}
						</Chip>
					))}
				</div>
			</div>

			{/* Floating decorative chip, bottom area */}
			<div
				aria-hidden="true"
				className="absolute right-10 bottom-36 flex items-center gap-2"
			>
				<div className="bg-accent/60 h-px w-10" />
				<div className="bg-surface flex size-11 items-center justify-center rounded-xl shadow-md">
					<ShieldCheck className="text-accent size-5" />
				</div>
			</div>

			{/* Headline */}
			<p className="absolute inset-x-8 bottom-8 font-serif text-3xl leading-tight font-normal md:text-4xl">
				{t('headlineLine1')}
				<br />
				{t('headlineLine2')}
			</p>
		</div>
	)
}
