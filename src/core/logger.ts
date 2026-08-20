import pino from 'pino'
import { env } from '@/core/env'

// pino's transport spawns a worker thread — do not import this from proxy.ts
// or any file with `export const runtime = 'edge'`, it will fail to bundle.
export const logger = pino({
	level: env.LOG_LEVEL,
	transport:
		env.NODE_ENV === 'development'
			? { target: 'pino-pretty', options: { colorize: true } }
			: undefined,
})
