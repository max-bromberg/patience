/**
 * Build a short, emoji-flavoured "share your result" blurb (Wordle-style) that
 * a player can copy and paste into a text message. Pure + framework-free so it
 * can be unit-tested; the UI just hands it the facts and copies the string.
 */

export const SITE = 'https://patience.maxbromberg.me';

export interface SolitaireShare {
	type: 'solitaire';
	name: string; // e.g. "Klondike"
	gameId: string;
	url: string; // full reproducible play link
	won: boolean;
	moves: number;
	timeMs?: number;
	daily?: boolean;
	streak?: number; // daily streak (when daily)
}

export interface TrickShare {
	type: 'trick';
	name: string; // e.g. "Hearts"
	gameId: string;
	url: string;
	won: boolean;
	scores: readonly { label: string; value: number; you: boolean }[];
}

export type ShareInput = SolitaireShare | TrickShare;

/** mm:ss from milliseconds (drops to h:mm:ss past an hour). */
export function formatTime(ms: number): string {
	const total = Math.max(0, Math.round(ms / 1000));
	const s = total % 60;
	const m = Math.floor(total / 60) % 60;
	const h = Math.floor(total / 3600);
	const pad = (n: number) => String(n).padStart(2, '0');
	return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

export function buildShareText(input: ShareInput): string {
	const lines: string[] = [];

	if (input.type === 'solitaire') {
		lines.push(`${input.won ? '🎉' : '🃏'} Patience · ${input.name}`);
		if (input.won) {
			const time = input.timeMs !== undefined ? ` · ⏱ ${formatTime(input.timeMs)}` : '';
			lines.push(`🏆 Solved in ${input.moves} moves${time}`);
			lines.push('♠️ ♥️ ♦️ ♣️ cleared');
		} else {
			lines.push(`😅 Stuck after ${input.moves} moves — can you clear it?`);
		}
		if (input.daily) {
			const streak = input.streak && input.streak > 0 ? ` · 🔥 ${input.streak}` : '';
			lines.push(`📅 Daily Challenge${streak}`);
		}
	} else {
		lines.push(`${input.won ? '🎉' : '🃏'} Patience · ${input.name}`);
		lines.push(input.won ? '🏆 I won!' : '😅 Got beat — your turn?');
		if (input.scores.length) {
			lines.push(input.scores.map((s) => `${s.you ? 'You' : s.label} ${s.value}`).join(' · '));
		}
	}

	lines.push(`▶️ ${input.url}`);
	return lines.join('\n');
}
