/**
 * Tiny hex-color helpers for the custom theme builder: derive darker/lighter
 * shades from a single base color so one picked color yields a full felt ramp.
 */

interface Rgb {
	r: number;
	g: number;
	b: number;
}

export function parseHex(hex: string): Rgb | null {
	let h = hex.trim().replace(/^#/, '');
	if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
	if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
	return {
		r: parseInt(h.slice(0, 2), 16),
		g: parseInt(h.slice(2, 4), 16),
		b: parseInt(h.slice(4, 6), 16)
	};
}

function toHex(rgb: Rgb): string {
	const c = (n: number) =>
		Math.max(0, Math.min(255, Math.round(n)))
			.toString(16)
			.padStart(2, '0');
	return `#${c(rgb.r)}${c(rgb.g)}${c(rgb.b)}`;
}

/**
 * Shift a color toward black (amount < 0) or white (amount > 0), where `amount`
 * is in [-1, 1]. Returns the input unchanged if it can't be parsed.
 */
export function shade(hex: string, amount: number): string {
	const rgb = parseHex(hex);
	if (!rgb) return hex;
	const target = amount < 0 ? 0 : 255;
	const t = Math.abs(amount);
	return toHex({
		r: rgb.r + (target - rgb.r) * t,
		g: rgb.g + (target - rgb.g) * t,
		b: rgb.b + (target - rgb.b) * t
	});
}

/** True for a valid #rgb or #rrggbb color string. */
export function isHexColor(hex: string): boolean {
	return parseHex(hex) !== null;
}
