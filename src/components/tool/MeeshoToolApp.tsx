import { AlertTriangleIcon, ArrowLeftIcon, ArrowRightIcon, RotateCwIcon, SparklesIcon } from 'lucide-react';
import { AnimatePresence, motion, MotionConfig } from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from 'cn';
import { buttonVariants } from '@/components/ui/button';
import type { FileFailure, ProcessResult } from '@/lib/engine/pipeline';
import { resolveDefaultConfig, sanitizeConfig, type OptionConfig } from '@/lib/options/schema';
import { describeMeeshoConfig } from '@/lib/platforms/meesho/describe';
import { MEESHO_OPTIONS } from '@/lib/platforms/meesho/options';
import { resolveMeeshoProcessOptions } from '@/lib/platforms/meesho/resolveOptions';
import {
	loadPlatformSettings,
	loadUiMode,
	requestPersistentStorage,
	saveUiMode,
	savePlatformSettings,
} from '@/lib/storage/settings';
import { ActionBar } from './ActionBar';
import { OptionsForm } from './OptionsForm';
import { PreviewCard, type PreviewStatus } from './PreviewCard';
import { PreviewSheet, PreviewThumb } from './PreviewSheet';
import { ProcessProgress, type ProgressEvent } from './ProcessProgress';
import { ResultsPanel } from './ResultsPanel';
import { StepIndicator } from './StepIndicator';
import { formatSize, UploadDropzone, type UploadedFile } from './UploadDropzone';

// Batches beyond this size still process (per the plan, chunked composition targets 2000+ pages), but a
// heads-up here sets expectations before the user waits through a long run on a slow connection/device.
const LARGE_BATCH_BYTES = 30 * 1024 * 1024;

// Backing-store width (CSS px, multiplied by devicePixelRatio) for the preview canvas. The displayed size is
// set by CSS; this only needs to be large enough that a 4-per-sheet A4 preview stays legible when zoomed.
const PREVIEW_RENDER_WIDTH_PX = 440;

const EASE_OUT = [0.16, 1, 0.3, 1] as const;

// Shared fade+slide for every top-level stage swap, so the three screens read as one motion language.
const STAGE_TRANSITION = {
	initial: { opacity: 0, y: 16 },
	animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE_OUT } },
	exit: { opacity: 0, y: -8, transition: { duration: 0.18, ease: 'easeIn' as const } },
};

const primaryCta = cn(
	buttonVariants({ size: 'lg' }),
	'h-14 flex-1 gap-2 rounded-2xl text-base font-semibold shadow-lg shadow-primary/25 transition-[transform,background-color,box-shadow]',
);

// Chrome: "Failed to fetch dynamically imported module", Firefox: "error loading dynamically imported module",
// Safari: "Importing a module script failed". All mean a lazily loaded chunk is gone — in production, a new
// deploy replaced the hashed files under an open tab; in dev, Vite re-optimized its deps. Only a reload fixes it.
function isStaleChunkError(error: unknown): boolean {
	return error instanceof Error && /dynamically imported module|importing a module script failed/i.test(error.message);
}

function makeId(): string {
	return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

export function MeeshoToolApp() {
	const [browserSupported, setBrowserSupported] = useState(true);
	const [files, setFiles] = useState<UploadedFile[]>([]);
	const [advancedOpen, setAdvancedOpen] = useState(false);
	const [config, setConfig] = useState<OptionConfig>(() => resolveDefaultConfig(MEESHO_OPTIONS));
	const [settingsLoaded, setSettingsLoaded] = useState(false);

	// 'upload' = dropzone + file list; 'configure' = options + live preview. Processing/done/error are layered
	// on top via `status` below.
	const [stage, setStage] = useState<'upload' | 'configure'>('upload');
	const [previewStatus, setPreviewStatus] = useState<PreviewStatus>('empty');
	const [previewUpdating, setPreviewUpdating] = useState(false);
	const canvasRef = useRef<HTMLCanvasElement>(null);
	// Phones show the preview as a thumbnail in the action bar (plus a full-size sheet on tap) instead of the
	// big card, so they need the rendered canvas as an image; desktop uses the canvas directly.
	const [previewSnapshot, setPreviewSnapshot] = useState<string | null>(null);
	const [previewSheetOpen, setPreviewSheetOpen] = useState(false);
	const closePreviewSheet = useCallback(() => setPreviewSheetOpen(false), []);
	useEffect(() => {
		if (!previewSnapshot) return;
		return () => URL.revokeObjectURL(previewSnapshot);
	}, [previewSnapshot]);
	const rootRef = useRef<HTMLDivElement>(null);

	const [status, setStatus] = useState<'idle' | 'processing' | 'done' | 'error'>('idle');
	const [progressEvent, setProgressEvent] = useState<ProgressEvent | null>(null);
	const [result, setResult] = useState<ProcessResult | null>(null);
	const [failures, setFailures] = useState<FileFailure[]>([]);
	const [runError, setRunError] = useState<string | null>(null);
	const [needsReload, setNeedsReload] = useState(false);

	// One-time setup: unsupported-browser check plus loading any previously saved options. Wrapped in try/catch
	// at the storage layer already (Safari private mode, etc.) — this just merges what comes back, dropping any
	// saved value that no longer fits the current option list.
	useEffect(() => {
		if (typeof Worker === 'undefined' || typeof File === 'undefined') {
			setBrowserSupported(false);
		}
		if (loadUiMode() === 'advanced') setAdvancedOpen(true);
		const saved = loadPlatformSettings('meesho');
		if (saved) setConfig((prev) => ({ ...prev, ...sanitizeConfig(MEESHO_OPTIONS, saved) }));
		setSettingsLoaded(true);
	}, []);

	useEffect(() => {
		if (settingsLoaded) savePlatformSettings('meesho', config);
	}, [config, settingsLoaded]);

	useEffect(() => {
		if (settingsLoaded) saveUiMode(advancedOpen ? 'advanced' : 'simple');
	}, [advancedOpen, settingsLoaded]);

	const handleFilesAdded = useCallback((added: { name: string; bytes: Uint8Array }[]) => {
		setFiles((prev) => [...prev, ...added.map((f) => ({ id: makeId(), name: f.name, sizeBytes: f.bytes.byteLength, bytes: f.bytes }))]);
		setResult(null);
		setStatus('idle');
	}, []);

	const handleRemove = useCallback((id: string) => {
		setFiles((prev) => prev.filter((f) => f.id !== id));
	}, []);

	const handleOptionChange = useCallback((id: string, value: string | boolean) => {
		setConfig((prev) => ({ ...prev, [id]: value }));
		// The first time someone picks their own setup, ask the browser to keep it through storage clean-ups.
		void requestPersistentStorage();
	}, []);

	const totalBytes = files.reduce((sum, f) => sum + f.sizeBytes, 0);
	const view: 'done' | 'configure' | 'upload' = status === 'done' && result ? 'done' : stage;
	const stepIndex = view === 'upload' ? 0 : view === 'configure' ? 1 : 2;
	const processing = status === 'processing';
	const configSummary = describeMeeshoConfig(config);
	const { layout } = resolveMeeshoProcessOptions(config);
	const labelsPerPage = layout.columns * layout.rows;

	// Bring the top of the tool into view on every stage change — on a phone the user has usually scrolled
	// down to the action bar, and would otherwise land mid-way through the next screen.
	useEffect(() => {
		const el = rootRef.current;
		if (el && el.getBoundingClientRect().top < 0) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}, [view]);

	// Live preview: re-renders the first output sheet whenever the options (or first file) change while on the
	// configure stage. Debounced, and a run counter drops results from superseded renders so a slow older
	// render can't overwrite a newer one.
	const previewRunRef = useRef(0);
	const firstFile = files[0];
	useEffect(() => {
		if (view !== 'configure' || !firstFile) return;
		const run = ++previewRunRef.current;
		// Keep the current sheet on screen (dimmed) while re-rendering; only the very first render shows the skeleton.
		setPreviewStatus((prev) => (prev === 'ready' ? prev : 'loading'));
		setPreviewUpdating(true);
		const timer = setTimeout(async () => {
			try {
				const [{ buildFirstPagePreview }, { renderPdfFirstPageToCanvas }, { meeshoAdapter }] = await Promise.all([
					import('@/lib/engine/preview'),
					import('@/lib/engine/renderPreview'),
					import('@/lib/platforms/meesho/adapter'),
				]);
				const { layout: previewLayout, cropMode, overlay } = resolveMeeshoProcessOptions(config);
				const preview = await buildFirstPagePreview(firstFile.bytes, meeshoAdapter, previewLayout, cropMode ?? 'label', overlay);
				if (run !== previewRunRef.current) return;
				if (!preview || !canvasRef.current) {
					setPreviewStatus('unavailable');
					return;
				}
				const canvas = canvasRef.current;
				await renderPdfFirstPageToCanvas(preview.pdfBytes, canvas, PREVIEW_RENDER_WIDTH_PX);
				if (run !== previewRunRef.current) return;
				const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
				if (run !== previewRunRef.current) return;
				setPreviewSnapshot(blob ? URL.createObjectURL(blob) : null);
				setPreviewStatus('ready');
			} catch {
				if (run === previewRunRef.current) setPreviewStatus('unavailable');
			} finally {
				if (run === previewRunRef.current) setPreviewUpdating(false);
			}
		}, 200);
		return () => clearTimeout(timer);
	}, [view, firstFile, config]);

	function handleContinue() {
		if (files.length === 0) return;
		setPreviewStatus('empty');
		setStage('configure');
	}

	function handleBackToUpload() {
		setPreviewSheetOpen(false);
		setStage('upload');
		setStatus('idle');
		setRunError(null);
		setProgressEvent(null);
	}

	function handleEditOptions() {
		// Back from results to the options with the same files — the preview re-renders from scratch since the
		// canvas was unmounted with the configure screen.
		setStatus('idle');
		setResult(null);
		setPreviewStatus('empty');
		setStage('configure');
	}

	async function handleProcess() {
		if (files.length === 0) return;
		setPreviewSheetOpen(false);
		setStatus('processing');
		setRunError(null);
		setProgressEvent({ stage: 'reading', current: 0, total: files.length });

		try {
			const [Comlink, { getEngineWorker }] = await Promise.all([import('comlink'), import('@/lib/engine/workerClient')]);
			const api = getEngineWorker();
			const options = resolveMeeshoProcessOptions(config);

			const { result: processResult, failures: fileFailures } = await api.processMeeshoFiles(
				files.map((f) => ({ name: f.name, bytes: f.bytes })),
				options,
				Comlink.proxy((event: ProgressEvent) => setProgressEvent(event)),
			);

			if (processResult.pageCount === 0) {
				setFailures(fileFailures);
				setRunError(
					fileFailures.length > 0
						? `None of your files could be read — ${fileFailures[0].message}`
						: 'No labels were found in these files.',
				);
				setStatus('error');
				return;
			}

			setResult(processResult);
			setFailures(fileFailures);
			setStatus('done');
		} catch (error) {
			if (isStaleChunkError(error)) {
				setNeedsReload(true);
				setRunError('This page is out of date — reload it and add your files again. Your settings are saved.');
			} else {
				setRunError(error instanceof Error ? error.message : 'Something went wrong while processing. Try a smaller batch.');
			}
			setStatus('error');
		} finally {
			setProgressEvent(null);
		}
	}

	function handleReset() {
		setFiles([]);
		setResult(null);
		setFailures([]);
		setStatus('idle');
		setRunError(null);
		setStage('upload');
		setPreviewStatus('empty');
	}

	if (!browserSupported) {
		return (
			<div className="mx-auto max-w-2xl rounded-3xl border border-destructive/30 bg-destructive/5 p-6 text-center">
				<AlertTriangleIcon className="mx-auto size-6 text-destructive" />
				<p className="mt-3 font-semibold">Your browser doesn't support the features this tool needs.</p>
				<p className="mt-1.5 text-sm text-muted-foreground">Try the latest Chrome, Edge, Firefox, or Safari.</p>
			</div>
		);
	}

	return (
		<MotionConfig reducedMotion="user">
			<div ref={rootRef} className="scroll-mt-20">
				<StepIndicator
					current={stepIndex}
					onStepClick={
						processing
							? undefined
							: (index) => {
									if (index === 0) handleBackToUpload();
									if (index === 1) handleEditOptions();
								}
					}
				/>

				<div className="mt-6 sm:mt-8">
					<AnimatePresence mode="wait" initial={false}>
						{view === 'upload' && (
							<motion.div key="upload" {...STAGE_TRANSITION} className="mx-auto max-w-xl">
								<UploadDropzone files={files} onFilesAdded={handleFilesAdded} onRemove={handleRemove} />

								<AnimatePresence>
									{totalBytes > LARGE_BATCH_BYTES && (
										<motion.p
											initial={{ opacity: 0, height: 0 }}
											animate={{ opacity: 1, height: 'auto' }}
											exit={{ opacity: 0, height: 0 }}
											className="mt-3 flex items-start gap-2 overflow-hidden rounded-2xl border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-muted-foreground"
										>
											<AlertTriangleIcon className="mt-0.5 size-4 shrink-0 text-amber-600" />
											This is a large batch — it may take a little while on a phone. It'll still work, just keep this tab open.
										</motion.p>
									)}
								</AnimatePresence>

								<AnimatePresence>
									{files.length > 0 && (
										<ActionBar>
											<motion.button type="button" onClick={handleContinue} whileTap={{ scale: 0.97 }} className={cn(primaryCta, 'w-full')}>
												Continue
												<span className="font-normal opacity-80">
													· {files.length} file{files.length === 1 ? '' : 's'}, {formatSize(totalBytes)}
												</span>
												<ArrowRightIcon className="size-5" />
											</motion.button>
										</ActionBar>
									)}
								</AnimatePresence>
							</motion.div>
						)}

						{view === 'configure' && (
							<motion.div key="configure" {...STAGE_TRANSITION} className="mx-auto max-w-5xl">
								<div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-8">
									<div className="min-w-0 sm:rounded-3xl sm:border sm:border-border sm:bg-card sm:p-6">
										<OptionsForm
											fields={MEESHO_OPTIONS}
											config={config}
											advancedOpen={advancedOpen}
											onAdvancedOpenChange={setAdvancedOpen}
											onChange={handleOptionChange}
											disabled={processing}
										/>
									</div>

									{/* Desktop: the preview sits in the right column, pinned while the options scroll. Phones hide
									 * this card (the canvas still renders off-screen) and show a live thumbnail in the action bar
									 * instead, so the options get the whole screen and the result of each tap stays in view. */}
									<div className="hidden lg:block">
										<div className="lg:sticky lg:top-24">
											<PreviewCard status={previewStatus} updating={previewUpdating} canvasRef={canvasRef} summary={configSummary} />
										</div>
									</div>
								</div>

								<ActionBar>
									<AnimatePresence>
										{runError && !processing && (
											<motion.p
												initial={{ opacity: 0, y: 8 }}
												animate={{ opacity: 1, y: 0 }}
												exit={{ opacity: 0, y: 8 }}
												role="alert"
												className="mb-2.5 flex items-start gap-2 rounded-2xl border border-destructive/30 bg-background p-3 text-sm text-destructive"
											>
												<AlertTriangleIcon className="mt-0.5 size-4 shrink-0" />
												{runError}
											</motion.p>
										)}
									</AnimatePresence>
									<div className="mx-auto max-w-xl">
										<AnimatePresence mode="wait" initial={false}>
											{processing ? (
												<motion.div
													key="progress"
													initial={{ opacity: 0, scale: 0.97 }}
													animate={{ opacity: 1, scale: 1 }}
													exit={{ opacity: 0, scale: 0.97 }}
													transition={{ duration: 0.2 }}
												>
													<ProcessProgress event={progressEvent} />
												</motion.div>
											) : (
												<motion.div
													key="actions"
													initial={{ opacity: 0, scale: 0.97 }}
													animate={{ opacity: 1, scale: 1 }}
													exit={{ opacity: 0, scale: 0.97 }}
													transition={{ duration: 0.2 }}
													className="flex gap-2.5"
												>
													<motion.button
														type="button"
														onClick={handleBackToUpload}
														whileTap={{ scale: 0.94 }}
														aria-label="Back to files"
														className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'size-14 shrink-0 rounded-2xl bg-background')}
													>
														<ArrowLeftIcon className="size-5" />
													</motion.button>
													<PreviewThumb
														status={previewStatus}
														updating={previewUpdating}
														src={previewSnapshot}
														onOpen={() => setPreviewSheetOpen(true)}
													/>
													{needsReload ? (
														<motion.button
															type="button"
															onClick={() => window.location.reload()}
															whileTap={{ scale: 0.97 }}
															className={primaryCta}
														>
															<RotateCwIcon className="size-5" />
															Reload page
														</motion.button>
													) : (
														<motion.button
															type="button"
															onClick={handleProcess}
															disabled={previewStatus === 'loading'}
															whileTap={{ scale: 0.97 }}
															className={primaryCta}
														>
															<SparklesIcon className="size-5" />
															{runError ? 'Try again' : 'Create my labels'}
														</motion.button>
													)}
												</motion.div>
											)}
										</AnimatePresence>
									</div>
								</ActionBar>
								<PreviewSheet
									open={previewSheetOpen}
									onClose={closePreviewSheet}
									src={previewSnapshot}
									updating={previewUpdating}
									summary={configSummary}
									onCreate={handleProcess}
									createDisabled={previewStatus === 'loading' || needsReload}
								/>
							</motion.div>
						)}

						{view === 'done' && result && (
							<motion.div key="done" {...STAGE_TRANSITION} className="mx-auto max-w-xl">
								<ResultsPanel
									result={result}
									failures={failures}
									labelsPerPage={labelsPerPage}
									summary={configSummary}
									onEditOptions={handleEditOptions}
									onReset={handleReset}
								/>
							</motion.div>
						)}
					</AnimatePresence>
				</div>
			</div>
		</MotionConfig>
	);
}
