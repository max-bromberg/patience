/**
 * Tiny haptic (vibration) cues for card interactions, mirroring the sound-effects
 * module. Short, tasteful buzzes that add a little physicality to moves without
 * being a buzzer. Gated behind the `haptics` user setting.
 *
 * Vibration API caveats:
 *  - `navigator.vibrate` is Android-only in practice. Desktop browsers and, most
 *    notably, iOS Safari do NOT support it — `navigator.vibrate` is simply
 *    absent there, so every method here must be a silent no-op (never throw).
 *  - It only works from a real page (no `navigator` on the server), so all calls
 *    are SSR-safe via a `typeof navigator === 'undefined'` guard.
 *  - Some browsers throw or ignore the call if it happens outside a user gesture
 *    or while the page is hidden, so the actual call is wrapped in try/catch.
 *  - Patterns are `number | number[]` of milliseconds: `[vibrate, pause, ...]`.
 */

import { settings } from '$lib/storage/settings.svelte';

type VibratePattern = number | number[];

/** Feature-detect the Vibration API. Absent on desktop and iOS Safari. */
function canVibrate(): boolean {
	return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
}

/** Fire a vibration pattern, swallowing any browser hiccups. */
function buzz(pattern: VibratePattern): void {
	try {
		navigator.vibrate(pattern);
	} catch {
		// Some browsers throw outside a user gesture / when vibration is disabled.
	}
}

/** Gate + guard, mirroring sound.ts's `withAudio`. No-op when off/unsupported. */
function withHaptics(pattern: VibratePattern): void {
	if (!settings.haptics) return;
	if (!canVibrate()) return;
	buzz(pattern);
}

export const haptics = {
	/** A generic light tap — stock draw / flip / pick up. */
	tap(): void {
		withHaptics(10);
	},
	/** Card placed onto a pile — a crisp single tick. */
	place(): void {
		withHaptics(12);
	},
	/** A card reaching a foundation — a slightly firmer, rewarding bump. */
	foundation(): void {
		withHaptics(18);
	},
	/** New deal — a light riffle of quick taps. */
	deal(): void {
		withHaptics([8, 30, 8, 30, 8]);
	},
	/** Undo — a soft single nudge. */
	undo(): void {
		withHaptics(8);
	},
	/** Illegal move / spring-back — a soft double buzz. */
	invalid(): void {
		withHaptics([10, 30, 10]);
	},
	/** Victory — a gentle celebratory pattern. */
	win(): void {
		withHaptics([12, 40, 12, 40, 24]);
	}
};
