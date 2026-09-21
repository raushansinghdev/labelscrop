import { type PDFDocument, type PDFFont, type PDFPage, StandardFonts, rgb } from 'pdf-lib';
import type { CellRect } from './layout';
import type { OrderMetadata, OverlayOptions } from './types';

const OVERLAY_FONT_SIZE = 7;
const OVERLAY_MARGIN = 4;
const OVERLAY_LINE_GAP = 2;

const BADGE_FONT_SIZE = 12;
const BADGE_PAD_X = 5;
const BADGE_PAD_Y = 3;

export interface OverlayFonts {
	regular: PDFFont;
	/** Only embedded when the quantity badge is on. */
	bold: PDFFont | null;
}

/** Embeds the fonts used for every overlay stamp in an output document. Callers embed these once per
 * document and reuse them across every page/cell rather than re-embedding per label. */
export async function embedOverlayFonts(doc: PDFDocument, options: OverlayOptions): Promise<OverlayFonts> {
	const regular = await doc.embedFont(StandardFonts.Helvetica);
	const bold = options.showQtyBadge ? await doc.embedFont(StandardFonts.HelveticaBold) : null;
	return { regular, bold };
}

function buildOverlayLines(metadata: OrderMetadata, options: OverlayOptions): string[] {
	const lines: string[] = [];
	if (options.customText) lines.push(options.customText);
	if (options.showOrderNumber && metadata.orderNo) lines.push(`Order #${metadata.orderNo}`);
	if (options.showDateTime) lines.push(new Date().toLocaleString('en-IN'));
	return lines;
}

/** White "×N" on a black pill, top-right of the cell — reads at arm's length on a packing table, and
 * survives a faded thermal print better than grey text would. Only for orders of more than one unit. */
function drawQtyBadge(page: PDFPage, cell: CellRect, qty: number, font: PDFFont): void {
	// Helvetica's WinAnsi encoding has "×" (U+00D7), so no custom font is needed.
	const text = `\u00D7${qty}`;
	const textWidth = font.widthOfTextAtSize(text, BADGE_FONT_SIZE);
	const width = textWidth + BADGE_PAD_X * 2;
	const height = BADGE_FONT_SIZE + BADGE_PAD_Y * 2;
	const x = cell.x + cell.width - OVERLAY_MARGIN - width;
	const y = cell.y + cell.height - OVERLAY_MARGIN - height;
	page.drawRectangle({ x, y, width, height, color: rgb(0, 0, 0) });
	page.drawText(text, {
		x: x + BADGE_PAD_X,
		// Helvetica's baseline sits ~0.22em above the glyph box bottom; this centres the cap height in the pill.
		y: y + BADGE_PAD_Y + BADGE_FONT_SIZE * 0.18,
		size: BADGE_FONT_SIZE,
		font,
		color: rgb(1, 1, 1),
	});
}

/** Stamps the requested custom text / order number / date-time onto a label, bottom-left of its cell, and
 * the quantity badge top-right. Does nothing if none of the overlay options are set for this run, or none
 * produced a value for this order (e.g. "show order number" on a page metadata extraction couldn't find one). */
export function drawOverlay(
	page: PDFPage,
	cell: CellRect,
	metadata: OrderMetadata,
	options: OverlayOptions,
	fonts: OverlayFonts,
): void {
	const lines = buildOverlayLines(metadata, options);
	let y = cell.y + OVERLAY_MARGIN;
	for (const line of lines) {
		page.drawText(line, {
			x: cell.x + OVERLAY_MARGIN,
			y,
			size: OVERLAY_FONT_SIZE,
			font: fonts.regular,
			color: rgb(0, 0, 0),
		});
		y += OVERLAY_FONT_SIZE + OVERLAY_LINE_GAP;
	}

	if (options.showQtyBadge && fonts.bold && metadata.qty !== null && metadata.qty > 1) {
		drawQtyBadge(page, cell, metadata.qty, fonts.bold);
	}
}
