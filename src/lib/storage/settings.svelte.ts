/**
 * Reactive, persisted user settings: sound, table theme (preset or custom
 * colors), and ambient "vibes". Read fields in components for live updates;
 * assignments persist to localStorage.
 */

import { isHexColor } from '$lib/theme/color';
import { DEFAULT_FACE, isFace } from '$lib/theme/faces';
import { DEFAULT_THEME, isTheme } from '$lib/theme/themes';
import { VIBE_IDS } from '$lib/theme/vibes';
import { readJSON, writeJSON } from './storage';

export interface CustomColors {
	felt: string;
	back: string;
	accent: string;
}

interface SettingsData {
	sound: boolean;
	music: boolean;
	musicVolume: number;
	/** Ambience mood: 'auto' (matches the game) or a specific mood id. */
	musicMood: string;
	theme: string;
	face: string;
	custom: CustomColors;
	vibes: Record<string, boolean>;
}

const KEY = 'settings';
const DEFAULT_CUSTOM: CustomColors = { felt: '#3a6ea5', back: '#b9472f', accent: '#ffe39a' };

function defaultVibes(): Record<string, boolean> {
	return Object.fromEntries(VIBE_IDS.map((id) => [id, false]));
}

class Settings {
	#data = $state<SettingsData>({
		sound: true,
		music: true,
		musicVolume: 0.5,
		musicMood: 'auto',
		theme: DEFAULT_THEME,
		face: DEFAULT_FACE,
		custom: { ...DEFAULT_CUSTOM },
		vibes: defaultVibes()
	});

	constructor() {
		const saved = readJSON<Partial<SettingsData>>(KEY, {});
		this.#data = {
			sound: saved.sound ?? true,
			music: saved.music ?? true,
			musicVolume:
				typeof saved.musicVolume === 'number' && saved.musicVolume >= 0 && saved.musicVolume <= 1
					? saved.musicVolume
					: 0.5,
			musicMood: typeof saved.musicMood === 'string' ? saved.musicMood : 'auto',
			theme:
				saved.theme && (isTheme(saved.theme) || saved.theme === 'custom')
					? saved.theme
					: DEFAULT_THEME,
			face: saved.face && isFace(saved.face) ? saved.face : DEFAULT_FACE,
			custom: {
				felt:
					saved.custom && isHexColor(saved.custom.felt) ? saved.custom.felt : DEFAULT_CUSTOM.felt,
				back:
					saved.custom && isHexColor(saved.custom.back) ? saved.custom.back : DEFAULT_CUSTOM.back,
				accent:
					saved.custom && isHexColor(saved.custom.accent)
						? saved.custom.accent
						: DEFAULT_CUSTOM.accent
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

	get music(): boolean {
		return this.#data.music;
	}
	set music(value: boolean) {
		this.#data = { ...this.#data, music: value };
		this.#persist();
	}
	toggleMusic(): void {
		this.music = !this.#data.music;
	}

	get musicVolume(): number {
		return this.#data.musicVolume;
	}
	set musicVolume(value: number) {
		const v = Math.max(0, Math.min(1, value));
		this.#data = { ...this.#data, musicVolume: v };
		this.#persist();
	}

	get musicMood(): string {
		return this.#data.musicMood;
	}
	set musicMood(value: string) {
		this.#data = { ...this.#data, musicMood: value };
		this.#persist();
	}

	get theme(): string {
		return this.#data.theme;
	}
	set theme(value: string) {
		if (!isTheme(value) && value !== 'custom') return;
		this.#data = { ...this.#data, theme: value };
		this.#persist();
	}

	get face(): string {
		return this.#data.face;
	}
	set face(value: string) {
		if (!isFace(value)) return;
		this.#data = { ...this.#data, face: value };
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
