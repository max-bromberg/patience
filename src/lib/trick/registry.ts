/**
 * Catalog entries for the trick-taking games. These don't use the solitaire
 * {@link GameDefinition} contract (they have hidden hands, AI opponents and a
 * bidding phase), so they carry their own metadata here and the player route
 * renders them with {@link EuchreTable} instead of the generic pile Table.
 */

import type { GameMeta } from '$lib/engine';

export interface TrickGame {
	readonly meta: GameMeta;
}

const euchre: TrickGame = {
	meta: {
		id: 'euchre',
		name: 'Euchre',
		blurb: 'Partner with an AI to take tricks and race to 10 points.',
		difficulty: 'medium',
		family: 'Trick-taking',
		howTo: [
			'You (South) and your partner (North) play against two AI opponents.',
			'Each hand, a card is turned up. In round one you may order it up as trump; if all pass, round two lets someone name a different suit.',
			'The Jack of trump (right bower) is highest, then the Jack of the same colour (left bower), then A K Q 10 9 of trump.',
			'Follow the led suit if you can. The team that calls trump must win at least 3 of the 5 tricks or get "euchred" (+2 to the other team).',
			'Win all 5 for 2 points, or go alone (partner sits out) and sweep for 4. First team to 10 wins.'
		],
		learnMore: 'https://en.wikipedia.org/wiki/Euchre'
	}
};

export const trickGames: readonly TrickGame[] = [euchre];

export const trickCatalog: readonly GameMeta[] = trickGames.map((g) => g.meta);

export function getTrickGame(id: string): TrickGame | undefined {
	return trickGames.find((g) => g.meta.id === id);
}

export function isTrickGame(id: string): boolean {
	return trickGames.some((g) => g.meta.id === id);
}
