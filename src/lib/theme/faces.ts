/**
 * Card-face styles — the look of the card FRONT (background, ink, corners, pip
 * treatment), independent of the table theme and card back. Each `id` maps to a
 * `[data-face='id']` block in faces.css. Grouped by vibe for the picker.
 */
export type FaceCategory = 'Cozy' | 'Cute' | 'Classic' | 'Bold';

export interface FaceOption {
	readonly id: string;
	readonly name: string;
	readonly category: FaceCategory;
}

export const FACES: readonly FaceOption[] = [
	// Cozy — the default vibe: warm, soft, rounded
	{ id: 'cozy', name: 'Cozy', category: 'Cozy' },
	{ id: 'linen', name: 'Linen', category: 'Cozy' },
	{ id: 'marshmallow', name: 'Marshmallow', category: 'Cozy' },
	{ id: 'cocoa', name: 'Cocoa', category: 'Cozy' },
	// Cute — pastel, playful
	{ id: 'cloud', name: 'Cloud', category: 'Cute' },
	{ id: 'bun', name: 'Bun', category: 'Cute' },
	{ id: 'sakura', name: 'Sakura', category: 'Cute' },
	{ id: 'matcha', name: 'Matcha', category: 'Cute' },
	{ id: 'lavender', name: 'Lavender', category: 'Cute' },
	{ id: 'bubblegum', name: 'Bubblegum', category: 'Cute' },
	// Classic — traditional
	{ id: 'classic', name: 'Classic', category: 'Classic' },
	{ id: 'paper', name: 'Paper', category: 'Classic' },
	// Bold — high-contrast, casino
	{ id: 'casino', name: 'Casino', category: 'Bold' },
	{ id: 'neon', name: 'Neon', category: 'Bold' },
	{ id: 'royal', name: 'Royal', category: 'Bold' }
];

export const DEFAULT_FACE = 'cozy';

export function isFace(id: string): boolean {
	return FACES.some((f) => f.id === id);
}
