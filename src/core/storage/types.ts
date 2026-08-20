export interface StorageAdapter {
	put(
		key: string,
		data: Buffer | Uint8Array | string,
		options?: { contentType?: string },
	): Promise<void>
	get(key: string): Promise<Buffer | null>
	delete(key: string): Promise<void>
	getSignedUrl(
		key: string,
		options?: { expiresInSeconds?: number },
	): Promise<string>
}
