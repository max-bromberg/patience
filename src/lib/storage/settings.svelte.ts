/**
 * Reactive, persisted user settings. Read `settings.sound` / `settings.theme`
 * in components for live updates; assignments persist to localStorage.
 */

import { DEFAULT_THEME, isTheme } from '$lib/theme/themes';
import { readJSON, writeJSON } from './storage';

interface SettingsData {
	sound: boolean;
	theme: string;
}

const KEY = 'settings';
const DEFAULTS: SettingsData = { sound: true, theme: DEFAULT_THEME };

class Settings {
	#data = $state<SettingsData>(DEFAULTS);

	constructor() {
		const saved = readJSON<Partial<SettingsData>>(KEY, {});
		this.#data = {
			sound: saved.sound ?? DEFAULTS.sound,
			theme: saved.theme && isTheme(saved.theme) ? saved.theme : DEFAULTS.theme
		};
	}

	#persist(): void {
		writeJSON(KEY, this.#data);
	}

	get sound(): boolean {
		return this.#data.sound;
	}

	set sound(value: boolean) {
		this.#data = { ...this.#data, sound: value };
		this.#persist();
	}

	toggleSound(): void {
		this.sound = !this.#data.sound;
	}

	get theme(): string {
		return this.#data.theme;
	}

	set theme(value: string) {
		if (!isTheme(value)) return;
		this.#data = { ...this.#data, theme: value };
		this.#persist();
	}
}

export const settings = new Settings();
