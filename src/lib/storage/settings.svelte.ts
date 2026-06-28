/**
 * Reactive, persisted user settings. Read `settings.sound` in components for
 * live updates; assignments persist to localStorage automatically.
 */

import { readJSON, writeJSON } from './storage';

interface SettingsData {
	sound: boolean;
}

const KEY = 'settings';
const DEFAULTS: SettingsData = { sound: true };

class Settings {
	#sound = $state(DEFAULTS.sound);

	constructor() {
		const saved = readJSON<Partial<SettingsData>>(KEY, {});
		this.#sound = saved.sound ?? DEFAULTS.sound;
	}

	get sound(): boolean {
		return this.#sound;
	}

	set sound(value: boolean) {
		this.#sound = value;
		writeJSON(KEY, { sound: value } satisfies SettingsData);
	}

	toggleSound(): void {
		this.sound = !this.#sound;
	}
}

export const settings = new Settings();
