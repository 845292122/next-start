'use client'

import { Avatar, Button, Dropdown, Tooltip } from '@heroui/react'
import { LogOut } from 'lucide-react'
import { signOut, useSession } from 'next-auth/react'
import { useTranslations } from 'next-intl'

/**
 * The signed-in user's avatar at the bottom of the rail, with sign-out.
 *
 * The session comes from useSession() rather than a prop: AppProviders already
 * seeds SessionProvider with the server-rendered session, so this reads the same
 * value without every layout in between having to pass it down.
 */
export function AccountMenu() {
	const t = useTranslations('Account')
	const { data: session } = useSession()

	const email = session?.user?.email ?? ''
	const name = session?.user?.name ?? email
	// Latin initials read better uppercased; a CJK name's first character is
	// already the right thing to show.
	const initial = name.slice(0, 1).toUpperCase() || '?'

	return (
		<Dropdown>
			{/* A styled Button rather than Dropdown.Trigger — see locale-switch.tsx */}
			<Tooltip delay={300}>
				<Button
					variant="ghost"
					isIconOnly
					className="rounded-full"
					aria-label={t('label')}
				>
					<Avatar size="sm">
						<Avatar.Fallback>{initial}</Avatar.Fallback>
					</Avatar>
				</Button>
				<Tooltip.Content placement="right">
					{name || t('label')}
				</Tooltip.Content>
			</Tooltip>
			<Dropdown.Popover placement="right bottom">
				<Dropdown.Menu aria-label={t('label')}>
					{/* isDisabled: this row is the identity readout, not an action. */}
					<Dropdown.Item id="identity" isDisabled textValue={email}>
						<span className="flex flex-col">
							<span className="font-medium">{name}</span>
							{email && email !== name && (
								<span className="text-muted text-xs">{email}</span>
							)}
						</span>
					</Dropdown.Item>
					<Dropdown.Item
						id="sign-out"
						textValue={t('signOut')}
						// callbackUrl is absolute-from-root and unprefixed; the proxy
						// resolves it to the current locale.
						onAction={() => signOut({ redirectTo: '/login' })}
					>
						<LogOut className="size-4" />
						{t('signOut')}
					</Dropdown.Item>
				</Dropdown.Menu>
			</Dropdown.Popover>
		</Dropdown>
	)
}
