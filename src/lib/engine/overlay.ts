import { type PDFDocument, type PDFFont, type PDFPage, StandardFonts, rgb } from 'pdf-lib';
import type { CellRect } from './layout';
import type { OrderMetadata, OverlayOptions } from './types';

const OVERLAY_FONT_SIZE = 7;
const OVERLAY_MARGIN = 4;
const OVERLAY_LINE_GAP = 2;

/** Embeds the (one, shared) font used for every overlay stamp in an output document. Callers embed this
 * once per document and reuse it across every page/cell rather than re-embedding per label. */
export function embedOverlayFont(doc: PDFDocument): Promise<PDFFont> {
	return doc.embedFont(StandardFonts.Helvetica);
}

function buildOverlayLines(metadata: OrderMetadata, options: OverlayOptions): string[] {
	const lines: string[] = [];
	if (options.customText) lines.push(options.customText);
	if (options.showOrderNumber && metadata.orderNo) lines.push(`Order #${metadata.orderNo}`);
	if (options.showDateTime) lines.push(new Date().toLocaleString('en-IN'));
	return lines;
}

/** Stamps the requested custom text / order number / date-time onto a label, bottom-left of its cell. Does
 * nothing if none of the overlay options are set for this run, or none produced a value for this order
 * (e.g. "show order number" on a page metadata extraction couldn't find one). */
export function drawOverlay(
	page: PDFPage,
	cell: CellRect,
	metadata: OrderMetadata,
	options: OverlayOptions,
	font: PDFFont,
): void {
	const lines = buildOverlayLines(metadata, options);
	let y = cell.y + OVERLAY_MARGIN;
	for (const line of lines) {
		page.drawText(line, {
			x: cell.x + OVERLAY_MARGIN,
			y,
			size: OVERLAY_FONT_SIZE,
			font,
			color: rgb(0, 0, 0),
		});
		y += OVERLAY_FONT_SIZE + OVERLAY_LINE_GAP;
	}
}
