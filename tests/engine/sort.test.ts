import { describe, expect, it } from 'vitest';
import { sortPages } from '@/lib/engine/sort';
import type { OrderMetadata, SourcePage } from '@/lib/engine/types';

function makePage(
	fileIndex: number,
	pageIndex: number,
	metadata: Partial<OrderMetadata>,
): SourcePage {
	return {
		fileIndex,
		pageIndex,
		pageText: { pageIndex, width: 595, height: 842, items: [], lines: [] },
		boundary: { found: true, splitY: 480 },
		metadata: {
			sku: null,
			size: null,
			qty: null,
			color: null,
			orderNo: null,
			purchaseOrderNo: null,
			awb: null,
			courier: null,
			paymentMode: null,
			destinationCode: null,
			...metadata,
		},
	};
}

describe('sortPages', () => {
	it('"original" preserves upload order across multiple files', () => {
		const pages = [
			makePage(1, 0, { sku: 'Z' }),
			makePage(0, 1, { sku: 'A' }),
			makePage(0, 0, { sku: 'B' }),
		];
		const sorted = sortPages(pages, 'original');
		expect(sorted.map((p) => [p.fileIndex, p.pageIndex])).toEqual([
			[0, 0],
			[0, 1],
			[1, 0],
		]);
	});

	it('sorts by SKU alphabetically', () => {
		const pages = [makePage(0, 0, { sku: 'Zebra' }), makePage(0, 1, { sku: 'Apple' })];
		const sorted = sortPages(pages, 'sku');
		expect(sorted.map((p) => p.metadata.sku)).toEqual(['Apple', 'Zebra']);
	});

	it('sorts by courier alphabetically', () => {
		const pages = [makePage(0, 0, { courier: 'Xpressbees' }), makePage(0, 1, { courier: 'Delhivery' })];
		const sorted = sortPages(pages, 'courier');
		expect(sorted.map((p) => p.metadata.courier)).toEqual(['Delhivery', 'Xpressbees']);
	});

	it('pushes pages with a missing sort field to the end, without dropping them', () => {
		const pages = [
			makePage(0, 0, { sku: null }),
			makePage(0, 1, { sku: 'Apple' }),
			makePage(0, 2, { sku: null }),
		];
		const sorted = sortPages(pages, 'sku');
		expect(sorted).toHaveLength(3);
		expect(sorted[0].metadata.sku).toBe('Apple');
		expect(sorted[1].metadata.sku).toBeNull();
		expect(sorted[2].metadata.sku).toBeNull();
	});

	it('breaks ties by original position, for a stable sort', () => {
		const pages = [makePage(0, 0, { sku: 'A' }), makePage(0, 1, { sku: 'A' }), makePage(0, 2, { sku: 'A' })];
		const sorted = sortPages(pages, 'sku');
		expect(sorted.map((p) => p.pageIndex)).toEqual([0, 1, 2]);
	});

	it('sorts by color, then size, grouping same-color pages together', () => {
		const pages = [
			makePage(0, 0, { color: 'Blue', size: 'L' }),
			makePage(0, 1, { color: 'Blue', size: 'S' }),
			makePage(0, 2, { color: 'Red', size: 'M' }),
		];
		const sorted = sortPages(pages, 'colorSize');
		expect(sorted.map((p) => [p.metadata.color, p.metadata.size])).toEqual([
			['Blue', 'L'],
			['Blue', 'S'],
			['Red', 'M'],
		]);
	});

	it('sorts by size, then color — a different grouping than colorSize for the same pages', () => {
		const pages = [
			makePage(0, 0, { color: 'Blue', size: 'L' }),
			makePage(0, 1, { color: 'Blue', size: 'S' }),
			makePage(0, 2, { color: 'Red', size: 'M' }),
		];
		const sorted = sortPages(pages, 'sizeColor');
		expect(sorted.map((p) => [p.metadata.size, p.metadata.color])).toEqual([
			['L', 'Blue'],
			['M', 'Red'],
			['S', 'Blue'],
		]);
	});

	it('pushes pages missing both color and size to the end for colorSize/sizeColor', () => {
		const pages = [
			makePage(0, 0, { color: null, size: null }),
			makePage(0, 1, { color: 'Blue', size: 'L' }),
		];
		const sorted = sortPages(pages, 'colorSize');
		expect(sorted.map((p) => p.metadata.color)).toEqual(['Blue', null]);
	});
});
