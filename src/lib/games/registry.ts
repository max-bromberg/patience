/**
 * The game catalog manifest. Adding a game = implement its module and add one
 * line here; the catalog and the generic player both read from this list, so no
 * other changes are needed (Architecture Principles §5).
 */

import type { AnyGame, Game, GameMeta } from '$lib/engine';
import { acesup } from './acesup';
import { fortythieves } from './fortythieves';
import { freecell } from './freecell';
import { golf } from './golf';
import { klondike, klondikeDraw1 } from './klondike';
import { pyramid } from './pyramid';
import { scorpion } from './scorpion';
import { spider1, spider2, spider4 } from './spider';
import { tripeaks } from './tripeaks';
import { yukon } from './yukon';

/**
 * Erase a game's private S/M to AnyGame. Safe: the shell only ever feeds a
 * game's own state back into its own methods, so the concrete types stay
 * internally consistent at runtime.
 */
function toAnyGame<S, M>(game: Game<S, M>): AnyGame {
	return game as unknown as AnyGame;
}

/** Ordered catalog. Order here is the order shown on the home grid. */
export const games: readonly AnyGame[] = [
	toAnyGame(klondike),
	toAnyGame(klondikeDraw1),
	toAnyGame(freecell),
	toAnyGame(yukon),
	toAnyGame(fortythieves),
	toAnyGame(scorpion),
	toAnyGame(spider1),
	toAnyGame(spider2),
	toAnyGame(spider4),
	toAnyGame(golf),
	toAnyGame(tripeaks),
	toAnyGame(pyramid),
	toAnyGame(acesup)
];

export const catalog: readonly GameMeta[] = games.map((g) => g.definition.meta);

export function getGame(id: string): AnyGame | undefined {
	return games.find((g) => g.definition.meta.id === id);
}
