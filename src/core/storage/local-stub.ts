import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { StorageAdapter } from '@/core/storage/types'

// Dev-only placeholder — writes to disk under the project root. Swap for a
// real S3-compatible adapter (e.g. Cloudflare R2 via @aws-sdk/client-s3) when
// a project actually needs file storage; this only exists so the interface
// has one working implementation to develop against.
const STORAGE_DIR = path.join(process.cwd(), '.local-storage')

export const localStorageAdapter: StorageAdapter = {
	async put(key, data) {
		const filePath = path.join(STORAGE_DIR, key)
		await mkdir(path.dirname(filePath), { recursive: true })
		await writeFile(filePath, data)
	},
	async get(key) {
		try {
			return await readFile(path.join(STORAGE_DIR, key))
		} catch {
			return null
		}
	},
	async delete(key) {
		await rm(path.join(STORAGE_DIR, key), { force: true })
	},
	async getSignedUrl(key) {
		return `/api/local-storage/${key}`
	},
}
