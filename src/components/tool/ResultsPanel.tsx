import { AlertTriangleIcon, ChevronDownIcon, DownloadIcon, FileTextIcon, ReceiptTextIcon, RotateCcwIcon, Share2Icon, SlidersHorizontalIcon, TruckIcon } from 'lucide-react';
import { motion } from 'motion/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cn } from 'cn';
import { buttonVariants } from '@/components/ui/button';
import { ghostAction } from './buttons';
import type { CourierPdf, FileFailure, ProcessResult } from '@/lib/engine/pipeline';

interface ResultsPanelProps {
	result: ProcessResult;
	failures: FileFailure[];
	/** Labels per output page for the layout that was used — turns the label count into a page/sheet count. */
	labelsPerPage: number;
	/** Chips describing the settings used, e.g. ["4 x 6\"", "Label only", "Sorted by SKU"]. */
	summary: string[];
	onEditOptions: () => void;
	onReset: () => void;
}

const EASE_OUT = [0.16, 1, 0.3, 1] as const;

/** Pick-list rows shown before "Show all" — enough for a typical batch without a long wall of rows. */
const PICK_LIST_PREVIEW = 8;

/** The PDF as a Blob plus an object URL for it. The share button wraps the same Blob in a File, so a tap
 * does no byte copying — on a big batch that copy could outlast the tap's user activation on a slow phone. */
function usePdfBlob(bytes: Uint8Array | null): { blob: Blob; url: string } | null {
	return useMemo(() => {
		if (!bytes) return null;
		const blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
		return { blob, url: URL.createObjectURL(blob) };
	}, [bytes]);
}

// dd-mm-yyyy (not dd/mm/yyyy — "/" isn't valid in a filename) so a seller's downloads folder sorts/groups
// by day across repeated runs, e.g. meesho-label-19-09-2026.pdf.
function dateStamp(): string {
	const now = new Date();
	const dd = String(now.getDate()).padStart(2, '0');
	const mm = String(now.getMonth() + 1).padStart(2, '0');
	return `${dd}-${mm}-${now.getFullYear()}`;
}

function triggerDownload(url: string, filename: string) {
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	a.remove();
}

type ShareStatus = 'idle' | 'sharing' | 'fellBack';

/** Web Share with files — on phones this hands the PDF straight to WhatsApp, Drive, or a printer app, which
 * is usually where a seller's labels are headed anyway. Only offered where the browser can share files at
 * all (most mobile browsers; hidden on desktop browsers that can't).
 *
 * Two things make a naive `navigator.share()` flaky on real phones:
 *  - A tap while a sheet is still open rejects with InvalidStateError, and on some Android builds a sheet
 *    dismissed with the back gesture never settles its promise — the browser then refuses every later share.
 *    So re-entry is guarded, and the guard is released when the page becomes visible again (the sheet is
 *    gone) or after a timeout, so it can never wedge the button for the session.
 *  - `canShare` only says the browser knows how to share files. In in-app browsers (Instagram, WhatsApp,
 *    Facebook) or a frame without the `web-share` permission it still says yes, and `share()` then rejects
 *    with NotAllowedError. So any failure other than the user cancelling falls back to the download. */
function useShareFile(pdf: { blob: Blob; url: string } | null, filename: string) {
	const [canShare, setCanShare] = useState(false);
	const [status, setStatus] = useState<ShareStatus>('idle');
	const inFlight = useRef(false);

	useEffect(() => {
		try {
			const probe = new File([new Uint8Array(1)], 'probe.pdf', { type: 'application/pdf' });
			setCanShare(typeof navigator.canShare === 'function' && navigator.canShare({ files: [probe] }));
		} catch {
			setCanShare(false);
		}
	}, []);

	useEffect(() => {
		if (status === 'fellBack') {
			const timer = window.setTimeout(() => setStatus('idle'), 6000);
			return () => window.clearTimeout(timer);
		}
		if (status !== 'sharing') return;
		const release = () => {
			inFlight.current = false;
			setStatus((s) => (s === 'sharing' ? 'idle' : s));
		};
		const timer = window.setTimeout(release, 30_000);
		const onVisible = () => {
			if (document.visibilityState === 'visible') window.setTimeout(release, 500);
		};
		document.addEventListener('visibilitychange', onVisible);
		return () => {
			window.clearTimeout(timer);
			document.removeEventListener('visibilitychange', onVisible);
		};
	}, [status]);

	const share = useCallback(() => {
		if (inFlight.current || !pdf) return;
		const fallBack = () => {
			triggerDownload(pdf.url, filename);
			setStatus('fellBack');
		};
		const file = new File([pdf.blob], filename, { type: 'application/pdf' });
		// Ask again with the real file: the mount-time probe only proves the browser can share *a* PDF.
		if (typeof navigator.canShare !== 'function' || !navigator.canShare({ files: [file] })) {
			fallBack();
			return;
		}
		inFlight.current = true;
		setStatus('sharing');
		// Files only — with `title`/`text` alongside, some targets (WhatsApp, Gmail) send the text and drop the PDF.
		navigator
			.share({ files: [file] })
			.then(() => setStatus('idle'))
			.catch((err: unknown) => {
				// AbortError is the user closing the sheet — nothing failed, so nothing to say.
				if (err instanceof Error && err.name === 'AbortError') setStatus('idle');
				else fallBack();
			})
			.finally(() => {
				inFlight.current = false;
			});
	}, [pdf, filename]);

	return { canShare, status, share };
}

/** Exported so the profit calculator's "all costed" moment celebrates the same way. */
export function SuccessMark({ className = 'size-20' }: { className?: string }) {
	return (
		<div className={cn('relative mx-auto flex items-center justify-center', className)}>
			{/* Two expanding rings behind the badge — a one-shot "done!" pulse, not a looping animation. */}
			{[0, 0.15].map((delay) => (
				<motion.span
					key={delay}
					className="absolute inset-0 rounded-full bg-success/25"
					initial={{ scale: 0.6, opacity: 0.8 }}
					animate={{ scale: 1.7, opacity: 0 }}
					transition={{ duration: 1.1, delay: 0.25 + delay, ease: 'easeOut' }}
				/>
			))}
			<motion.svg
				viewBox="0 0 52 52"
				className="relative size-full"
				initial={{ scale: 0.4, opacity: 0 }}
				animate={{ scale: 1, opacity: 1 }}
				transition={{ type: 'spring', stiffness: 260, damping: 18 }}
				aria-hidden="true"
			>
				<circle cx="26" cy="26" r="25" className="fill-success" />
				<motion.path
					d="M15 27 l7 7 l15 -16"
					fill="none"
					stroke="white"
					strokeWidth="4.5"
					strokeLinecap="round"
					strokeLinejoin="round"
					initial={{ pathLength: 0 }}
					animate={{ pathLength: 1 }}
					transition={{ duration: 0.45, delay: 0.25, ease: 'easeOut' }}
				/>
			</motion.svg>
		</div>
	);
}

/** "Ekart Logistics" → "ekart-logistics", for a filename that sorts next to the combined labels PDF. */
function slug(text: string): string {
	return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'courier';
}

/** One courier's labels: its own Blob/object URL, revoked when the row unmounts. */
function CourierRow({ pdf, stamp }: { pdf: CourierPdf; stamp: string }) {
	const blob = usePdfBlob(pdf.bytes);
	const url = blob?.url ?? null;
	useEffect(() => {
		return () => {
			if (url) URL.revokeObjectURL(url);
		};
	}, [url]);

	return (
		<li className="flex items-center gap-3 py-1.5 pr-1.5 pl-4 text-sm">
			<span className="min-w-0 flex-1 truncate font-medium">{pdf.courier}</span>
			<span className="shrink-0 rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold tabular-nums">
				{pdf.labelCount} {pdf.labelCount === 1 ? 'label' : 'labels'}
			</span>
			{url && (
				<a
					href={url}
					download={`meesho-label-${slug(pdf.courier)}-${stamp}.pdf`}
					aria-label={`Download ${pdf.courier} labels`}
					className="flex size-11 shrink-0 items-center justify-center rounded-xl text-primary transition-colors hover:bg-primary/[0.06]"
				>
					<DownloadIcon className="size-4" />
				</a>
			)}
		</li>
	);
}

const item = {
	hidden: { opacity: 0, y: 16 },
	show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE_OUT } },
};

export function ResultsPanel({ result, failures, labelsPerPage, summary, onEditOptions, onReset }: ResultsPanelProps) {
	const labelPdf = usePdfBlob(result.labelPdfBytes);
	const invoicePdf = usePdfBlob(result.invoicePdfBytes);
	const summaryPdf = usePdfBlob(result.summaryPdfBytes);
	const labelUrl = labelPdf?.url ?? null;
	const invoiceUrl = invoicePdf?.url ?? null;
	const summaryUrl = summaryPdf?.url ?? null;
	const stamp = useMemo(() => dateStamp(), []);

	useEffect(() => {
		return () => {
			for (const url of [labelUrl, invoiceUrl, summaryUrl]) {
				if (url) URL.revokeObjectURL(url);
			}
		};
	}, [labelUrl, invoiceUrl, summaryUrl]);

	const labelFile = `meesho-label-${stamp}.pdf`;
	const { canShare, status: shareStatus, share } = useShareFile(labelPdf, labelFile);
	const pages = Math.ceil(result.pageCount / Math.max(1, labelsPerPage));
	const totalUnits = result.summary.reduce((sum, row) => sum + row.count, 0);
	const [showAllSkus, setShowAllSkus] = useState(false);
	const stats = [
		{ label: result.pageCount === 1 ? 'Label' : 'Labels', value: result.pageCount },
		{ label: pages === 1 ? 'Page to print' : 'Pages to print', value: pages },
		{ label: result.summary.length === 1 ? 'SKU' : 'SKUs', value: result.summary.length },
	];

	return (
		<motion.div
			variants={{ show: { transition: { staggerChildren: 0.07, delayChildren: 0.15 } } }}
			initial="hidden"
			animate="show"
			className="space-y-5"
		>
			<motion.div variants={item} className="space-y-4 pt-2 text-center">
				<SuccessMark />
				<div>
					<h2 className="text-2xl font-bold tracking-tight">Your labels are ready</h2>
					{summary.length > 0 && <p className="mt-1.5 text-sm text-muted-foreground">{summary.join(' · ')}</p>}
				</div>
			</motion.div>

			<motion.div variants={item} className="grid grid-cols-3 gap-2.5">
				{stats.map((stat) => (
					<div key={stat.label} className="rounded-2xl bg-muted/60 px-2 py-3 text-center">
						<p className="text-2xl font-bold tabular-nums tracking-tight">{stat.value}</p>
						<p className="mt-0.5 text-xs text-muted-foreground">{stat.label}</p>
					</div>
				))}
			</motion.div>

			{result.duplicatesRemoved > 0 && (
				<motion.p variants={item} className="-mt-2 text-center text-xs text-muted-foreground">
					{result.duplicatesRemoved} duplicate {result.duplicatesRemoved === 1 ? 'label' : 'labels'} skipped
				</motion.p>
			)}

			<motion.div variants={item} className="space-y-2.5">
				<div className="flex gap-2.5">
					{labelUrl && (
						<motion.a
							href={labelUrl}
							download={labelFile}
							whileTap={{ scale: 0.97 }}
							className={cn(
								buttonVariants({ size: 'lg' }),
								'h-14 flex-1 gap-2 rounded-2xl text-base font-semibold shadow-lg shadow-primary/25',
							)}
						>
							<DownloadIcon className="size-5" />
							Download labels
						</motion.a>
					)}
					{canShare && (
						<motion.button
							type="button"
							whileTap={{ scale: 0.94 }}
							onClick={share}
							aria-label="Share labels PDF"
							aria-busy={shareStatus === 'sharing'}
							className={cn(
								buttonVariants({ variant: 'outline', size: 'lg' }),
								'size-14 rounded-2xl',
								shareStatus === 'sharing' && 'opacity-60',
							)}
						>
							<Share2Icon className="size-5" />
						</motion.button>
					)}
				</div>
				{shareStatus === 'fellBack' && (
					<p role="status" className="text-center text-xs text-muted-foreground">
						Sharing isn't available in this browser, so the PDF was downloaded instead.
					</p>
				)}

				<div className={cn('grid gap-2.5', invoiceUrl ? 'grid-cols-2' : 'grid-cols-1')}>
					{invoiceUrl && (
						<a
							href={invoiceUrl}
							download={`meesho-invoice-${stamp}.pdf`}
							className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'h-12 gap-2 rounded-2xl')}
						>
							<ReceiptTextIcon className="size-4" />
							Invoices
						</a>
					)}
					{summaryUrl && (
						<a
							href={summaryUrl}
							download={`meesho-summary-${stamp}.pdf`}
							className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'h-12 gap-2 rounded-2xl')}
						>
							<FileTextIcon className="size-4" />
							SKU summary PDF
						</a>
					)}
				</div>
			</motion.div>

			{result.courierPdfs.length > 0 && (
				<motion.div variants={item} className="overflow-hidden rounded-2xl border border-border bg-card">
					<div className="flex items-center justify-between border-b border-border px-4 py-3">
						<p className="flex items-center gap-2 text-sm font-semibold">
							<TruckIcon className="size-4 text-muted-foreground" />
							By courier
						</p>
						<p className="text-xs text-muted-foreground">{result.courierPdfs.length} separate PDFs</p>
					</div>
					<ul className="divide-y divide-border">
						{result.courierPdfs.map((pdf) => (
							<CourierRow key={pdf.courier} pdf={pdf} stamp={stamp} />
						))}
					</ul>
				</motion.div>
			)}

			{(result.warnings.length > 0 || failures.length > 0) && (
				<motion.details variants={item} className="group rounded-2xl border border-amber-500/30 bg-amber-500/5 text-sm">
					<summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-4 font-medium">
						<AlertTriangleIcon className="size-4 shrink-0 text-amber-600" />
						<span className="flex-1">
							{failures.length > 0
								? `${failures.length} file${failures.length === 1 ? '' : 's'} skipped`
								: `${result.warnings.length} label${result.warnings.length === 1 ? '' : 's'} need a quick check`}
						</span>
						<span className="text-xs text-muted-foreground group-open:hidden">Show</span>
						<span className="hidden text-xs text-muted-foreground group-open:inline">Hide</span>
					</summary>
					<div className="space-y-2 px-4 pb-4">
						{failures.map((failure) => (
							<p key={failure.fileName} className="text-destructive">
								<strong>{failure.fileName}</strong> was skipped: {failure.message}
							</p>
						))}
						{result.warnings.map((warning) => (
							<p key={warning} className="text-muted-foreground">
								{warning}
							</p>
						))}
					</div>
				</motion.details>
			)}

			{result.summary.length > 0 && (
				<motion.div variants={item} className="overflow-hidden rounded-2xl border border-border bg-card">
					<div className="flex items-center justify-between border-b border-border px-4 py-3">
						<p className="text-sm font-semibold">Pick list</p>
						<p className="text-xs text-muted-foreground">{totalUnits} items total</p>
					</div>
					{/* No inner scroll box: on phones a nested scroller traps the swipe at its end. Show the top SKUs
					    and let the list expand in place, so the page is the only thing that scrolls. */}
					<ul className="divide-y divide-border">
						{(showAllSkus ? result.summary : result.summary.slice(0, PICK_LIST_PREVIEW)).map((row) => (
							<li key={row.sku} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
								<span className="min-w-0 truncate font-medium">{row.sku}</span>
								<span className="shrink-0 rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold tabular-nums">
									× {row.count}
								</span>
							</li>
						))}
					</ul>
					{result.summary.length > PICK_LIST_PREVIEW && (
						<button
							type="button"
							onClick={() => setShowAllSkus((v) => !v)}
							aria-expanded={showAllSkus}
							className="flex w-full items-center justify-center gap-1.5 border-t border-border px-4 py-3 text-sm font-semibold text-primary transition-colors hover:bg-muted/50"
						>
							{showAllSkus ? 'Show less' : `Show all ${result.summary.length} SKUs`}
							<ChevronDownIcon className={cn('size-4 transition-transform duration-200', showAllSkus && 'rotate-180')} />
						</button>
					)}
				</motion.div>
			)}

			<motion.div variants={item} className="grid grid-cols-2 gap-2.5 pt-1">
				<button type="button" onClick={onEditOptions} className={ghostAction}>
					<SlidersHorizontalIcon className="size-4" />
					Change options
				</button>
				<button type="button" onClick={onReset} className={ghostAction}>
					<RotateCcwIcon className="size-4" />
					New batch
				</button>
			</motion.div>
		</motion.div>
	);
}
