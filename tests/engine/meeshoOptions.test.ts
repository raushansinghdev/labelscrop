import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { extractPageLines } from '@/lib/engine/pdfText';
import { buildFirstPagePreview } from '@/lib/engine/preview';
import { resolveDefaultConfig, sanitizeConfig } from '@/lib/options/schema';
import { meeshoAdapter } from '@/lib/platforms/meesho/adapter';
import { describeMeeshoConfig } from '@/lib/platforms/meesho/describe';
import { MEESHO_LAYOUTS } from '@/lib/platforms/meesho/layouts';
import { MEESHO_OPTIONS } from '@/lib/platforms/meesho/options';
import { resolveMeeshoProcessOptions } from '@/lib/platforms/meesho/resolveOptions';
import { buildMeeshoFixturePdf } from './fixtures/buildMeeshoFixture';

const defaults = resolveDefaultConfig(MEESHO_OPTIONS);

describe('resolveMeeshoProcessOptions — labels per A4 sheet', () => {
	it.each([
		['1', 1],
		['2', 2],
		['4', 4],
	])('maps labelsPerSheet=%s onto an A4 layout with %i cells', (perSheet, cells) => {
		const { layout } = resolveMeeshoProcessOptions({ ...defaults, printerType: 'a4', labelsPerSheet: perSheet });
		expect(layout.columns * layout.rows).toBe(cells);
		expect(layout.pageWidth).toBeCloseTo(MEESHO_LAYOUTS['a4-4up'].pageWidth);
	});

	it('ignores labelsPerSheet for a label printer', () => {
		const { layout } = resolveMeeshoProcessOptions({ ...defaults, printerType: 'label', labelsPerSheet: '1' });
		expect(layout.id).toBe('thermal-4x6');
	});

	it('only saves invoices separately when the toggle is on and the invoice is being cropped away', () => {
		expect(resolveMeeshoProcessOptions({ ...defaults, keepInvoice: true }).keepInvoice).toBe(true);
		expect(resolveMeeshoProcessOptions({ ...defaults, keepInvoice: true, cropMode: 'full' }).keepInvoice).toBe(false);
		expect(resolveMeeshoProcessOptions({ ...defaults, keepInvoice: 'yes' }).keepInvoice).toBe(false);
	});
});

describe('sanitizeConfig', () => {
	it('drops unknown ids, type mismatches, and values that are no longer a valid choice', () => {
		const clean = sanitizeConfig(MEESHO_OPTIONS, {
			printerType: 'a4',
			labelsPerSheet: '3',
			keepInvoice: 'yes', // was a Yes/No segmented control before it became a toggle
			sortKey: 'sku',
			removedOption: true,
		});
		expect(clean).toEqual({ printerType: 'a4', sortKey: 'sku' });
	});
});

describe('describeMeeshoConfig', () => {
	it('summarizes the settings in short phrases', () => {
		expect(describeMeeshoConfig({ ...defaults, printerType: 'a4', labelsPerSheet: '4', sortKey: 'sku' })).toEqual([
			'A4 · 4 per sheet',
			'Label only',
			'Sorted by SKU',
		]);
		expect(describeMeeshoConfig({ ...defaults, cropMode: 'full', sortKey: 'courier' })).toEqual([
			'4 x 6" label',
			'Label + invoice',
			'Sorted by courier',
		]);
	});
});

describe('buildFirstPagePreview', () => {
	it('previews a full first sheet for an N-up layout, not just the first label', async () => {
		const bytes = await buildMeeshoFixturePdf(
			['1', '2', '3', '4', '5'].map((n) => ({ sku: `SKU-${n}`, orderNo: `10000000000000000${n}_1`, awb: `900000000000000${n}` })),
		);
		const preview = await buildFirstPagePreview(bytes, meeshoAdapter, MEESHO_LAYOUTS['a4-4up'], 'full');
		expect(preview?.labelCount).toBe(4);

		const doc = await PDFDocument.load(preview?.pdfBytes as Uint8Array);
		expect(doc.getPageCount()).toBe(1);
		const [page] = await extractPageLines(preview?.pdfBytes as Uint8Array);
		const text = page.lines.map((l) => l.text).join(' | ');
		for (const n of ['1', '2', '3', '4']) expect(text).toContain(`10000000000000000${n}_1`);
		expect(text).not.toContain('100000000000000005_1');
	});

	it('previews a single label for a one-per-page layout', async () => {
		const bytes = await buildMeeshoFixturePdf([
			{ sku: 'SKU-A', orderNo: '100000000000000001_1', awb: '9000000000000001' },
			{ sku: 'SKU-B', orderNo: '100000000000000002_1', awb: '9000000000000002' },
		]);
		const preview = await buildFirstPagePreview(bytes, meeshoAdapter, MEESHO_LAYOUTS['thermal-4x6'], 'label');
		expect(preview?.labelCount).toBe(1);
	});
});

describe('feedback mailto', () => {
	it('addresses the feedback inbox with an encoded subject and template body', async () => {
		const { feedbackMailto } = await import('@/lib/feedback');
		const href = feedbackMailto('https://labelscrop.com/faq/', 'Android · Chrome 128');
		expect(href.startsWith('mailto:singhraushan2410@gmail.com?subject=')).toBe(true);
		const body = decodeURIComponent(href.split('&body=')[1]);
		expect(body).toContain('Page: https://labelscrop.com/faq/');
		expect(body).toContain('Device / browser: Android · Chrome 128');
	});

	it('describes common devices from their user agent', async () => {
		const { describeDevice } = await import('@/lib/feedback');
		expect(
			describeDevice('Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36'),
		).toBe('Android · Chrome 128');
		expect(
			describeDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'),
		).toBe('iOS · Safari 17');
		expect(describeDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7; rv:130.0) Gecko/20100101 Firefox/130.0')).toBe('macOS · Firefox 130');
	});
});
