/**
 * Spades (4 players, you + AI partner vs two AI). Spades are always trump.
 * Each player bids the tricks they'll take; partners' bids combine. Make the
 * contract for +10/trick (extra tricks are "bags" — 10 bags costs 100), miss it
 * for -10/bid. Bid Nil (0) for ±100. First partnership to 250 wins. Pure+seeded.
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

const NAMES = ['You', 'West', 'Partner', 'East'];
const TARGET = 250;
const teamOf = (seat: number) => seat % 2;

export interface SpadesState {
	readonly seed: number;
	readonly handNo: number;
	readonly dealer: number;
	readonly turn: number;
	readonly phase: 'bidding' | 'playing' | 'handComplete' | 'gameOver';
	readonly hands: readonly (readonly Card[])[];
	readonly bids: readonly (number | null)[];
	readonly trick: readonly Play[];
	readonly lastTrick: readonly Play[] | null;
	readonly tricksWon: readonly number[];
	readonly spadesBroken: boolean;
	readonly scores: readonly [number, number];
	readonly bags: readonly [number, number];
	readonly log: readonly string[];
	readonly handResult: string | null;
	readonly winner: number | null;
}

function note(log: readonly string[], msg: string): readonly string[] {
	return [...log, msg].slice(-6);
}

function deal(seed: number, handNo: number, dealer: number): SpadesState {
	const deck = shuffle(deck52(), mulberry32(seed + handNo * 5237 + 1));
	const hands: Card[][] = [[], [], [], []];
	deck.forEach((card, i) => hands[i % 4].push(card));
	return {
		seed,
		handNo,
		dealer,
		turn: (dealer + 1) % 4,
		phase: 'bidding',
		hands,
		bids: [null, null, null, null],
		trick: [],
		lastTrick: null,
		tricksWon: [0, 0, 0, 0],
		spadesBroken: false,
		scores: [0, 0],
		bags: [0, 0],
		log: [],
		handResult: null,
		winner: null
	};
}

const high = (cards: readonly Card[]) =>
	[...cards].sort((a, b) => rankValue(b.rank) - rankValue(a.rank))[0];
const low = (cards: readonly Card[]) =>
	[...cards].sort((a, b) => rankValue(a.rank) - rankValue(b.rank))[0];

/** Estimate the tricks a hand should take (used for AI bids). */
function aiBidValue(hand: readonly Card[]): number {
	let pts = 0;
	const spades = hand.filter((c) => c.suit === 'spades');
	for (const c of spades) {
		if (c.rank === 1) pts += 1;
		else if (c.rank === 13) pts += 0.85;
		else if (c.rank === 12) pts += 0.6;
	}
	pts += Math.max(0, spades.length - 3) * 0.5; // long trump
	for (const suit of ['hearts', 'diamonds', 'clubs'] as const) {
		const s = hand.filter((c) => c.suit === suit);
		if (s.some((c) => c.rank === 1)) pts += 1; // ace
		if (s.some((c) => c.rank === 13)) pts += s.length >= 2 ? 0.6 : 0.25; // king
		if (s.length === 0)
			pts += 1; // void → ruff
		else if (s.length === 1) pts += 0.4; // singleton
	}
	// nil candidate: a notably weak hand with no high spades
	const weak =
		!spades.some((c) => c.rank >= 11) && !hand.some((c) => c.suit !== 'spades' && c.rank === 1);
	if (weak && pts < 1.6) return 0;
	return Math.max(1, Math.min(13, Math.round(pts)));
}

function legalPlays(s: SpadesState, seat: number): Card[] {
	const hand = s.hands[seat];
	if (s.trick.length === 0) {
		const nonSpades = hand.filter((c) => c.suit !== 'spades');
		if (!s.spadesBroken && nonSpades.length > 0) return nonSpades; // can't lead spades until broken
		return [...hand];
	}
	return legalFollow(hand, s.trick[0].card.suit, 'spades');
}

function aiPlay(s: SpadesState, seat: number): Card {
	const opts = legalPlays(s, seat);
	if (opts.length === 1) return opts[0];
	const nil = s.bids[seat] === 0;

	if (s.trick.length === 0) {
		if (nil) return low(opts);
		const sideAces = opts.filter((c) => c.suit !== 'spades' && c.rank === 1);
		if (sideAces.length > 0) return sideAces[0];
		return low(opts);
	}

	const led = s.trick[0].card.suit;
	const winIdx = trickWinnerIndex(s.trick, 'spades');
	const winStrength = cardStrength(s.trick[winIdx].card, 'spades', led);
	const partnerWinning = teamOf(s.trick[winIdx].player) === teamOf(seat);
	const winning = opts
		.filter((c) => cardStrength(c, 'spades', led) > winStrength)
		.sort((a, b) => cardStrength(a, 'spades', led) - cardStrength(b, 'spades', led));

	if (nil) {
		const losing = opts.filter((c) => cardStrength(c, 'spades', led) < winStrength);
		return losing.length > 0 ? high(losing) : low(opts); // never win if avoidable
	}
	if (partnerWinning && s.trick.length >= 2) return low(opts); // let partner have it
	if (winning.length > 0) return winning[0]; // win as cheaply as possible
	return low(opts);
}

function playCard(s: SpadesState, seat: number, card: Card): SpadesState {
	const hands = s.hands.map((h, i) => (i === seat ? h.filter((c) => c.id !== card.id) : h));
	const trick = [...s.trick, { player: seat, card }];
	const spadesBroken = s.spadesBroken || card.suit === 'spades';
	if (trick.length === 4) return { ...s, hands, trick, spadesBroken };
	return { ...s, hands, trick, spadesBroken, turn: (seat + 1) % 4 };
}

function resolveTrick(s: SpadesState): SpadesState {
	const winner = s.trick[trickWinnerIndex(s.trick, 'spades')].player;
	const tricksWon = s.tricksWon.map((n, i) => (i === winner ? n + 1 : n));
	const total = tricksWon.reduce((a, b) => a + b, 0);
	const s2: SpadesState = {
		...s,
		tricksWon,
		trick: [],
		lastTrick: s.trick,
		turn: winner,
		log: note(s.log, `${NAMES[winner]} wins the trick.`)
	};
	if (total === 13) return scoreHand(s2);
	return s2;
}

function scoreHand(s: SpadesState): SpadesState {
	const scores: [number, number] = [s.scores[0], s.scores[1]];
	const bags: [number, number] = [s.bags[0], s.bags[1]];
	for (const team of [0, 1] as const) {
		const seats = team === 0 ? [0, 2] : [1, 3];
		const teamBid = seats.reduce((a, seat) => a + (s.bids[seat] || 0), 0);
		const teamTricks = seats.reduce((a, seat) => a + s.tricksWon[seat], 0);
		// nil bonuses/penalties
		for (const seat of seats) {
			if (s.bids[seat] === 0) scores[team] += s.tricksWon[seat] === 0 ? 100 : -100;
		}
		if (teamBid > 0) {
			if (teamTricks >= teamBid) {
				scores[team] += 10 * teamBid;
				bags[team] += teamTricks - teamBid;
				if (bags[team] >= 10) {
					scores[team] -= 100;
					bags[team] -= 10;
				}
			} else {
				scores[team] -= 10 * teamBid;
			}
		}
	}
	const over = scores[0] >= TARGET || scores[1] >= TARGET;
	const winner = over ? (scores[0] === scores[1] ? null : scores[0] > scores[1] ? 0 : 1) : null;
	const us = scores[0] - s.scores[0];
	const result = `Hand scored — you ${us >= 0 ? '+' : ''}${us}.`;
	return {
		...s,
		scores,
		bags,
		phase: over && winner !== null ? 'gameOver' : 'handComplete',
		winner,
		handResult: result,
		log: note(s.log, result)
	};
}

function stepAuto(s: SpadesState): SpadesState | null {
	if (s.phase === 'bidding') {
		if (s.turn === 0) return null;
		const bid = aiBidValue(s.hands[s.turn]);
		const bids = s.bids.map((b, i) => (i === s.turn ? bid : b));
		const allIn = bids.every((b) => b !== null);
		return {
			...s,
			bids,
			turn: allIn ? (s.dealer + 1) % 4 : (s.turn + 1) % 4,
			phase: allIn ? 'playing' : 'bidding',
			log: note(s.log, `${NAMES[s.turn]} bids ${bid === 0 ? 'Nil' : bid}.`)
		};
	}
	if (s.phase === 'playing') {
		if (s.trick.length === 4) return resolveTrick(s);
		if (s.turn === 0) return null;
		return playCard(s, s.turn, aiPlay(s, s.turn));
	}
	return null;
}

function apply(s: SpadesState, move: TrickMove): SpadesState {
	switch (move.type) {
		case 'bid': {
			if (s.phase !== 'bidding' || s.turn !== 0) return s;
			const bids = s.bids.map((b, i) => (i === 0 ? move.n : b));
			const allIn = bids.every((b) => b !== null);
			return {
				...s,
				bids,
				turn: allIn ? (s.dealer + 1) % 4 : 1,
				phase: allIn ? 'playing' : 'bidding',
				log: note(s.log, `You bid ${move.n === 0 ? 'Nil' : move.n}.`)
			};
		}
		case 'play': {
			if (s.phase !== 'playing' || s.turn !== 0) return s;
			const card = s.hands[0].find((c) => c.id === move.cardId);
			if (!card || !legalPlays(s, 0).some((c) => c.id === move.cardId)) return s;
			return playCard(s, 0, card);
		}
		case 'continue':
			if (s.phase !== 'handComplete') return s;
			return { ...deal(s.seed, s.handNo + 1, (s.dealer + 1) % 4), scores: s.scores, bags: s.bags };
		default:
			return s;
	}
}

function view(s: SpadesState): TableView {
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
		trump: 'spades',
		trumpLabel: 'Spades ♠',
		scoreboard: [
			{ label: 'You', value: s.scores[0], you: true },
			{ label: 'Them', value: s.scores[1], you: false }
		],
		banner: s.log.length > 0 ? s.log[s.log.length - 1] : null,
		phase: s.phase,
		result: s.handResult,
		winnerLabel: s.winner === null ? null : s.winner === 0 ? 'You win! 🎉' : 'Opponents win',
		prompt:
			s.phase === 'gameOver'
				? { kind: 'gameOver' }
				: s.phase === 'handComplete'
					? { kind: 'continue', title: s.handResult ?? undefined }
					: s.phase === 'bidding' && s.turn === 0
						? {
								kind: 'bid',
								title: 'How many tricks? (0 = Nil)',
								bids: Array.from({ length: 14 }, (_, i) => i)
							}
						: s.phase === 'playing' && s.turn === 0
							? { kind: 'play', title: `Your lead — you bid ${s.bids[0]}` }
							: { kind: 'none' }
	};
}

function suggest(s: SpadesState): TrickMove | null {
	if (s.phase === 'handComplete') return { type: 'continue' };
	if (s.turn !== 0) return null;
	if (s.phase === 'bidding') return { type: 'bid', n: aiBidValue(s.hands[0]) };
	if (s.phase === 'playing') return { type: 'play', cardId: aiPlay(s, 0).id };
	return null;
}

export const spades: AiCardGame<SpadesState> = {
	meta: {
		id: 'spades',
		name: 'Spades',
		blurb: 'Bid your tricks, partner up, and make the contract.',
		difficulty: 'hard',
		family: 'Trick-taking',
		howTo: [
			'You and your AI partner (North) face two AI opponents. Spades are always trump.',
			'First, each player bids how many of the 13 tricks they expect; partners’ bids add together into one contract.',
			'Follow the led suit if you can. You can’t lead spades until they’ve been "broken" by playing one.',
			'Make your combined bid for 10 points each; every extra trick is a "bag" (10 bags = −100). Miss the bid and lose 10 per trick bid.',
			'Bid Nil (0) and take no tricks for +100 — but +1 trick costs you 100. First partnership to 250 wins.'
		],
		learnMore: 'https://en.wikipedia.org/wiki/Spades_(card_game)'
	},
	newGame: (seed) => deal(seed, 0, 3),
	view,
	apply,
	stepAuto,
	suggest
};
