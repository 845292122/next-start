import type { ActionFailure } from '@/core/action-result'
import type { AppErrorCode } from '@/core/errors'

/**
 * Turns an `ActionFailure` into a user-facing sentence.
 *
 * This is the client half of the error contract: the server sends a `code` and
 * nothing else (see `core/action-result.ts` on why no message travels), and the
 * mapping from code to wording is a UI concern.
 *
 * Every `AppErrorCode` gets an entry — the `Record<AppErrorCode, string>`
 * annotation is what makes this exhaustive: add a code to `core/errors.ts`
 * without adding a message here and `bun run typecheck` fails, which is the
 * whole point.
 */
const MESSAGE: Record<AppErrorCode, string> = {
	VALIDATION: '填写的内容不符合要求，检查一下再提交。',
	UNAUTHORIZED: '登录状态已经失效，请重新登录。',
	FORBIDDEN: '你没有做这个操作的权限。',
	NOT_FOUND: '要操作的内容不存在，可能已经被删掉了。',
	CONFLICT: '和已有的数据冲突，换一个值试试。',
	RATE_LIMITED: '操作太频繁了，过一会儿再试。',
	INTERNAL: '服务器出了点问题，稍后重试。',
}

export function getActionErrorMessage(failure: ActionFailure) {
	return MESSAGE[failure.code]
}
