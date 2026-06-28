/**
 * Optional ambient "vibes" — purely cosmetic effects the player can layer on the
 * table for mood. Each is an independent toggle rendered by VibeLayer.svelte.
 */
export interface VibeOption {
	readonly id: string;
	readonly name: string;
	readonly description: string;
	readonly emoji: string;
}

export const VIBES: readonly VibeOption[] = [
	{ id: 'hearth', name: 'Hearth glow', description: 'A warm fireplace flicker', emoji: '🔥' },
	{ id: 'casino', name: 'Casino lights', description: 'Chasing marquee bulbs', emoji: '🎰' },
	{ id: 'aurora', name: 'Aurora', description: 'Slow drifting color', emoji: '🌌' },
	{ id: 'vignette', name: 'Vignette', description: 'Soft darkened edges', emoji: '🌑' },
	{ id: 'sparkle', name: 'Sparkle', description: 'Occasional twinkles', emoji: '✨' }
];

export const VIBE_IDS: readonly string[] = VIBES.map((v) => v.id);
