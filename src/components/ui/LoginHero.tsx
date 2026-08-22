/**
 * Decorative left panel for the sign-in screen: a halftone dot texture, a brand
 * mark, a couple of floating card mockups, and a headline. Nothing else depends on
 * it besides app/[locale]/(auth)/login/page.tsx — swap the whole thing out when
 * there's real brand art.
 *
 * The dot texture is a self-contained SVG (a tiled `<pattern>` behind a
 * radial-gradient `<mask>` that fades the density toward one corner) rather than an
 * image asset — no files to ship, and `currentColor` means it follows the colour
 * scheme for free.
 *
 * A Server Component. Tabler's icon components are plain forwardRef SVGs with no
 * context or hooks, so unlike some icon packages they need no special
 * server-safe import — the same import works here and in a Client Component.
 */

import { Badge, Box, Group, Paper, Text } from '@mantine/core'
import {
	IconDatabase,
	IconLanguage,
	IconPalette,
	IconRocket,
	IconShieldCheck,
	IconSparkle,
} from '@tabler/icons-react'
import { useTranslations } from 'next-intl'

const TAGS = [
	{ key: 'tagAuth', icon: IconShieldCheck },
	{ key: 'tagDb', icon: IconDatabase },
	{ key: 'tagI18n', icon: IconLanguage },
	{ key: 'tagTheme', icon: IconPalette },
] as const

export function LoginHero() {
	const t = useTranslations('LoginHero')

	return (
		<Paper
			radius="lg"
			bg="var(--mantine-color-default)"
			pos="relative"
			h="100%"
			w="100%"
			style={{ overflow: 'hidden' }}
		>
			<Box
				component="svg"
				aria-hidden="true"
				pos="absolute"
				inset={0}
				h="100%"
				w="100%"
				c="var(--mantine-color-text)"
				opacity={0.35}
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
			</Box>

			{/* Brand mark */}
			<Group pos="absolute" top={24} left={24} gap="xs">
				<Paper
					w={36}
					h={36}
					radius="md"
					shadow="xs"
					display="flex"
					style={{ alignItems: 'center', justifyContent: 'center' }}
				>
					<IconRocket size={20} />
				</Paper>
				<Text ff="var(--app-font-serif)" size="lg" fw={600} lts="0.03em">
					{t('brand')}
				</Text>
			</Group>

			{/* Floating decorative chip, top area */}
			<Group aria-hidden="true" pos="absolute" top={96} left={40} gap="xs">
				<Paper
					w={44}
					h={44}
					radius="md"
					shadow="md"
					display="flex"
					style={{ alignItems: 'center', justifyContent: 'center' }}
				>
					<IconSparkle size={20} color="var(--mantine-primary-color-filled)" />
				</Paper>
				<Box w={64} h={1} bg="var(--mantine-primary-color-light-color)" />
			</Group>

			{/* Main feature card */}
			<Paper
				pos="absolute"
				top="50%"
				left={{ base: 32, sm: 40 }}
				right={{ base: 32, sm: 40 }}
				radius="lg"
				shadow="lg"
				p="lg"
				// translateY rather than a flex centre: the card is absolutely
				// positioned against the panel, and `top: 50%` alone would centre its
				// top edge rather than the card.
				style={{ transform: 'translateY(-50%)' }}
			>
				{/* Plain badges, not buttons: this is a static mockup, not a real tab
				    switcher — making it look interactive would mislead a11y. */}
				<Group gap="xs">
					<Badge variant="light" radius="xl">
						{t('tabPrimary')}
					</Badge>
					<Badge variant="transparent" color="gray" radius="xl">
						{t('tabSecondary')}
					</Badge>
				</Group>
				<Text mt="sm" size="sm">
					{t('cardBody')}
				</Text>
				<Group mt="md" gap="xs">
					{TAGS.map(({ key, icon: TagIcon }) => (
						<Badge
							key={key}
							variant="light"
							color="gray"
							leftSection={<TagIcon size={12} />}
						>
							{t(key)}
						</Badge>
					))}
				</Group>
			</Paper>

			{/* Floating decorative chip, bottom area */}
			<Group aria-hidden="true" pos="absolute" right={40} bottom={144} gap="xs">
				<Box w={40} h={1} bg="var(--mantine-primary-color-light-color)" />
				<Paper
					w={44}
					h={44}
					radius="md"
					shadow="md"
					display="flex"
					style={{ alignItems: 'center', justifyContent: 'center' }}
				>
					<IconShieldCheck
						size={20}
						color="var(--mantine-primary-color-filled)"
					/>
				</Paper>
			</Group>

			{/* Headline */}
			<Text
				pos="absolute"
				left={32}
				right={32}
				bottom={32}
				ff="var(--app-font-serif)"
				fz={{ base: 30, sm: 36 }}
				lh={1.2}
			>
				{t('headlineLine1')}
				<br />
				{t('headlineLine2')}
			</Text>
		</Paper>
	)
}
