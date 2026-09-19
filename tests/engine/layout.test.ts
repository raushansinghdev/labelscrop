import { describe, expect, it } from 'vitest';
import { computeCellRects, fitContainAutoRotate } from '@/lib/engine/layout';
import type { LayoutPreset } from '@/lib/engine/types';

describe('computeCellRects', () => {
	it('returns a single full-page cell for a 1x1 (thermal) layout', () => {
		const layout: LayoutPreset = {
			id: 'test',
			label: 'test',
			pageWidth: 288,
			pageHeight: 432,
			columns: 1,
			rows: 1,
			marginPt: 0,
			gapPt: 0,
		};
		const cells = computeCellRects(layout);
		expect(cells).toEqual([{ x: 0, y: 0, width: 288, height: 432 }]);
	});

	it('lays out an N-up grid top-to-bottom, left-to-right, honoring margin and gap', () => {
		const layout: LayoutPreset = {
			id: 'test',
			label: 'test',
			pageWidth: 100,
			pageHeight: 100,
			columns: 2,
			rows: 2,
			marginPt: 10,
			gapPt: 10,
		};
		const cells = computeCellRects(layout);
		// usable = 100 - 20 - 10 = 70 across 2 columns/rows => 35pt cells
		expect(cells).toHaveLength(4);
		expect(cells[0]).toEqual({ x: 10, y: 55, width: 35, height: 35 }); // top-left
		expect(cells[1]).toEqual({ x: 55, y: 55, width: 35, height: 35 }); // top-right
		expect(cells[2]).toEqual({ x: 10, y: 10, width: 35, height: 35 }); // bottom-left
		expect(cells[3]).toEqual({ x: 55, y: 10, width: 35, height: 35 }); // bottom-right
	});
});

describe('fitContainAutoRotate', () => {
	const cell = { x: 0, y: 0, width: 288, height: 432 }; // 4x6" portrait cell

	it('does not rotate when the unrotated orientation already fits better', () => {
		// A near-portrait source (taller than wide) fits a portrait cell better unrotated.
		const result = fitContainAutoRotate(200, 400, cell);
		expect(result.rotateDeg).toBe(0);
		expect(result.width).toBeLessThanOrEqual(cell.width + 1e-6);
		expect(result.height).toBeLessThanOrEqual(cell.height + 1e-6);
	});

	it('rotates 90° when a wide-and-short source fits a tall cell better rotated', () => {
		// Roughly the real Meesho label region's proportions: wide (595) and short (357.5).
		const result = fitContainAutoRotate(595, 357.5, cell);
		expect(result.rotateDeg).toBe(90);
	});

	it('centers the rotated placement within the cell', () => {
		const result = fitContainAutoRotate(595, 357.5, cell);
		// Reconstruct the visual bounding box pdf-lib will actually draw, per drawPage's rotation semantics,
		// and confirm it's centered in the cell.
		const visualLeft = result.x - result.height;
		const visualRight = result.x;
		const visualBottom = result.y;
		const visualTop = result.y + result.width;

		const visualCenterX = (visualLeft + visualRight) / 2;
		const visualCenterY = (visualBottom + visualTop) / 2;
		expect(visualCenterX).toBeCloseTo(cell.x + cell.width / 2, 5);
		expect(visualCenterY).toBeCloseTo(cell.y + cell.height / 2, 5);
	});

	it('centers a non-rotated placement within the cell', () => {
		const result = fitContainAutoRotate(200, 400, cell);
		const centerX = result.x + result.width / 2;
		const centerY = result.y + result.height / 2;
		expect(centerX).toBeCloseTo(cell.x + cell.width / 2, 5);
		expect(centerY).toBeCloseTo(cell.y + cell.height / 2, 5);
	});
});
