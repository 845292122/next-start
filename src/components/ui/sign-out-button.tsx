'use client'

import { ActionIcon, Button, Group, Modal, Text, Tooltip } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { IconLogout } from '@tabler/icons-react'
import { signOut } from 'next-auth/react'

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
	const [opened, { open, close }] = useDisclosure(false)

	return (
		<>
			<Tooltip label="退出登录" position="right" openDelay={300}>
				<ActionIcon
					variant="subtle"
					color="gray"
					size="lg"
					aria-label="退出登录"
					onClick={open}
				>
					<IconLogout size={18} />
				</ActionIcon>
			</Tooltip>

			<Modal
				opened={opened}
				onClose={close}
				title="确认退出登录？"
				size="sm"
				centered
				// Mantine's close button carries no default aria-label — an icon-only
				// button with none is a critical a11y violation. Caught by
				// e2e/a11y.e2e.ts, which opens this exact modal.
				closeButtonProps={{ 'aria-label': '关闭' }}
			>
				<Text size="sm" c="dimmed">
					退出后需要重新用手机号和验证码登录。
				</Text>
				<Group justify="flex-end" mt="lg">
					<Button variant="default" onClick={close}>
						取消
					</Button>
					<Button color="red" onClick={() => signOut({ redirectTo: '/login' })}>
						确认退出
					</Button>
				</Group>
			</Modal>
		</>
	)
}
