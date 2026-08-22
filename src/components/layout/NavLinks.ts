import { IconLayoutGrid, IconPencil, IconSettings } from '@tabler/icons-react'

// Rail items. To add a page: create a directory under src/app/(app)/ and add an
// entry here.
export const navLinks = [
	{ href: '/dashboard', label: '概览', icon: IconLayoutGrid },
	{ href: '/notes', label: '笔记', icon: IconPencil },
	{ href: '/settings', label: '设置', icon: IconSettings },
] as const
