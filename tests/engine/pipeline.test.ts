import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { extractPageLines } from '@/lib/engine/pdfText';
import { processFiles } from '@/lib/engine/pipeline';
import { meeshoAdapter } from '@/lib/platforms/meesho/adapter';
import { MEESHO_INVOICE_LAYOUT, MEESHO_LAYOUTS } from '@/lib/platforms/meesho/layouts';
import { buildMeeshoFixturePdf, type FixtureOrder } from './fixtures/buildMeeshoFixture';

describe('processFiles (end-to-end, Meesho adapter)', () => {
	it('processes a single file into sorted, cropped labels plus a SKU summary', async () => {
		const orders: FixtureOrder[] = [
			{ sku: 'SKU-B', orderNo: '100000000000000001_1', awb: '9000000000000001', courier: 'Delhivery' },
			{ sku: 'SKU-A', orderNo: '100000000000000002_1', awb: '9000000000000002', courier: 'Delhivery' },
		];
		const bytes = await buildMeeshoFixturePdf(orders);

		const { result, failures } = await processFiles(
			[{ name: 'labels.pdf', bytes }],
			meeshoAdapter,
			{ layout: MEESHO_LAYOUTS['thermal-4x6'], sortKey: 'sku', keepInvoice: false },
		);

		expect(failures).toEqual([]);
		expect(result.pageCount).toBe(2);
		expect(result.warnings).toEqual([]);
		expect(result.summary).toEqual(
			expect.arrayContaining([
				{ sku: 'SKU-A', count: 1 },
				{ sku: 'SKU-B', count: 1 },
			]),
		);

		const labelDoc = await PDFDocument.load(result.labelPdfBytes);
		expect(labelDoc.getPageCount()).toBe(2);

		// Sorted by SKU: SKU-A's order should appear before SKU-B's in the composed output.
		const [firstPage] = await extractPageLines(result.labelPdfBytes);
		const firstPageText = firstPage.lines.map((l) => l.text).join(' | ');
		expect(firstPageText).toContain('100000000000000002_1'); // SKU-A's order

		expect(result.invoicePdfBytes).toBeNull();
	});

	it('produces a separate invoice PDF when keepInvoice is true', async () => {
		const bytes = await buildMeeshoFixturePdf([
			{ sku: 'SKU-A', orderNo: '100000000000000001_1', awb: '9000000000000001' },
		]);

		const { result } = await processFiles([{ name: 'labels.pdf', bytes }], meeshoAdapter, {
			layout: MEESHO_LAYOUTS['thermal-4x6'],
			sortKey: 'original',
			keepInvoice: true,
			invoiceLayout: MEESHO_INVOICE_LAYOUT,
		});

		expect(result.invoicePdfBytes).not.toBeNull();
		const invoiceDoc = await PDFDocument.load(result.invoicePdfBytes as Uint8Array);
		expect(invoiceDoc.getPageCount()).toBe(1);
	});

	it('combines multiple uploaded files into one output, without cross-file page-index collisions', async () => {
		const fileA = await buildMeeshoFixturePdf([
			{ sku: 'SKU-A', orderNo: '100000000000000001_1', awb: '9000000000000001' },
		]);
		const fileB = await buildMeeshoFixturePdf([
			{ sku: 'SKU-B', orderNo: '200000000000000001_1', awb: '9100000000000001' },
		]);

		const { result, failures } = await processFiles(
			[
				{ name: 'account-1.pdf', bytes: fileA },
				{ name: 'account-2.pdf', bytes: fileB },
			],
			meeshoAdapter,
			{ layout: MEESHO_LAYOUTS['thermal-4x6'], sortKey: 'original', keepInvoice: false },
		);

		expect(failures).toEqual([]);
		expect(result.pageCount).toBe(2);
		expect(result.summary).toHaveLength(2);
	});

	it('records a per-file failure for a corrupt upload without aborting the rest of the batch', async () => {
		const goodBytes = await buildMeeshoFixturePdf([
			{ sku: 'SKU-A', orderNo: '100000000000000001_1', awb: '9000000000000001' },
		]);
		const corruptBytes = new Uint8Array([1, 2, 3]);

		const { result, failures } = await processFiles(
			[
				{ name: 'good.pdf', bytes: goodBytes },
				{ name: 'corrupt.pdf', bytes: corruptBytes },
			],
			meeshoAdapter,
			{ layout: MEESHO_LAYOUTS['thermal-4x6'], sortKey: 'original', keepInvoice: false },
		);

		expect(failures).toHaveLength(1);
		expect(failures[0].fileName).toBe('corrupt.pdf');
		expect(result.pageCount).toBe(1);
	});

	it('surfaces a non-blocking warning (not a thrown error) for a page with no detectable boundary', async () => {
		const bytes = await buildMeeshoFixturePdf([
			{ sku: 'SKU-A', orderNo: '100000000000000001_1', awb: '9000000000000001', omitBoundaryAnchor: true },
		]);

		const { result, failures } = await processFiles([{ name: 'weird.pdf', bytes }], meeshoAdapter, {
			layout: MEESHO_LAYOUTS['thermal-4x6'],
			sortKey: 'original',
			keepInvoice: false,
		});

		expect(failures).toEqual([]);
		expect(result.pageCount).toBe(1);
		expect(result.warnings).toHaveLength(1);
		expect(result.warnings[0]).toContain("couldn't auto-detect the invoice split");
	});

	it('reports progress through each stage', async () => {
		const bytes = await buildMeeshoFixturePdf([
			{ sku: 'SKU-A', orderNo: '100000000000000001_1', awb: '9000000000000001' },
		]);
		const stages: string[] = [];

		await processFiles([{ name: 'labels.pdf', bytes }], meeshoAdapter, {
			layout: MEESHO_LAYOUTS['thermal-4x6'],
			sortKey: 'original',
			keepInvoice: false,
			onProgress: (event) => stages.push(event.stage),
		});

		expect(stages).toEqual(['reading', 'composing', 'summarizing']);
	});

	it('puts multi-unit orders first and splits labels into one PDF per courier', async () => {
		const bytes = await buildMeeshoFixturePdf([
			{ sku: 'SKU-A', orderNo: '100000000000000001_1', awb: '9000000000000001', courier: 'Delhivery' },
			{ sku: 'SKU-B', orderNo: '100000000000000002_1', awb: '9000000000000002', courier: 'Ekart', qty: 2 },
			{ sku: 'SKU-C', orderNo: '100000000000000003_1', awb: '9000000000000003', courier: 'Delhivery' },
		]);

		const { result } = await processFiles([{ name: 'labels.pdf', bytes }], meeshoAdapter, {
			layout: MEESHO_LAYOUTS['thermal-4x6'],
			sortKey: 'sku',
			keepInvoice: false,
			multiUnitFirst: true,
			splitByCourier: true,
			overlay: { showQtyBadge: true },
		});

		const [firstPage] = await extractPageLines(result.labelPdfBytes);
		const firstText = firstPage.lines.map((l) => l.text).join(' | ');
		expect(firstText).toContain('100000000000000002_1');
		expect(firstText).toContain('\u00D72');

		expect(result.courierPdfs.map((c) => [c.courier, c.labelCount])).toEqual([
			['Ekart', 1],
			['Delhivery', 2],
		]);
		const delhivery = await PDFDocument.load(result.courierPdfs[1].bytes);
		expect(delhivery.getPageCount()).toBe(2);
	});

	it('skips the courier split when every label has the same courier', async () => {
		const bytes = await buildMeeshoFixturePdf([
			{ sku: 'SKU-A', orderNo: '100000000000000001_1', awb: '9000000000000001', courier: 'Delhivery' },
			{ sku: 'SKU-B', orderNo: '100000000000000002_1', awb: '9000000000000002', courier: 'Delhivery' },
		]);
		const { result } = await processFiles([{ name: 'labels.pdf', bytes }], meeshoAdapter, {
			layout: MEESHO_LAYOUTS['thermal-4x6'],
			sortKey: 'original',
			keepInvoice: false,
			splitByCourier: true,
		});
		expect(result.courierPdfs).toEqual([]);
	});

	it('only drops a file uploaded twice when skipDuplicates is on', async () => {
		const bytes = await buildMeeshoFixturePdf([
			{ sku: 'SKU-A', orderNo: '100000000000000001_1', awb: '9000000000000001' },
			{ sku: 'SKU-B', orderNo: '100000000000000002_1', awb: '9000000000000002' },
		]);
		const files = [
			{ name: 'a.pdf', bytes },
			{ name: 'b.pdf', bytes },
		];
		const base = { layout: MEESHO_LAYOUTS['thermal-4x6'], sortKey: 'original' as const, keepInvoice: false };

		const off = await processFiles(files, meeshoAdapter, base);
		expect(off.result.pageCount).toBe(4);
		expect(off.result.duplicatesRemoved).toBe(0);

		const on = await processFiles(files, meeshoAdapter, { ...base, skipDuplicates: true });
		expect(on.result.pageCount).toBe(2);
		expect(on.result.duplicatesRemoved).toBe(2);
	});
});
