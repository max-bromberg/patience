import { luminance } from './color';

/** Available felt themes. `id` maps to a `data-theme` value in theme.css. */
export interface ThemeOption {
	readonly id: string;
	readonly name: string;
	/** Representative felt color for the picker swatch. */
	readonly swatch: string;
}

export const THEMES: readonly ThemeOption[] = [
	{ id: 'felt', name: 'Felt', swatch: '#2f7d57' },
	{ id: 'twilight', name: 'Twilight', swatch: '#6a4aa0' },
	{ id: 'midnight', name: 'Midnight', swatch: '#2c3340' },
	{ id: 'ocean', name: 'Ocean', swatch: '#1f7a8c' },
	{ id: 'crimson', name: 'Crimson', swatch: '#9c3b46' },
	{ id: 'sunset', name: 'Sunset', swatch: '#b5532e' },
	{ id: 'rose', name: 'Rose', swatch: '#b14a6e' },
	{ id: 'slate', name: 'Slate', swatch: '#4a5b73' },
	// cute / pastel
	{ id: 'blossom', name: 'Blossom', swatch: '#d98aa6' },
	{ id: 'mint', name: 'Mint', swatch: '#6bc2a8' },
	{ id: 'grape', name: 'Grape', swatch: '#9d7ad0' },
	{ id: 'cloudtop', name: 'Cloudtop', swatch: '#c2def5' },
	{ id: 'buttercream', name: 'Buttercream', swatch: '#f6ddae' }
];

export const DEFAULT_THEME = 'felt';

export function isTheme(id: string): boolean {
	return THEMES.some((t) => t.id === id);
}

/** Preset themes with a light felt (dark ink UI). Custom is judged by luminance. */
const LIGHT_THEMES = new Set(['cloudtop', 'buttercream']);

/**
 * Whether the active theme reads as "light" — used to pick a readable iOS
 * status-bar style (dark text on light themes, light text on dark ones).
 */
export function isLightTheme(theme: string, customFelt?: string): boolean {
	if (theme === 'custom') return customFelt ? luminance(customFelt) > 0.65 : false;
	return LIGHT_THEMES.has(theme);
}
