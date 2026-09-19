import { describe, expect, it } from 'vitest';
import { extractPageLines, PasswordProtectedPdfError, UnreadablePdfError } from '@/lib/engine/pdfText';
import { buildMeeshoFixturePdf } from './fixtures/buildMeeshoFixture';

describe('extractPageLines', () => {
	it('extracts one PageTextModel per page, with correct page dimensions', async () => {
		const bytes = await buildMeeshoFixturePdf([
			{ sku: 'SKU-A', orderNo: '100000000000000001_1', awb: '9000000000000001' },
			{ sku: 'SKU-B', orderNo: '100000000000000002_1', awb: '9000000000000002' },
		]);

		const pages = await extractPageLines(bytes);

		expect(pages).toHaveLength(2);
		expect(pages[0].pageIndex).toBe(0);
		expect(pages[1].pageIndex).toBe(1);
		expect(pages[0].width).toBeCloseTo(595, 0);
		expect(pages[0].height).toBeCloseTo(842, 0);
	});

	it('populates both a flat items array and a line-grouped array', async () => {
		const bytes = await buildMeeshoFixturePdf([
			{ sku: 'SKU-A', orderNo: '100000000000000001_1', awb: '9000000000000001' },
		]);
		const [page] = await extractPageLines(bytes);

		expect(page.items.length).toBeGreaterThan(10);
		expect(page.lines.length).toBeGreaterThan(5);
		// The Product Details header row is a clean single line with all five column headers.
		const headerLine = page.lines.find((line) => line.text.startsWith('SKU'));
		expect(headerLine?.text).toBe('SKU Size Qty Color Order No.');
	});

	it('rejects a non-PDF file with UnreadablePdfError', async () => {
		const garbage = new Uint8Array([1, 2, 3, 4, 5]);
		await expect(extractPageLines(garbage)).rejects.toBeInstanceOf(UnreadablePdfError);
	});

	it('exports PasswordProtectedPdfError as a distinct error type', () => {
		expect(new PasswordProtectedPdfError().name).toBe('PasswordProtectedPdfError');
	});
});
