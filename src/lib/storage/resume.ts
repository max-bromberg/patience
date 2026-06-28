/**
 * Per-game in-progress persistence: the latest casual deal for each game id is
 * saved as a session snapshot (seed + moves) so a reload resumes where you left
 * off. Seeded/daily deals (`?seed=`) are intentionally not persisted here.
 */

import type { SessionSnapshot } from '$lib/engine';
import { readJSON, remove, writeJSON } from './storage';

type AnySnapshot = SessionSnapshot<unknown>;

const key = (gameId: string) => `progress:${gameId}`;

export function loadProgress(gameId: string): AnySnapshot | null {
	const snap = readJSON<AnySnapshot | null>(key(gameId), null);
	// guard against corrupted/old shapes
	if (
		snap &&
		snap.gameId === gameId &&
		typeof snap.seed === 'number' &&
		Array.isArray(snap.moves)
	) {
		return snap;
	}
	return null;
}

export function saveProgress(gameId: string, snapshot: AnySnapshot): void {
	writeJSON(key(gameId), snapshot);
}

export function clearProgress(gameId: string): void {
	remove(key(gameId));
}
