import { PDFDocument } from 'pdf-lib';
import { type ComposeInput, composeOutputDocument, labelRegionFor } from './compose';
import { extractPageLines, PasswordProtectedPdfError, UnreadablePdfError } from './pdfText';
import { dedupePages, prioritizeMultiUnit, sortPages } from './sort';
import { buildSkuSummary, buildSkuSummaryPdf } from './summary';
import type { LayoutPreset, OverlayOptions, PlatformAdapter, SkuSummaryRow, SortDirection, SortKey, SourcePage } from './types';

export interface ProcessFileInput {
	name: string;
	bytes: Uint8Array;
}

export interface ProcessOptions {
	layout: LayoutPreset;
	sortKey: SortKey;
	/** Defaults to `'asc'` (A–Z). Ignored for `sortKey: 'original'`. */
	sortDirection?: SortDirection;
	/** `'label'` (default) crops the invoice away; `'full'` keeps the entire original page untouched — for
	 * sort-only workflows, or A4 sheets that keep the invoice attached to each cell. Optional so existing
	 * callers/fixtures that don't set it keep behaving exactly as before. */
	cropMode?: 'label' | 'full';
	keepInvoice: boolean;
	invoiceLayout?: LayoutPreset;
	overlay?: OverlayOptions;
	/** Orders with more than one unit go first, ahead of the chosen sort. */
	multiUnitFirst?: boolean;
	/** Drop repeat labels for the same AWB / order, e.g. from overlapping downloads. Off unless asked for. */
	skipDuplicates?: boolean;
	/** Also compose one label PDF per courier (see `ProcessResult.courierPdfs`). */
	splitByCourier?: boolean;
	onProgress?: (event: { stage: 'reading' | 'composing' | 'summarizing'; current: number; total: number }) => void;
}

export interface ProcessResult {
	labelPdfBytes: Uint8Array;
	invoicePdfBytes: Uint8Array | null;
	summaryPdfBytes: Uint8Array;
	summary: SkuSummaryRow[];
	/** One label PDF per courier, in the order couriers first appear in the sorted output. Empty unless
	 * `splitByCourier` was set and the batch has at least two couriers — one courier would only duplicate
	 * the main labels PDF. */
	courierPdfs: CourierPdf[];
	/** Labels dropped by `skipDuplicates`. */
	duplicatesRemoved: number;
	pageCount: number;
	/** Non-fatal issues surfaced to the user (e.g. a page whose boundary/metadata couldn't be detected) —
	 * per the plan's error-handling taxonomy, these never abort the run. */
	warnings: string[];
}

export interface CourierPdf {
	courier: string;
	labelCount: number;
	bytes: Uint8Array;
}

/** Couriers whose name couldn't be read are grouped under this, so no label is left out of the split. */
export const UNKNOWN_COURIER = 'Other';

export interface FileFailure {
	fileName: string;
	message: string;
}

/** The full crop → sort → repack → overlay → summarize pipeline, written against the generic
 * `PlatformAdapter` contract rather than any one marketplace, so Amazon/Flipkart support later is a new
 * adapter module, not a rewrite of this function. */
export async function processFiles(
	files: ProcessFileInput[],
	adapter: PlatformAdapter,
	options: ProcessOptions,
): Promise<{ result: ProcessResult; failures: FileFailure[] }> {
	const warnings: string[] = [];
	const failures: FileFailure[] = [];
	const sourcePages: SourcePage[] = [];
	const sourceDocs: PDFDocument[] = [];

	for (let fileIndex = 0; fileIndex < files.length; fileIndex++) {
		const file = files[fileIndex];
		options.onProgress?.({ stage: 'reading', current: fileIndex, total: files.length });

		let pageTexts: Awaited<ReturnType<typeof extractPageLines>>;
		let doc: PDFDocument;
		try {
			pageTexts = await extractPageLines(file.bytes);
			doc = await PDFDocument.load(file.bytes);
		} catch (error) {
			const message =
				error instanceof PasswordProtectedPdfError
					? error.message
					: error instanceof UnreadablePdfError
						? error.message
						: "This file couldn't be read as a PDF.";
			failures.push({ fileName: file.name, message });
			continue;
		}

		const docIndex = sourceDocs.length;
		sourceDocs.push(doc);

		for (const pageText of pageTexts) {
			const boundary = adapter.detectBoundary(pageText);
			if (!boundary.found) {
				warnings.push(
					`${file.name}, page ${pageText.pageIndex + 1}: couldn't auto-detect the invoice split — used a default crop.`,
				);
			}
			const metadata = adapter.extractMetadata(pageText, boundary.splitY);
			sourcePages.push({ fileIndex: docIndex, pageIndex: pageText.pageIndex, pageText, boundary, metadata });
		}
	}

	const { pages: uniquePages, removed: duplicatesRemoved } = options.skipDuplicates
		? dedupePages(sourcePages)
		: { pages: sourcePages, removed: 0 };
	const keyed = sortPages(uniquePages, options.sortKey, options.sortDirection);
	const sorted = options.multiUnitFirst ? prioritizeMultiUnit(keyed) : keyed;

	options.onProgress?.({ stage: 'composing', current: 0, total: sorted.length });

	const labelRegion = labelRegionFor(options.cropMode ?? 'label');
	const labelInputs: ComposeInput[] = sorted.map((sourcePage) => ({
		sourcePage,
		sourceDoc: sourceDocs[sourcePage.fileIndex],
		region: labelRegion,
	}));
	const labelDoc = await composeOutputDocument(labelInputs, options.layout, options.overlay);
	const labelPdfBytes = await labelDoc.save();

	const courierPdfs: CourierPdf[] = [];
	if (options.splitByCourier) {
		const groups = new Map<string, ComposeInput[]>();
		for (const input of labelInputs) {
			const courier = input.sourcePage.metadata.courier ?? UNKNOWN_COURIER;
			const group = groups.get(courier);
			if (group) group.push(input);
			else groups.set(courier, [input]);
		}
		if (groups.size > 1) {
			for (const [courier, inputs] of groups) {
				const doc = await composeOutputDocument(inputs, options.layout, options.overlay);
				courierPdfs.push({ courier, labelCount: inputs.length, bytes: await doc.save() });
			}
		}
	}

	let invoicePdfBytes: Uint8Array | null = null;
	if (options.keepInvoice && options.invoiceLayout) {
		const invoiceInputs: ComposeInput[] = sorted.map((sourcePage) => ({
			sourcePage,
			sourceDoc: sourceDocs[sourcePage.fileIndex],
			region: 'invoice',
		}));
		const invoiceDoc = await composeOutputDocument(invoiceInputs, options.invoiceLayout);
		invoicePdfBytes = await invoiceDoc.save();
	}

	options.onProgress?.({ stage: 'summarizing', current: 0, total: 1 });
	const summary = buildSkuSummary(sorted);
	const summaryPdfBytes = await buildSkuSummaryPdf(summary);

	return {
		result: {
			labelPdfBytes,
			invoicePdfBytes,
			summaryPdfBytes,
			summary,
			courierPdfs,
			duplicatesRemoved,
			pageCount: sorted.length,
			warnings,
		},
		failures,
	};
}
