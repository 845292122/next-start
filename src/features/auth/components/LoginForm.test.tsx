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
	test('renders the phone and code fields', () => {
		renderForm()
		expect(screen.getByLabelText('手机号')).toBeInTheDocument()
		expect(screen.getByLabelText('验证码', { exact: true })).toBeInTheDocument()
		expect(screen.getByRole('button', { name: '登录' })).toBeInTheDocument()
	})

	test('a malformed phone number is rejected before signIn is called', async () => {
		const user = userEvent.setup()
		renderForm()

		await user.type(screen.getByLabelText('手机号'), '123')
		await user.type(screen.getByLabelText('验证码', { exact: true }), '123456')
		await user.click(screen.getByRole('button', { name: '登录' }))

		// The guard that matters: zod stopped this, so no network call happened.
		await waitFor(() => {
			expect(screen.getByLabelText('手机号')).toHaveAttribute(
				'aria-invalid',
				'true',
			)
		})
		expect(signIn).not.toHaveBeenCalled()
	})

	test('"send code" is refused for a malformed phone number', async () => {
		const user = userEvent.setup()
		renderForm()

		await user.type(screen.getByLabelText('手机号'), '123')
		await user.click(screen.getByRole('button', { name: '获取验证码' }))

		// react-hook-form's own trigger('phone') is what blocks this — no
		// countdown should start, and the field should end up invalid.
		await waitFor(() => {
			expect(screen.getByLabelText('手机号')).toHaveAttribute(
				'aria-invalid',
				'true',
			)
		})
		expect(
			screen.getByRole('button', { name: '获取验证码' }),
		).not.toBeDisabled()
	})

	test('valid phone + code are handed to signIn and then routed onward', async () => {
		const user = userEvent.setup()
		renderForm()

		await user.type(screen.getByLabelText('手机号'), '13800000000')
		await user.type(screen.getByLabelText('验证码', { exact: true }), '123456')
		await user.click(screen.getByRole('button', { name: '登录' }))

		await waitFor(() => {
			expect(signIn).toHaveBeenCalledWith('phone-otp', {
				phone: '13800000000',
				code: '123456',
				// redirect: false is what keeps a bad code on this page instead of
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

		await user.type(screen.getByLabelText('手机号'), '13800000000')
		await user.type(screen.getByLabelText('验证码', { exact: true }), '000000')
		await user.click(screen.getByRole('button', { name: '登录' }))

		await waitFor(() =>
			expect(screen.getByText('验证码不正确。')).toBeInTheDocument(),
		)
		expect(push).not.toHaveBeenCalled()
	})
})
