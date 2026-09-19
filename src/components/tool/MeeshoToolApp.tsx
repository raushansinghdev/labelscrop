import { AlertTriangleIcon } from 'lucide-react';
import { AnimatePresence, motion, MotionConfig } from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { FileFailure, ProcessResult } from '@/lib/engine/pipeline';
import { resolveDefaultConfig, type OptionConfig } from '@/lib/options/schema';
import { MEESHO_OPTIONS } from '@/lib/platforms/meesho/options';
import { loadPlatformSettings, loadUiMode, saveUiMode, savePlatformSettings } from '@/lib/storage/settings';
import { ConfirmStep } from './ConfirmStep';
import { OptionsForm } from './OptionsForm';
import type { PreviewStatus } from './PreviewCard';
import type { ProgressEvent } from './ProcessProgress';
import { ResultsPanel } from './ResultsPanel';
import { formatSize, UploadDropzone, type UploadedFile } from './UploadDropzone';

// Batches beyond this size still process (per the plan, chunked composition targets 2000+ pages), but a
// heads-up here sets expectations before the user waits through a long run on a slow connection/device.
const LARGE_BATCH_BYTES = 30 * 1024 * 1024;

// Render target for the confirm-step preview — larger than a sidebar thumbnail since it's now the sole
// focus of its own step rather than sharing the screen with the options form.
const PREVIEW_TARGET_WIDTH_PX = 380;

// Shared fade+slide used for every top-level stage swap (configure/confirm/done), so switching stages
// reads as one deliberate motion language rather than each screen inventing its own.
const STAGE_TRANSITION = {
	initial: { opacity: 0, y: 10 },
	animate: { opacity: 1, y: 0 },
	exit: { opacity: 0, y: -10 },
	transition: { duration: 0.22, ease: [0.16, 1, 0.3, 1] as const },
};

function makeId(): string {
	return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

export function MeeshoToolApp() {
	const [browserSupported, setBrowserSupported] = useState(true);
	const [files, setFiles] = useState<UploadedFile[]>([]);
	const [mode, setMode] = useState<'simple' | 'advanced'>('simple');
	const [config, setConfig] = useState<OptionConfig>(() => resolveDefaultConfig(MEESHO_OPTIONS));
	const [settingsLoaded, setSettingsLoaded] = useState(false);

	// 'configure' = upload + options; 'confirm' = preview shown, awaiting confirmation (or edit) before the
	// real worker run. Kept separate from `status` below so "processing"/"done"/"error" can be layered inside
	// the confirm step without re-deriving them from a single combined enum.
	const [stage, setStage] = useState<'configure' | 'confirm'>('configure');
	const [previewStatus, setPreviewStatus] = useState<PreviewStatus>('empty');
	const canvasRef = useRef<HTMLCanvasElement>(null);

	const [status, setStatus] = useState<'idle' | 'processing' | 'done' | 'error'>('idle');
	const [progressEvent, setProgressEvent] = useState<ProgressEvent | null>(null);
	const [result, setResult] = useState<ProcessResult | null>(null);
	const [failures, setFailures] = useState<FileFailure[]>([]);
	const [runError, setRunError] = useState<string | null>(null);

	// One-time setup: unsupported-browser check plus loading any previously saved options/mode. Wrapped in
	// try/catch at the storage layer already (Safari private mode, etc.) — this just merges what comes back.
	useEffect(() => {
		if (typeof Worker === 'undefined' || typeof File === 'undefined') {
			setBrowserSupported(false);
		}
		const savedMode = loadUiMode();
		if (savedMode) setMode(savedMode);
		const saved = loadPlatformSettings('meesho');
		if (saved) setConfig((prev) => ({ ...prev, ...saved }));
		setSettingsLoaded(true);
	}, []);

	useEffect(() => {
		if (settingsLoaded) savePlatformSettings('meesho', config);
	}, [config, settingsLoaded]);

	useEffect(() => {
		if (settingsLoaded) saveUiMode(mode);
	}, [mode, settingsLoaded]);

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
	}, []);

	const totalBytes = files.reduce((sum, f) => sum + f.sizeBytes, 0);

	// Generates the confirm-step preview on demand (no more continuous live-updating preview) — moves to the
	// confirm stage immediately so the loading state renders there, rather than blocking the configure screen.
	async function handlePreview() {
		const firstFile = files[0];
		if (!firstFile) return;
		setStage('confirm');
		setPreviewStatus('loading');
		try {
			const [{ buildFirstPagePreview }, { renderPdfFirstPageToCanvas }, { meeshoAdapter }, { resolveMeeshoProcessOptions }] =
				await Promise.all([
					import('@/lib/engine/preview'),
					import('@/lib/engine/renderPreview'),
					import('@/lib/platforms/meesho/adapter'),
					import('@/lib/platforms/meesho/resolveOptions'),
				]);
			const { layout, cropMode, overlay } = resolveMeeshoProcessOptions(config);
			const preview = await buildFirstPagePreview(firstFile.bytes, meeshoAdapter, layout, cropMode ?? 'label', overlay);
			if (!preview || !canvasRef.current) {
				setPreviewStatus('unavailable');
				return;
			}
			await renderPdfFirstPageToCanvas(preview.pdfBytes, canvasRef.current, PREVIEW_TARGET_WIDTH_PX);
			setPreviewStatus('ready');
		} catch {
			setPreviewStatus('unavailable');
		}
	}

	function handleEdit() {
		setStage('configure');
		setStatus('idle');
		setRunError(null);
		setProgressEvent(null);
	}

	async function handleProcess() {
		if (files.length === 0) return;
		setStatus('processing');
		setRunError(null);
		setProgressEvent({ stage: 'reading', current: 0, total: files.length });

		try {
			const [Comlink, { getEngineWorker }, { resolveMeeshoProcessOptions }] = await Promise.all([
				import('comlink'),
				import('@/lib/engine/workerClient'),
				import('@/lib/platforms/meesho/resolveOptions'),
			]);
			const api = getEngineWorker();
			const options = resolveMeeshoProcessOptions(config);

			const { result: processResult, failures: fileFailures } = await api.processMeeshoFiles(
				files.map((f) => ({ name: f.name, bytes: f.bytes })),
				options,
				Comlink.proxy((event: ProgressEvent) => setProgressEvent(event)),
			);

			setResult(processResult);
			setFailures(fileFailures);
			setStatus('done');
		} catch (error) {
			setRunError(error instanceof Error ? error.message : 'Something went wrong while processing. Try a smaller batch.');
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
		setStage('configure');
		setPreviewStatus('empty');
	}

	if (!browserSupported) {
		return (
			<div className="mx-auto max-w-2xl rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-center">
				<AlertTriangleIcon className="mx-auto size-6 text-destructive" />
				<p className="mt-3 font-semibold">Your browser doesn't support the features this tool needs.</p>
				<p className="mt-1.5 text-sm text-muted-foreground">Try the latest Chrome, Edge, Firefox, or Safari.</p>
			</div>
		);
	}

	const view: 'done' | 'confirm' | 'configure' = status === 'done' && result ? 'done' : stage === 'confirm' ? 'confirm' : 'configure';

	return (
		<MotionConfig reducedMotion="user">
			<AnimatePresence mode="wait">
				{view === 'done' && result && (
					<motion.div key="done" {...STAGE_TRANSITION} className="mx-auto max-w-2xl">
						<ResultsPanel result={result} failures={failures} onReset={handleReset} />
					</motion.div>
				)}

				{view === 'confirm' && (
					<motion.div key="confirm" {...STAGE_TRANSITION}>
						<ConfirmStep
							fileCount={files.length}
							previewStatus={previewStatus}
							canvasRef={canvasRef}
							processing={status === 'processing'}
							progressEvent={progressEvent}
							runError={runError}
							onEdit={handleEdit}
							onConfirm={handleProcess}
						/>
					</motion.div>
				)}

				{view === 'configure' && (
					<motion.div key="configure" {...STAGE_TRANSITION} className="mx-auto max-w-5xl space-y-6">
						<div className="grid items-start gap-6 lg:grid-cols-[1.05fr_1fr]">
							<div className="space-y-4">
								<h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">1. Upload your PDFs</h2>
								<UploadDropzone files={files} onFilesAdded={handleFilesAdded} onRemove={handleRemove} />

								{totalBytes > LARGE_BATCH_BYTES && (
									<p className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-muted-foreground">
										<AlertTriangleIcon className="mt-0.5 size-4 shrink-0 text-amber-600" />
										This is a large batch — processing may take a little while and use noticeable memory. It'll still work, just be patient.
									</p>
								)}

								<div className="flex flex-col items-center gap-2.5 pt-2">
									<p className="text-sm text-muted-foreground">
										{files.length === 0
											? 'Add at least one PDF to continue.'
											: `${files.length} file${files.length === 1 ? '' : 's'} ready — ${formatSize(totalBytes)}`}
									</p>
									<Button
										type="button"
										size="lg"
										onClick={handlePreview}
										disabled={files.length === 0}
										className="w-full sm:w-auto sm:min-w-56"
									>
										Preview
									</Button>
								</div>
							</div>

							<div className="space-y-4 rounded-2xl border border-border bg-card p-5 sm:p-6">
								<div className="flex flex-wrap items-center justify-between gap-3">
									<h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">2. Choose your options</h2>
									<Tabs value={mode} onValueChange={(v) => setMode(v as 'simple' | 'advanced')}>
										<TabsList>
											<TabsTrigger value="simple">Simple</TabsTrigger>
											<TabsTrigger value="advanced">Advanced</TabsTrigger>
										</TabsList>
									</Tabs>
								</div>
								<OptionsForm fields={MEESHO_OPTIONS} config={config} mode={mode} onChange={handleOptionChange} />
							</div>
						</div>
					</motion.div>
				)}
			</AnimatePresence>
		</MotionConfig>
	);
}
