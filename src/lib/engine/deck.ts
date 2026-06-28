/**
 * Deck construction and seeded shuffling. Standard 52-card deck (×N for
 * multi-deck games), shuffled with a seeded Fisher–Yates so deals reproduce.
 */

import { RANKS, SUITS, makeCard } from './card';
import { mulberry32, randInt, type Rng } from './rng';
import type { Card } from './types';

export interface DeckOptions {
	/** Number of standard decks to combine (Spider = 2). Default 1. */
	decks?: number;
	/** Initial face-up state of every card. Default false (face-down). */
	faceUp?: boolean;
}

/** Build an ordered deck of `52 × decks` cards. */
export function buildDeck(options: DeckOptions = {}): Card[] {
	const { decks = 1, faceUp = false } = options;
	const cards: Card[] = [];
	for (let copy = 0; copy < decks; copy++) {
		for (const suit of SUITS) {
			for (const rank of RANKS) {
				cards.push(makeCard(suit, rank, { faceUp, copy }));
			}
		}
	}
	return cards;
}

/**
 * Pure Fisher–Yates shuffle: returns a NEW array, leaving `items` untouched.
 * Determined entirely by `rng`.
 */
export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
	const result = items.slice();
	for (let i = result.length - 1; i > 0; i--) {
		const j = randInt(rng, i + 1);
		[result[i], result[j]] = [result[j], result[i]];
	}
	return result;
}

/** Build and shuffle a deck deterministically from `seed`. */
export function shuffledDeck(seed: number, options: DeckOptions = {}): Card[] {
	return shuffle(buildDeck(options), mulberry32(seed));
}
