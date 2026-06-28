/**
 * Pointer-driven drag helpers. Built on Pointer Events so touch and mouse share
 * ONE code path (priority #1: mobile parity). These are pure geometry helpers;
 * Table.svelte orchestrates the actual pointer capture and card motion.
 */

export interface Point {
	x: number;
	y: number;
}

/** A pile's hit rectangle in board-local coordinates. */
export interface TargetRect {
	pileId: string;
	left: number;
	top: number;
	right: number;
	bottom: number;
}

export function pointerPoint(e: PointerEvent): Point {
	return { x: e.clientX, y: e.clientY };
}

/** Squared distance — cheap, used only for comparisons. */
function dist2(ax: number, ay: number, bx: number, by: number): number {
	const dx = ax - bx;
	const dy = ay - by;
	return dx * dx + dy * dy;
}

function contains(r: TargetRect, p: Point): boolean {
	return p.x >= r.left && p.x <= r.right && p.y >= r.top && p.y <= r.bottom;
}

/**
 * Pick the best drop target for `point` among `rects` (already filtered to LEGAL
 * targets). Prefers a rect that contains the point; otherwise the nearest rect
 * by center, but only within `tolerance` px (so a drop far from any target is a
 * miss → spring back). Returns the pile id, or null.
 */
export function pickTarget(
	point: Point,
	rects: readonly TargetRect[],
	tolerance: number
): string | null {
	let containing: string | null = null;
	let nearest: string | null = null;
	let nearestD = Infinity;
	const tol2 = tolerance * tolerance;

	for (const r of rects) {
		if (contains(r, point)) {
			containing = r.pileId;
			break;
		}
		const cx = (r.left + r.right) / 2;
		const cy = (r.top + r.bottom) / 2;
		const d = dist2(point.x, point.y, cx, cy);
		if (d < nearestD) {
			nearestD = d;
			nearest = r.pileId;
		}
	}

	if (containing) return containing;
	return nearestD <= tol2 ? nearest : null;
}

/** Whether pointer travel exceeds the tap→drag threshold. */
export function exceedsThreshold(from: Point, to: Point, threshold: number): boolean {
	return dist2(from.x, from.y, to.x, to.y) > threshold * threshold;
}
