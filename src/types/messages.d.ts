// zh is the source of truth for message keys: en.json is a translation of it,
// so typing t() against zh is what catches a key that exists nowhere.
//
// The imported .json is typed by src/i18n/messages/zh.d.json.ts, which
// next-intl's plugin generates (see createMessagesDeclaration in
// next.config.ts) and which is committed — `bun run typecheck` doesn't run the
// plugin, so a gitignored declaration would break CI.
import type messages from '@/i18n/messages/zh.json'

declare module 'use-intl' {
	interface AppConfig {
		Locale: 'zh' | 'en'
		Messages: typeof messages
	}
}
