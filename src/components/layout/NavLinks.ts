import {
	GearIcon,
	NotePencilIcon,
	SquaresFourIcon,
} from '@phosphor-icons/react'

// Rail items. To add a page: create a directory under src/app/[locale]/(app)/
// and add an entry here. Labels are message keys in the Nav namespace, not
// strings — this module isn't a component, so it can't call useTranslations.
//
// `as const` is load-bearing: it keeps `labelKey` a literal union, which is what
// lets next-intl typecheck the `t(link.labelKey)` call in AppShell. Widening it to
// `string` fails typecheck there instead of here, which is a confusing place to
// find the error.
//
// The icons come from the barrel's default (client) build. That's fine because the
// only consumer is AppShell, a Client Component — a Server Component has to import
// from `@phosphor-icons/react/ssr`, see the note in components/ui/LoginHero.tsx.
export const navLinks = [
	{ href: '/dashboard', labelKey: 'dashboard', icon: SquaresFourIcon },
	{ href: '/notes', labelKey: 'notes', icon: NotePencilIcon },
	{ href: '/settings', labelKey: 'settings', icon: GearIcon },
] as const
