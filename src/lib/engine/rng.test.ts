import { describe, expect, it } from 'vitest';
import { mulberry32, randInt } from './rng';

describe('mulberry32', () => {
	it('is deterministic for a given seed', () => {
		const a = mulberry32(12345);
		const b = mulberry32(12345);
		const seqA = Array.from({ length: 10 }, () => a());
		const seqB = Array.from({ length: 10 }, () => b());
		expect(seqA).toEqual(seqB);
	});

	it('produces different sequences for different seeds', () => {
		const a = mulberry32(1);
		const b = mulberry32(2);
		expect(a()).not.toEqual(b());
	});

	it('returns values in [0, 1)', () => {
		const rng = mulberry32(42);
		for (let i = 0; i < 1000; i++) {
			const v = rng();
			expect(v).toBeGreaterThanOrEqual(0);
			expect(v).toBeLessThan(1);
		}
	});
});

describe('randInt', () => {
	it('returns integers in [0, n)', () => {
		const rng = mulberry32(7);
		for (let i = 0; i < 1000; i++) {
			const v = randInt(rng, 52);
			expect(Number.isInteger(v)).toBe(true);
			expect(v).toBeGreaterThanOrEqual(0);
			expect(v).toBeLessThan(52);
		}
	});
});
