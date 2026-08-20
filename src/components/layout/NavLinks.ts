import { LayoutGrid, NotebookPen, Settings } from 'lucide-react'

// Rail items. To add a page: create a directory under src/app/[locale]/(app)/
// and add an entry here. Labels are message keys in the Nav namespace, not
// strings — this module isn't a component, so it can't call useTranslations.
export const navLinks = [
	{ href: '/dashboard', labelKey: 'dashboard', icon: LayoutGrid },
	{ href: '/notes', labelKey: 'notes', icon: NotebookPen },
	{ href: '/settings', labelKey: 'settings', icon: Settings },
] as const
