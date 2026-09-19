import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { type ComposeInput, composeOutputDocument } from '@/lib/engine/compose';
import { extractPageLines } from '@/lib/engine/pdfText';
import type { LayoutPreset, SourcePage } from '@/lib/engine/types';
import { detectMeeshoBoundary } from '@/lib/platforms/meesho/boundaryDetect';
import { extractMeeshoMetadata } from '@/lib/platforms/meesho/metadataExtract';
import { buildMeeshoFixturePdf, type FixtureOrder } from './fixtures/buildMeeshoFixture';

const THERMAL_LAYOUT: LayoutPreset = {
	id: 'thermal-4x6',
	label: '4x6',
	pageWidth: 288,
	pageHeight: 432,
	columns: 1,
	rows: 1,
	marginPt: 0,
	gapPt: 0,
};

const A4_4UP_LAYOUT: LayoutPreset = {
	id: 'a4-4up',
	label: 'a4 4up',
	pageWidth: 595,
	pageHeight: 842,
	columns: 2,
	rows: 2,
	marginPt: 18,
	gapPt: 10,
};

async function buildSourcePages(orders: FixtureOrder[]): Promise<{ sourcePages: SourcePage[]; sourceDoc: PDFDocument }> {
	const bytes = await buildMeeshoFixturePdf(orders);
	const pageTexts = await extractPageLines(bytes);
	const sourceDoc = await PDFDocument.load(bytes);
	const sourcePages = pageTexts.map((pageText) => {
		const boundary = detectMeeshoBoundary(pageText);
		return {
			fileIndex: 0,
			pageIndex: pageText.pageIndex,
			pageText,
			boundary,
			metadata: extractMeeshoMetadata(pageText, boundary.splitY),
		};
	});
	return { sourcePages, sourceDoc };
}

describe('composeOutputDocument', () => {
	it('crops the label region so the invoice text is not present in the output', async () => {
		const { sourcePages, sourceDoc } = await buildSourcePages([
			{ sku: 'SKU-A', orderNo: '100000000000000001_1', awb: '9000000000000001' },
		]);
		const inputs: ComposeInput[] = sourcePages.map((sourcePage) => ({
			sourcePage,
			sourceDoc,
			region: 'label',
		}));

		const outputDoc = await composeOutputDocument(inputs, THERMAL_LAYOUT);
		const outputBytes = await outputDoc.save();
		const [outputPage] = await extractPageLines(outputBytes);
		const allText = outputPage.lines.map((l) => l.text).join(' | ');

		expect(allText).toContain('Product Details');
		expect(allText).toContain('SKU-A');
		expect(allText).not.toContain('BILL TO / SHIP TO');
		expect(allText).not.toContain('Purchase Order No.');
	});

	it('crops the invoice region so the label-only text is not present in the output', async () => {
		const { sourcePages, sourceDoc } = await buildSourcePages([
			{ sku: 'SKU-A', orderNo: '100000000000000001_1', awb: '9000000000000001' },
		]);
		const inputs: ComposeInput[] = sourcePages.map((sourcePage) => ({
			sourcePage,
			sourceDoc,
			region: 'invoice',
		}));

		const outputDoc = await composeOutputDocument(inputs, THERMAL_LAYOUT);
		const outputBytes = await outputDoc.save();
		const [outputPage] = await extractPageLines(outputBytes);
		const allText = outputPage.lines.map((l) => l.text).join(' | ');

		expect(allText).toContain('BILL TO / SHIP TO');
		expect(allText).not.toContain('Product Details');
		expect(allText).not.toContain('Customer Address');
	});

	it('keeps the whole original page (label and invoice both) for a "full" region, nothing cropped', async () => {
		const { sourcePages, sourceDoc } = await buildSourcePages([
			{ sku: 'SKU-A', orderNo: '100000000000000001_1', awb: '9000000000000001' },
		]);
		const inputs: ComposeInput[] = sourcePages.map((sourcePage) => ({
			sourcePage,
			sourceDoc,
			region: 'full',
		}));

		const outputDoc = await composeOutputDocument(inputs, A4_4UP_LAYOUT);
		const outputBytes = await outputDoc.save();
		const [outputPage] = await extractPageLines(outputBytes);
		const allText = outputPage.lines.map((l) => l.text).join(' | ');

		expect(allText).toContain('Product Details');
		expect(allText).toContain('SKU-A');
		expect(allText).toContain('BILL TO / SHIP TO');
		expect(allText).toContain('Purchase Order No.');
	});

	it('places one label per page for a 1x1 (thermal) layout', async () => {
		const { sourcePages, sourceDoc } = await buildSourcePages([
			{ sku: 'SKU-A', orderNo: '100000000000000001_1', awb: '9000000000000001' },
			{ sku: 'SKU-B', orderNo: '100000000000000002_1', awb: '9000000000000002' },
			{ sku: 'SKU-C', orderNo: '100000000000000003_1', awb: '9000000000000003' },
		]);
		const inputs: ComposeInput[] = sourcePages.map((sourcePage) => ({ sourcePage, sourceDoc, region: 'label' }));

		const outputDoc = await composeOutputDocument(inputs, THERMAL_LAYOUT);
		expect(outputDoc.getPageCount()).toBe(3);
	});

	it('packs four labels per page for a 2x2 A4 grid layout', async () => {
		const orders: FixtureOrder[] = Array.from({ length: 5 }, (_, i) => ({
			sku: `SKU-${i}`,
			orderNo: `10000000000000000${i}_1`,
			awb: `900000000000000${i}`,
		}));
		const { sourcePages, sourceDoc } = await buildSourcePages(orders);
		const inputs: ComposeInput[] = sourcePages.map((sourcePage) => ({ sourcePage, sourceDoc, region: 'label' }));

		const outputDoc = await composeOutputDocument(inputs, A4_4UP_LAYOUT);
		// 5 labels at 4-per-page => 2 output pages (4 + 1).
		expect(outputDoc.getPageCount()).toBe(2);
	});

	it('returns an empty document for an empty input list, without adding a blank page', async () => {
		const outputDoc = await composeOutputDocument([], THERMAL_LAYOUT);
		expect(outputDoc.getPageCount()).toBe(0);
	});

	it('stamps overlay text (custom text and order number) onto the output when requested', async () => {
		const { sourcePages, sourceDoc } = await buildSourcePages([
			{ sku: 'SKU-A', orderNo: '100000000000000001_1', awb: '9000000000000001' },
		]);
		const inputs: ComposeInput[] = sourcePages.map((sourcePage) => ({ sourcePage, sourceDoc, region: 'label' }));

		const outputDoc = await composeOutputDocument(inputs, THERMAL_LAYOUT, {
			customText: 'Dispatch Monday',
			showOrderNumber: true,
		});
		const outputBytes = await outputDoc.save();
		const [outputPage] = await extractPageLines(outputBytes);
		const allText = outputPage.lines.map((l) => l.text).join(' | ');

		expect(allText).toContain('Dispatch Monday');
		expect(allText).toContain('Order #100000000000000001_1');
	});
});
