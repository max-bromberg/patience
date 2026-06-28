import { describe, expect, it } from 'vitest';
import { whist, type WhistState } from './whist';

function drain(s: WhistState): WhistState {
	let n: WhistState | null;
	let g = 0;
	while ((n = whist.stepAuto(s)) !== null && g++ < 100) s = n;
	return s;
}
function playOut(seed: number): WhistState {
	let s = drain(whist.newGame(seed));
	let g = 0;
	while (s.phase !== 'gameOver' && g++ < 20000) {
		const m = whist.suggest(s);
		if (!m) break;
		s = drain(whist.apply(s, m));
	}
	return s;
}

describe('whist', () => {
	it('deals 13 each and sets trump from the dealer’s last card', () => {
		const s = whist.newGame(4);
		expect(s.hands.map((h) => h.length)).toEqual([13, 13, 13, 13]);
		expect(s.trump).toBe(s.trumpCard.suit);
		// the trump card belongs to the dealer
		expect(s.hands[s.dealer].some((c) => c.id === s.trumpCard.id)).toBe(true);
	});

	it('full games end with a partnership reaching 7', () => {
		for (const seed of [1, 8, 19, 64, 808]) {
			const s = playOut(seed);
			expect(s.phase).toBe('gameOver');
			expect(s.winner === 0 || s.winner === 1).toBe(true);
			expect(Math.max(s.scores[0], s.scores[1])).toBeGreaterThanOrEqual(7);
		}
	});

	it('each hand distributes exactly 13 tricks', () => {
		let s = drain(whist.newGame(55));
		while (s.phase === 'playing') s = drain(whist.apply(s, whist.suggest(s)!));
		expect(s.tricksWon.reduce((a, b) => a + b, 0)).toBe(13);
	});
});
