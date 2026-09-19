import { PDFDocument } from 'pdf-lib';
import { type ComposeInput, composeOutputDocument, labelRegionFor } from './compose';
import { extractPageLines } from './pdfText';
import type { LayoutPreset, OverlayOptions, PlatformAdapter, SourcePage } from './types';

export interface PreviewResult {
	pdfBytes: Uint8Array;
}

/** Builds a single-page preview of how the *first* page of one uploaded file will look once cropped (or, in
 * `cropMode: 'full'`, left untouched), repacked to the chosen layout, and stamped — reusing the exact same
 * pure `extractPageLines`/`composeOutputDocument` functions the full pipeline uses (see pipeline.ts), just
 * for one page. Called on demand when the user asks to preview/confirm, on the main thread (not the worker).
 * Returns `null` rather than throwing for an empty/unreadable PDF — the caller shows a plain "preview
 * unavailable" state instead of an error. */
export async function buildFirstPagePreview(
	fileBytes: Uint8Array,
	adapter: PlatformAdapter,
	layout: LayoutPreset,
	cropMode: 'label' | 'full',
	overlay?: OverlayOptions,
): Promise<PreviewResult | null> {
	const pageTexts = await extractPageLines(fileBytes);
	if (pageTexts.length === 0) return null;

	const pageText = pageTexts[0];
	const boundary = adapter.detectBoundary(pageText);
	const metadata = adapter.extractMetadata(pageText, boundary.splitY);
	const sourceDoc = await PDFDocument.load(fileBytes);

	const sourcePage: SourcePage = { fileIndex: 0, pageIndex: pageText.pageIndex, pageText, boundary, metadata };
	const input: ComposeInput = { sourcePage, sourceDoc, region: labelRegionFor(cropMode) };

	const outputDoc = await composeOutputDocument([input], layout, overlay);
	const pdfBytes = await outputDoc.save();
	return { pdfBytes };
}
