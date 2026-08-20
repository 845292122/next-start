export function notesKey(query?: string) {
	return query ? `/api/notes?q=${encodeURIComponent(query)}` : '/api/notes'
}
