import { describe, expect, it } from 'vitest';
import { findBoundaryByAnchor } from '@/lib/engine/boundary';
import type { TextItem } from '@/lib/engine/types';

function item(text: string, x: number, y: number): TextItem {
	return { text, x, y };
}

describe('findBoundaryByAnchor', () => {
	it('finds the anchor and returns a splitY above it, with the default buffer', () => {
		const items = [item('Some label content', 20, 600), item('TAX INVOICE', 265, 481.5)];
		const result = findBoundaryByAnchor(items, /^TAX INVOICE\b/i);

		expect(result.found).toBe(true);
		expect(result.splitY).toBeCloseTo(481.5 + 3, 5);
	});

	it('takes the highest y among multiple matching runs (an anchor split across items)', () => {
		const items = [item('TAX INVOICE', 265, 481.5), item('TAX INVOICE Original', 265, 482.1)];
		const result = findBoundaryByAnchor(items, /^TAX INVOICE/i);

		expect(result.splitY).toBeCloseTo(482.1 + 3, 5);
	});

	it('reports not found, rather than throwing, when the anchor is absent', () => {
		const items = [item('Nothing relevant here', 20, 600)];
		const result = findBoundaryByAnchor(items, /^TAX INVOICE\b/i);

		expect(result.found).toBe(false);
		expect(result.splitY).toBeNull();
	});
});
