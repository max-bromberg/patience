/**
 * A generic, bounded solitaire solver. PURE — no Svelte/DOM imports, no `any`.
 *
 * The solver knows nothing about any specific game: it operates purely through
 * the {@link GameDefinition} contract (legalMoves / applyMove / isWon / isLost).
 * It runs an iterative depth-first search with an explicit stack, ordered
 * greedily by an optional heuristic (higher = closer to a win), and guarded by
 * two things that together guarantee termination:
 *
 *  1. a transposition table (a `Set` of visited state keys) so no state is ever
 *     enqueued twice — this makes even games with stock recycling terminate and
 *     keeps memory bounded; and
 *  2. a hard `nodeBudget` on the number of expansions.
 *
 * The returned {@link SolveResult.solution} is a concrete move list: replaying
 * it from `initial` via {@link GameDefinition.applyMove} is guaranteed to reach
 * a state where {@link GameDefinition.isWon} holds. That makes every solution
 * self-verifying.
 */

import type { GameDefinition } from './types';

// `M` is part of the required public signature (it pairs with SolveResult<M> and
// keeps call sites reading `SolveOptions<S, M>`), even though only `S` is used here.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export interface SolveOptions<S, M> {
	/** Maximum number of state expansions before giving up. */
	readonly nodeBudget: number;
	/**
	 * Canonical string key for a state, used as the transposition-table identity.
	 * Two states with the same key are treated as identical. `JSON.stringify` is
	 * a safe generic default for plain-data states.
	 */
	readonly key: (s: S) => string;
	/**
	 * Optional greedy ordering signal — higher means "looks closer to a win".
	 * Successors are explored highest-first. Omit for plain DFS order.
	 */
	readonly heuristic?: (s: S) => number;
}

export interface SolveResult<M> {
	/** True once a state satisfying `isWon` was reached. */
	readonly solved: boolean;
	/**
	 * The exact move sequence from the initial state to a won state (empty if the
	 * initial state was already won, or if `solved` is false).
	 */
	readonly solution: M[];
	/** Number of states expanded. */
	readonly nodes: number;
	/** True when the search hit `nodeBudget` without proving a win. */
	readonly exhausted: boolean;
}

interface StackEntry<S> {
	readonly state: S;
	/** Index into the parent/move arrays, for path reconstruction. */
	readonly id: number;
}

interface Successor<S, M> {
	readonly state: S;
	readonly move: M;
	readonly score: number;
}

/**
 * Search for a winning line from `initial`. Deterministic given the same
 * definition, state and options.
 */
export function solve<S, M>(
	def: GameDefinition<S, M>,
	initial: S,
	opts: SolveOptions<S, M>
): SolveResult<M> {
	const { nodeBudget, key, heuristic } = opts;

	if (def.isWon(initial)) {
		return { solved: true, solution: [], nodes: 0, exhausted: false };
	}

	// Parent-pointer tree: node `id` was reached from `parentOf[id]` via
	// `moveInto[id]`. Reconstructing a path never copies growing arrays, and the
	// live stack only ever holds each distinct state once.
	const parentOf: number[] = [-1];
	const moveInto: (M | null)[] = [null];

	const reconstruct = (id: number, last: M): M[] => {
		const rev: M[] = [last];
		let cur = id;
		while (cur > 0) {
			const m = moveInto[cur];
			if (m !== null) rev.push(m);
			cur = parentOf[cur];
		}
		rev.reverse();
		return rev;
	};

	const visited = new Set<string>([key(initial)]);
	const stack: StackEntry<S>[] = [{ state: initial, id: 0 }];
	let nextId = 1;
	let nodes = 0;

	while (stack.length > 0) {
		const entry = stack.pop();
		if (entry === undefined) break;

		// Budget is measured in expansions; bail before doing more work.
		if (nodes >= nodeBudget) {
			return { solved: false, solution: [], nodes, exhausted: true };
		}
		nodes++;

		const { state, id } = entry;

		// A dead state cannot lead to a win — prune it.
		if (def.isLost?.(state)) continue;

		const successors: Successor<S, M>[] = [];
		for (const move of def.legalMoves(state)) {
			const next = def.applyMove(state, move);
			if (def.isWon(next)) {
				return { solved: true, solution: reconstruct(id, move), nodes, exhausted: false };
			}
			const nk = key(next);
			if (visited.has(nk)) continue;
			visited.add(nk); // dedup on generation: each distinct state is enqueued once
			successors.push({ state: next, move, score: heuristic ? heuristic(next) : 0 });
		}

		// Stack is LIFO: sort ascending so the highest-scoring successor is pushed
		// last and therefore popped (explored) first.
		if (heuristic) successors.sort((a, b) => a.score - b.score);
		for (const s of successors) {
			const childId = nextId++;
			parentOf[childId] = id;
			moveInto[childId] = s.move;
			stack.push({ state: s.state, id: childId });
		}
	}

	return { solved: false, solution: [], nodes, exhausted: false };
}
