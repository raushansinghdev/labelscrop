import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { buildSkuSummary, buildSkuSummaryPdf } from '@/lib/engine/summary';
import type { OrderMetadata, SourcePage } from '@/lib/engine/types';

function makePage(sku: string | null, qty: number | null): SourcePage {
	return {
		fileIndex: 0,
		pageIndex: 0,
		pageText: { pageIndex: 0, width: 595, height: 842, items: [], lines: [] },
		boundary: { found: true, splitY: 480 },
		metadata: {
			sku,
			size: null,
			color: null,
			qty,
			orderNo: null,
			purchaseOrderNo: null,
			awb: null,
			courier: null,
			paymentMode: null,
			destinationCode: null,
		} satisfies OrderMetadata,
	};
}

describe('buildSkuSummary', () => {
	it('groups by SKU and sums quantities', () => {
		const pages = [makePage('A', 1), makePage('A', 2), makePage('B', 1)];
		const summary = buildSkuSummary(pages);

		expect(summary).toEqual(
			expect.arrayContaining([
				{ sku: 'A', count: 3 },
				{ sku: 'B', count: 1 },
			]),
		);
	});

	it('sorts by count descending, then SKU ascending as a tiebreak', () => {
		const pages = [makePage('B', 1), makePage('A', 1), makePage('C', 5)];
		const summary = buildSkuSummary(pages);
		expect(summary.map((r) => r.sku)).toEqual(['C', 'A', 'B']);
	});

	it('treats a missing quantity as 1 unit, and groups missing SKUs under "Unknown SKU"', () => {
		const pages = [makePage(null, null), makePage(null, null)];
		const summary = buildSkuSummary(pages);
		expect(summary).toEqual([{ sku: 'Unknown SKU', count: 2 }]);
	});
});

describe('buildSkuSummaryPdf', () => {
	it('produces a valid, loadable single-page PDF for a small summary', async () => {
		const bytes = await buildSkuSummaryPdf([
			{ sku: 'A', count: 3 },
			{ sku: 'B', count: 1 },
		]);
		const doc = await PDFDocument.load(bytes);
		expect(doc.getPageCount()).toBe(1);
	});

	it('paginates onto additional pages when the summary is long', async () => {
		const rows = Array.from({ length: 80 }, (_, i) => ({ sku: `SKU-${i}`, count: 1 }));
		const bytes = await buildSkuSummaryPdf(rows);
		const doc = await PDFDocument.load(bytes);
		expect(doc.getPageCount()).toBeGreaterThan(1);
	});

	it('handles an empty summary without throwing', async () => {
		const bytes = await buildSkuSummaryPdf([]);
		const doc = await PDFDocument.load(bytes);
		expect(doc.getPageCount()).toBe(1);
	});
});
