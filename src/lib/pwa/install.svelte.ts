/**
 * Reactive install state for the PWA "Install app" affordance.
 *
 * Two worlds:
 *  - Chromium (Android/desktop) fires `beforeinstallprompt`, which we stash so a
 *    button can trigger the real native install dialog on demand.
 *  - iOS Safari has no such API — installing is a manual "Share → Add to Home
 *    Screen". So on iOS we still surface the button, but it opens a short how-to
 *    instead. (Only Safari can install on iOS; in-app/other iOS browsers can't,
 *    so we hint to open in Safari.)
 *
 * `available` gates whether the UI shows at all; it's false once we detect the
 * app is already running installed (standalone display mode).
 */

import { browser } from '$app/environment';

interface BeforeInstallPromptEvent extends Event {
	prompt: () => Promise<void>;
	userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export type InstallPlatform = 'ios' | 'android' | 'other';

class InstallState {
	#deferred: BeforeInstallPromptEvent | null = null;

	/** A native install prompt is queued (Chromium). */
	canPrompt = $state(false);
	/** Already running as an installed/standalone app. */
	installed = $state(false);
	platform = $state<InstallPlatform>('other');
	/** On iOS, whether we're in Safari (the only iOS browser that can install). */
	iosSafari = $state(true);

	constructor() {
		if (!browser) return;
		this.installed = this.#detectStandalone();
		this.platform = this.#detectPlatform();
		this.iosSafari = this.#detectIosSafari();

		window.addEventListener('beforeinstallprompt', (e) => {
			e.preventDefault(); // suppress the mini-infobar; we drive it from our button
			this.#deferred = e as BeforeInstallPromptEvent;
			this.canPrompt = true;
		});
		window.addEventListener('appinstalled', () => {
			this.installed = true;
			this.canPrompt = false;
			this.#deferred = null;
		});
		// Catch an install that happens while the tab is open.
		window.matchMedia?.('(display-mode: standalone)').addEventListener?.('change', (e) => {
			if (e.matches) this.installed = true;
		});
	}

	#detectStandalone(): boolean {
		return (
			window.matchMedia?.('(display-mode: standalone)').matches === true ||
			window.matchMedia?.('(display-mode: fullscreen)').matches === true ||
			// iOS Safari's non-standard flag for home-screen apps
			(navigator as unknown as { standalone?: boolean }).standalone === true
		);
	}

	#detectPlatform(): InstallPlatform {
		const ua = navigator.userAgent;
		if (/android/i.test(ua)) return 'android';
		// iPadOS 13+ reports as desktop Safari, so also sniff a touch-capable Mac.
		const iOS =
			/iphone|ipad|ipod/i.test(ua) ||
			(navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
		return iOS ? 'ios' : 'other';
	}

	#detectIosSafari(): boolean {
		// On iOS every engine is WebKit; only Safari exposes Add to Home Screen.
		// Chrome=CriOS, Firefox=FxiOS, Edge=EdgiOS, Opera=OPiOS.
		return !/crios|fxios|edgios|opios/i.test(navigator.userAgent);
	}

	/** Whether to show the install affordance at all. */
	get available(): boolean {
		return !this.installed && (this.canPrompt || this.platform === 'ios');
	}

	/** Fire the native install dialog (Chromium). No-op elsewhere. */
	async prompt(): Promise<void> {
		const e = this.#deferred;
		if (!e) return;
		this.#deferred = null;
		this.canPrompt = false;
		await e.prompt();
	}
}

export const install = new InstallState();
