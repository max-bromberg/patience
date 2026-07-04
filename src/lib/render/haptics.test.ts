import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { haptics } from './haptics';
import { settings } from '$lib/storage/settings.svelte';

vi.mock('$lib/storage/settings.svelte', () => ({
	settings: { haptics: true }
}));

const mockSettings = settings as unknown as { haptics: boolean };

describe('haptics', () => {
	let vibrate: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		mockSettings.haptics = true;
		vibrate = vi.fn();
		vi.stubGlobal('navigator', { vibrate });
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('fires the expected pattern for each method when haptics are on', () => {
		haptics.tap();
		expect(vibrate).toHaveBeenLastCalledWith(10);

		haptics.place();
		expect(vibrate).toHaveBeenLastCalledWith(12);

		haptics.foundation();
		expect(vibrate).toHaveBeenLastCalledWith(18);

		haptics.deal();
		expect(vibrate).toHaveBeenLastCalledWith([8, 30, 8, 30, 8]);

		haptics.undo();
		expect(vibrate).toHaveBeenLastCalledWith(8);

		haptics.invalid();
		expect(vibrate).toHaveBeenLastCalledWith([10, 30, 10]);

		haptics.win();
		expect(vibrate).toHaveBeenLastCalledWith([12, 40, 12, 40, 24]);
	});

	it('does not vibrate when haptics are off', () => {
		mockSettings.haptics = false;
		haptics.place();
		haptics.foundation();
		haptics.win();
		expect(vibrate).not.toHaveBeenCalled();
	});

	it('does not throw when navigator.vibrate is undefined', () => {
		vi.stubGlobal('navigator', {});
		expect(() => haptics.place()).not.toThrow();
	});

	it('does not throw when navigator itself is undefined (SSR)', () => {
		vi.stubGlobal('navigator', undefined);
		expect(() => haptics.win()).not.toThrow();
	});

	it('does not throw when vibrate throws', () => {
		vibrate.mockImplementation(() => {
			throw new Error('outside a user gesture');
		});
		expect(() => haptics.foundation()).not.toThrow();
	});
});
