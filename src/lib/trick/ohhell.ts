/**
 * Oh Hell (4 players, you + 3 AI). Each round deals one more card (1→7); the
 * next card off the deck sets trump. Everyone bids the EXACT number of tricks
 * they'll take — and the dealer is "hooked": their bid can't make the table
 * total equal the hand size, so someone always misses. Make your bid exactly
 * for 10 + bid points. Most points after seven rounds wins. Pure + seeded.
 */

import { mulberry32, shuffle, type Card, type Suit } from '$lib/engine';
import type { AiCardGame, TableView, TrickMove } from './aigame';
import {
	cardStrength,
	deck52,
	legalFollow,
	rankValue,
	sortHand,
	trickWinnerIndex,
	type Play
} from './standard';

const NAMES = ['You', 'West', 'North', 'East'];
const ROUNDS = [1, 2, 3, 4, 5, 6, 7] as const;
const SUIT_NAME: Record<Suit, string> = {
	spades: 'Spades ♠',
	hearts: 'Hearts ♥',
	diamonds: 'Diamonds ♦',
	clubs: 'Clubs ♣'
};

export interface OhHellState {
	readonly seed: number;
	readonly roundIdx: number;
	readonly handSize: number;
	readonly dealer: number;
	readonly turn: number;
	readonly leader: number;
	readonly phase: 'bidding' | 'playing' | 'handComplete' | 'gameOver';
	readonly trump: Suit | null;
	readonly turnUp: Card | null;
	readonly hands: readonly (readonly Card[])[];
	readonly bids: readonly (number | null)[];
	readonly trick: readonly Play[];
	readonly lastTrick: readonly Play[] | null;
	readonly tricksWon: readonly number[];
	readonly scores: readonly number[];
	readonly log: readonly string[];
	readonly handResult: string | null;
	readonly winner: number | null;
}

function note(log: readonly string[], msg: string): readonly string[] {
	return [...log, msg].slice(-6);
}

function deal(
	seed: number,
	roundIdx: number,
	dealer: number,
	scores: readonly number[]
): OhHellState {
	const handSize = ROUNDS[roundIdx];
	const deck = shuffle(deck52(), mulberry32(seed + roundIdx * 4099 + 1));
	const hands: Card[][] = [[], [], [], []];
	let k = 0;
	for (let r = 0; r < handSize; r++)
		for (let p = 0; p < 4; p++) hands[(dealer + 1 + p) % 4].push(deck[k++]);
	const turnUp = deck[k] ?? null;
	const leader = (dealer + 1) % 4;
	return {
		seed,
		roundIdx,
		handSize,
		dealer,
		turn: leader,
		leader,
		phase: 'bidding',
		trump: turnUp ? turnUp.suit : null,
		turnUp,
		hands,
		bids: [null, null, null, null],
		trick: [],
		lastTrick: null,
		tricksWon: [0, 0, 0, 0],
		scores,
		log: [],
		handResult: null,
		winner: null
	};
}

const high = (cards: readonly Card[]) =>
	[...cards].sort((a, b) => rankValue(b.rank) - rankValue(a.rank))[0];
const low = (cards: readonly Card[]) =>
	[...cards].sort((a, b) => rankValue(a.rank) - rankValue(b.rank))[0];

/** The bid forbidden to the dealer (would make the table total equal handSize). */
function forbiddenDealerBid(s: OhHellState): number | null {
	const others = s.bids.reduce((a: number, b) => a + (b ?? 0), 0);
	const f = s.handSize - others;
	return f >= 0 && f <= s.handSize ? f : null;
}

function aiBidValue(hand: readonly Card[], trump: Suit | null): number {
	let e = 0;
	for (const c of hand) {
		if (trump && c.suit === trump) e += c.rank === 1 ? 0.95 : c.rank >= 12 ? 0.7 : 0.45;
		else if (c.rank === 1) e += 0.8;
		else if (c.rank === 13) e += 0.45;
	}
	return Math.max(0, Math.min(hand.length, Math.round(e)));
}

/** AI/human-suggestion bid, honoring the dealer hook. */
function chooseBid(s: OhHellState, seat: number): number {
	let bid = aiBidValue(s.hands[seat], s.trump);
	if (seat === s.dealer) {
		const f = forbiddenDealerBid(s);
		if (f !== null && bid === f) bid = bid > 0 ? bid - 1 : 1; // nudge off the forbidden value
	}
	return Math.max(0, Math.min(s.handSize, bid));
}

function legalPlays(s: OhHellState, seat: number): Card[] {
	if (s.trick.length === 0) return [...s.hands[seat]];
	return legalFollow(s.hands[seat], s.trick[0].card.suit, s.trump);
}

function aiPlay(s: OhHellState, seat: number): Card {
	const opts = legalPlays(s, seat);
	if (opts.length === 1) return opts[0];
	const need = (s.bids[seat] ?? 0) - s.tricksWon[seat];

	if (s.trick.length === 0) {
		if (need > 0) return high(opts); // want tricks → lead strong
		return low(opts); // done bidding → shed low
	}
	const led = s.trick[0].card.suit;
	const winIdx = trickWinnerIndex(s.trick, s.trump);
	const winStrength = cardStrength(s.trick[winIdx].card, s.trump, led);
	const winning = opts
		.filter((c) => cardStrength(c, s.trump, led) > winStrength)
		.sort((a, b) => cardStrength(a, s.trump, led) - cardStrength(b, s.trump, led));
	const losing = opts.filter((c) => cardStrength(c, s.trump, led) < winStrength);

	if (need > 0) return winning.length > 0 ? winning[0] : low(opts); // grab it cheaply or duck
	return losing.length > 0 ? high(losing) : low(opts); // avoid winning
}

function playCard(s: OhHellState, seat: number, card: Card): OhHellState {
	const hands = s.hands.map((h, i) => (i === seat ? h.filter((c) => c.id !== card.id) : h));
	const trick = [...s.trick, { player: seat, card }];
	if (trick.length === 4) return { ...s, hands, trick };
	return { ...s, hands, trick, turn: (seat + 1) % 4 };
}

function resolveTrick(s: OhHellState): OhHellState {
	const winner = s.trick[trickWinnerIndex(s.trick, s.trump)].player;
	const tricksWon = s.tricksWon.map((n, i) => (i === winner ? n + 1 : n));
	const total = tricksWon.reduce((a, b) => a + b, 0);
	const s2: OhHellState = {
		...s,
		tricksWon,
		trick: [],
		lastTrick: s.trick,
		turn: winner,
		leader: winner,
		log: note(s.log, `${NAMES[winner]} wins the trick.`)
	};
	if (total === s.handSize) return scoreHand(s2);
	return s2;
}

function scoreHand(s: OhHellState): OhHellState {
	const scores = s.scores.map(
		(v, seat) => v + (s.tricksWon[seat] === s.bids[seat] ? 10 + (s.bids[seat] ?? 0) : 0)
	);
	const last = s.roundIdx === ROUNDS.length - 1;
	const made = s.tricksWon[0] === s.bids[0];
	const result = made
		? `You made your bid of ${s.bids[0]}! +${10 + (s.bids[0] ?? 0)}`
		: `You bid ${s.bids[0]}, took ${s.tricksWon[0]}.`;
	const winner = last ? scores.indexOf(Math.max(...scores)) : null;
	return {
		...s,
		scores,
		phase: last ? 'gameOver' : 'handComplete',
		winner,
		handResult: result,
		log: note(s.log, result)
	};
}

function advanceBid(s: OhHellState, seat: number, bid: number): OhHellState {
	const bids = s.bids.map((b, i) => (i === seat ? bid : b));
	const allIn = bids.every((b) => b !== null);
	return {
		...s,
		bids,
		phase: allIn ? 'playing' : 'bidding',
		turn: allIn ? s.leader : (seat + 1) % 4,
		log: note(s.log, `${NAMES[seat]} bids ${bid}.`)
	};
}

function stepAuto(s: OhHellState): OhHellState | null {
	if (s.phase === 'bidding') {
		if (s.turn === 0) return null;
		return advanceBid(s, s.turn, chooseBid(s, s.turn));
	}
	if (s.phase === 'playing') {
		if (s.trick.length === 4) return resolveTrick(s);
		if (s.turn === 0) return null;
		return playCard(s, s.turn, aiPlay(s, s.turn));
	}
	return null;
}

function apply(s: OhHellState, move: TrickMove): OhHellState {
	switch (move.type) {
		case 'bid':
			if (s.phase !== 'bidding' || s.turn !== 0) return s;
			if (move.n < 0 || move.n > s.handSize) return s;
			if (s.dealer === 0 && forbiddenDealerBid(s) === move.n) return s; // hooked
			return advanceBid(s, 0, move.n);
		case 'play': {
			if (s.phase !== 'playing' || s.turn !== 0) return s;
			const card = s.hands[0].find((c) => c.id === move.cardId);
			if (!card || !legalPlays(s, 0).some((c) => c.id === move.cardId)) return s;
			return playCard(s, 0, card);
		}
		case 'continue':
			if (s.phase !== 'handComplete') return s;
			return deal(s.seed, s.roundIdx + 1, (s.dealer + 1) % 4, s.scores);
		default:
			return s;
	}
}

function humanBidOptions(s: OhHellState): number[] {
	const all = Array.from({ length: s.handSize + 1 }, (_, i) => i);
	if (s.dealer === 0) {
		const f = forbiddenDealerBid(s);
		if (f !== null) return all.filter((n) => n !== f);
	}
	return all;
}

function view(s: OhHellState): TableView {
	const playable = s.phase === 'playing' && s.turn === 0 ? legalPlays(s, 0).map((c) => c.id) : [];
	return {
		seats: 4,
		hand: sortHand(s.hands[0]),
		playable,
		opponents: [1, 2, 3].map((seat) => ({
			seat,
			name: NAMES[seat],
			count: s.hands[seat].length,
			active: s.turn === seat && (s.phase === 'playing' || s.phase === 'bidding'),
			dealer: seat === s.dealer,
			bid: s.bids[seat],
			tricks: s.tricksWon[seat]
		})),
		trick: s.trick.map((p) => ({ player: p.player, name: NAMES[p.player], card: p.card })),
		trump: s.trump,
		trumpLabel: s.trump ? SUIT_NAME[s.trump] : null,
		scoreboard: s.scores.map((value, seat) => ({ label: NAMES[seat], value, you: seat === 0 })),
		banner:
			s.log.length > 0
				? s.log[s.log.length - 1]
				: `Round ${s.roundIdx + 1} of ${ROUNDS.length} — ${s.handSize} card${s.handSize > 1 ? 's' : ''}`,
		phase: s.phase,
		result: s.handResult,
		winnerLabel:
			s.winner === null ? null : s.winner === 0 ? 'You win! 🎉' : `${NAMES[s.winner]} wins`,
		prompt:
			s.phase === 'gameOver'
				? { kind: 'gameOver' }
				: s.phase === 'handComplete'
					? { kind: 'continue', title: s.handResult ?? undefined }
					: s.phase === 'bidding' && s.turn === 0
						? {
								kind: 'bid',
								title: `Bid your tricks (${s.handSize} in hand)`,
								bids: humanBidOptions(s)
							}
						: s.phase === 'playing' && s.turn === 0
							? { kind: 'play', title: `You bid ${s.bids[0]} — took ${s.tricksWon[0]} so far` }
							: { kind: 'none' }
	};
}

function suggest(s: OhHellState): TrickMove | null {
	if (s.phase === 'handComplete') return { type: 'continue' };
	if (s.turn !== 0) return null;
	if (s.phase === 'bidding') return { type: 'bid', n: chooseBid(s, 0) };
	if (s.phase === 'playing') return { type: 'play', cardId: aiPlay(s, 0).id };
	return null;
}

export const ohhell: AiCardGame<OhHellState> = {
	meta: {
		id: 'ohhell',
		name: 'Oh Hell',
		blurb: 'Bid the exact tricks you’ll take — no more, no less.',
		difficulty: 'medium',
		family: 'Trick-taking',
		howTo: [
			'Seven rounds, dealing one more card each time (1 up to 7). The next card off the deck sets the trump suit.',
			'Everyone bids exactly how many tricks they will take — being precise is everything.',
			'The dealer is "hooked": their bid can’t make the table’s total equal the number of tricks, so at least one player must miss.',
			'Follow the led suit if you can; highest trump (or highest of the led suit) wins the trick.',
			'Hit your bid exactly for 10 + your bid in points; miss by any amount and score nothing. Most points after round seven wins.'
		],
		learnMore: 'https://en.wikipedia.org/wiki/Oh_Hell'
	},
	newGame: (seed) => deal(seed, 0, 3, [0, 0, 0, 0]),
	view,
	apply,
	stepAuto,
	suggest
};
