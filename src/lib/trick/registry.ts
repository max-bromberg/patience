/**
 * Catalog entries for the trick-taking games. These don't use the solitaire
 * {@link GameDefinition} contract (they have hidden hands, AI opponents and a
 * bidding phase), so they carry their own metadata here and the player route
 * renders them with {@link EuchreTable} instead of the generic pile Table.
 */

import type { GameMeta } from '$lib/engine';
import type { AiCardGame } from './aigame';
import { hearts } from './hearts';
import { spades } from './spades';
import { ohhell } from './ohhell';

/**
 * A trick-taking catalog entry. Two engine kinds exist: the bespoke Euchre
 * state machine (selected by `variant`), and the generic 52-card
 * {@link AiCardGame} interface (carried in `game`). The player route dispatches
 * on `kind`.
 */
export interface TrickGame {
	readonly meta: GameMeta;
	readonly kind: 'euchre' | 'ai';
	/** Euchre variant id (kind === 'euchre'). */
	readonly variant?: string;
	/** The pluggable 52-card game (kind === 'ai'). */
	readonly game?: AiCardGame<unknown>;
}

function ai(game: AiCardGame<unknown>): TrickGame {
	return { meta: game.meta, kind: 'ai', game };
}

const BOWERS =
	'The Jack of trump (right bower) is highest, then the Jack of the same colour (left bower), then A K Q 10 9 of trump.';

const euchre: TrickGame = {
	kind: 'euchre',
	variant: 'euchre',
	meta: {
		id: 'euchre',
		name: 'Euchre',
		blurb: 'Partner with an AI to take tricks and race to 10 points.',
		difficulty: 'medium',
		family: 'Trick-taking',
		howTo: [
			'You (South) and your partner (North) play against two AI opponents.',
			'Each hand, a card is turned up. In round one you may order it up as trump; if all pass, round two lets someone name a different suit.',
			BOWERS,
			'Follow the led suit if you can. The team that calls trump must win at least 3 of the 5 tricks or get "euchred" (+2 to the other team).',
			'Win all 5 for 2 points, or go alone (partner sits out) and sweep for 4. First team to 10 wins.'
		],
		learnMore: 'https://en.wikipedia.org/wiki/Euchre'
	}
};

const euchre2: TrickGame = {
	kind: 'euchre',
	variant: 'euchre2',
	meta: {
		id: 'euchre2',
		name: 'Euchre Duel',
		blurb: 'Head-to-head Euchre against a single AI — no partners, pure skill.',
		difficulty: 'medium',
		family: 'Trick-taking',
		howTo: [
			'Two-handed Euchre: just you versus one AI, five cards each.',
			'Bid as usual — order up the turned card or name a suit in round two.',
			BOWERS,
			'Whoever calls trump must take at least 3 of the 5 tricks or be euchred (+2 to the opponent).',
			'3–4 tricks score 1, all five score 2. First to 10 points wins.'
		],
		learnMore: 'https://en.wikipedia.org/wiki/Euchre#Two_players'
	}
};

const euchre3: TrickGame = {
	kind: 'euchre',
	variant: 'euchre3',
	meta: {
		id: 'euchre3',
		name: 'Cutthroat Euchre',
		blurb: 'Three-player free-for-all: the maker takes on both opponents alone.',
		difficulty: 'hard',
		family: 'Trick-taking',
		howTo: [
			'Three-handed Euchre with no partnerships — every player for themselves.',
			'The player who calls trump plays alone against the other two.',
			BOWERS,
			'Make 3–4 tricks for 1 point, sweep all five for 2. Get euchred and BOTH opponents score 2.',
			'First player to 10 points wins.'
		],
		learnMore: 'https://en.wikipedia.org/wiki/Euchre#Three_players'
	}
};

export const trickGames: readonly TrickGame[] = [
	euchre,
	euchre2,
	euchre3,
	ai(hearts),
	ai(spades),
	ai(ohhell)
];

export const trickCatalog: readonly GameMeta[] = trickGames.map((g) => g.meta);

export function getTrickGame(id: string): TrickGame | undefined {
	return trickGames.find((g) => g.meta.id === id);
}

export function isTrickGame(id: string): boolean {
	return trickGames.some((g) => g.meta.id === id);
}
