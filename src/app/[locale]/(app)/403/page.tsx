import { buttonVariants, Heading, Paragraph } from '@heroui/react'
import { Lock } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'

/**
 * Nothing redirects here yet: the (app) layout's guard covers "not signed in",
 * and there is no role model to fail. This is the page a role check should send
 * an authenticated-but-unauthorized user to.
 */
export default async function NoPermission() {
	const t = await getTranslations('Errors')

	return (
		<div className="flex min-h-[60vh] items-center justify-center p-6">
			<div className="flex max-w-100 flex-col items-center gap-4 text-center">
				<div className="bg-danger-soft text-danger-soft-foreground flex size-18 items-center justify-center rounded-full">
					<Lock className="size-9" />
				</div>
				<Heading level={1}>403</Heading>
				<Paragraph className="text-muted">{t('forbidden')}</Paragraph>
				{/*
				 * HeroUI's Button is a <button> and takes no href — buttonVariants() is
				 * the escape hatch for giving something else the same look. The Link has
				 * to be the locale-aware one from @/i18n/navigation, and it prefetches,
				 * which react-aria's own Link would not.
				 */}
				<Link
					href="/"
					replace
					className={buttonVariants({ variant: 'secondary' })}
				>
					{t('backHome')}
				</Link>
			</div>
		</div>
	)
}
