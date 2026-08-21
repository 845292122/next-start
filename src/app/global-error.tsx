'use client'

/**
 * Last-resort boundary: this renders when `app/[locale]/layout.tsx` itself
 * throws, which is the one failure `[locale]/error.tsx` cannot catch (an error
 * file never wraps the layout of its own segment).
 *
 * Because it *replaces* the root layout, three constraints apply — all of them
 * from Next, not from choices made here (see
 * node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/error.md):
 *
 *  1. **It must render its own `<html>` and `<body>`.** There is no layout above
 *     it to supply them.
 *  2. **No `metadata` export.** Error boundaries are Client Components, where
 *     that export isn't supported; React's `<title>` element is the substitute.
 *  3. **Global styles don't reach it.** `next-themes`' blocking script and the
 *     `class="light|dark"` it writes both belong to the root layout that just
 *     failed, so `globals.css` would render here without a theme class.
 *
 * ## Why this file duplicates instead of reusing
 *
 * It deliberately imports **nothing** — not `globals.css`, not `ErrorState`, not
 * HeroUI, not next-intl. This is the page that has to work when the app is
 * broken, so every import is a way for it to break too: a crash originating in
 * the stylesheet, in a HeroUI component, or in the i18n request config would
 * take the error page down with it and leave the user on a blank screen. Inline
 * styles and hardcoded text can't fail that way.
 *
 * That's also why the copy is bilingual and hardcoded. Translations live behind
 * `NextIntlClientProvider`, which is inside the layout that failed, so there is
 * no locale to read here — showing both languages beats guessing wrong.
 */
export default function GlobalError({
	error,
	retry,
}: {
	error: Error & { digest?: string }
	retry: () => void
}) {
	return (
		<html lang="zh">
			<body>
				<title>出错了 · Something went wrong</title>
				{/*
				 * A <style> element rather than inline style attributes: the
				 * prefers-color-scheme query can't be expressed inline, and without it
				 * this page would be stark white for anyone using a dark OS theme.
				 * Values are literals, not the CSS variables from globals.css, since
				 * that file isn't loaded here.
				 */}
				<style>{`
					.ge-root {
						--ge-bg: #f7f7f7;
						--ge-fg: #363636;
						--ge-muted: #767676;
						--ge-surface: #fff;
						--ge-border: #e5e5e5;
						min-height: 100dvh;
						display: flex;
						align-items: center;
						justify-content: center;
						padding: 1.5rem;
						margin: 0;
						background: var(--ge-bg);
						color: var(--ge-fg);
						font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica,
							Arial, "PingFang SC", "Microsoft YaHei", sans-serif;
					}
					@media (prefers-color-scheme: dark) {
						.ge-root {
							--ge-bg: #1e1e1e;
							--ge-fg: #fcfcfc;
							--ge-muted: #b4b4b4;
							--ge-surface: #363636;
							--ge-border: #474747;
						}
					}
					.ge-card { max-width: 27rem; text-align: center; }
					.ge-title { margin: 0 0 .75rem; font-size: 1.25rem; font-weight: 600; }
					.ge-text { margin: 0 0 .5rem; color: var(--ge-muted); line-height: 1.6; }
					.ge-text-en { font-size: .875rem; }
					.ge-digest {
						display: inline-block;
						margin-top: .75rem;
						padding: .25rem .5rem;
						border-radius: .25rem;
						background: var(--ge-surface);
						border: 1px solid var(--ge-border);
						color: var(--ge-muted);
						font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
						font-size: .75rem;
					}
					.ge-actions { margin-top: 1.5rem; display: flex; gap: .75rem; justify-content: center; }
					.ge-btn {
						padding: .5rem 1rem;
						border-radius: .25rem;
						border: 1px solid var(--ge-border);
						background: var(--ge-surface);
						color: var(--ge-fg);
						font: inherit;
						font-size: .875rem;
						cursor: pointer;
						text-decoration: none;
					}
					.ge-btn--primary {
						background: var(--ge-fg);
						color: var(--ge-bg);
						border-color: var(--ge-fg);
					}
				`}</style>

				<div className="ge-root">
					<div className="ge-card">
						<h1 className="ge-title">出错了 · Something went wrong</h1>
						<p className="ge-text">应用没能启动起来。重试一次通常就好了。</p>
						<p className="ge-text ge-text-en">
							The app failed to start. Trying again usually works.
						</p>

						{/*
						 * In production the real message never reaches the client — only
						 * this hash, which matches the server log entry. It's the only
						 * thing a user can usefully report.
						 */}
						{error.digest && (
							<code className="ge-digest">
								错误编号 / error id: {error.digest}
							</code>
						)}

						<div className="ge-actions">
							<button
								type="button"
								className="ge-btn ge-btn--primary"
								onClick={() => retry()}
							>
								重试 / Try again
							</button>
							{/*
							 * A plain <a>, not next/link: this page renders when the root
							 * layout is broken, and a hard navigation is the more reliable
							 * way out of that state. No locale prefix — the proxy resolves it.
							 */}
							<a className="ge-btn" href="/">
								回到首页 / Home
							</a>
						</div>
					</div>
				</div>
			</body>
		</html>
	)
}
