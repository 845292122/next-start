import { IconLayoutGrid, IconPencil, IconSettings } from '@tabler/icons-react'

// Rail items. To add a page: create a directory under src/app/[locale]/(app)/
// and add an entry here. Labels are message keys in the Nav namespace, not
// strings — this module isn't a component, so it can't call useTranslations.
//
// `as const` is load-bearing: it keeps `labelKey` a literal union, which is what
// lets next-intl typecheck the `t(link.labelKey)` call in AppShell. Widening it to
// `string` fails typecheck there instead of here, which is a confusing place to
// find the error.
export const navLinks = [
	{ href: '/dashboard', labelKey: 'dashboard', icon: IconLayoutGrid },
	{ href: '/notes', labelKey: 'notes', icon: IconPencil },
	{ href: '/settings', labelKey: 'settings', icon: IconSettings },
] as const
