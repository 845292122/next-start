import type { Key } from 'swr'

/**
 * SWR keys for the notes list.
 *
 * These used to be `/api/notes?q=...` URL strings, back when `NoteList` fetched
 * through the route handlers. Now that it reads through `listNotesAction` there's
 * no URL involved, so the key is a plain tuple — SWR serializes arrays
 * structurally, so `['notes', 'abc', 20]` is a stable, distinct key per
 * (query, limit) pair.
 *
 * The limit is part of the key because it changes the response: a wider window is
 * a different cache entry, not a stale version of the same one.
 *
 * The `'notes'` prefix isn't decoration: it's what `notesKeyFilter` matches on.
 */
export function notesKey(query?: string, limit?: number) {
	return ['notes', query ?? '', limit ?? 0] as const
}

/**
 * Matches every notes-list key regardless of its query.
 *
 * Pass to `mutate()` to revalidate the whole family:
 *
 * ```ts
 * const { mutate } = useSWRConfig()
 * await mutate(notesKeyFilter)
 * ```
 *
 * A filter rather than `mutate(notesKey())` — that only invalidates the
 * *empty-query* key, so creating a note while the search box had text in it left
 * the visible (filtered) list stale until something else refetched it. Any
 * mutation can change which queries a note belongs to, so all of them have to go.
 */
export function notesKeyFilter(key: Key) {
	return Array.isArray(key) && key[0] === 'notes'
}
