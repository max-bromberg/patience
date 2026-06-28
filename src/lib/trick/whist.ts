/**
 * Whist (4 players, you + AI partner vs two AI) — the classic ancestor of
 * Bridge. All 52 cards are dealt; the dealer's last card is turned up to set
 * trump. No bidding: just take tricks. The side that wins more than six "books"
 * scores a point per extra trick; first partnership to 7 wins. Pure + seeded.
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

const NAMES = ['You', 'West', 'Partner', 'East'];
const SUIT_NAME: Record<Suit, string> = {
	spades: 'Spades ♠',
	hearts: 'Hearts ♥',
	diamonds: 'Diamonds ♦',
	clubs: 'Clubs ♣'
};
const TARGET = 7;
const teamOf = (seat: number) => seat % 2;

export interface WhistState {
	readonly seed: number;
	readonly handNo: number;
	readonly dealer: number;
	readonly turn: number;
	readonly phase: 'playing' | 'handComplete' | 'gameOver';
	readonly trump: Suit;
	readonly trumpCard: Card;
	readonly hands: readonly (readonly Card[])[];
	readonly trick: readonly Play[];
	readonly lastTrick: readonly Play[] | null;
	readonly tricksWon: readonly number[];
	readonly scores: readonly [number, number];
	readonly log: readonly string[];
	readonly handResult: string | null;
	readonly winner: number | null;
}

function note(log: readonly string[], msg: string): readonly string[] {
	return [...log, msg].slice(-6);
}

function deal(seed: number, handNo: number, dealer: number): WhistState {
	const deck = shuffle(deck52(), mulberry32(seed + handNo * 6299 + 1));
	const hands: Card[][] = [[], [], [], []];
	let k = 0;
	for (let r = 0; r < 13; r++)
		for (let p = 0; p < 4; p++) hands[(dealer + 1 + p) % 4].push(deck[k++]);
	const trumpCard = deck[k - 1]; // the dealer's last card is turned up for trump
	return {
		seed,
		handNo,
		dealer,
		turn: (dealer + 1) % 4,
		phase: 'playing',
		trump: trumpCard.suit,
		trumpCard,
		hands,
		trick: [],
		lastTrick: null,
		tricksWon: [0, 0, 0, 0],
		scores: [0, 0],
		log: [`Trump is ${SUIT_NAME[trumpCard.suit]}.`],
		handResult: null,
		winner: null
	};
}

const low = (cards: readonly Card[]) =>
	[...cards].sort((a, b) => rankValue(a.rank) - rankValue(b.rank))[0];

function legalPlays(s: WhistState, seat: number): Card[] {
	if (s.trick.length === 0) return [...s.hands[seat]];
	return legalFollow(s.hands[seat], s.trick[0].card.suit, s.trump);
}

function aiPlay(s: WhistState, seat: number): Card {
	const opts = legalPlays(s, seat);
	if (opts.length === 1) return opts[0];
	if (s.trick.length === 0) {
		const sideAces = opts.filter((c) => c.suit !== s.trump && c.rank === 1);
		return sideAces.length > 0 ? sideAces[0] : low(opts);
	}
	const led = s.trick[0].card.suit;
	const winIdx = trickWinnerIndex(s.trick, s.trump);
	const winStrength = cardStrength(s.trick[winIdx].card, s.trump, led);
	const partnerWinning = teamOf(s.trick[winIdx].player) === teamOf(seat);
	const winning = opts
		.filter((c) => cardStrength(c, s.trump, led) > winStrength)
		.sort((a, b) => cardStrength(a, s.trump, led) - cardStrength(b, s.trump, led));
	if (partnerWinning && s.trick.length >= 2) return low(opts);
	if (winning.length > 0) return winning[0];
	return low(opts);
}

function playCard(s: WhistState, seat: number, card: Card): WhistState {
	const hands = s.hands.map((h, i) => (i === seat ? h.filter((c) => c.id !== card.id) : h));
	const trick = [...s.trick, { player: seat, card }];
	if (trick.length === 4) return { ...s, hands, trick };
	return { ...s, hands, trick, turn: (seat + 1) % 4 };
}

function resolveTrick(s: WhistState): WhistState {
	const winner = s.trick[trickWinnerIndex(s.trick, s.trump)].player;
	const tricksWon = s.tricksWon.map((n, i) => (i === winner ? n + 1 : n));
	const total = tricksWon.reduce((a, b) => a + b, 0);
	const s2: WhistState = {
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

function scoreHand(s: WhistState): WhistState {
	const teamTricks = [s.tricksWon[0] + s.tricksWon[2], s.tricksWon[1] + s.tricksWon[3]];
	const scores: [number, number] = [s.scores[0], s.scores[1]];
	let result: string;
	if (teamTricks[0] > 6) {
		scores[0] += teamTricks[0] - 6;
		result = `You took ${teamTricks[0]} tricks — +${teamTricks[0] - 6}.`;
	} else if (teamTricks[1] > 6) {
		scores[1] += teamTricks[1] - 6;
		result = `Opponents took ${teamTricks[1]} — +${teamTricks[1] - 6} for them.`;
	} else {
		result = 'Six tricks each — no score.';
	}
	const over = scores[0] >= TARGET || scores[1] >= TARGET;
	const winner = over ? (scores[0] > scores[1] ? 0 : 1) : null;
	return {
		...s,
		scores,
		phase: over ? 'gameOver' : 'handComplete',
		winner,
		handResult: result,
		log: note(s.log, result)
	};
}

function stepAuto(s: WhistState): WhistState | null {
	if (s.phase !== 'playing') return null;
	if (s.trick.length === 4) return resolveTrick(s);
	if (s.turn === 0) return null;
	return playCard(s, s.turn, aiPlay(s, s.turn));
}

function apply(s: WhistState, move: TrickMove): WhistState {
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

function view(s: WhistState): TableView {
	const playable = s.phase === 'playing' && s.turn === 0 ? legalPlays(s, 0).map((c) => c.id) : [];
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
			tricks: s.tricksWon[seat]
		})),
		trick: s.trick.map((p) => ({ player: p.player, name: NAMES[p.player], card: p.card })),
		trump: s.trump,
		trumpLabel: SUIT_NAME[s.trump],
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
					: s.turn === 0
						? { kind: 'play', title: 'Your lead' }
						: { kind: 'none' }
	};
}

function suggest(s: WhistState): TrickMove | null {
	if (s.phase === 'handComplete') return { type: 'continue' };
	if (s.phase !== 'playing' || s.turn !== 0) return null;
	return { type: 'play', cardId: aiPlay(s, 0).id };
}

export const whist: AiCardGame<WhistState> = {
	meta: {
		id: 'whist',
		name: 'Whist',
		blurb: 'The classic: take more than six tricks with your partner.',
		difficulty: 'medium',
		family: 'Trick-taking',
		howTo: [
			'You and your AI partner (North) versus two AI opponents. All 52 cards are dealt, 13 each.',
			'The dealer’s last card is turned up to decide the trump suit — no bidding.',
			'Follow the led suit if you can; the highest trump, or highest card of the led suit, wins the trick.',
			'The first six tricks a side takes are "the book"; every trick beyond six scores one point.',
			'First partnership to 7 points wins the rubber.'
		],
		learnMore: 'https://en.wikipedia.org/wiki/Whist'
	},
	newGame: (seed) => deal(seed, 0, 3),
	view,
	apply,
	stepAuto,
	suggest
};
