// pdf.js's `page.getTextContent()` consumes a ReadableStream with `for await`, which needs
// `ReadableStream.prototype[Symbol.asyncIterator]`. Chrome/Android and Firefox have shipped that for years, but
// Safari/iOS WebKit only added it very recently — and every iOS browser (Chrome included) runs on WebKit — and
// pdf.js's legacy build doesn't polyfill it. Without this, on those iPhones every PDF fails with "undefined is
// not a function" and gets reported as unreadable. Imported for its side effect by `pdfText.ts`, so it's
// installed in every context that extracts text (the main-thread preview and our engine Web Worker).

type IterableStream = ReadableStream & {
	values?: (options?: { preventCancel?: boolean }) => AsyncIterableIterator<unknown>;
	[Symbol.asyncIterator]?: () => AsyncIterableIterator<unknown>;
};

if (typeof ReadableStream !== 'undefined') {
	const proto = ReadableStream.prototype as IterableStream;

	if (typeof proto[Symbol.asyncIterator] !== 'function') {
		const values = function (this: ReadableStream, { preventCancel = false } = {}): AsyncIterableIterator<unknown> {
			const reader = this.getReader();
			return {
				async next() {
					try {
						const result = await reader.read();
						if (result.done) reader.releaseLock();
						return result as IteratorResult<unknown>;
					} catch (error) {
						reader.releaseLock();
						throw error;
					}
				},
				async return(value?: unknown) {
					if (!preventCancel) {
						const cancelled = reader.cancel(value);
						reader.releaseLock();
						await cancelled;
					} else {
						reader.releaseLock();
					}
					return { done: true, value };
				},
				[Symbol.asyncIterator]() {
					return this;
				},
			};
		};

		Object.defineProperty(proto, 'values', { value: values, writable: true, configurable: true });
		Object.defineProperty(proto, Symbol.asyncIterator, { value: values, writable: true, configurable: true });
	}
}
