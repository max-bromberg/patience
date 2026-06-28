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
	{ id: 'crimson', name: 'Crimson', swatch: '#9c3b46' }
];

export const DEFAULT_THEME = 'felt';

export function isTheme(id: string): boolean {
	return THEMES.some((t) => t.id === id);
}
