/**
 * Thin, SSR-safe localStorage wrapper. Everything that persists (settings,
 * daily streak, future in-progress resume) goes through here, so swapping the
 * backing store later is a one-file change. All calls degrade gracefully when
 * storage is unavailable (SSR, private mode, quota errors).
 */

const PREFIX = 'patience:';

function store(): Storage | null {
	try {
		if (typeof localStorage === 'undefined') return null;
		return localStorage;
	} catch {
		return null;
	}
}

export function readJSON<T>(key: string, fallback: T): T {
	const s = store();
	if (!s) return fallback;
	try {
		const raw = s.getItem(PREFIX + key);
		return raw === null ? fallback : (JSON.parse(raw) as T);
	} catch {
		return fallback;
	}
}

export function writeJSON(key: string, value: unknown): void {
	const s = store();
	if (!s) return;
	try {
		s.setItem(PREFIX + key, JSON.stringify(value));
	} catch {
		// ignore quota / serialization errors — persistence is best-effort
	}
}

export function remove(key: string): void {
	const s = store();
	if (!s) return;
	try {
		s.removeItem(PREFIX + key);
	} catch {
		// ignore
	}
}
