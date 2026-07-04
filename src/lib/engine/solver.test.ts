import { describe, expect, it } from 'vitest';
import { solve } from './solver';
import type { GameDefinition } from './types';

/**
 * A tiny deterministic fixture game the solver can chew on without any real
 * game. "Climb": state is a single integer `n`; the only move adds 1 up to a
 * ceiling; you win at `target`. This gives us a hand-verifiable optimal length
 * and a controllable branching factor via `branch` (each level offers `branch`
 * moves that all advance by 1, so the transposition table has real work to do).
 */
interface ClimbState {
	readonly n: number;
}
type ClimbMove = { readonly type: 'up'; readonly via: number };

function makeClimb(target: number, branch: number): GameDefinition<ClimbState, ClimbMove> {
	return {
		meta: { id: 'climb', name: 'Climb', blurb: 'fixture', difficulty: 'easy', family: 'test' },
		initialState: () => ({ n: 0 }),
		legalMoves: (state) =>
			state.n >= target
				? []
				: Array.from({ length: branch }, (_, via) => ({ type: 'up', via }) as ClimbMove),
		applyMove: (state, move) => ({ n: Math.min(target, state.n + 1) + move.via * 0 }),
		isWon: (state) => state.n === target
	};
}

/** Replay a solution from the initial state and report whether it wins. */
function replayWins<S, M>(def: GameDefinition<S, M>, solution: M[]): boolean {
	let state = def.initialState(0);
	for (const move of solution) state = def.applyMove(state, move);
	return def.isWon(state);
}

describe('solve', () => {
	it('returns an empty solution when the initial state is already won', () => {
		const def = makeClimb(0, 1);
		const result = solve(def, def.initialState(0), { nodeBudget: 10, key: (s) => String(s.n) });
		expect(result.solved).toBe(true);
		expect(result.solution).toEqual([]);
		expect(result.exhausted).toBe(false);
	});

	it('finds a solution whose replay reaches isWon (self-verifying)', () => {
		const def = makeClimb(6, 3);
		const result = solve(def, def.initialState(0), {
			nodeBudget: 1000,
			key: (s) => String(s.n)
		});
		expect(result.solved).toBe(true);
		expect(result.exhausted).toBe(false);
		// The core correctness guarantee: replaying the exact move list wins.
		expect(replayWins(def, result.solution)).toBe(true);
		expect(result.solution).toHaveLength(6);
	});

	it('uses the transposition table so nodes stay bounded despite wide branching', () => {
		// branch=8 but every move collapses to the same n → only `target`+1 distinct
		// states exist. Without a transposition table this would blow up.
		const def = makeClimb(10, 8);
		const result = solve(def, def.initialState(0), {
			nodeBudget: 100000,
			key: (s) => String(s.n)
		});
		expect(result.solved).toBe(true);
		expect(replayWins(def, result.solution)).toBe(true);
		// At most one expansion per distinct state (0..10 minus the won state).
		expect(result.nodes).toBeLessThanOrEqual(11);
	});

	it('respects the node budget and reports exhausted when it cannot finish', () => {
		const def = makeClimb(50, 3);
		const result = solve(def, def.initialState(0), {
			nodeBudget: 5,
			key: (s) => String(s.n)
		});
		expect(result.solved).toBe(false);
		expect(result.exhausted).toBe(true);
		expect(result.solution).toEqual([]);
		expect(result.nodes).toBeLessThanOrEqual(5);
	});

	it('terminates and reports no solution for an unwinnable, cycle-prone game', () => {
		// Two states that flip-flop forever; never won. The transposition table
		// guarantees termination and we report solved:false, exhausted:false.
		interface FlipState {
			readonly a: boolean;
		}
		type FlipMove = { readonly type: 'toggle' };
		const flip: GameDefinition<FlipState, FlipMove> = {
			meta: { id: 'flip', name: 'Flip', blurb: 'fixture', difficulty: 'easy', family: 'test' },
			initialState: () => ({ a: false }),
			legalMoves: () => [{ type: 'toggle' }],
			applyMove: (state) => ({ a: !state.a }),
			isWon: () => false
		};
		const result = solve(flip, flip.initialState(0), {
			nodeBudget: 1000,
			key: (s) => String(s.a)
		});
		expect(result.solved).toBe(false);
		expect(result.exhausted).toBe(false);
		expect(result.nodes).toBeLessThanOrEqual(2);
	});

	it('prunes states flagged isLost', () => {
		let lostChecks = 0;
		// Winnable only by never taking the losing branch; here every state past 0
		// is lost, so no win is reachable and isLost is consulted.
		const def: GameDefinition<ClimbState, ClimbMove> = {
			...makeClimb(5, 2),
			isLost: (state) => {
				lostChecks++;
				return state.n > 0;
			}
		};
		const result = solve(def, def.initialState(0), {
			nodeBudget: 1000,
			key: (s) => String(s.n)
		});
		expect(result.solved).toBe(false);
		expect(lostChecks).toBeGreaterThan(0);
	});
});
