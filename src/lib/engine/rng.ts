/**
 * Seedable PRNG. ALL shuffling goes through this — never `Math.random` — so
 * deals are reproducible from a seed (shareable deals, optional daily challenge).
 */

/** A pure random source: each call returns a float in [0, 1). */
export type Rng = () => number;

/**
 * mulberry32 — a tiny, fast, well-distributed 32-bit PRNG. Deterministic for a
 * given seed.
 */
export function mulberry32(seed: number): Rng {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** Random integer in [0, n). */
export function randInt(rng: Rng, n: number): number {
	return Math.floor(rng() * n);
}
