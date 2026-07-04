/**
 * Reactive controller for the "What's new" popup. Two ways to open it:
 *  - openPending() — the automatic path, run once at launch: shows every release
 *    newer than the player's last-seen version (and records the current one).
 *  - openLatest()  — the manual path (a "What's new" button in Settings): shows
 *    the latest release on demand, so it can always be revisited.
 */

import { CHANGELOG, type Release } from './changelog';
import { markSeen, pendingReleases } from './updates';

class ReleaseNotes {
	releases = $state<Release[]>([]);

	get open(): boolean {
		return this.releases.length > 0;
	}

	/** Auto: show unseen releases at launch (no-op if up to date / first launch). */
	openPending(): void {
		const pending = pendingReleases();
		if (pending.length === 0) return;
		this.releases = pending;
		// Mark seen as soon as it's shown, so it appears exactly once.
		markSeen();
	}

	/** Manual: show the most recent release notes on demand. */
	openLatest(): void {
		this.releases = CHANGELOG.slice(0, 1);
	}

	close(): void {
		this.releases = [];
	}
}

export const releaseNotes = new ReleaseNotes();
