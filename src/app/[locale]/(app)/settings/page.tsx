'use client'

import {
	Card,
	Separator,
	Switch,
	ToggleButton,
	ToggleButtonGroup,
} from '@heroui/react'
import { Monitor, Moon, Sun } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { type ThemeMode, useColorMode } from '@/components/ui/color-mode'

/** Placeholder page — copy this file as the starting point for a new one. */
export default function Settings() {
	const t = useTranslations('Settings')
	const { mode, setMode, colorMode } = useColorMode()

	return (
		<div className="mx-auto max-w-180 p-4 md:p-8">
			<div className="flex flex-col gap-8">
				<div>
					<h2 className="text-2xl font-bold">{t('title')}</h2>
					<p className="text-muted mt-1 text-sm">{t('description')}</p>
				</div>

				{/* Color scheme: three states (follow the OS / light / dark) */}
				<Card>
					<Card.Content className="p-6">
						<p className="font-semibold">{t('appearance.title')}</p>
						<p className="text-muted text-xs">
							{t('appearance.current', {
								mode:
									colorMode === 'dark'
										? t('appearance.dark')
										: t('appearance.light'),
							})}
							{mode === 'auto' ? t('appearance.followingSystem') : ''}
						</p>
						<Separator className="my-4" />
						{/*
						 * selectionMode="single" with a Set — react-aria's toggle group is
						 * multi-select by default, and selectedKeys is always a collection
						 * even when only one item can be on.
						 */}
						<ToggleButtonGroup
							fullWidth
							selectionMode="single"
							disallowEmptySelection
							selectedKeys={new Set([mode])}
							onSelectionChange={(keys) => {
								const [next] = [...keys]
								if (next) setMode(next as ThemeMode)
							}}
						>
							<ToggleButton id="auto">
								<Monitor className="size-4" />
								{t('appearance.system')}
							</ToggleButton>
							<ToggleButton id="light">
								<Sun className="size-4" />
								{t('appearance.light')}
							</ToggleButton>
							<ToggleButton id="dark">
								<Moon className="size-4" />
								{t('appearance.dark')}
							</ToggleButton>
						</ToggleButtonGroup>
					</Card.Content>
				</Card>

				<Card>
					<Card.Content className="p-6">
						<p className="font-semibold">{t('notifications.title')}</p>
						<p className="text-muted text-xs">{t('notifications.note')}</p>
						<Separator className="my-4" />
						<div className="flex flex-col gap-3">
							{(['buildDone', 'deployFailed', 'weeklyDigest'] as const).map(
								(key) => (
									<Switch key={key} defaultSelected={key !== 'weeklyDigest'}>
										<Switch.Control>
											<Switch.Thumb />
										</Switch.Control>
										<Switch.Content>{t(`notifications.${key}`)}</Switch.Content>
									</Switch>
								),
							)}
						</div>
					</Card.Content>
				</Card>
			</div>
		</div>
	)
}
