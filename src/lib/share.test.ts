import { describe, expect, it } from 'vitest';
import { buildShareText, formatTime } from './share';

describe('formatTime', () => {
	it('formats under an hour as m:ss', () => {
		expect(formatTime(0)).toBe('0:00');
		expect(formatTime(9000)).toBe('0:09');
		expect(formatTime(204000)).toBe('3:24');
	});
	it('formats over an hour as h:mm:ss', () => {
		expect(formatTime(3_725_000)).toBe('1:02:05');
	});
});

describe('buildShareText', () => {
	it('builds a solitaire win blurb with moves, time, and link', () => {
		const text = buildShareText({
			type: 'solitaire',
			name: 'Klondike',
			gameId: 'klondike',
			url: 'https://patience.maxbromberg.me/play/klondike?seed=42',
			won: true,
			moves: 142,
			timeMs: 204000
		});
		expect(text).toContain('🎉 Patience · Klondike');
		expect(text).toContain('142 moves');
		expect(text).toContain('3:24');
		expect(text).toContain('?seed=42');
	});

	it('marks a solitaire loss as stuck and omits the cleared line', () => {
		const text = buildShareText({
			type: 'solitaire',
			name: 'Spider',
			gameId: 'spider1',
			url: 'https://patience.maxbromberg.me/play/spider1?seed=7',
			won: false,
			moves: 88
		});
		expect(text).toContain('🃏 Patience · Spider');
		expect(text).toContain('Stuck after 88 moves');
		expect(text).not.toContain('cleared');
	});

	it('includes the daily streak when present', () => {
		const text = buildShareText({
			type: 'solitaire',
			name: 'Golf',
			gameId: 'golf',
			url: 'https://patience.maxbromberg.me/play/golf?seed=1&daily=1',
			won: true,
			moves: 30,
			daily: true,
			streak: 5
		});
		expect(text).toContain('📅 Daily Challenge');
		expect(text).toContain('🔥 5');
	});

	it('builds a trick blurb with the scoreboard', () => {
		const text = buildShareText({
			type: 'trick',
			name: 'Hearts',
			gameId: 'hearts',
			url: 'https://patience.maxbromberg.me/play/hearts?seed=9',
			won: true,
			scores: [
				{ label: 'South', value: 12, you: true },
				{ label: 'West', value: 26, you: false }
			]
		});
		expect(text).toContain('🎉 Patience · Hearts');
		expect(text).toContain('🏆 I won!');
		expect(text).toContain('You 12 · West 26');
	});
});
