/**
 * A little well of card wisdom for the home page — quotes about playing cards
 * and the lessons a deck can teach (patience, playing the hand you're dealt,
 * fresh starts). Picked at random on the client so it changes each visit.
 */

export interface Quote {
	readonly text: string;
	readonly author: string;
}

export const CARD_QUOTES: readonly Quote[] = [
	{
		text: 'Life is not always a matter of holding good cards, but sometimes playing a poor hand well.',
		author: 'Jack London'
	},
	{ text: 'Patience — and shuffle the cards.', author: 'Miguel de Cervantes' },
	{
		text: 'You’ve got to know when to hold ’em, know when to fold ’em.',
		author: 'Kenny Rogers'
	},
	{ text: 'Cards are war, in disguise of a sport.', author: 'Charles Lamb' },
	{
		text: 'Chance gives us the cards; it is for us to play them well.',
		author: 'Card-table proverb'
	},
	{
		text: 'The cards beat all the players, though they were honest enough.',
		author: 'Eden Phillpotts'
	},
	{
		text: 'A good player who is in bad luck has the chance to show real character.',
		author: 'Poker proverb'
	},
	{
		text: 'Every deal is a fresh start — the last hand is already history.',
		author: 'On solitaire'
	},
	{
		text: 'The deck may be stacked, but you still choose how to play it.',
		author: 'A patient gambler'
	},
	{
		text: 'Fortune favours the player who counts what’s already been played.',
		author: 'Table wisdom'
	},
	{
		text: 'It’s not the hand you’re dealt, but how you lay it down.',
		author: 'An old dealer'
	},
	{ text: 'Solitaire teaches you to lose gracefully and deal again.', author: 'Anonymous' }
];

/** Pick a quote. Pass an index to make it deterministic; omit for a random one. */
export function pickQuote(index?: number): Quote {
	const i = index ?? Math.floor(Math.random() * CARD_QUOTES.length);
	return CARD_QUOTES[((i % CARD_QUOTES.length) + CARD_QUOTES.length) % CARD_QUOTES.length];
}
