/**
 * Pure display helpers for the render layer: how a rank/suit reads to a human.
 * Kept out of the engine because these are presentation, not rules.
 */

import type { Rank, Suit } from '$lib/engine';

export const SUIT_GLYPH: Readonly<Record<Suit, string>> = {
	spades: '♠',
	hearts: '♥',
	diamonds: '♦',
	clubs: '♣'
};

const SPECIAL_RANKS: Readonly<Record<number, string>> = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' };

export function rankLabel(rank: Rank): string {
	return SPECIAL_RANKS[rank] ?? String(rank);
}
