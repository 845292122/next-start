'use client'

import { AlertDialog, Button, Tooltip } from '@heroui/react'
import { LogOut } from 'lucide-react'
import { signOut } from 'next-auth/react'
import { useTranslations } from 'next-intl'

/**
 * The rail's sign-out control: an icon button that asks for confirmation
 * before ending the session.
 *
 * AlertDialog rather than Modal — react-aria gives it `role="alertdialog"` and
 * moves focus to it on open, which is the right semantics for a destructive
 * confirmation.
 */
export function SignOutButton() {
	const t = useTranslations('Account')

	return (
		<AlertDialog>
			{/*
			 * A styled Button rather than AlertDialog.Trigger: that component
			 * renders a plain div, so it would carry no button semantics and no
			 * keyboard activation. HeroUI's Button is built on the react-aria
			 * primitive the dialog looks for, so it still opens it.
			 */}
			<Tooltip delay={300}>
				<Button variant="ghost" isIconOnly aria-label={t('signOut')}>
					<LogOut className="size-4.5" />
				</Button>
				<Tooltip.Content placement="right">{t('signOut')}</Tooltip.Content>
			</Tooltip>

			<AlertDialog.Backdrop>
				<AlertDialog.Container size="sm">
					<AlertDialog.Dialog>
						<AlertDialog.Header>
							<AlertDialog.Heading>{t('signOutTitle')}</AlertDialog.Heading>
						</AlertDialog.Header>
						<AlertDialog.Body>{t('signOutBody')}</AlertDialog.Body>
						<AlertDialog.Footer>
							{/*
							 * slot="close" rather than AlertDialog.CloseTrigger: that
							 * component renders HeroUI's small "×" icon button, not a
							 * labelled one, and nesting a Button inside it leaves the
							 * dialog open because the inner button swallows the press.
							 * react-aria closes the dialog for any button carrying this
							 * slot, so a normal Button is all that's needed.
							 */}
							<Button variant="ghost" slot="close">
								{t('cancel')}
							</Button>
							<Button
								variant="danger"
								// redirectTo is unprefixed on purpose — the proxy resolves it
								// to the active locale.
								onPress={() => signOut({ redirectTo: '/login' })}
							>
								{t('signOutConfirm')}
							</Button>
						</AlertDialog.Footer>
					</AlertDialog.Dialog>
				</AlertDialog.Container>
			</AlertDialog.Backdrop>
		</AlertDialog>
	)
}
