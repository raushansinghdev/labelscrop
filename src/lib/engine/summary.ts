import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { SkuSummaryRow, SourcePage } from './types';

const UNKNOWN_SKU_LABEL = 'Unknown SKU';

/** Groups pages by SKU and sums quantities, for the "how many of each SKU do I need to pack today" summary
 * shown alongside the cropped labels. A page whose SKU couldn't be extracted is grouped under a single
 * "Unknown SKU" bucket rather than being silently dropped from the count. */
export function buildSkuSummary(pages: SourcePage[]): SkuSummaryRow[] {
	const counts = new Map<string, number>();
	for (const page of pages) {
		const sku = page.metadata.sku ?? UNKNOWN_SKU_LABEL;
		const qty = page.metadata.qty ?? 1;
		counts.set(sku, (counts.get(sku) ?? 0) + qty);
	}

	return Array.from(counts.entries())
		.map(([sku, count]) => ({ sku, count }))
		.sort((a, b) => b.count - a.count || a.sku.localeCompare(b.sku));
}

const PAGE_SIZE: [number, number] = [595.28, 841.89]; // A4
const MARGIN_X = 40;
const TOP_MARGIN = 60;
const BOTTOM_MARGIN = 50;
const ROW_HEIGHT = 18;
const QTY_COLUMN_X = 480;

/** Renders the SKU summary as its own small, standalone A4 PDF — independent of the label output, so it can
 * be downloaded (or printed as a packing checklist) on its own. */
export async function buildSkuSummaryPdf(rows: SkuSummaryRow[]): Promise<Uint8Array> {
	const doc = await PDFDocument.create();
	const font = await doc.embedFont(StandardFonts.Helvetica);
	const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);
	const grey = rgb(0.45, 0.45, 0.45);
	const lightGrey = rgb(0.75, 0.75, 0.75);

	let page = doc.addPage(PAGE_SIZE);
	let y = page.getHeight() - TOP_MARGIN;

	const addPageBreakIfNeeded = () => {
		if (y >= BOTTOM_MARGIN) return;
		page = doc.addPage(PAGE_SIZE);
		y = page.getHeight() - TOP_MARGIN;
	};

	page.drawText('SKU Order Summary', { x: MARGIN_X, y, size: 18, font: boldFont });
	y -= 26;

	const totalUnits = rows.reduce((sum, row) => sum + row.count, 0);
	page.drawText(`${rows.length} SKU${rows.length === 1 ? '' : 's'}, ${totalUnits} unit${totalUnits === 1 ? '' : 's'} total`, {
		x: MARGIN_X,
		y,
		size: 10,
		font,
		color: grey,
	});
	y -= 28;

	page.drawText('SKU', { x: MARGIN_X, y, size: 11, font: boldFont });
	page.drawText('Qty', { x: QTY_COLUMN_X, y, size: 11, font: boldFont });
	y -= 8;
	page.drawLine({
		start: { x: MARGIN_X, y },
		end: { x: PAGE_SIZE[0] - MARGIN_X, y },
		thickness: 0.75,
		color: lightGrey,
	});
	y -= ROW_HEIGHT;

	for (const row of rows) {
		addPageBreakIfNeeded();
		page.drawText(row.sku, { x: MARGIN_X, y, size: 10, font, maxWidth: QTY_COLUMN_X - MARGIN_X - 12 });
		page.drawText(String(row.count), { x: QTY_COLUMN_X, y, size: 10, font });
		y -= ROW_HEIGHT;
	}

	return doc.save();
}
