/**
 * Standard 4-player partnership Euchre: you (South, seat 0) + your AI partner
 * (North, seat 2) vs two AI opponents (West 1, East 3). Teams are seats {0,2}
 * and {1,3}. First team to 10 points wins.
 *
 * The human is always seat 0. `applyMove` applies the human's action and then
 * advances all AI/auto steps until the human must act again (or the game ends),
 * so the UI only ever deals with the human's turn. The AI is deterministic
 * (rule-based), keeping the whole thing pure and reproducible from the seed.
 */

import { mulberry32, shuffle, SUITS, type Card, type Suit } from '$lib/engine';
import {
	cardStrength,
	effectiveSuit,
	euchreDeck,
	isLeftBower,
	isRightBower,
	legalPlays,
	sameColorSuit,
	trickWinnerIndex,
	type Play
} from './cards';

export type Phase = 'bidding1' | 'bidding2' | 'discard' | 'playing' | 'handComplete' | 'gameOver';

/**
 * A rules variant. The same state machine drives all three: a partnership
 * 4-hand, a head-to-head 2-hand, and a 3-hand "cutthroat" where each player
 * fends for themselves. `seats` are the active players (always seats 0…seats-1,
 * with the human at 0); `partners` pairs seats {0,2} vs {1,3}.
 */
export interface EuchreVariant {
	readonly id: string;
	readonly seats: number; // 2 | 3 | 4
	readonly partners: boolean;
	readonly allowAlone: boolean;
}

export const VARIANTS: Record<string, EuchreVariant> = {
	euchre: { id: 'euchre', seats: 4, partners: true, allowAlone: true },
	euchre2: { id: 'euchre2', seats: 2, partners: false, allowAlone: false },
	euchre3: { id: 'euchre3', seats: 3, partners: false, allowAlone: false }
};

export interface EuchreState {
	readonly variant: EuchreVariant;
	readonly seed: number;
	readonly handNo: number;
	readonly hands: readonly (readonly Card[])[]; // one per active seat
	readonly dealer: number;
	readonly turn: number;
	readonly phase: Phase;
	readonly upCard: Card | null;
	readonly trump: Suit | null;
	readonly maker: number | null;
	readonly alone: boolean;
	readonly sitOut: number | null;
	readonly trick: readonly Play[];
	readonly lastTrick: readonly Play[] | null;
	readonly trickWins: readonly number[]; // per seat
	readonly scores: readonly number[]; // per team (length = numTeams)
	readonly log: readonly string[];
	readonly handResult: string | null;
	readonly winner: number | null; // winning team, or null
}

export type EuchreMove =
	| { type: 'order'; alone: boolean }
	| { type: 'pass' }
	| { type: 'call'; suit: Suit; alone: boolean }
	| { type: 'discard'; cardId: string }
	| { type: 'play'; cardId: string }
	| { type: 'continue' };

const SEATS = ['South', 'West', 'North', 'East'];
/** Partnership team for the default 4-hand game (kept for the test surface). */
export const teamOf = (seat: number) => seat % 2;

/** Team index for a seat under a given variant: partners pair up, else each alone. */
function teamFor(v: EuchreVariant, seat: number): number {
	return v.partners ? seat % 2 : seat;
}
function numTeams(v: EuchreVariant): number {
	return v.partners ? 2 : v.seats;
}

// --- helpers ----------------------------------------------------------------
function note(state: EuchreState, msg: string): readonly string[] {
	return [...state.log, msg].slice(-6);
}

function nextSeat(state: EuchreState, seat: number): number {
	const n0 = state.variant.seats;
	let n = (seat + 1) % n0;
	if (state.sitOut !== null && n === state.sitOut) n = (n + 1) % n0;
	return n;
}

function removeCard(hand: readonly Card[], cardId: string): Card[] {
	return hand.filter((c) => c.id !== cardId);
}

/** Trump strength of a hand if `trump` were trump (rough points for the AI). */
function handTrumpPoints(hand: readonly Card[], trump: Suit): number {
	let pts = 0;
	for (const card of hand) {
		if (isRightBower(card, trump)) pts += 1.5;
		else if (isLeftBower(card, trump)) pts += 1.2;
		else if (effectiveSuit(card, trump) === trump) pts += 0.5 + (card.rank === 1 ? 0.4 : 0);
		else if (card.rank === 1) pts += 0.5; // off-suit ace
	}
	return pts;
}

function deal(v: EuchreVariant, seed: number, handNo: number, dealer: number): EuchreState {
	const n = v.seats;
	const deck = shuffle(euchreDeck(), mulberry32(seed + handNo * 7919 + 1));
	const hands: Card[][] = Array.from({ length: n }, () => []);
	let k = 0;
	for (let round = 0; round < 5; round++)
		for (let s = 0; s < n; s++) hands[(dealer + 1 + s) % n].push(deck[k++]);
	const upCard = deck[k];
	return {
		variant: v,
		seed,
		handNo,
		hands,
		dealer,
		turn: (dealer + 1) % n,
		phase: 'bidding1',
		upCard,
		trump: null,
		maker: null,
		alone: false,
		sitOut: null,
		trick: [],
		lastTrick: null,
		trickWins: Array.from({ length: n }, () => 0),
		scores: Array.from({ length: numTeams(v) }, () => 0),
		log: [],
		handResult: null,
		winner: null
	};
}

// --- AI ---------------------------------------------------------------------
const ORDER_THRESHOLD = 2.5;
const ALONE_THRESHOLD = 3.6;

/** Bidding round 1: order up the up-card suit, or pass. */
function aiBid1(state: EuchreState, seat: number): EuchreMove {
	const trump = state.upCard!.suit;
	// the dealer's team will receive the up-card
	const dealerTeam = teamFor(state.variant, state.dealer);
	let pts = handTrumpPoints(state.hands[seat], trump);
	if (teamFor(state.variant, seat) === dealerTeam)
		pts += 0.4; // up-card helps our side
	else pts -= 0.3;
	if (pts >= ORDER_THRESHOLD) return { type: 'order', alone: pts >= ALONE_THRESHOLD };
	return { type: 'pass' };
}

/** Bidding round 2: name the strongest other suit, or pass (dealer must call). */
function aiBid2(state: EuchreState, seat: number, mustCall: boolean): EuchreMove {
	const forbidden = state.upCard!.suit;
	let bestSuit: Suit | null = null;
	let bestPts = -Infinity;
	for (const suit of SUITS) {
		if (suit === forbidden) continue;
		const pts = handTrumpPoints(state.hands[seat], suit);
		if (pts > bestPts) {
			bestPts = pts;
			bestSuit = suit;
		}
	}
	if (mustCall || bestPts >= ORDER_THRESHOLD)
		return { type: 'call', suit: bestSuit!, alone: bestPts >= ALONE_THRESHOLD };
	return { type: 'pass' };
}

/** The dealer discards their weakest card after picking up the up-card. */
function aiDiscard(state: EuchreState, seat: number): string {
	const trump = state.trump!;
	let worst = state.hands[seat][0];
	let worstVal = Infinity;
	for (const card of state.hands[seat]) {
		const v =
			effectiveSuit(card, trump) === trump
				? 100 + card.rank
				: (card.rank === 1 ? 20 : 0) + card.rank; // keep trumps and aces
		if (v < worstVal) {
			worstVal = v;
			worst = card;
		}
	}
	return worst.id;
}

/** Choose a card to play, following suit, winning cheaply or ducking. */
function aiPlay(state: EuchreState, seat: number): string {
	const trump = state.trump!;
	const hand = state.hands[seat];
	const ledSuit = state.trick.length > 0 ? effectiveSuit(state.trick[0].card, trump) : null;
	const options = legalPlays(hand, ledSuit, trump);

	if (state.trick.length === 0) {
		// leading: lead the strongest trump if we have a bower, else a high off-suit
		const sorted = [...options].sort((a, b) => leadValue(b, trump) - leadValue(a, trump));
		return sorted[0].id;
	}

	// who is currently winning?
	const winIdx = trickWinnerIndex(state.trick, trump);
	const winner = state.trick[winIdx].player;
	const partnerWinning = teamFor(state.variant, winner) === teamFor(state.variant, seat);
	const led = effectiveSuit(state.trick[0].card, trump);
	const bestSoFar = cardStrength(state.trick[winIdx].card, trump, led);

	const winning = options
		.filter((c) => cardStrength(c, trump, led) > bestSoFar)
		.sort((a, b) => cardStrength(a, trump, led) - cardStrength(b, trump, led));

	if (partnerWinning) {
		// duck: keep strength, play lowest
		return lowest(options, trump, led).id;
	}
	if (winning.length > 0) return winning[0].id; // win as cheaply as possible
	return lowest(options, trump, led).id; // can't win — throw lowest
}

function leadValue(card: Card, trump: Suit): number {
	if (isRightBower(card, trump)) return 50;
	if (isLeftBower(card, trump)) return 49;
	if (effectiveSuit(card, trump) === trump) return 40 + card.rank;
	if (card.rank === 1) return 30; // off-suit ace
	return card.rank;
}

function lowest(cards: readonly Card[], trump: Suit, led: Suit): Card {
	return [...cards].sort((a, b) => cardStrength(a, trump, led) - cardStrength(b, trump, led))[0];
}

// --- transitions ------------------------------------------------------------
function startPlaying(state: EuchreState): EuchreState {
	return {
		...state,
		phase: 'playing',
		turn: (state.dealer + 1) % state.variant.seats,
		trick: []
	};
}

/** Where the partner sits when going alone (4-hand only). */
function aloneSitOut(state: EuchreState, seat: number, alone: boolean): number | null {
	return alone && state.variant.partners ? (seat + 2) % state.variant.seats : null;
}

function applyOrder(state: EuchreState, seat: number, aloneReq: boolean): EuchreState {
	const alone = aloneReq && state.variant.allowAlone;
	const trump = state.upCard!.suit;
	// dealer picks up the up-card
	const hands = state.hands.map((h, i) => (i === state.dealer ? [...h, state.upCard!] : h));
	let s: EuchreState = {
		...state,
		hands,
		trump,
		maker: seat,
		alone,
		sitOut: aloneSitOut(state, seat, alone),
		upCard: null,
		log: note(state, `${SEATS[seat]} orders up ${trump}${alone ? ' (alone)' : ''}.`),
		phase: 'discard',
		turn: state.dealer
	};
	// if dealer is AI, they discard during advance; if human dealer, stop for input.
	if (s.dealer !== 0) {
		const id = aiDiscard(s, s.dealer);
		s = { ...s, hands: s.hands.map((h, i) => (i === s.dealer ? removeCard(h, id) : h)) };
		s = startPlaying(s);
	}
	return s;
}

function applyCall(state: EuchreState, seat: number, suit: Suit, aloneReq: boolean): EuchreState {
	const alone = aloneReq && state.variant.allowAlone;
	const s: EuchreState = {
		...state,
		trump: suit,
		maker: seat,
		alone,
		sitOut: aloneSitOut(state, seat, alone),
		upCard: null,
		log: note(state, `${SEATS[seat]} calls ${suit}${alone ? ' (alone)' : ''}.`)
	};
	return startPlaying(s);
}

/** Score a completed hand and set up the next one (or game over). */
function scoreHand(state: EuchreState): EuchreState {
	const v = state.variant;
	const makerTeam = teamFor(v, state.maker!);
	// tricks won per team
	const teamTricks = Array.from({ length: numTeams(v) }, () => 0);
	for (let seat = 0; seat < v.seats; seat++) teamTricks[teamFor(v, seat)] += state.trickWins[seat];
	const makerCount = teamTricks[makerTeam];
	const ours = makerTeam === 0; // team 0 is always the human's side

	const scores = [...state.scores];
	let result: string;
	if (makerCount >= 3) {
		const pts = state.alone && makerCount === 5 ? 4 : makerCount === 5 ? 2 : 1;
		scores[makerTeam] += pts;
		result = `${ours ? 'You' : 'Opponents'} made it — ${makerCount} tricks (+${pts}).`;
	} else {
		// Euchred: in partnership/2-hand the single other team takes +2; in a
		// 3-hand cutthroat both defenders score +2.
		for (let t = 0; t < numTeams(v); t++) if (t !== makerTeam) scores[t] += 2;
		result = ours ? 'Euchred! Opponents take +2.' : 'Euchred! You take +2.';
	}

	let winner: number | null = null;
	for (let t = 0; t < scores.length; t++)
		if (scores[t] >= 10) winner = winner === null ? t : winner;
	return {
		...state,
		scores,
		handResult: result,
		phase: winner === null ? 'handComplete' : 'gameOver',
		winner,
		log: note(state, result)
	};
}

/** Resolve a full trick: award it, set the next leader, score the hand if done. */
function resolveTrick(state: EuchreState): EuchreState {
	const winIdx = trickWinnerIndex(state.trick, state.trump!);
	const winner = state.trick[winIdx].player;
	const trickWins = state.trickWins.map((n, i) => (i === winner ? n + 1 : n));
	const totalPlayed = trickWins.reduce((a, b) => a + b, 0);
	const s: EuchreState = {
		...state,
		trickWins,
		lastTrick: state.trick,
		trick: [],
		turn: winner,
		log: note(state, `${SEATS[winner]} wins the trick.`)
	};
	if (totalPlayed === 5) return scoreHand(s);
	return s;
}

function trickSize(state: EuchreState): number {
	// active players this trick: everyone, minus a partner sitting out when alone
	return state.variant.seats - (state.sitOut !== null ? 1 : 0);
}
function trickIsFull(state: EuchreState): boolean {
	return state.trick.length === trickSize(state);
}

function playCard(state: EuchreState, seat: number, cardId: string): EuchreState {
	const card = state.hands[seat].find((c) => c.id === cardId);
	if (!card) return state;
	const hands = state.hands.map((h, i) => (i === seat ? removeCard(h, cardId) : h));
	const trick = [...state.trick, { player: seat, card }];
	const s: EuchreState = { ...state, hands, trick };
	// a full trick is resolved as its OWN step (so the UI can show it briefly)
	if (trickIsFull(s)) return s;
	return { ...s, turn: nextSeat(s, seat) };
}

/**
 * Perform ONE automatic step (an AI bid/play, or resolving a full trick), or
 * return null when it's the human's turn / the hand or game is paused. The UI
 * drives this on a timer so AI turns animate; tests drain it in a loop.
 */
export function stepAuto(state: EuchreState): EuchreState | null {
	if (state.phase === 'gameOver' || state.phase === 'handComplete') return null;
	if (state.phase === 'discard') return null; // a human dealer discards
	if (state.phase === 'bidding1') {
		if (state.turn === 0) return null;
		const move = aiBid1(state, state.turn);
		return move.type === 'order' ? applyOrder(state, state.turn, move.alone) : passBidding(state);
	}
	if (state.phase === 'bidding2') {
		if (state.turn === 0) return null;
		const move = aiBid2(state, state.turn, state.turn === state.dealer);
		return move.type === 'call'
			? applyCall(state, state.turn, move.suit, move.alone)
			: passBidding(state);
	}
	if (state.phase === 'playing') {
		if (trickIsFull(state)) return resolveTrick(state);
		if (state.turn === 0 && state.sitOut !== 0) return null; // human plays
		return playCard(state, state.turn, aiPlay(state, state.turn));
	}
	return null;
}

/** Drain all automatic steps at once (headless / non-animated use). */
export function runAuto(state: EuchreState): EuchreState {
	let s = state;
	let next: EuchreState | null;
	let guard = 0;
	while ((next = stepAuto(s)) !== null && guard++ < 2000) s = next;
	return s;
}

/** True when the engine is waiting on the human (or the hand/game is over). */
export function needsHuman(state: EuchreState): boolean {
	return stepAuto(state) === null;
}

function passBidding(state: EuchreState): EuchreState {
	const n = state.variant.seats;
	const s = { ...state, log: note(state, `${SEATS[state.turn]} passes.`) };
	if (state.phase === 'bidding1') {
		// after the dealer passes, move to round 2
		if (state.turn === state.dealer) {
			return { ...s, phase: 'bidding2', turn: (state.dealer + 1) % n };
		}
		return { ...s, turn: (state.turn + 1) % n };
	}
	// bidding2: dealer must call, so a pass here only happens for non-dealers
	return { ...s, turn: (state.turn + 1) % n };
}

// --- public API -------------------------------------------------------------
export function newGame(seed: number, variantId = 'euchre'): EuchreState {
	const v = VARIANTS[variantId] ?? VARIANTS.euchre;
	// The seat left of the dealer bids first; dealing the button to the last seat
	// means the human (seat 0) always opens the bidding. No AI pre-steps needed —
	// the controller drains stepAuto on a timer thereafter.
	return deal(v, seed, 0, v.seats - 1);
}

export function applyMove(state: EuchreState, move: EuchreMove): EuchreState {
	const seat = 0; // moves are always the human's
	let s = state;
	switch (move.type) {
		case 'order':
			if (s.phase !== 'bidding1' || s.turn !== 0) return state;
			s = applyOrder(s, 0, move.alone);
			break;
		case 'call':
			if (s.phase !== 'bidding2' || s.turn !== 0) return state;
			s = applyCall(s, 0, move.suit, move.alone);
			break;
		case 'pass':
			if ((s.phase !== 'bidding1' && s.phase !== 'bidding2') || s.turn !== 0) return state;
			if (s.phase === 'bidding2' && s.dealer === 0) return state; // stuck dealer must call
			s = passBidding(s);
			break;
		case 'discard':
			if (s.phase !== 'discard' || s.dealer !== 0) return state;
			s = startPlaying({
				...s,
				hands: s.hands.map((h, i) => (i === 0 ? removeCard(h, move.cardId) : h))
			});
			break;
		case 'play': {
			if (s.phase !== 'playing' || s.turn !== 0) return state;
			const led = s.trick.length > 0 ? effectiveSuit(s.trick[0].card, s.trump!) : null;
			const legal = legalPlays(s.hands[0], led, s.trump!);
			if (!legal.some((c) => c.id === move.cardId)) return state;
			s = playCard(s, 0, move.cardId);
			break;
		}
		case 'continue':
			if (s.phase !== 'handComplete') return state;
			s = deal(s.variant, s.seed, s.handNo + 1, (s.dealer + 1) % s.variant.seats);
			s = { ...s, scores: state.scores };
			break;
	}
	void seat;
	return s;
}

/** The legal trump suits the human may call in round 2 (anything but the up-card suit). */
export function callableSuits(state: EuchreState): Suit[] {
	const forbidden = state.upCard?.suit;
	return SUITS.filter((s) => s !== forbidden);
}

/** The move the AI would make for the human seat — drives a hint / auto-play button. */
export function suggestMove(state: EuchreState): EuchreMove | null {
	if (state.turn !== 0 && state.phase !== 'handComplete') return null;
	switch (state.phase) {
		case 'bidding1':
			return aiBid1(state, 0);
		case 'bidding2':
			return aiBid2(state, 0, state.dealer === 0);
		case 'discard':
			return state.dealer === 0 ? { type: 'discard', cardId: aiDiscard(state, 0) } : null;
		case 'playing':
			return { type: 'play', cardId: aiPlay(state, 0) };
		case 'handComplete':
			return { type: 'continue' };
		default:
			return null;
	}
}

export { SEATS, sameColorSuit };
