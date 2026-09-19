// The actual Web Worker entry point Phase C wires up: runs the pipeline off the main thread so the UI
// (progress bar, animations) stays responsive during large batches, per the plan's memory/scale strategy.
// Not exercised by the Phase B test suite — it only wraps `processFiles` for postMessage/Comlink transport
// and has no logic of its own worth unit-testing in isolation.
import * as Comlink from 'comlink';
import { meeshoAdapter } from '@/lib/platforms/meesho/adapter';
import { type ProcessFileInput, type ProcessOptions, processFiles } from './pipeline';

const api = {
	// `onProgress` must be its own top-level argument (not nested inside `options`): Comlink only recognizes
	// `Comlink.proxy()`-wrapped functions when they're a direct element of the RPC argument list — it checks
	// the proxy marker per top-level argument, not recursively inside plain objects — so a proxied callback
	// buried in `options` would hit the default structured-clone path and fail with "could not be cloned".
	processMeeshoFiles: (
		files: ProcessFileInput[],
		options: Omit<ProcessOptions, 'onProgress'>,
		onProgress?: ProcessOptions['onProgress'],
	) => processFiles(files, meeshoAdapter, { ...options, onProgress }),
};

export type EngineWorkerApi = typeof api;

Comlink.expose(api);
