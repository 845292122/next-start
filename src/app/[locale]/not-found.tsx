import { buttonVariants, Heading, Paragraph } from '@heroui/react'
import { SearchX } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'

/**
 * Rendered for unmatched URLs (via app/[locale]/[...rest]/page.tsx) and for
 * notFound() thrown in this segment.
 *
 * It sits outside the (app) group, so it gets no rail — and deliberately so:
 * bringing AppShell in here would require a session, and a 404 has to render for
 * signed-out visitors too.
 */
export default async function NotFound() {
	const t = await getTranslations('Errors')

	return (
		<div className="flex min-h-dvh items-center justify-center p-6">
			<div className="flex max-w-100 flex-col items-center gap-4 text-center">
				<div className="bg-default text-muted flex size-18 items-center justify-center rounded-full">
					<SearchX className="size-9" />
				</div>
				<Heading level={1}>404</Heading>
				<Paragraph className="text-muted">{t('notFound')}</Paragraph>
				{/* buttonVariants() rather than <Button>: see (app)/403/page.tsx */}
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
