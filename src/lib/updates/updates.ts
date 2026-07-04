/**
 * "What's new" gating: decide which release notes a returning player hasn't seen
 * yet, and remember the version they're now on.
 *
 * Rules:
 *  - First-ever launch (no stored version) shows nothing — we just record the
 *    current version, so a brand-new player isn't greeted by a changelog and
 *    existing players aren't blasted with notes for a version they're already on.
 *  - Otherwise, show every release strictly newer than the stored version,
 *    newest first, then record the current version.
 */

import { readJSON, writeJSON } from '$lib/storage/storage';
import { CHANGELOG, CURRENT_VERSION, type Release } from './changelog';

const KEY = 'seen-version';

/** Compare dotted numeric versions: <0 if a<b, 0 if equal, >0 if a>b. */
function compareVersions(a: string, b: string): number {
	const pa = a.split('.').map((n) => parseInt(n, 10));
	const pb = b.split('.').map((n) => parseInt(n, 10));
	const len = Math.max(pa.length, pb.length);
	for (let i = 0; i < len; i++) {
		const x = pa[i] ?? 0;
		const y = pb[i] ?? 0;
		if (Number.isNaN(x) || Number.isNaN(y)) return 0; // unparseable → treat as equal (no popup)
		if (x !== y) return x < y ? -1 : 1;
	}
	return 0;
}

/**
 * Releases to show on this launch. Empty on a first-ever launch (and records the
 * current version as a side effect), or when the player is already up to date.
 */
export function pendingReleases(): Release[] {
	const seen = readJSON<string | null>(KEY, null);
	if (seen === null) {
		writeJSON(KEY, CURRENT_VERSION);
		return [];
	}
	return CHANGELOG.filter((r) => compareVersions(r.version, seen) > 0);
}

/** Record that the player has now seen the current version. */
export function markSeen(): void {
	writeJSON(KEY, CURRENT_VERSION);
}
