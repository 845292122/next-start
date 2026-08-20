import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scryptAsync = promisify(scrypt)
const KEY_LENGTH = 64

// Next.js runs Server Actions/Route Handlers/Server Components in a plain
// Node process even under `bun run dev|build|start` — Bun-only APIs like
// Bun.password are unavailable there, so this uses node:crypto instead
// (works identically under Bun's own script runner and under Next's server).
export async function hashPassword(password: string) {
	const salt = randomBytes(16).toString('hex')
	const derivedKey = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer
	return `${salt}:${derivedKey.toString('hex')}`
}

export async function verifyPassword(password: string, storedHash: string) {
	const [salt, key] = storedHash.split(':')
	if (!salt || !key) return false

	const keyBuffer = Buffer.from(key, 'hex')
	const derivedKey = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer
	if (keyBuffer.length !== derivedKey.length) return false

	return timingSafeEqual(keyBuffer, derivedKey)
}
