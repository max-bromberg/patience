/**
 * Pure dry-run of an auto-to-foundation cascade: would repeatedly sending top
 * cards to foundations (via the game's `autoMove`) win from `state`? Used to
 * gate the "Auto-finish" affordance to the trivially-solved endgame. Auto-moves
 * are monotonic (foundations only grow), so this always terminates.
 */

import type { GameDefinition, GamePresenter } from '$lib/engine';

export function autoFinishWins<S, M>(
	def: GameDefinition<S, M>,
	presenter: GamePresenter<S, M>,
	state: S
): boolean {
	if (!def.autoMove || def.isWon(state)) return false;
	let s = state;
	for (let guard = 0; guard < 300; guard++) {
		let moved = false;
		for (const pile of presenter.piles(s)) {
			const top = pile.cards[pile.cards.length - 1];
			if (!top) continue;
			const move = def.autoMove(s, top);
			if (move) {
				s = def.applyMove(s, move);
				moved = true;
				break;
			}
		}
		if (!moved) break;
	}
	return def.isWon(s);
}
