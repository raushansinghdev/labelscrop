import { PDFDocument } from 'pdf-lib';
import { type ComposeInput, composeOutputDocument, labelRegionFor } from './compose';
import { extractPageLines } from './pdfText';
import type { LayoutPreset, OverlayOptions, PlatformAdapter, SourcePage } from './types';

export interface PreviewResult {
	pdfBytes: Uint8Array;
	/** How many source labels landed on the previewed sheet (fewer than the layout's cells for a short file). */
	labelCount: number;
}

/** Builds a one-page preview of the *first output sheet* for one uploaded file: its first page for a
 * one-label-per-page layout, or its first N pages packed onto the sheet for an N-up layout (so a 4-per-A4
 * choice previews as a full 2x2 sheet, not one label marooned in a corner). Each label is cropped (or, in
 * `cropMode: 'full'`, left untouched), repacked, and stamped by the exact same pure
 * `extractPageLines`/`composeOutputDocument` functions the full pipeline uses (see pipeline.ts). Runs on the
 * main thread, not the worker. Returns `null` rather than throwing for an empty/unreadable PDF — the caller
 * shows a plain "preview unavailable" state instead of an error. */
export async function buildFirstPagePreview(
	fileBytes: Uint8Array,
	adapter: PlatformAdapter,
	layout: LayoutPreset,
	cropMode: 'label' | 'full',
	overlay?: OverlayOptions,
): Promise<PreviewResult | null> {
	const pageTexts = await extractPageLines(fileBytes);
	if (pageTexts.length === 0) return null;

	const sourceDoc = await PDFDocument.load(fileBytes);
	const region = labelRegionFor(cropMode);
	const inputs: ComposeInput[] = pageTexts.slice(0, layout.columns * layout.rows).map((pageText) => {
		const boundary = adapter.detectBoundary(pageText);
		const metadata = adapter.extractMetadata(pageText, boundary.splitY);
		const sourcePage: SourcePage = { fileIndex: 0, pageIndex: pageText.pageIndex, pageText, boundary, metadata };
		return { sourcePage, sourceDoc, region };
	});

	const outputDoc = await composeOutputDocument(inputs, layout, overlay);
	const pdfBytes = await outputDoc.save();
	return { pdfBytes, labelCount: inputs.length };
}
