import './readableStreamAsyncIterator';
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
// `?url` gets Vite to emit pdf.js's own worker script as a bundled asset and hand back its URL — required in
// every real-browser context. pdf.js only auto-falls-back to a synchronous "fake worker" when `isNodeJS` is
// true (e.g. under vitest); everywhere else — the browser main thread (first-page preview) and inside our
// own dedicated Web Worker (engine/worker.ts) alike — an unset `workerSrc` throws `No
// "GlobalWorkerOptions.workerSrc" specified.` synchronously out of `getDocument()`, uncaught.
import pdfWorkerSrc from 'pdfjs-dist/legacy/build/pdf.worker.mjs?url';
import type { TextItem as PdfJsTextItem } from 'pdfjs-dist/types/src/display/api';
import type { PageTextModel, TextItem, TextLine } from './types';

// Only set in a real browser-like global (main thread or a dedicated Worker) — under Node/vitest, pdf.js's
// own fake-worker bootstrap resolves its *default* `workerSrc` (`./pdf.worker.mjs`) via Node's module
// resolution relative to its own package directory; overwriting it with the Vite-emitted asset URL above
// breaks that resolution (`Cannot find module '/node_modules/pdfjs-dist/...'`) since that URL isn't a real
// path Node can resolve.
if (typeof window !== 'undefined' || typeof importScripts === 'function') {
	GlobalWorkerOptions.workerSrc = pdfWorkerSrc;
}

// Text items within this many PDF points of each other vertically are treated as the same line.
const LINE_TOLERANCE_PT = 2.5;

function isRealTextItem(item: unknown): item is PdfJsTextItem {
	return typeof item === 'object' && item !== null && 'str' in item && 'transform' in item;
}

// Silences pdf.js's "standardFontDataUrl" warning by pointing it at the glyph-metrics data pdf.js ships
// with its own package. Purely cosmetic (only affects width fallbacks for non-embedded standard fonts) —
// if resolution fails in some bundler context, we just fall back to the (harmless) warning.
function resolveStandardFontDataUrl(): string | undefined {
	try {
		const pkgUrl = import.meta.resolve('pdfjs-dist/package.json');
		return new URL('./standard_fonts/', pkgUrl).toString();
	} catch {
		return undefined;
	}
}

function groupIntoLines(items: TextItem[]): TextLine[] {
	const sorted = [...items].sort((a, b) => b.y - a.y);
	const lines: TextLine[] = [];

	for (const item of sorted) {
		const last = lines[lines.length - 1];
		if (last && Math.abs(last.y - item.y) <= LINE_TOLERANCE_PT) {
			last.items.push(item);
		} else {
			lines.push({ y: item.y, items: [item], text: '' });
		}
	}

	for (const line of lines) {
		line.items.sort((a, b) => a.x - b.x);
		line.text = line.items
			.map((i) => i.text)
			.join(' ')
			.replace(/\s+/g, ' ')
			.trim();
	}

	return lines.filter((line) => line.text.length > 0);
}

export class UnreadablePdfError extends Error {
	constructor(message: string, cause?: unknown) {
		super(message, { cause });
		this.name = 'UnreadablePdfError';
	}
}

export class PasswordProtectedPdfError extends Error {
	constructor() {
		super('This PDF is password-protected.');
		this.name = 'PasswordProtectedPdfError';
	}
}

/** Loads a PDF and extracts a line-grouped text model for every page. Does not touch the page's visual
 * content in any way — this is a read-only pass used purely to locate the label/invoice boundary and pull
 * per-order metadata before any cropping or composition happens. */
export async function extractPageLines(pdfBytes: Uint8Array): Promise<PageTextModel[]> {
	// pdf.js's `getDocument` can transfer (and thereby detach) the ArrayBuffer backing `data` as part of its
	// internal worker message-passing, even when falling back to its synchronous "fake worker" — silently
	// corrupting `pdfBytes` for any other consumer (e.g. a subsequent `pdf-lib` `PDFDocument.load` on the
	// same bytes, as the pipeline does). Passing a copy keeps the caller's buffer safe to reuse.
	const loadingTask = getDocument({
		data: pdfBytes.slice(),
		standardFontDataUrl: resolveStandardFontDataUrl(),
	});

	let doc: Awaited<typeof loadingTask.promise>;
	try {
		doc = await loadingTask.promise;
	} catch (error) {
		const name = error instanceof Error ? error.name : '';
		if (name === 'PasswordException') {
			throw new PasswordProtectedPdfError();
		}
		throw new UnreadablePdfError("This file couldn't be read as a PDF.", error);
	}

	const pages: PageTextModel[] = [];
	try {
		for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
			const page = await doc.getPage(pageNumber);
			// `page.view` is the raw, unrotated MediaBox — the same coordinate space pdf-lib's
			// `embedPage`/`setCropBox` expect, unlike a rendering viewport (which bakes in /Rotate).
			const [x0, y0, x1, y1] = page.view;
			const content = await page.getTextContent();

			const items: TextItem[] = content.items
				.filter(isRealTextItem)
				.filter((item) => item.str.trim().length > 0)
				.map((item) => ({
					text: item.str,
					x: item.transform[4],
					y: item.transform[5],
				}));

			const sortedItems = [...items].sort((a, b) => b.y - a.y || a.x - b.x);

			pages.push({
				pageIndex: pageNumber - 1,
				width: x1 - x0,
				height: y1 - y0,
				items: sortedItems,
				lines: groupIntoLines(items),
			});

			page.cleanup();
		}
	} finally {
		await loadingTask.destroy();
	}

	return pages;
}
