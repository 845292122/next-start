'use client'

import { ActionIcon, Button, Group, Modal, Text, Tooltip } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { IconLogout } from '@tabler/icons-react'
import { signOut } from 'next-auth/react'
import { useTranslations } from 'next-intl'

/**
 * The rail's sign-out control: an icon button that asks for confirmation before
 * ending the session.
 *
 * A `Modal` with an explicit title, which is what gives it `aria-labelledby` and
 * moves focus inside on open. Mantine has no `role="alertdialog"` variant — the
 * distinction buys little here, since the destructive action is a labelled button
 * inside a modal the user just opened, and `alertdialog` mainly matters for alerts
 * the *app* raises unprompted.
 */
export function SignOutButton() {
	const t = useTranslations('Account')
	const [opened, { open, close }] = useDisclosure(false)

	return (
		<>
			<Tooltip label={t('signOut')} position="right" openDelay={300}>
				<ActionIcon
					variant="subtle"
					color="gray"
					size="lg"
					aria-label={t('signOut')}
					onClick={open}
				>
					<IconLogout size={18} />
				</ActionIcon>
			</Tooltip>

			<Modal
				opened={opened}
				onClose={close}
				title={t('signOutTitle')}
				size="sm"
				centered
			>
				<Text size="sm" c="dimmed">
					{t('signOutBody')}
				</Text>
				<Group justify="flex-end" mt="lg">
					<Button variant="default" onClick={close}>
						{t('cancel')}
					</Button>
					<Button
						color="red"
						// redirectTo is unprefixed on purpose — the proxy resolves it to the
						// active locale.
						onClick={() => signOut({ redirectTo: '/login' })}
					>
						{t('signOutConfirm')}
					</Button>
				</Group>
			</Modal>
		</>
	)
}
