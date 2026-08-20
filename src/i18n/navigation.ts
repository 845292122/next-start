import { createNavigation } from 'next-intl/navigation'
import { routing } from '@/i18n/routing'

/**
 * Locale-aware replacements for next/link and next/navigation. Always import
 * Link / usePathname / useRouter / redirect from here rather than from Next
 * directly — these apply the locale prefix, and usePathname() returns the path
 * *without* it, which is what route-matching code wants.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } =
	createNavigation(routing)
