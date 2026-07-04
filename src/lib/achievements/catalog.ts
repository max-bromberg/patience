/**
 * Cozy achievement definitions. Each is a small badge with a pure predicate over
 * an {@link AchievementContext} snapshot (built in the achievements store from
 * local stats / daily streak / the just-finished game). Everything stays
 * on-device. Order here is the display order in the gallery.
 */

import { catalog } from '$lib/games/registry';

export interface AchievementContext {
	/** Games finished (won or lost), all-time. */
	totalPlayed: number;
	/** Games won, all-time. */
	totalWon: number;
	/** Best win streak reached in any single game. */
	bestStreakAnyGame: number;
	/** Ids of games won at least once. */
	wonGameIds: readonly string[];
	/** Ids of games played at least once. */
	playedGameIds: readonly string[];
	/** Current daily-challenge streak. */
	dailyStreak: number;
	/** When this evaluation happened (local time). */
	finishedAt: Date;
	/** True when a game just concluded (vs. an aggregate refresh). */
	justFinishedGame: boolean;
	/** Details of the just-won game, if this evaluation follows a win. */
	win?: { gameId: string; family: string; timeMs?: number; moves?: number };
}

export interface Achievement {
	readonly id: string;
	readonly emoji: string;
	readonly name: string;
	readonly description: string;
	readonly test: (c: AchievementContext) => boolean;
}

// Derived from the catalog so the "collector" badges stay in sync as games are
// added: every game id, and the set of distinct families.
const ALL_GAME_IDS: readonly string[] = catalog.map((m) => m.id);
const FAMILY_OF: Record<string, string> = Object.fromEntries(catalog.map((m) => [m.id, m.family]));
const ALL_FAMILIES: readonly string[] = [...new Set(catalog.map((m) => m.family))];

function wonFamilies(c: AchievementContext): Set<string> {
	return new Set(c.wonGameIds.map((id) => FAMILY_OF[id]).filter(Boolean));
}

export const ACHIEVEMENTS: readonly Achievement[] = [
	{
		id: 'first-win',
		emoji: '🎉',
		name: 'First Victory',
		description: 'Win your very first game.',
		test: (c) => c.totalWon >= 1
	},
	{
		id: 'ten-wins',
		emoji: '🃏',
		name: 'Warmed Up',
		description: 'Win 10 games.',
		test: (c) => c.totalWon >= 10
	},
	{
		id: 'fifty-wins',
		emoji: '♠️',
		name: 'Card Sharp',
		description: 'Win 50 games.',
		test: (c) => c.totalWon >= 50
	},
	{
		id: 'century',
		emoji: '💯',
		name: 'Centurion',
		description: 'Play 100 games.',
		test: (c) => c.totalPlayed >= 100
	},
	{
		id: 'streak-3',
		emoji: '🔥',
		name: 'On a Roll',
		description: 'Win 3 in a row in one game.',
		test: (c) => c.bestStreakAnyGame >= 3
	},
	{
		id: 'streak-5',
		emoji: '⚡',
		name: 'Unstoppable',
		description: 'Win 5 in a row in one game.',
		test: (c) => c.bestStreakAnyGame >= 5
	},
	{
		id: 'speed',
		emoji: '🏃',
		name: 'Speed Demon',
		description: 'Win a game in under 2 minutes.',
		test: (c) => c.win?.timeMs !== undefined && c.win.timeMs > 0 && c.win.timeMs < 120_000
	},
	{
		id: 'night-owl',
		emoji: '🌙',
		name: 'Night Owl',
		description: 'Finish a game after midnight.',
		test: (c) => c.justFinishedGame && c.finishedAt.getHours() >= 0 && c.finishedAt.getHours() < 5
	},
	{
		id: 'early-bird',
		emoji: '🌅',
		name: 'Early Bird',
		description: 'Finish a game before 8 in the morning.',
		test: (c) => c.justFinishedGame && c.finishedAt.getHours() >= 5 && c.finishedAt.getHours() < 8
	},
	{
		id: 'explorer',
		emoji: '🗺️',
		name: 'Explorer',
		description: 'Play every game at least once.',
		test: (c) => ALL_GAME_IDS.every((id) => c.playedGameIds.includes(id))
	},
	{
		id: 'all-families',
		emoji: '🌈',
		name: 'Jack of All Trades',
		description: 'Win a game in every category.',
		test: (c) => {
			const won = wonFamilies(c);
			return ALL_FAMILIES.every((f) => won.has(f));
		}
	},
	{
		id: 'daily-7',
		emoji: '📅',
		name: 'Daily Devotee',
		description: 'Reach a 7-day daily streak.',
		test: (c) => c.dailyStreak >= 7
	}
];

export const ACHIEVEMENT_COUNT = ACHIEVEMENTS.length;

export function achievementById(id: string): Achievement | undefined {
	return ACHIEVEMENTS.find((a) => a.id === id);
}
