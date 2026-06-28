import { describe, expect, it } from 'vitest';
import { dailyFor, dateKey, dayNumber, previousKey } from './daily';

// Note: Date months are 0-indexed in the constructor.
const d = (y: number, m: number, day: number) => new Date(y, m - 1, day);

describe('dateKey', () => {
	it('formats YYYY-MM-DD with zero padding', () => {
		expect(dateKey(d(2026, 6, 28))).toBe('2026-06-28');
		expect(dateKey(d(2026, 1, 3))).toBe('2026-01-03');
	});
});

describe('previousKey', () => {
	it('returns the prior day, crossing month boundaries', () => {
		expect(previousKey(d(2026, 6, 28))).toBe('2026-06-27');
		expect(previousKey(d(2026, 7, 1))).toBe('2026-06-30');
		expect(previousKey(d(2026, 1, 1))).toBe('2025-12-31');
	});
});

describe('dailyFor', () => {
	const ids = ['klondike', 'klondike-draw1', 'freecell'];

	it('is deterministic for a given date', () => {
		expect(dailyFor(d(2026, 6, 28), ids)).toEqual(dailyFor(d(2026, 6, 28), ids));
	});

	it('uses the day number as the seed and rotates the game', () => {
		const info = dailyFor(d(2026, 6, 28), ids);
		expect(info.seed).toBe(dayNumber(d(2026, 6, 28)));
		expect(ids).toContain(info.gameId);
	});

	it('handles an empty catalog gracefully', () => {
		expect(dailyFor(d(2026, 6, 28), []).gameId).toBe('');
	});
});
