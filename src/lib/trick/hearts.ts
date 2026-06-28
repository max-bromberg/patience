/**
 * Hearts (4 players, you + 3 AI). Avoid taking hearts (1 point each) and the
 * Queen of Spades (13). Lowest score when someone hits 100 wins. "Shooting the
 * moon" (taking all 26) scores 0 for you and 26 for everyone else.
 *
 * This is the no-pass variant — there's no 3-card pass phase, so the whole game
 * is tap-to-play and shares the generic {@link TrickTable} UI. Pure + seeded.
 */

import { mulberry32, shuffle, type Card } from '$lib/engine';
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
const GAME_OVER_SCORE = 100;

export interface HeartsState {
	readonly seed: number;
	readonly handNo: number;
	readonly dealer: number;
	readonly turn: number;
	readonly phase: 'playing' | 'handComplete' | 'gameOver';
	readonly hands: readonly (readonly Card[])[];
	readonly trick: readonly Play[];
	readonly lastTrick: readonly Play[] | null;
	readonly tricksPlayed: number;
	readonly taken: readonly (readonly Card[])[]; // captured cards per seat
	readonly heartsBroken: boolean;
	readonly scores: readonly number[];
	readonly log: readonly string[];
	readonly handResult: string | null;
	readonly winner: number | null;
}

const isQueenSpades = (c: Card) => c.suit === 'spades' && c.rank === 12;
const isPoint = (c: Card) => c.suit === 'hearts' || isQueenSpades(c);
const pointValue = (c: Card) => (isQueenSpades(c) ? 13 : c.suit === 'hearts' ? 1 : 0);

function note(log: readonly string[], msg: string): readonly string[] {
	return [...log, msg].slice(-6);
}

function deal(seed: number, handNo: number, dealer: number): HeartsState {
	const deck = shuffle(deck52(), mulberry32(seed + handNo * 6151 + 1));
	const hands: Card[][] = [[], [], [], []];
	deck.forEach((card, i) => hands[i % 4].push(card));
	// the holder of 2♣ leads the first trick
	const leader = hands.findIndex((h) => h.some((c) => c.suit === 'clubs' && c.rank === 2));
	return {
		seed,
		handNo,
		dealer,
		turn: leader,
		phase: 'playing',
		hands,
		trick: [],
		lastTrick: null,
		tricksPlayed: 0,
		taken: [[], [], [], []],
		heartsBroken: false,
		scores: handNo === 0 ? [0, 0, 0, 0] : [],
		log: [],
		handResult: null,
		winner: null
	};
}

/** Legal cards for `seat` to play right now. */
function legalPlays(s: HeartsState, seat: number): Card[] {
	const hand = s.hands[seat];
	const firstTrick = s.tricksPlayed === 0;
	if (s.trick.length === 0) {
		// leading
		if (firstTrick) {
			const twoClubs = hand.find((c) => c.suit === 'clubs' && c.rank === 2);
			if (twoClubs) return [twoClubs]; // must open with 2♣
		}
		const nonHearts = hand.filter((c) => c.suit !== 'hearts');
		if (!s.heartsBroken && nonHearts.length > 0) return nonHearts; // can't lead hearts yet
		return [...hand];
	}
	// following
	const led = s.trick[0].card.suit;
	let opts = legalFollow(hand, led, null);
	if (firstTrick) {
		const safe = opts.filter((c) => !isPoint(c)); // no points on trick one
		if (safe.length > 0) opts = safe;
	}
	return opts;
}

function lowest(cards: readonly Card[]): Card {
	return [...cards].sort((a, b) => rankValue(a.rank) - rankValue(b.rank))[0];
}
function highest(cards: readonly Card[]): Card {
	return [...cards].sort((a, b) => rankValue(b.rank) - rankValue(a.rank))[0];
}

/** Heuristic Hearts AI: shed dangerous cards, duck tricks with points. */
function aiPlay(s: HeartsState, seat: number): Card {
	const opts = legalPlays(s, seat);
	if (opts.length === 1) return opts[0];
	const led = s.trick.length > 0 ? s.trick[0].card.suit : null;

	if (s.trick.length === 0) {
		// leading: get rid of low cards; never lead the Queen's suit high early
		const nonSpadeHigh = opts.filter((c) => !(c.suit === 'spades' && c.rank >= 12));
		return lowest(nonSpadeHigh.length > 0 ? nonSpadeHigh : opts);
	}

	const following = led !== null && s.hands[seat].some((c) => c.suit === led);
	if (following) {
		const winIdx = trickWinnerIndex(s.trick, null);
		const winStrength = cardStrength(s.trick[winIdx].card, null, led);
		const losing = opts.filter((c) => cardStrength(c, null, led) < winStrength);
		const pointsInTrick = s.trick.some((p) => isPoint(p.card));
		// last to play and no points yet? safe to take it cheaply.
		const lastToPlay = s.trick.length === 3;
		if (!pointsInTrick && lastToPlay) return lowest(opts);
		if (losing.length > 0) return highest(losing); // duck as high as safely possible
		return lowest(opts); // forced to win — do it with the smallest card
	}

	// void in the led suit → discard the most dangerous card
	const queen = opts.find(isQueenSpades);
	if (queen) return queen;
	const hearts = opts.filter((c) => c.suit === 'hearts');
	if (hearts.length > 0) return highest(hearts);
	// dump a high spade (to avoid being stuck winning the Queen later)
	const highSpades = opts.filter((c) => c.suit === 'spades' && c.rank >= 12);
	if (highSpades.length > 0) return highest(highSpades);
	return highest(opts);
}

function playCard(s: HeartsState, seat: number, card: Card): HeartsState {
	const hands = s.hands.map((h, i) => (i === seat ? h.filter((c) => c.id !== card.id) : h));
	const trick = [...s.trick, { player: seat, card }];
	const heartsBroken = s.heartsBroken || card.suit === 'hearts';
	if (trick.length === 4) {
		return { ...s, hands, trick, heartsBroken }; // resolved on the next step
	}
	return { ...s, hands, trick, heartsBroken, turn: (seat + 1) % 4 };
}

function resolveTrick(s: HeartsState): HeartsState {
	const winIdx = trickWinnerIndex(s.trick, null);
	const winner = s.trick[winIdx].player;
	const wonCards = s.trick.map((p) => p.card);
	const taken = s.taken.map((t, i) => (i === winner ? [...t, ...wonCards] : t));
	const tricksPlayed = s.tricksPlayed + 1;
	const pts = wonCards.reduce((a, c) => a + pointValue(c), 0);
	const s2: HeartsState = {
		...s,
		taken,
		trick: [],
		lastTrick: s.trick,
		tricksPlayed,
		turn: winner,
		log: note(s.log, `${NAMES[winner]} takes the trick${pts > 0 ? ` (+${pts})` : ''}.`)
	};
	if (tricksPlayed === 13) return scoreHand(s2);
	return s2;
}

function scoreHand(s: HeartsState): HeartsState {
	const handPts = s.taken.map((cards) => cards.reduce((a, c) => a + pointValue(c), 0));
	const shooter = handPts.findIndex((p) => p === 26);
	let gained: number[];
	let result: string;
	if (shooter >= 0) {
		gained = handPts.map((_, i) => (i === shooter ? 0 : 26));
		result = `${NAMES[shooter]} shot the moon! Everyone else +26.`;
	} else {
		gained = handPts;
		const worst = handPts.indexOf(Math.max(...handPts));
		result = `Hand over — ${NAMES[worst]} took the most (${handPts[worst]}).`;
	}
	const scores = s.scores.map((v, i) => v + gained[i]);
	const over = scores.some((v) => v >= GAME_OVER_SCORE);
	const winner = over ? scores.indexOf(Math.min(...scores)) : null;
	return {
		...s,
		scores,
		phase: over ? 'gameOver' : 'handComplete',
		winner,
		handResult: result,
		log: note(s.log, result)
	};
}

function stepAuto(s: HeartsState): HeartsState | null {
	if (s.phase !== 'playing') return null;
	if (s.trick.length === 4) return resolveTrick(s);
	if (s.turn === 0) return null; // human's turn
	return playCard(s, s.turn, aiPlay(s, s.turn));
}

function apply(s: HeartsState, move: TrickMove): HeartsState {
	switch (move.type) {
		case 'play': {
			if (s.phase !== 'playing' || s.turn !== 0) return s;
			const card = s.hands[0].find((c) => c.id === move.cardId);
			if (!card || !legalPlays(s, 0).some((c) => c.id === move.cardId)) return s;
			return playCard(s, 0, card);
		}
		case 'continue':
			if (s.phase !== 'handComplete') return s;
			return { ...deal(s.seed, s.handNo + 1, (s.dealer + 1) % 4), scores: s.scores };
		default:
			return s;
	}
}

function view(s: HeartsState): TableView {
	const playable = s.phase === 'playing' && s.turn === 0 ? legalPlays(s, 0).map((c) => c.id) : [];
	const handPts = s.taken.map((cards) => cards.reduce((a, c) => a + pointValue(c), 0));
	return {
		seats: 4,
		hand: sortHand(s.hands[0]),
		playable,
		opponents: [1, 2, 3].map((seat) => ({
			seat,
			name: NAMES[seat],
			count: s.hands[seat].length,
			active: s.turn === seat && s.phase === 'playing',
			dealer: seat === s.dealer,
			tricks: handPts[seat]
		})),
		trick: s.trick.map((p) => ({ player: p.player, name: NAMES[p.player], card: p.card })),
		trump: null,
		trumpLabel: null,
		scoreboard: s.scores.map((value, seat) => ({ label: NAMES[seat], value, you: seat === 0 })),
		banner: s.log.length > 0 ? s.log[s.log.length - 1] : null,
		phase: s.phase,
		result: s.handResult,
		winnerLabel:
			s.winner === null ? null : s.winner === 0 ? 'You win! 🎉' : `${NAMES[s.winner]} wins`,
		prompt:
			s.phase === 'gameOver'
				? { kind: 'gameOver' }
				: s.phase === 'handComplete'
					? { kind: 'continue', title: s.handResult ?? undefined }
					: s.turn === 0
						? { kind: 'play', title: 'Your lead — avoid hearts and the Q♠' }
						: { kind: 'none' }
	};
}

function suggest(s: HeartsState): TrickMove | null {
	if (s.phase === 'handComplete') return { type: 'continue' };
	if (s.phase !== 'playing' || s.turn !== 0) return null;
	return { type: 'play', cardId: aiPlay(s, 0).id };
}

export const hearts: AiCardGame<HeartsState> = {
	meta: {
		id: 'hearts',
		name: 'Hearts',
		blurb: 'Dodge every heart and the dreaded Queen of Spades.',
		difficulty: 'medium',
		family: 'Trick-taking',
		howTo: [
			'Four players; follow the led suit if you can. There is no trump.',
			'The 2♣ always leads the first trick, and you can’t lead hearts until one has been played ("hearts broken").',
			'Whoever plays the highest card of the led suit wins the trick — and any hearts or the Q♠ in it.',
			'Each heart is 1 point and the Queen of Spades is 13 — points are bad, so duck tricks that hold them.',
			'Take all 26 in a hand to "shoot the moon": you score 0 and everyone else gets 26. First to 100 ends it; lowest score wins.'
		],
		learnMore: 'https://en.wikipedia.org/wiki/Hearts_(card_game)'
	},
	newGame: (seed) => deal(seed, 0, 0),
	view,
	apply,
	stepAuto,
	suggest
};
