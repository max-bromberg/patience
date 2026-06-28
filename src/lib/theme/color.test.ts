import { describe, expect, it } from 'vitest';
import { isHexColor, parseHex, shade } from './color';

describe('parseHex', () => {
	it('parses 6- and 3-digit hex', () => {
		expect(parseHex('#2f7d57')).toEqual({ r: 0x2f, g: 0x7d, b: 0x57 });
		expect(parseHex('#fff')).toEqual({ r: 255, g: 255, b: 255 });
	});
	it('rejects bad input', () => {
		expect(parseHex('nope')).toBeNull();
		expect(parseHex('#12')).toBeNull();
	});
});

describe('shade', () => {
	it('darkens toward black and lightens toward white', () => {
		expect(shade('#808080', -1)).toBe('#000000');
		expect(shade('#808080', 1)).toBe('#ffffff');
		expect(shade('#808080', 0)).toBe('#808080');
	});
	it('returns input unchanged when unparseable', () => {
		expect(shade('nope', -0.5)).toBe('nope');
	});
});

describe('isHexColor', () => {
	it('validates', () => {
		expect(isHexColor('#2f7d57')).toBe(true);
		expect(isHexColor('#abc')).toBe(true);
		expect(isHexColor('red')).toBe(false);
	});
});
