/**
 * Resolve which mood the ambience should play, honoring the player's Settings
 * choice ('auto' = match the game) and only allowing a hand-picked mood if it's
 * been unlocked. Reads the reactive settings/achievements stores, so callers can
 * use it inside an $effect to re-resolve when either changes.
 */

import { achievements } from '$lib/storage/achievements.svelte';
import { settings } from '$lib/storage/settings.svelte';
import { getMood, isMoodUnlocked, moodForGame, type Mood } from './moods';

export function resolveMood(gameId: string | undefined): Mood {
	const choice = settings.musicMood;
	if (choice && choice !== 'auto') {
		const picked = getMood(choice);
		if (picked && isMoodUnlocked(picked, (id) => achievements.has(id))) return picked;
	}
	return moodForGame(gameId);
}
