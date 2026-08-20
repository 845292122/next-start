import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NextIntlClientProvider } from 'next-intl'
import messages from '@/i18n/messages/zh.json'

/**
 * Component test — run by `bun run test:dom`, which preloads test/setup.ts to
 * register happy-dom. Running it under the plain `test` script fails: the DOM
 * globals wouldn't exist.
 */

const signIn = mock(async (_provider: string, _options: unknown) => ({
	error: undefined as string | undefined,
}))
const push = mock(() => {})
const refresh = mock(() => {})

// mock.module has to run before the component is imported, so the import below
// is dynamic.
mock.module('next-auth/react', () => ({ signIn }))
mock.module('@/i18n/navigation', () => ({
	useRouter: () => ({ push, refresh }),
}))

const { LoginForm } = await import('@/features/auth/components/LoginForm')

// Real messages rather than a stubbed useTranslations: that way a renamed or
// missing message key fails the test instead of silently rendering a key name.
function renderForm() {
	return render(
		<NextIntlClientProvider locale="zh" messages={messages}>
			<LoginForm />
		</NextIntlClientProvider>,
	)
}

beforeEach(() => {
	signIn.mockClear()
	push.mockClear()
	refresh.mockClear()
})

afterEach(() => {
	document.body.innerHTML = ''
})

describe('LoginForm', () => {
	test('renders the email and password fields', () => {
		renderForm()
		expect(screen.getByLabelText('邮箱')).toBeInTheDocument()
		expect(screen.getByLabelText('密码')).toBeInTheDocument()
		expect(screen.getByRole('button', { name: '继续' })).toBeInTheDocument()
	})

	test('a malformed email is rejected before signIn is called', async () => {
		const user = userEvent.setup()
		renderForm()

		await user.type(screen.getByLabelText('邮箱'), 'not-an-email')
		await user.type(screen.getByLabelText('密码'), 'demo1234')
		await user.click(screen.getByRole('button', { name: '继续' }))

		// The guard that matters: zod stopped this, so no network call happened.
		await waitFor(() => {
			expect(screen.getByLabelText('邮箱')).toHaveAttribute(
				'aria-invalid',
				'true',
			)
		})
		expect(signIn).not.toHaveBeenCalled()
	})

	test('valid credentials are handed to signIn and then routed onward', async () => {
		const user = userEvent.setup()
		renderForm()

		await user.type(screen.getByLabelText('邮箱'), 'demo@example.com')
		await user.type(screen.getByLabelText('密码'), 'demo1234')
		await user.click(screen.getByRole('button', { name: '继续' }))

		await waitFor(() => {
			expect(signIn).toHaveBeenCalledWith('credentials', {
				email: 'demo@example.com',
				password: 'demo1234',
				// redirect: false is what keeps a bad password on this page instead of
				// bouncing to Auth.js's own error screen.
				redirect: false,
			})
		})
		// refresh() before push(): the (app) layout reads the session on the server.
		await waitFor(() => expect(push).toHaveBeenCalledWith('/dashboard'))
		expect(refresh).toHaveBeenCalled()
	})

	test('a rejected sign-in shows the error and stays put', async () => {
		signIn.mockResolvedValueOnce({ error: 'CredentialsSignin' })
		const user = userEvent.setup()
		renderForm()

		await user.type(screen.getByLabelText('邮箱'), 'demo@example.com')
		await user.type(screen.getByLabelText('密码'), 'wrong')
		await user.click(screen.getByRole('button', { name: '继续' }))

		await waitFor(() =>
			expect(screen.getByText('邮箱或密码不正确。')).toBeInTheDocument(),
		)
		expect(push).not.toHaveBeenCalled()
	})
})
