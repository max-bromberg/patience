import { describe, expect, it } from 'vitest';
import { catalog } from '$lib/games/registry';
import { ACHIEVEMENTS, achievementById, type AchievementContext } from './catalog';

function ctx(over: Partial<AchievementContext> = {}): AchievementContext {
	return {
		totalPlayed: 0,
		totalWon: 0,
		bestStreakAnyGame: 0,
		wonGameIds: [],
		playedGameIds: [],
		dailyStreak: 0,
		finishedAt: new Date('2026-07-04T12:00:00'),
		justFinishedGame: false,
		...over
	};
}

/** A predicate's result for a given context. */
function test(id: string, over: Partial<AchievementContext>): boolean {
	const a = achievementById(id);
	if (!a) throw new Error(`unknown achievement ${id}`);
	return a.test(ctx(over));
}

describe('achievement predicates', () => {
	it('has unique ids', () => {
		const ids = ACHIEVEMENTS.map((a) => a.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it('win-count thresholds', () => {
		expect(test('first-win', { totalWon: 0 })).toBe(false);
		expect(test('first-win', { totalWon: 1 })).toBe(true);
		expect(test('ten-wins', { totalWon: 9 })).toBe(false);
		expect(test('ten-wins', { totalWon: 10 })).toBe(true);
		expect(test('fifty-wins', { totalWon: 49 })).toBe(false);
		expect(test('fifty-wins', { totalWon: 50 })).toBe(true);
	});

	it('century counts games played, not won', () => {
		expect(test('century', { totalPlayed: 99, totalWon: 0 })).toBe(false);
		expect(test('century', { totalPlayed: 100, totalWon: 0 })).toBe(true);
	});

	it('streak thresholds use the best single-game streak', () => {
		expect(test('streak-3', { bestStreakAnyGame: 2 })).toBe(false);
		expect(test('streak-3', { bestStreakAnyGame: 3 })).toBe(true);
		expect(test('streak-5', { bestStreakAnyGame: 4 })).toBe(false);
		expect(test('streak-5', { bestStreakAnyGame: 5 })).toBe(true);
	});

	it('speed needs a fast win, not just a fast finish', () => {
		expect(test('speed', { justFinishedGame: true })).toBe(false); // no win
		expect(test('speed', { win: { gameId: 'x', family: 'y', timeMs: 130_000 } })).toBe(false);
		expect(test('speed', { win: { gameId: 'x', family: 'y', timeMs: 90_000 } })).toBe(true);
		expect(test('speed', { win: { gameId: 'x', family: 'y', timeMs: 0 } })).toBe(false);
	});

	it('time-of-day badges require a just-finished game', () => {
		const night = new Date('2026-07-04T02:00:00');
		const morning = new Date('2026-07-04T06:30:00');
		const noon = new Date('2026-07-04T12:00:00');
		// not counted unless a game just finished
		expect(test('night-owl', { finishedAt: night, justFinishedGame: false })).toBe(false);
		expect(test('night-owl', { finishedAt: night, justFinishedGame: true })).toBe(true);
		expect(test('night-owl', { finishedAt: noon, justFinishedGame: true })).toBe(false);
		expect(test('early-bird', { finishedAt: morning, justFinishedGame: true })).toBe(true);
		expect(test('early-bird', { finishedAt: noon, justFinishedGame: true })).toBe(false);
	});

	it('daily-7 needs a 7-day streak', () => {
		expect(test('daily-7', { dailyStreak: 6 })).toBe(false);
		expect(test('daily-7', { dailyStreak: 7 })).toBe(true);
	});

	it('explorer needs every game played', () => {
		const all = catalog.map((m) => m.id);
		expect(test('explorer', { playedGameIds: all.slice(1) })).toBe(false);
		expect(test('explorer', { playedGameIds: all })).toBe(true);
	});

	it('all-families needs a win in every category', () => {
		const all = catalog.map((m) => m.id);
		const oneFamilyMissing = catalog.filter((m) => m.family !== catalog[0].family).map((m) => m.id);
		expect(test('all-families', { wonGameIds: oneFamilyMissing })).toBe(false);
		expect(test('all-families', { wonGameIds: all })).toBe(true);
	});
});
