import { PDFDocument, type PDFFont, degrees } from 'pdf-lib';
import { computeCellRects, fitContainAutoRotate } from './layout';
import { drawOverlay, embedOverlayFont } from './overlay';
import type { LayoutPreset, OverlayOptions, Rect, SourcePage } from './types';

export type Region = 'label' | 'invoice' | 'full';

export interface ComposeInput {
	sourcePage: SourcePage;
	/** The pdf-lib document this page's bytes were loaded into — the caller loads each unique source file
	 * once and reuses the same `PDFDocument` for every page drawn from it. */
	sourceDoc: PDFDocument;
	region: Region;
}

/** Which region a "label output" composition should embed, given the user's crop-mode choice — `'label'`
 * crops the invoice away (the original default); `'full'` keeps the entire original page untouched (for
 * sort-only workflows, or A4 sheets that keep the invoice attached to each cell). Shared by the full
 * pipeline (`pipeline.ts`) and the first-page preview (`preview.ts`) so the two can't drift apart. */
export function labelRegionFor(cropMode: 'label' | 'full'): Region {
	return cropMode === 'full' ? 'full' : 'label';
}

function regionRect(sourcePage: SourcePage, region: Region): Rect {
	const { width, height } = sourcePage.pageText;
	if (region === 'full') return { left: 0, bottom: 0, right: width, top: height };
	// A boundary that couldn't be found falls back to an even split rather than failing the page outright —
	// the caller is expected to have already recorded a non-blocking warning for this via boundary.found.
	const splitY = sourcePage.boundary.splitY ?? height / 2;
	return region === 'label'
		? { left: 0, bottom: splitY, right: width, top: height }
		: { left: 0, bottom: 0, right: width, top: splitY };
}

/** Crops and repacks a list of source label pages onto a new output document laid out per `layout`
 * (one label per page for a thermal preset, or an N-per-sheet grid for an A4 preset), optionally stamping
 * each with the requested overlay text. Each input's `region` selects whether the *label* or the *invoice*
 * half of that source page gets embedded — the same function composes both the label output and, when the
 * user asks to keep it, the separate invoice output. */
export async function composeOutputDocument(
	inputs: ComposeInput[],
	layout: LayoutPreset,
	overlay?: OverlayOptions,
): Promise<PDFDocument> {
	const outputDoc = await PDFDocument.create();
	if (inputs.length === 0) return outputDoc;

	const cells = computeCellRects(layout);
	const overlayFont: PDFFont | null = overlay ? await embedOverlayFont(outputDoc) : null;

	let currentPage = outputDoc.addPage([layout.pageWidth, layout.pageHeight]);
	let cellIndex = 0;

	for (const input of inputs) {
		if (cellIndex >= cells.length) {
			currentPage = outputDoc.addPage([layout.pageWidth, layout.pageHeight]);
			cellIndex = 0;
		}
		const page = currentPage;
		const cell = cells[cellIndex];

		const sourcePdfPage = input.sourceDoc.getPage(input.sourcePage.pageIndex);
		const embedded = await outputDoc.embedPage(
			sourcePdfPage,
			regionRect(input.sourcePage, input.region),
		);
		const placement = fitContainAutoRotate(embedded.width, embedded.height, cell);

		page.drawPage(embedded, {
			x: placement.x,
			y: placement.y,
			width: placement.width,
			height: placement.height,
			rotate: degrees(placement.rotateDeg),
		});

		if (overlay && overlayFont) {
			drawOverlay(page, cell, input.sourcePage.metadata, overlay, overlayFont);
		}

		cellIndex++;
	}

	return outputDoc;
}
