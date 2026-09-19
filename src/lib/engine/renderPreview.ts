import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

/** Renders page 1 of a PDF onto a canvas, scaled to fill `targetWidthPx` CSS pixels (sharp on high-DPI
 * screens). Browser-only (uses `window`/`HTMLCanvasElement`) — kept out of `pdfText.ts` since that module is
 * also exercised by the Node-based vitest suite and has no reason to touch canvas rendering. */
export async function renderPdfFirstPageToCanvas(
	pdfBytes: Uint8Array,
	canvas: HTMLCanvasElement,
	targetWidthPx: number,
): Promise<void> {
	// See pdfText.ts for why a defensive copy is passed: pdf.js can detach the underlying ArrayBuffer.
	const loadingTask = getDocument({ data: pdfBytes.slice() });
	try {
		const doc = await loadingTask.promise;
		const page = await doc.getPage(1);
		const unscaled = page.getViewport({ scale: 1 });
		const dpr = window.devicePixelRatio || 1;
		const viewport = page.getViewport({ scale: (targetWidthPx / unscaled.width) * dpr });

		canvas.width = Math.round(viewport.width);
		canvas.height = Math.round(viewport.height);
		canvas.style.width = `${targetWidthPx}px`;
		canvas.style.height = `${(targetWidthPx * viewport.height) / viewport.width}px`;

		const ctx = canvas.getContext('2d');
		if (!ctx) return;
		await page.render({ canvasContext: ctx, viewport, canvas }).promise;
	} finally {
		await loadingTask.destroy();
	}
}
