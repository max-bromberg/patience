/**
 * Curated release notes shown in the "What's new" popup.
 *
 * This is deliberately hand-maintained (not the build hash) so the popup fires
 * only on releases worth announcing, not on every deploy. To ship an update:
 * add a new entry at the TOP with a bumped `version` (semver `major.minor.patch`)
 * — everything newer than a returning player's last-seen version is shown, newest
 * first. Keep entries small; the popup scrolls if there are many.
 */

export type ChangeKind = 'added' | 'improved' | 'fixed';

export interface Change {
	readonly kind: ChangeKind;
	readonly text: string;
}

export interface Release {
	readonly version: string; // semver: "1.2.0"
	readonly date: string; // ISO date, for display
	readonly title: string; // short headline
	readonly changes: readonly Change[];
}

export const CHANGELOG: readonly Release[] = [
	{
		version: '1.4.1',
		date: '2026-07-04',
		title: 'Cleaner & calmer',
		changes: [
			{
				kind: 'fixed',
				text: 'The labels in these notes no longer overlap the text while you scroll.'
			},
			{
				kind: 'improved',
				text: 'Locked pinch- and double-tap-zoom so the table stays put while you play.'
			}
		]
	},
	{
		version: '1.4.0',
		date: '2026-07-04',
		title: 'One-tap updates',
		changes: [
			{
				kind: 'added',
				text: 'When a new version is ready, an “Update available” button appears — one tap refreshes you to the latest, no need to fully quit and reopen.'
			},
			{
				kind: 'fixed',
				text: 'Fixed the “What’s new” list so the New / Improved / Fixed labels scroll along with the text instead of staying put.'
			}
		]
	},
	{
		version: '1.3.0',
		date: '2026-07-04',
		title: 'Polish & fixes',
		changes: [
			{
				kind: 'fixed',
				text: 'You can now recycle the stock again in Klondike and friends — tapping the empty stock (the ↻) deals the pile back over as it should.'
			},
			{
				kind: 'fixed',
				text: 'In Euchre, the status line no longer overlaps the “You” label at the bottom of the table.'
			},
			{
				kind: 'fixed',
				text: 'Euchre’s “Go alone” toggle now resets each hand, so a past choice can’t carry over.'
			},
			{
				kind: 'improved',
				text: 'Tidied up small-screen layouts: the “no moves” bar and the custom-colour pickers no longer get clipped on narrow phones.'
			},
			{
				kind: 'improved',
				text: 'You can reopen these notes any time from Settings → “What’s new”.'
			}
		]
	},
	{
		version: '1.2.0',
		date: '2026-07-04',
		title: 'Achievements',
		changes: [
			{
				kind: 'added',
				text: 'Earn cozy badges as you play — first win, win streaks, night-owl sessions, winning a game in every category, and more. Unlocking one gives a little celebration.'
			},
			{
				kind: 'added',
				text: 'A badge gallery in your Stats sheet tracks everything you’ve earned and what’s left to unlock.'
			}
		]
	},
	{
		version: '1.1.0',
		date: '2026-07-04',
		title: 'Install & play offline',
		changes: [
			{
				kind: 'added',
				text: 'Install Patience to your Home Screen — it launches full-screen and plays completely offline.'
			},
			{
				kind: 'added',
				text: 'An “Install app” button on the home screen, with a quick how-to on iPhone and iPad.'
			},
			{
				kind: 'improved',
				text: 'Dragging cards by touch now lifts the card above your fingertip, so it’s never hidden while you move it.'
			},
			{
				kind: 'improved',
				text: 'Stripped out mobile-web quirks: no more double-tap zoom, grey tap flashes, or rubber-band scrolling.'
			},
			{
				kind: 'improved',
				text: 'The phone status bar now matches your table theme — light on dark felts, dark on the pastel ones.'
			},
			{
				kind: 'fixed',
				text: 'Background music now stops when you leave the app, instead of playing on behind other apps.'
			}
		]
	}
];

/** The latest shipped version — the yardstick for "have you seen this?". */
export const CURRENT_VERSION = CHANGELOG[0]?.version ?? '0.0.0';
