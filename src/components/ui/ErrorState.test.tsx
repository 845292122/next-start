import { afterEach, describe, expect, mock, test } from 'bun:test'
import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ErrorState } from '@/components/ui/ErrorState'

/**
 * Component test for the shared body of the error boundaries.
 *
 * The boundaries themselves (`app/error.tsx`, `app/(app)/error.tsx`,
 * `app/global-error.tsx`) aren't covered here — triggering them needs a route
 * that deliberately throws, and the template doesn't ship one. This covers
 * everything they *render*, which is the part that breaks silently.
 *
 * No `mock.module`, on purpose: `ErrorState` takes finished strings and the home
 * link as a slot, so it imports nothing that needs a request context. That's
 * what lets this file be a plain render.
 *
 * `MantineProvider` is the one wrapper that *is* required: Mantine components read
 * the theme from it and throw without one. `env="test"` disables transitions.
 */

// The same literal Chinese the real error boundaries pass in — see
// `app/error.tsx` / `app/(app)/error.tsx`.
const t = {
	title: '这个页面没能加载出来',
	description:
		'渲染时出了点问题。重试一次通常就好了；如果一直这样，把下面的错误编号发给我们。',
	retry: '重试',
	backHome: '回到首页',
}

function renderState(props: Partial<Parameters<typeof ErrorState>[0]> = {}) {
	return render(
		<MantineProvider env="test">
			<ErrorState
				title={t.title}
				description={t.description}
				retryLabel={t.retry}
				homeLink={<a href="/">{t.backHome}</a>}
				onRetry={() => {}}
				{...props}
			/>
		</MantineProvider>,
	)
}

afterEach(() => {
	document.body.innerHTML = ''
})

describe('ErrorState', () => {
	test('renders the message, a retry button and a way out', () => {
		renderState()

		expect(screen.getByRole('heading', { name: t.title })).toBeInTheDocument()
		expect(screen.getByText(t.description)).toBeInTheDocument()
		expect(screen.getByRole('button', { name: t.retry })).toBeInTheDocument()
		// The escape hatch matters as much as retry: if the failure is permanent,
		// the retry button leaves the user stuck.
		expect(screen.getByRole('link', { name: t.backHome })).toHaveAttribute(
			'href',
			'/',
		)
	})

	test('retry is wired to the callback Next hands the boundary', async () => {
		const onRetry = mock(() => {})
		const user = userEvent.setup()
		renderState({ onRetry })

		await user.click(screen.getByRole('button', { name: t.retry }))

		expect(onRetry).toHaveBeenCalledTimes(1)
	})

	test('shows the digest when there is one', () => {
		// In production this hash is the only link between what the user sees and
		// the real error in the server log.
		const { container } = renderState({
			digest: 'abc123',
			digestLabel: '错误编号 abc123',
		})

		// Asserted via the <code> element rather than by text: `Errors.description`
		// legitimately contains the words "错误编号" too, so a text query for that
		// matches the paragraph as well and proves nothing.
		expect(container.querySelector('code')?.textContent).toBe('错误编号 abc123')
	})

	test('renders no digest block for a client-side error', () => {
		// Client-side errors carry no digest, and an empty code block would just be
		// visual noise.
		const { container } = renderState()
		expect(container.querySelector('code')).toBeNull()
	})
})
