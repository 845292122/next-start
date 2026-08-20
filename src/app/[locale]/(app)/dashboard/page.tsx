'use client'

import {
	Alert,
	Button,
	Card,
	Chip,
	Code,
	Input,
	Label,
	ProgressBar,
	Separator,
	Slider,
	Switch,
	TextField,
	ToggleButton,
	ToggleButtonGroup,
	Tooltip,
	toast,
} from '@heroui/react'
import { Bell, Info, Layers, Palette, Zap } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'

/**
 * Dashboard — doubles as living documentation for the design system. Delete the
 * whole page when real features land; nothing else depends on it.
 *
 * Layout is plain Tailwind flex/grid: HeroUI has no layout components and no
 * size props, unlike Mantine's Stack/Group/SimpleGrid.
 */

function StatCard({
	label,
	value,
	hint,
	icon: Icon,
}: {
	label: string
	value: string
	hint: string
	icon: typeof Zap
}) {
	return (
		<Card>
			<Card.Content className="p-6">
				<div className="mb-2 flex items-start justify-between">
					<span className="text-muted text-sm font-semibold">{label}</span>
					<Icon className="text-accent size-4.5" />
				</div>
				<p className="text-[28px] leading-tight font-bold">{value}</p>
				<p className="text-muted mt-1 text-xs">{hint}</p>
			</Card.Content>
		</Card>
	)
}

/** Section shell: title + note + separator */
function Section({
	title,
	note,
	children,
}: {
	title: string
	note: string
	children: React.ReactNode
}) {
	return (
		<Card className="h-full">
			<Card.Content className="p-6">
				<p className="font-semibold">{title}</p>
				<p className="text-muted text-xs">{note}</p>
				<Separator className="my-4" />
				{children}
			</Card.Content>
		</Card>
	)
}

/**
 * HeroUI's semantic color roles. Each one is a CSS variable trio — base, its
 * readable foreground, and a low-emphasis `-soft` pair — so a theme changes all
 * of them at once. This is the counterpart to Mantine's 10-step numeric scales.
 */
const ROLES = [
	{
		key: 'accent',
		solid: 'bg-accent text-accent-foreground',
		soft: 'bg-accent-soft text-accent-soft-foreground',
	},
	{
		key: 'default',
		solid: 'bg-default text-default-foreground',
		soft: 'bg-default-soft text-default-soft-foreground',
	},
	{
		key: 'success',
		solid: 'bg-success text-success-foreground',
		soft: 'bg-success-soft text-success-soft-foreground',
	},
	{
		key: 'warning',
		solid: 'bg-warning text-warning-foreground',
		soft: 'bg-warning-soft text-warning-soft-foreground',
	},
	{
		key: 'danger',
		solid: 'bg-danger text-danger-foreground',
		soft: 'bg-danger-soft text-danger-soft-foreground',
	},
] as const

const SURFACES = [
	{ key: 'surface', className: 'bg-surface' },
	{ key: 'surface-secondary', className: 'bg-surface-secondary' },
	{ key: 'surface-tertiary', className: 'bg-surface-tertiary' },
] as const

export default function Dashboard() {
	const t = useTranslations('Dashboard')
	const [density, setDensity] = useState('comfortable')
	const [notify, setNotify] = useState(true)
	const [volume, setVolume] = useState(40)

	return (
		<div className="mx-auto max-w-290 p-4 md:p-8">
			{/* Header */}
			<div className="mb-8 flex flex-col gap-1">
				<p className="text-accent text-sm font-semibold">{t('eyebrow')}</p>
				<h1 className="text-3xl font-bold">{t('title')}</h1>
				<p className="text-muted max-w-136">
					{/* t.rich, not t: the message wraps the file path in <code> */}
					{t.rich('description', {
						code: (chunks) => <Code>{chunks}</Code>,
					})}
				</p>
			</div>

			<div className="flex flex-col gap-4">
				{/* Stat cards */}
				<div className="grid gap-4 md:grid-cols-3">
					<StatCard
						label={t('stats.layout.label')}
						value={t('stats.layout.value')}
						hint={t('stats.layout.hint')}
						icon={Layers}
					/>
					<StatCard
						label={t('stats.theme.label')}
						value={t('stats.theme.value')}
						hint={t('stats.theme.hint')}
						icon={Palette}
					/>
					<StatCard
						label={t('stats.platform.label')}
						value={t('stats.platform.value')}
						hint={t('stats.platform.hint')}
						icon={Zap}
					/>
				</div>

				{/* Semantic color roles */}
				<Section title={t('palette.title')} note={t('palette.note')}>
					<div className="flex flex-col gap-4">
						<div className="grid gap-2 sm:grid-cols-5">
							{ROLES.map((role) => (
								<div key={role.key} className="flex flex-col gap-1">
									<div
										className={`${role.solid} flex h-14 items-center justify-center rounded-lg text-xs font-medium`}
									>
										{role.key}
									</div>
									<div
										className={`${role.soft} flex h-9 items-center justify-center rounded-lg text-xs`}
									>
										soft
									</div>
								</div>
							))}
						</div>
						<div className="grid gap-2 sm:grid-cols-3">
							{SURFACES.map((surface) => (
								<div
									key={surface.key}
									className={`${surface.className} border-border flex h-12 items-center justify-center rounded-lg border font-mono text-xs`}
								>
									{surface.key}
								</div>
							))}
						</div>
					</div>
				</Section>

				<div className="grid gap-4 md:grid-cols-2">
					{/* Buttons */}
					<Section title={t('buttons.title')} note={t('buttons.note')}>
						<div className="flex flex-col gap-3">
							<div className="flex flex-wrap gap-2">
								<Button size="sm">Primary</Button>
								<Button size="sm" variant="secondary">
									Secondary
								</Button>
								<Button size="sm" variant="tertiary">
									Tertiary
								</Button>
							</div>
							<div className="flex flex-wrap gap-2">
								<Button size="sm" variant="outline">
									Outline
								</Button>
								<Button size="sm" variant="ghost">
									Ghost
								</Button>
								<Button size="sm" variant="danger">
									Danger
								</Button>
								<Button size="sm" isDisabled>
									Disabled
								</Button>
							</div>
						</div>
					</Section>

					{/* Chips and toasts */}
					<Section title={t('chips.title')} note={t('chips.note')}>
						<div className="flex flex-col gap-4">
							<div className="flex flex-wrap items-center gap-2">
								<Chip>{t('chips.default')}</Chip>
								<Chip color="success">{t('chips.live')}</Chip>
								<Chip color="danger" variant="soft">
									{t('chips.buildFailed')}
								</Chip>
								<Chip color="warning" variant="soft">
									{t('chips.archived')}
								</Chip>
							</div>
							<div className="flex flex-wrap gap-2">
								<Button
									size="sm"
									variant="secondary"
									onPress={() => toast.success(t('chips.toastSuccess'))}
								>
									<Bell className="size-4" />
									{t('chips.toastTrigger')}
								</Button>
								<Button
									size="sm"
									variant="danger-soft"
									onPress={() => toast.danger(t('chips.toastDanger'))}
								>
									{t('chips.toastDangerTrigger')}
								</Button>
							</div>
						</div>
					</Section>
				</div>

				<div className="grid gap-4 md:grid-cols-2">
					{/* Form controls */}
					<Section title={t('form.title')} note={t('form.note')}>
						<div className="flex flex-col gap-4">
							<TextField defaultValue="acme-console">
								<Label>{t('form.projectName')}</Label>
								<Input placeholder="acme-console" />
							</TextField>
							<TextField>
								<Label>{t('form.remark')}</Label>
								<Input placeholder={t('form.remarkPlaceholder')} />
							</TextField>
							<Switch isSelected={notify} onChange={setNotify}>
								<Switch.Control>
									<Switch.Thumb />
								</Switch.Control>
								<Switch.Content>{t('form.notify')}</Switch.Content>
							</Switch>
						</div>
					</Section>

					{/* Selection and progress */}
					<Section title={t('controls.title')} note={t('controls.note')}>
						<div className="flex flex-col gap-6">
							<ToggleButtonGroup
								fullWidth
								selectionMode="single"
								disallowEmptySelection
								selectedKeys={new Set([density])}
								onSelectionChange={(keys) => {
									const [next] = [...keys]
									if (next) setDensity(String(next))
								}}
							>
								<ToggleButton id="compact">
									{t('controls.compact')}
								</ToggleButton>
								<ToggleButton id="comfortable">
									{t('controls.comfortable')}
								</ToggleButton>
								<ToggleButton id="spacious">
									{t('controls.spacious')}
								</ToggleButton>
							</ToggleButtonGroup>

							<Slider
								value={volume}
								onChange={(value) => setVolume(value as number)}
								aria-label={t('controls.volumeLabel')}
							>
								<p className="mb-2 text-sm">
									{t('controls.volume', { value: volume })}
								</p>
								<Slider.Track>
									<Slider.Fill />
									<Slider.Thumb />
								</Slider.Track>
							</Slider>

							<ProgressBar value={72}>
								<p className="mb-2 text-sm">{t('controls.buildProgress')}</p>
								<ProgressBar.Track>
									<ProgressBar.Fill />
								</ProgressBar.Track>
							</ProgressBar>
						</div>
					</Section>
				</div>

				{/* Alerts and tooltips */}
				<Section title={t('surfaces.title')} note={t('surfaces.note')}>
					<div className="flex flex-col gap-4">
						{(
							['default', 'accent', 'success', 'warning', 'danger'] as const
						).map((status) => (
							<Alert key={status} status={status}>
								<Alert.Indicator>
									<Info className="size-4.5" />
								</Alert.Indicator>
								<Alert.Content>
									<Alert.Title>
										{t('surfaces.alertTitle', { status })}
									</Alert.Title>
									<Alert.Description>
										{t('surfaces.alertBody')}
									</Alert.Description>
								</Alert.Content>
							</Alert>
						))}
						<div className="flex gap-2">
							<Tooltip delay={200}>
								<Button size="sm" variant="outline">
									{t('surfaces.tooltipTrigger')}
								</Button>
								<Tooltip.Content showArrow>
									{t('surfaces.tooltipBody')}
								</Tooltip.Content>
							</Tooltip>
						</div>
					</div>
				</Section>
			</div>
		</div>
	)
}
