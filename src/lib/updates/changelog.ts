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
