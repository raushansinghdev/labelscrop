import { AlertTriangleIcon, ChevronDownIcon, DownloadIcon, FileTextIcon, ReceiptTextIcon, RotateCcwIcon, Share2Icon, SlidersHorizontalIcon } from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';
import { cn } from 'cn';
import { buttonVariants } from '@/components/ui/button';
import type { FileFailure, ProcessResult } from '@/lib/engine/pipeline';

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

function useObjectUrl(bytes: Uint8Array | null): string | null {
	return useMemo(() => {
		if (!bytes) return null;
		return URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: 'application/pdf' }));
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

/** Web Share with files — on phones this hands the PDF straight to WhatsApp, Drive, or a printer app, which
 * is usually where a seller's labels are headed anyway. Only offered where the browser can actually share
 * files (most mobile browsers; hidden on desktop browsers that can't). */
function useCanShareFiles(): boolean {
	const [canShare, setCanShare] = useState(false);
	useEffect(() => {
		try {
			const probe = new File([new Uint8Array(1)], 'probe.pdf', { type: 'application/pdf' });
			setCanShare(typeof navigator.canShare === 'function' && navigator.canShare({ files: [probe] }));
		} catch {
			setCanShare(false);
		}
	}, []);
	return canShare;
}

async function shareFile(bytes: Uint8Array, filename: string) {
	const file = new File([new Uint8Array(bytes)], filename, { type: 'application/pdf' });
	try {
		await navigator.share({ files: [file], title: filename });
	} catch {
		// User dismissed the share sheet, or sharing failed — the download button is still right there.
	}
}

function SuccessMark() {
	return (
		<div className="relative mx-auto flex size-20 items-center justify-center">
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
				className="relative size-20"
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

const item = {
	hidden: { opacity: 0, y: 16 },
	show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE_OUT } },
};

export function ResultsPanel({ result, failures, labelsPerPage, summary, onEditOptions, onReset }: ResultsPanelProps) {
	const labelUrl = useObjectUrl(result.labelPdfBytes);
	const invoiceUrl = useObjectUrl(result.invoicePdfBytes);
	const summaryUrl = useObjectUrl(result.summaryPdfBytes);
	const stamp = useMemo(() => dateStamp(), []);
	const canShare = useCanShareFiles();

	useEffect(() => {
		return () => {
			for (const url of [labelUrl, invoiceUrl, summaryUrl]) {
				if (url) URL.revokeObjectURL(url);
			}
		};
	}, [labelUrl, invoiceUrl, summaryUrl]);

	const labelFile = `meesho-label-${stamp}.pdf`;
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
							onClick={() => void shareFile(result.labelPdfBytes, labelFile)}
							aria-label="Share labels PDF"
							className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'size-14 rounded-2xl')}
						>
							<Share2Icon className="size-5" />
						</motion.button>
					)}
				</div>

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
				<button type="button" onClick={onEditOptions} className={cn(buttonVariants({ variant: 'ghost', size: 'lg' }), 'h-12 gap-2 rounded-2xl')}>
					<SlidersHorizontalIcon className="size-4" />
					Change options
				</button>
				<button type="button" onClick={onReset} className={cn(buttonVariants({ variant: 'ghost', size: 'lg' }), 'h-12 gap-2 rounded-2xl')}>
					<RotateCcwIcon className="size-4" />
					New batch
				</button>
			</motion.div>
		</motion.div>
	);
}
