/**
 * Reactive, persisted user settings: sound, table theme (preset or custom
 * colors), and ambient "vibes". Read fields in components for live updates;
 * assignments persist to localStorage.
 */

import { isHexColor } from '$lib/theme/color';
import { DEFAULT_THEME, isTheme } from '$lib/theme/themes';
import { VIBE_IDS } from '$lib/theme/vibes';
import { readJSON, writeJSON } from './storage';

export interface CustomColors {
	felt: string;
	back: string;
}

interface SettingsData {
	sound: boolean;
	theme: string;
	custom: CustomColors;
	vibes: Record<string, boolean>;
}

const KEY = 'settings';
const DEFAULT_CUSTOM: CustomColors = { felt: '#3a6ea5', back: '#b9472f' };

function defaultVibes(): Record<string, boolean> {
	return Object.fromEntries(VIBE_IDS.map((id) => [id, false]));
}

class Settings {
	#data = $state<SettingsData>({
		sound: true,
		theme: DEFAULT_THEME,
		custom: { ...DEFAULT_CUSTOM },
		vibes: defaultVibes()
	});

	constructor() {
		const saved = readJSON<Partial<SettingsData>>(KEY, {});
		this.#data = {
			sound: saved.sound ?? true,
			theme:
				saved.theme && (isTheme(saved.theme) || saved.theme === 'custom')
					? saved.theme
					: DEFAULT_THEME,
			custom: {
				felt:
					saved.custom && isHexColor(saved.custom.felt) ? saved.custom.felt : DEFAULT_CUSTOM.felt,
				back:
					saved.custom && isHexColor(saved.custom.back) ? saved.custom.back : DEFAULT_CUSTOM.back
			},
			vibes: { ...defaultVibes(), ...(saved.vibes ?? {}) }
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
		if (!isTheme(value) && value !== 'custom') return;
		this.#data = { ...this.#data, theme: value };
		this.#persist();
	}

	get custom(): CustomColors {
		return this.#data.custom;
	}
	setCustom(part: Partial<CustomColors>): void {
		this.#data = { ...this.#data, custom: { ...this.#data.custom, ...part } };
		this.#persist();
	}

	get vibes(): Record<string, boolean> {
		return this.#data.vibes;
	}
	vibe(id: string): boolean {
		return this.#data.vibes[id] ?? false;
	}
	toggleVibe(id: string): void {
		this.#data = { ...this.#data, vibes: { ...this.#data.vibes, [id]: !this.vibe(id) } };
		this.#persist();
	}
}

export const settings = new Settings();
