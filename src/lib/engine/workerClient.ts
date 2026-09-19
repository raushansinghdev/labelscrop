import * as Comlink from 'comlink';
import type { EngineWorkerApi } from './worker';

let api: Comlink.Remote<EngineWorkerApi> | null = null;

/** Lazily spins up the engine's dedicated Web Worker and wraps it with Comlink. Only called from inside a
 * user action (adding a file, hitting Process) — never at module load — so the worker script (which pulls in
 * pdf-lib/pdfjs-dist) is never fetched until it's actually needed, per the plan's "spin up the worker only
 * when the user actually adds a file" bundle-size guidance. Reused across calls within a session. */
export function getEngineWorker(): Comlink.Remote<EngineWorkerApi> {
	if (!api) {
		const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
		api = Comlink.wrap<EngineWorkerApi>(worker);
	}
	return api;
}
