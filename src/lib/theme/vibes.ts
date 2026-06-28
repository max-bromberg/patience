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
	// cozy / cute
	{ id: 'petals', name: 'Petals', description: 'Drifting cherry blossoms', emoji: '🌸' },
	{ id: 'hearts', name: 'Hearts', description: 'Floating little hearts', emoji: '💗' },
	{ id: 'bubbles', name: 'Bubbles', description: 'Soft rising bubbles', emoji: '🫧' },
	{ id: 'clouds', name: 'Clouds', description: 'Lazy drifting clouds', emoji: '☁️' },
	{ id: 'fireflies', name: 'Fireflies', description: 'Gentle warm glimmers', emoji: '🌟' },
	{ id: 'sparkle', name: 'Sparkle', description: 'Occasional twinkles', emoji: '✨' },
	// moody / bold
	{ id: 'hearth', name: 'Hearth glow', description: 'A warm fireplace flicker', emoji: '🔥' },
	{ id: 'aurora', name: 'Aurora', description: 'Slow drifting color', emoji: '🌌' },
	{ id: 'vignette', name: 'Vignette', description: 'Soft darkened edges', emoji: '🌑' },
	{ id: 'casino', name: 'Casino lights', description: 'Chasing marquee bulbs', emoji: '🎰' }
];

export const VIBE_IDS: readonly string[] = VIBES.map((v) => v.id);
